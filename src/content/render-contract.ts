import type { JSONContent } from "@tiptap/core";
export const RENDERERS = {
  mermaid: "mermaid@12.0.0:strict:paper:v2",
  inlineMath: "mathjax@4.1.3:tex-font@4.1.3:safe:packages-v1:inline",
  blockMath: "mathjax@4.1.3:tex-font@4.1.3:safe:packages-v1:block",
} as const;
export type RenderKind = keyof typeof RENDERERS;
export interface RenderInput {
  kind: RenderKind;
  source: string;
  renderer: string;
}
export interface RenderEntry extends RenderInput {
  key: string;
}
export interface RenderResult {
  output: string | null;
  diagnostic: string | null;
}
export function renderInputs(document: JSONContent): RenderInput[] {
  const result: RenderInput[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === "codeBlock" && node.attrs?.language === "mermaid")
      result.push({
        kind: "mermaid",
        renderer: RENDERERS.mermaid,
        source: (node.content ?? []).map((n) => n.text ?? "").join(""),
      });
    if (node.type === "inlineMath" || node.type === "blockMath")
      result.push({
        kind: node.type,
        renderer: RENDERERS[node.type],
        source: String(node.attrs?.latex ?? ""),
      });
    node.content?.forEach(visit);
  };
  visit(document);
  return result;
}
export async function renderKey(input: RenderInput): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([input.kind, input.renderer, input.source])),
  );
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function renderEntries(document: JSONContent): Promise<RenderEntry[]> {
  return Promise.all(
    renderInputs(document).map(async (input) => ({ ...input, key: await renderKey(input) })),
  );
}
