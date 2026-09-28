import type { JSONContent } from "@tiptap/core";
import type { RequestEventLoader } from "@qwik.dev/router";
import { renderEntries, type RenderResult } from "../content/render-contract";
import { mediaOccurrences, FOLD_POLICY } from "../content/media-fold";
import { mediaImageHTML, type ArtifactLayout } from "../content/media-artifact";
import { readMedia, mediaHash } from "./media";
import { MERMAID_ERROR } from "../components/editor/mermaid-contract";
export async function renderDocument(
  document: JSONContent,
  event: RequestEventLoader,
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
  const bodies = new Map<string, Promise<string | null>>();
  const diagrams: string[] = [];
  const math: RenderResult[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i],
      row = map.get(entry.key);
    const ref = refMap.get(occurrences[i].path);
    const embed =
      !ref || ref.body_hash !== hash || ref.policy_version !== FOLD_POLICY || !!ref.embed_initial;
    let html: string | null = null;
    if (row) {
      let src = "/media/variants/" + row.id;
      if (embed) {
        if (!bodies.has(row.id))
          bodies.set(
            row.id,
            event.platform.env.IMAGES.get(row.object_key).then((o) => (o ? o.text() : null)),
          );
        const svg = await bodies.get(row.id)!;
        src = svg ? "data:image/svg+xml," + encodeURIComponent(svg) : "";
      }
      if (src)
        html = mediaImageHTML(
          entry.kind,
          src,
          row.width,
          row.height,
          JSON.parse(row.layout_json) as ArtifactLayout,
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
