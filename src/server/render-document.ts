import type { JSONContent } from "@tiptap/core";
import type { MediaStore } from "./media";
import { renderEntries, type RenderResult } from "../content/render-contract";
import { mediaOccurrences, FOLD_POLICY } from "../content/media-fold";
import { mediaImageHTML, parseArtifactLayout } from "../content/media-artifact";
import { readMedia, readMediaStatement, mediaHash, type MediaRow } from "./media";
import { MERMAID_ERROR } from "../components/editor/mermaid-contract";
interface MediaRef {
  node_path: string;
  embed_initial: number;
  body_hash: string;
  policy_version: string;
}
/** Stored size and fold result of every media variant the post references. */
export interface RasterSize {
  id: string;
  width: number;
  height: number;
  upper: number;
}
/** UTF-8 bytes of SVG that one page may carry inline as data URLs. */
export const EMBED_BUDGET = 32 * 1024;
export async function renderDocument(
  document: JSONContent,
  event: { platform: { env: { DB: D1Database; IMAGES: Pick<MediaStore, "get"> } } },
  postId?: string,
  draft = false,
) {
  const entries = await renderEntries(document);
  const db = event.platform.env.DB;
  const keys = entries.map((e) => e.key);
  let rows: MediaRow[];
  let refs: MediaRef[] = [];
  let images: RasterSize[] = [];
  if (postId) {
    // One D1 round trip for everything the article needs besides the post itself.
    const table = draft ? "post_draft_media_refs" : "post_media_refs";
    const [media, references, rasters] = await db.batch([
      readMediaStatement(db, keys),
      db
        .prepare(
          `SELECT node_path,embed_initial,body_hash,policy_version FROM ${table} WHERE post_id=?`,
        )
        .bind(postId),
      db
        .prepare(
          `SELECT v.id, v.width, v.height, MAX(p.embed_initial) AS upper FROM media_variants v JOIN ${table} p ON p.variant_id=v.id WHERE p.post_id=? GROUP BY v.id`,
        )
        .bind(postId),
    ]);
    // D1 batch results are untyped rows of the statements above, in order.
    /* eslint-disable typescript/no-unsafe-type-assertion */
    rows = media.results as MediaRow[];
    refs = references.results as MediaRef[];
    images = rasters.results as RasterSize[];
    /* eslint-enable typescript/no-unsafe-type-assertion */
  } else rows = await readMedia(db, keys);
  const map = new Map(rows.map((r) => [r.render_key, r]));
  const hash = await mediaHash(JSON.stringify(document));
  const refMap = new Map(refs.map((r) => [r.node_path, r]));
  const occurrences = mediaOccurrences(document).filter(
    (o) => o.node.type !== "image" && o.node.type !== "figure",
  );
  const embeds = occurrences.map((o) => {
    const ref = refMap.get(o.path);
    return (
      !ref || ref.body_hash !== hash || ref.policy_version !== FOLD_POLICY || !!ref.embed_initial
    );
  });
  const upper = [
    ...new Map(
      entries.flatMap((e, i) => {
        const row = map.get(e.key);
        return embeds[i] && row ? [[row.id, row] as const] : [];
      }),
    ).values(),
  ];
  const bodies = new Map<string, string | null>();
  // Variants past the budget keep their eager loading but come from their own
  // immutable URL: large diagrams would otherwise be resent with every page view.
  const external = new Set<string>();
  let budget = EMBED_BUDGET;
  // Bound concurrent R2 streams and never fetch below-fold SVG bodies.
  for (let i = 0; i < upper.length; i += 6) {
    const batch = upper.slice(i, i + 6);
    const objects = await Promise.all(
      batch.map((row) => event.platform.env.IMAGES.get(row.object_key)),
    );
    await Promise.all(
      batch.map(async (row, index) => {
        const object = objects[index];
        if (object && (object.size ?? 0) > budget) {
          external.add(row.id);
          await object.body?.cancel();
          return;
        }
        budget -= object?.size ?? 0;
        bodies.set(row.id, object ? await object.text() : null);
      }),
    );
  }
  const diagrams: string[] = [];
  const math: RenderResult[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i],
      row = map.get(entry.key);
    const embed = embeds[i];
    let html: string | null = null;
    if (row) {
      let src = "/media/variants/" + row.id;
      if (embed && !external.has(row.id)) {
        const svg = bodies.get(row.id);
        src = svg ? "data:image/svg+xml," + encodeURIComponent(svg) : "";
      }
      if (src)
        html = mediaImageHTML(
          entry.kind,
          src,
          row.width,
          row.height,
          parseArtifactLayout(row.layout_json),
          row.id,
          embed,
        );
    }
    if (entry.kind === "mermaid") diagrams.push(html ?? MERMAID_ERROR);
    else
      math.push({
        output: html,
        diagnostic: html ? null : "数式を編集画面で確認して保存してください",
      });
  }
  return { diagrams, math, images };
}
