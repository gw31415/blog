import type { JSONContent } from "@tiptap/core";
import type { MediaStore } from "./media";
import { renderEntries, type RenderResult } from "../content/render-contract";
import { mediaOccurrences, FOLD_POLICY } from "../content/media-fold";
import { mediaImageHTML, parseArtifactLayout } from "../content/media-artifact";
import { readMedia, mediaHash } from "./media";
import { MERMAID_ERROR } from "../components/editor/mermaid-contract";
export async function renderDocument(
  document: JSONContent,
  event: { platform: { env: { DB: D1Database; IMAGES: Pick<MediaStore, "get"> } } },
  postId?: string,
) {
  const entries = await renderEntries(document);
  const rows = await readMedia(
    event.platform.env.DB,
    entries.map((e) => e.key),
  );
  const map = new Map(rows.map((r) => [r.render_key, r]));
  const refs = postId
    ? (
        await event.platform.env.DB.prepare(
          "SELECT node_path,embed_initial,body_hash,policy_version FROM post_media_refs WHERE post_id=?",
        )
          .bind(postId)
          .all<{
            node_path: string;
            embed_initial: number;
            body_hash: string;
            policy_version: string;
          }>()
      ).results
    : [];
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
  // Bound concurrent R2 streams and never fetch below-fold SVG bodies.
  for (let i = 0; i < upper.length; i += 6)
    await Promise.all(
      upper.slice(i, i + 6).map(async (row) => {
        const object = await event.platform.env.IMAGES.get(row.object_key);
        bodies.set(row.id, object ? await object.text() : null);
      }),
    );
  const diagrams: string[] = [];
  const math: RenderResult[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i],
      row = map.get(entry.key);
    const embed = embeds[i];
    let html: string | null = null;
    if (row) {
      let src = "/media/variants/" + row.id;
      if (embed) {
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
  return { diagrams, math };
}
