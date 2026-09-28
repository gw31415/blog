import type { JSONContent } from "@tiptap/core";
import { renderEntries, type RenderEntry } from "../../content/render-contract";
import { prepareMermaidArtifacts } from "./mermaid-renderer";
import { validateLatex } from "./mathjax-renderer";
import { mathArtifactFromHTML } from "../../content/media-artifact";
type Artifact = RenderEntry & { svg?: string; mathml?: string };
const prepared = new Map<string, Artifact>();
export async function prepareMediaArtifacts(body: JSONContent) {
  const entries = await renderEntries(body);
  const result: Artifact[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const existing =
      entry.kind === "mermaid"
        ? [...document.querySelectorAll<HTMLElement>(".mermaid-diagram")].find(
            (e) => e.dataset.mermaidSource === entry.source,
          )
        : [...document.querySelectorAll<HTMLElement>(".tiptap-mathematics-render")].find(
            (e) =>
              e.dataset.latex === entry.source &&
              e.dataset.type === (entry.kind === "inlineMath" ? "inline-math" : "block-math"),
          );
    if (existing?.querySelector('img[data-variant-id]:not([data-variant-id=""])')) {
      result.push(entry);
      continue;
    }
    let artifact = prepared.get(entry.key);
    if (!artifact) {
      if (entry.kind === "mermaid") {
        const diagrams = await prepareMermaidArtifacts({
          type: "doc",
          content: [
            {
              type: "codeBlock",
              attrs: { language: "mermaid" },
              content: [{ type: "text", text: entry.source }],
            },
          ],
        });
        if (diagrams[0]) artifact = { ...entry, svg: diagrams[0].svg };
      } else {
        const math = validateLatex(entry.source, entry.kind === "blockMath");
        if (math.ok) artifact = { ...entry, ...mathArtifactFromHTML(math.html) };
      }
      if (artifact) {
        if (prepared.size >= 64) prepared.delete(prepared.keys().next().value!);
        prepared.set(entry.key, artifact);
      }
    }
    if (artifact) result.push(artifact);
  }
  return result;
}
