import type { JSONContent } from "@tiptap/core";
import { renderEntries, RENDERERS } from "../content/render-contract";
import { insertRenderCache } from "./render-cache";

// Only Mermaid SVG images can be supplied by the editor. MathJax HTML is generated
// by the server, so a client cannot inject executable markup into the math cache.
export async function acceptRenderArtifacts(
  db: D1Database,
  body: JSONContent,
  raw: unknown,
  postId?: string,
): Promise<D1PreparedStatement[]> {
  if (raw == null) return [];
  const entries = (await renderEntries(body)).filter((entry) => entry.kind === "mermaid");
  const allowed = new Map(entries.map((entry) => [entry.source, entry]));
  if (typeof raw === "string" && raw.length > 5_000_000)
    throw new Error("図のキャッシュが大きすぎます");
  const values: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(values) || values.length > allowed.size)
    throw new Error("不正な図のキャッシュです");
  const statements: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  let size = 0;
  for (const value of values) {
    if (!value || typeof value !== "object") throw new Error("不正な図のキャッシュです");
    const { source, renderer, svg } = value;
    if (
      typeof source !== "string" ||
      !allowed.has(source) ||
      seen.has(source) ||
      renderer !== RENDERERS.mermaid ||
      typeof svg !== "string"
    )
      throw new Error("本文と図のキャッシュが一致しません");
    size += svg.length;
    if (
      svg.length > 1_000_000 ||
      size > 5_000_000 ||
      !/^\s*<svg\b[^>]*\bxmlns="http:\/\/www.w3.org\/2000\/svg"/i.test(svg) ||
      !svg.trimEnd().endsWith("</svg>") ||
      /<!DOCTYPE|<!ENTITY/i.test(svg)
    )
      throw new Error("SVG画像の形式またはサイズが不正です");
    statements.push(
      insertRenderCache(
        db,
        allowed.get(source)!,
        svg,
        postId ? { id: postId, body: JSON.stringify(body) } : undefined,
      ),
    );
    seen.add(source);
  }
  return statements;
}
