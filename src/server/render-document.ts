import type { JSONContent } from "@tiptap/core";
import type { RequestEventLoader } from "@qwik.dev/router";
import { renderEntries, type RenderEntry, type RenderResult } from "../content/render-contract";
import { validateLatex } from "../components/editor/mathjax-renderer";
import { mermaidImageHTML, MERMAID_ERROR } from "../components/editor/mermaid-contract";
import { resolveRenderCache } from "./render-cache";
import { generateMermaid } from "./render-mermaid";

export function generateMath(entry: RenderEntry): RenderResult {
  const result = validateLatex(entry.source, entry.kind === "blockMath");
  return result.ok
    ? { output: result.html, diagnostic: null }
    : { output: null, diagnostic: result.message };
}
export async function renderDocument(
  document: JSONContent,
  event: RequestEventLoader,
  postId?: string,
) {
  const entries = await renderEntries(document);
  const results = await resolveRenderCache(
    event.platform.env.DB,
    entries,
    async (missing) => {
      const diagrams = missing.filter((entry) => entry.kind === "mermaid");
      const generated = diagrams.length ? await generateMermaid(diagrams, event) : [];
      let diagramIndex = 0;
      return missing.map((entry) =>
        entry.kind === "mermaid" ? generated[diagramIndex++] : generateMath(entry),
      );
    },
    postId ? { id: postId, body: JSON.stringify(document) } : undefined,
  );
  const diagrams: string[] = [];
  const math: RenderResult[] = [];
  for (const entry of entries) {
    const result = results.get(entry.key)!;
    if (entry.kind === "mermaid")
      diagrams.push(result.output ? mermaidImageHTML(result.output) : MERMAID_ERROR);
    else math.push(result);
  }
  return { diagrams, math };
}
