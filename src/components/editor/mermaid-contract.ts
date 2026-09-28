import { mediaImageHTML } from "../../content/media-artifact";
import type { JSONContent } from "@tiptap/core";

import { RENDERERS, renderInputs } from "../../content/render-contract";
export const MERMAID_RENDERER = RENDERERS.mermaid;
export { MERMAID_CONFIG } from "./mermaid-theme";
export const MERMAID_ERROR = '<p role="alert">Mermaidの描画を確認してください。</p>';
export interface MermaidArtifact {
  source: string;
  renderer: string;
  svg: string;
}
export function mermaidSources(document: JSONContent): string[] {
  return renderInputs(document)
    .filter((input) => input.kind === "mermaid")
    .map((input) => input.source);
}
// SVG is an image document, never executable HTML supplied by a client.
export function mermaidImageHTML(svg: string): string {
  const tag = /^\s*<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!tag || !svg.trimEnd().endsWith("</svg>")) return MERMAID_ERROR;
  const box = /\bviewBox="([^"]+)"/.exec(tag)?.[1].trim().split(/[ ,]+/).map(Number);
  const width = box?.[2],
    height = box?.[3];
  return width && height
    ? mediaImageHTML(
        "mermaid",
        "data:image/svg+xml," + encodeURIComponent(svg),
        width,
        height,
        {},
        "",
        true,
      )
    : MERMAID_ERROR;
}
