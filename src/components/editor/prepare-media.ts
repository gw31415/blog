import type { JSONContent } from "@tiptap/core";
import { renderEntries } from "../../content/render-contract";
import { prepareMermaidArtifacts } from "./mermaid-renderer";
import { validateLatex } from "./mathjax-renderer";
import { mathArtifactFromHTML } from "../../content/media-artifact";
export async function prepareMediaArtifacts(body: JSONContent) {
  const diagrams = await prepareMermaidArtifacts(body);
  const entries = await renderEntries(body);
  const result = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    if (entry.kind === "mermaid") {
      const diagram = diagrams.find((d) => d.source === entry.source);
      if (diagram) result.push({ ...entry, svg: diagram.svg });
    } else {
      const math = validateLatex(entry.source, entry.kind === "blockMath");
      if (math.ok) result.push({ ...entry, ...mathArtifactFromHTML(math.html) });
    }
  }
  return result;
}
