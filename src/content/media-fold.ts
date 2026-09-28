import type { JSONContent } from "@tiptap/core";
export const FOLD_POLICY = "media-fold-v1";
export interface MediaSize {
  width: number;
  height: number;
  heightEm?: number;
}
export interface MediaOccurrence {
  path: string;
  node: JSONContent;
  embed: boolean;
}
export function mediaOccurrences(body: JSONContent): MediaOccurrence[] {
  const out: MediaOccurrence[] = [];
  const visit = (node: JSONContent, path: string) => {
    if (
      node.type === "image" ||
      node.type === "figure" ||
      node.type === "inlineMath" ||
      node.type === "blockMath" ||
      (node.type === "codeBlock" && node.attrs?.language === "mermaid")
    )
      out.push({ path, node, embed: false });
    node.content?.forEach((n, i) => visit(n, path ? `${path}.${i}` : `${i}`));
  };
  visit(body, "");
  return out;
}
function advance(text: string): number {
  let n = 0;
  for (const c of text) {
    const x = c.codePointAt(0)!;
    n +=
      x === 0x200d || (x >= 0x300 && x <= 0x36f) || (x >= 0xfe00 && x <= 0xfe0f)
        ? 0
        : c === " "
          ? 0.25
          : x < 128
            ? 0.45
            : x >= 0x3000 && x <= 0x303f
              ? 0.3
              : x >= 0x3040 && x <= 0x9fff
                ? 0.8
                : 0.5;
  }
  return n;
}
/** Fixed arithmetic only. Unknown container heights are deliberately zero. */
export function classifyMedia(
  body: JSONContent,
  sizes: Map<string, MediaSize> = new Map(),
): MediaOccurrence[] {
  const out = mediaOccurrences(body);
  const byPath = new Map(out.map((o) => [o.path, o]));
  for (const font of [12, 16, 20])
    for (const width of new Set([
      320,
      360,
      390,
      430,
      504,
      505,
      600,
      601,
      640,
      672,
      768,
      1024,
      1440,
      3840,
      31.5 * font,
      31.5 * font + 1,
    ]))
      for (const height of [568, 960, 1440, 1920, 2160, 2560])
        for (const sv of [0.75, 1]) {
          const inset =
            width <= 600 ? 1.5 * font : Math.max(1.5 * font, Math.min(0.05 * width, 3 * font));
          const available = Math.max(1, Math.min(width, 48 * font) - 2 * inset);
          const content = width <= 600 ? available : Math.min(36 * font, available);
          let y = 0;
          const mark = (node: JSONContent, path: string) => {
            const o = byPath.get(path);
            if (o && y <= height + Math.max(3 * font, 0.1 * height)) o.embed = true;
            node.content?.forEach((n, i) => mark(n, `${path}.${i}`));
          };
          body.content?.forEach((node, i) => {
            const path = String(i);
            mark(node, path);
            const size = sizes.get(path);
            if (
              size &&
              (node.type === "figure" || node.type === "image" || node.type === "codeBlock")
            )
              y += Math.min(
                (Math.min(size.width, content) * size.height) / size.width,
                0.8 * height * sv,
              );
            else if (size && node.type === "blockMath") y += (size.heightEm ?? 0) * font;
            else if (
              (node.type === "paragraph" || node.type === "heading") &&
              !node.content?.some((n) => n.type === "image")
            ) {
              const text = (node.content ?? [])
                .map((n) =>
                  n.type === "text"
                    ? (n.text ?? "")
                    : n.type === "hardBreak" || n.type === "softBreak"
                      ? "\n"
                      : "",
                )
                .join("");
              const lines = text
                .split("\n")
                .reduce((n, t) => n + Math.max(1, Math.floor((advance(t) * font) / content)), 0);
              y += Math.max(0, (lines - 2) * 1.5 * font);
            }
          });
        }
  return out;
}
