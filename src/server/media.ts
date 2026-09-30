import { normalizeDocument } from "../content/document";
import type { JSONContent } from "@tiptap/core";
import { renderEntries, type RenderKind } from "../content/render-contract";
import {
  classifyMedia,
  FOLD_POLICY,
  mediaOccurrences,
  type MediaSize,
} from "../content/media-fold";
import { parseSvgArtifact, parseArtifactLayout } from "../content/media-artifact";
export interface MediaStore {
  put(
    key: string,
    value: Blob,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete(key: string): Promise<void>;
}
export interface MediaRow {
  id: string;
  kind: RenderKind | "raster";
  render_key: string | null;
  object_key: string;
  width: number;
  height: number;
  layout_json: string;
  state: string;
  original_id: string | null;
}
export const mediaHash = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export async function readMedia(db: D1Database, keys: string[]): Promise<MediaRow[]> {
  if (!keys.length) return [];
  return (
    await db
      .prepare(
        "SELECT * FROM media_variants WHERE state='ready' AND (render_key IN (SELECT value FROM json_each(?)) OR id IN (SELECT value FROM json_each(?)))",
      )
      .bind(JSON.stringify(keys), JSON.stringify(keys))
      .all<MediaRow>()
  ).results;
}
export function imageVariantId(node: JSONContent): string | null {
  const src = String(node.attrs?.src ?? "");
  return (
    /^(?:https?:\/\/[^/]+)?\/(?:images\/variants|media\/variants)\/([^/?#]+)$/.exec(src)?.[1] ??
    null
  );
}
export async function acceptMedia(
  db: D1Database,
  objects: MediaStore,
  postId: string,
  body: JSONContent,
  raw: unknown,
) {
  const entries = await renderEntries(body);
  const allowed = new Map(entries.map((e) => [e.key, e]));
  const existing = await readMedia(db, [...allowed.keys()]);
  const rows = new Map(existing.map((v) => [v.render_key!, v]));
  const values: unknown = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
  if (!Array.isArray(values) || values.length > allowed.size)
    throw new Error("描画データが不正です");
  let bytes = 0;
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || typeof value.key !== "string")
      throw new Error("描画データが不正です");
    const entry = allowed.get(value.key);
    if (!entry || seen.has(entry.key) || value.renderer !== entry.renderer)
      throw new Error("本文と描画が一致しません");
    seen.add(entry.key);
    if (rows.has(entry.key)) continue;
    if (typeof value.svg !== "string")
      throw new Error("描画データが不足しています。再生成して保存してください");
    bytes += new TextEncoder().encode(value.svg).length;
    if (bytes > 5_000_000) throw new Error("描画データは5MB以内にしてください");
    const artifact = parseSvgArtifact(
      value.svg,
      entry.kind,
      typeof value.mathml === "string" ? value.mathml : "",
    );
    const id = crypto.randomUUID() + ".svg",
      key = "media/variants/" + id;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        "INSERT INTO media_variants(id,kind,render_key,recipe,object_key,content_hash,mime,width,height,layout_json,state,created_at,unreferenced_at,upload_expires_at) VALUES(?,?,?,?,?,?,'image/svg+xml',?,?,?,'uploading',?,?,?)",
      )
      .bind(
        id,
        entry.kind,
        entry.key,
        entry.renderer,
        key,
        await mediaHash(artifact.svg),
        artifact.width,
        artifact.height,
        JSON.stringify(artifact.layout),
        now,
        now,
        now + 3600,
      )
      .run();
    try {
      await objects.put(key, new Blob([artifact.svg]), {
        httpMetadata: { contentType: "image/svg+xml" },
      });
      await db
        .prepare("UPDATE media_variants SET state='ready' WHERE id=? AND state='uploading'")
        .bind(id)
        .run();
    } catch (error) {
      await discardUpload(db, objects, id);
      const concurrent = await readMedia(db, [entry.key]);
      if (!concurrent.length) throw error;
    }
    const saved = (await readMedia(db, [entry.key]))[0];
    if (!saved) {
      await objects.delete(key);
      throw new Error("描画保存を再試行してください");
    }
    rows.set(entry.key, saved);
  }
  // Acquire one bounded lease per save and artifact, including reuse.
  const lease = crypto.randomUUID();
  if (rows.size)
    await db.batch(
      [...rows.values()].map((v) =>
        db
          .prepare("INSERT INTO media_upload_leases VALUES(?,?,?,?)")
          .bind(lease + ":" + v.id, v.id, postId, Math.floor(Date.now() / 1000) + 3600),
      ),
    );
  return { lease, rows };
}
export async function mediaReferenceStatements(
  db: D1Database,
  postId: string,
  body: JSONContent,
  version: string,
  lease = "",
  published = false,
  revision: "draft" | "published" = "published",
  saveToken?: string,
) {
  const normalized = normalizeDocument(body);
  const occurrences = mediaOccurrences(normalized);
  const entries = await renderEntries(body);
  let index = 0;
  const keys = occurrences.map((o) =>
    o.node.type === "image" || o.node.type === "figure"
      ? imageVariantId(o.node)
      : (entries[index++]?.key ?? null),
  );
  const rows = await readMedia(
    db,
    keys.filter((k): k is string => !!k),
  );
  const byKey = new Map(
    rows.flatMap((r) => [
      [r.id, r] as const,
      ...(r.render_key ? [[r.render_key, r] as const] : []),
    ]),
  );
  const sizes = new Map<string, MediaSize>();
  occurrences.forEach((o, i) => {
    const v = byKey.get(keys[i] ?? "");
    if (v)
      sizes.set(o.path, {
        width: v.width,
        height: v.height,
        heightEm: parseArtifactLayout(v.layout_json).heightEm,
      });
  });
  const classified = classifyMedia(normalized, sizes);
  const hash = await mediaHash(JSON.stringify(normalized));
  const payload = classified
    .map((o, i) => {
      const key = keys[i];
      const v = key ? byKey.get(key) : undefined;
      const svg = o.node.type !== "image" && o.node.type !== "figure";
      if (published && key && !v)
        throw new Error("公開前に画像・数式・Mermaidの描画を保存してください");
      return {
        path: o.path,
        id: v?.id ?? null,
        key: svg ? key : null,
        embed: o.embed ? 1 : 0,
        diagnostic: svg && !v ? "描画を確認して保存してください" : null,
      };
    })
    .filter((r, i) => r.key || keys[i]);
  const table = revision === "draft" ? "post_draft_media_refs" : "post_media_refs";
  const source = revision === "draft" ? "post_drafts" : "posts";
  const guard = `EXISTS(SELECT 1 FROM ${source} WHERE id=? AND updated_at=? AND body_json=?)${saveToken ? " AND EXISTS(SELECT 1 FROM post_drafts WHERE id=? AND save_token=?)" : ""}`;
  const args = [postId, version, JSON.stringify(body), ...(saveToken ? [postId, saveToken] : [])];
  return [
    db.prepare(`DELETE FROM ${table} WHERE post_id=? AND ${guard}`).bind(postId, ...args),
    db
      .prepare(
        `INSERT INTO ${table}(post_id,node_path,body_hash,variant_id,render_key,embed_initial,policy_version,diagnostic) SELECT ?,json_extract(value,'$.path'),?,json_extract(value,'$.id'),json_extract(value,'$.key'),json_extract(value,'$.embed'),?,json_extract(value,'$.diagnostic') FROM json_each(?) WHERE ${guard}`,
      )
      .bind(postId, hash, FOLD_POLICY, JSON.stringify(payload), ...args),
    db
      .prepare(
        `INSERT INTO image_article_history SELECT DISTINCT v.original_id,p.id,p.title,unixepoch(),unixepoch(),NULL FROM posts p JOIN all_post_media_refs r ON r.post_id=p.id JOIN media_variants v ON v.id=r.variant_id WHERE p.id=? AND v.original_id IS NOT NULL AND ${guard} ON CONFLICT(original_id,post_id_snapshot) DO UPDATE SET post_title_snapshot=excluded.post_title_snapshot,last_linked_at=excluded.last_linked_at,last_unlinked_at=NULL`,
      )
      .bind(postId, ...args),
    db
      .prepare(
        `UPDATE image_article_history SET last_unlinked_at=unixepoch() WHERE post_id_snapshot=? AND last_unlinked_at IS NULL AND ${guard} AND NOT EXISTS(SELECT 1 FROM all_post_media_refs r JOIN media_variants v ON v.id=r.variant_id WHERE r.post_id=? AND v.original_id=image_article_history.original_id)`,
      )
      .bind(postId, ...args, postId),
    db
      .prepare(`DELETE FROM media_upload_leases WHERE post_id=? AND token LIKE ? AND ${guard}`)
      .bind(postId, lease + ":%", ...args),
  ];
}
export async function collectMedia(db: D1Database, objects: Pick<MediaStore, "delete">) {
  await db.prepare("DELETE FROM media_upload_leases WHERE expires_at<=unixepoch()").run();
  await db
    .prepare(
      "UPDATE media_variants SET unreferenced_at=unixepoch() WHERE state='ready' AND unreferenced_at IS NULL AND NOT EXISTS(SELECT 1 FROM all_post_media_refs WHERE variant_id=media_variants.id) AND NOT EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=media_variants.id)",
    )
    .run();
  const claimed = await db
    .prepare(
      "UPDATE media_variants SET state='deleting' WHERE id IN (SELECT id FROM media_variants WHERE (state='deleting' OR (state='uploading' AND upload_expires_at<unixepoch()) OR (state='ready' AND unreferenced_at<unixepoch()-86400)) AND NOT EXISTS(SELECT 1 FROM all_post_media_refs WHERE variant_id=media_variants.id) AND NOT EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=media_variants.id) LIMIT 50) RETURNING id,object_key",
    )
    .all<{ id: string; object_key: string }>();
  let removed = 0;
  for (const row of claimed.results) {
    try {
      await objects.delete(row.object_key);
      await db
        .prepare("DELETE FROM media_variants WHERE id=? AND state='deleting'")
        .bind(row.id)
        .run();
      removed++;
    } catch (error) {
      console.error("Media cleanup failed", row.id, error);
    }
  }
  return removed;
}

/** Claim before deleting: a lost DB response may already have committed a shared object. */
export async function discardUpload(
  db: D1Database,
  objects: Pick<MediaStore, "delete">,
  id: string,
) {
  const row = await db
    .prepare(
      "UPDATE media_variants SET state='deleting' WHERE id=? AND NOT EXISTS(SELECT 1 FROM all_post_media_refs WHERE variant_id=?) AND NOT EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=? AND expires_at>unixepoch()) RETURNING object_key",
    )
    .bind(id, id, id)
    .first<{ object_key: string }>();
  if (row) {
    try {
      await objects.delete(row.object_key);
      await db.prepare("DELETE FROM media_variants WHERE id=? AND state='deleting'").bind(id).run();
    } catch (error) {
      console.error("Upload cleanup pending", id, error);
    }
  }
}
