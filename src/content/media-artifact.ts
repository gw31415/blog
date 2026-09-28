import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { RenderKind } from "./render-contract";
export interface ArtifactLayout {
  widthEm?: number;
  heightEm?: number;
  verticalAlignEm?: number;
  mathml?: string;
}
export interface SvgArtifact {
  svg: string;
  width: number;
  height: number;
  layout: ArtifactLayout;
}
export const escapeMedia = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const svgTags = new Set(
  "svg g defs path rect circle ellipse line polyline polygon text tspan textPath marker clipPath mask pattern linearGradient radialGradient stop use symbol title desc style foreignObject switch filter feGaussianBlur feOffset feFlood feComposite feMerge feMergeNode feColorMatrix feBlend feDropShadow feComponentTransfer feFuncR feFuncG feFuncB feFuncA".split(
    " ",
  ),
);
const htmlTags = new Set("div span p br b strong i em small sub sup ul ol li".split(" "));
const mathTags = new Set(
  "math semantics annotation mrow mi mn mo mtext mspace ms mfrac msqrt mroot mstyle merror mpadded mphantom mfenced menclose msub msup msubsup munder mover munderover mmultiscripts mprescripts none mtable mtr mtd mlabeledtr maction".split(
    " ",
  ),
);
function parseSafe(text: string, math = false) {
  if (/<!DOCTYPE|<!ENTITY|<\?/i.test(text)) throw new Error("SVG/MathMLの宣言は使用できません");
  const doc = new DOMParser({
    onError: () => {
      throw new Error("SVG/MathMLの構造が不正です");
    },
  }).parseFromString(text, "text/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== (math ? "math" : "svg")) throw new Error("不正な描画形式です");
  for (const el of Array.from(doc.getElementsByTagName("*"))) {
    const ns = el.namespaceURI;
    if (
      !(math
        ? mathTags.has(el.localName ?? "")
        : ns === "http://www.w3.org/1999/xhtml"
          ? htmlTags.has(el.localName ?? "")
          : svgTags.has(el.localName ?? ""))
    )
      throw new Error("許可されていない描画要素です: " + el.localName);
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      const value = a.value;
      if (
        name.startsWith("on") ||
        name === "xml:base" ||
        ["src", "srcdoc", "action", "formaction"].includes(name) ||
        ((name === "href" || name === "xlink:href") && !value.startsWith("#"))
      )
        throw new Error("外部参照は使用できません");
      if (name === "style" && /\\|@import|expression\s*\(|url\s*\(\s*["']?[^#\s]/i.test(value))
        throw new Error("不正な描画スタイルです");
      if (
        /url\s*\(/i.test(value) &&
        !/^url\(\s*["']?#[\w:.-]+["']?\s*\)$/i.test(value) &&
        name !== "style"
      )
        throw new Error("外部参照は使用できません");
    }
    if (
      el.localName === "style" &&
      /\\|@import|expression\s*\(|url\s*\(\s*["']?[^#\s]/i.test(el.textContent ?? "")
    )
      throw new Error("外部スタイルは使用できません");
  }
  return root;
}
export function parseSvgArtifact(
  svg: string,
  kind: RenderKind,
  mathml = "",
  metrics?: ArtifactLayout,
): SvgArtifact {
  if (new TextEncoder().encode(svg).length > 1_000_000)
    throw new Error("SVGは1MB以内にしてください");
  const root = parseSafe(svg);
  const box = root.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
  const width = box?.[2] ?? 0,
    height = box?.[3] ?? 0;
  if (![width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("SVG寸法が不正です");
  const layout: ArtifactLayout = {};
  if (kind !== "mermaid") {
    const em = (s: string | null) => {
      const m = /^(-?[\d.]+)ex$/.exec(s ?? "");
      return m ? Number(m[1]) * 0.5 : NaN;
    };
    layout.widthEm = metrics?.widthEm ?? em(root.getAttribute("width"));
    layout.heightEm = metrics?.heightEm ?? em(root.getAttribute("height"));
    layout.verticalAlignEm =
      metrics?.verticalAlignEm ??
      em(/vertical-align:\s*([^;]+)/.exec(root.getAttribute("style") ?? "")?.[1] ?? "0ex");
    if (
      ![layout.widthEm, layout.heightEm].every((n) => Number.isFinite(n) && Number(n) > 0) ||
      !Number.isFinite(layout.verticalAlignEm)
    )
      throw new Error("数式寸法が不正です");
    root.setAttribute("style", (root.getAttribute("style") ?? "") + ";color:#45392f");
    layout.mathml = new XMLSerializer().serializeToString(parseSafe(mathml, true));
  }
  return { svg: new XMLSerializer().serializeToString(root), width, height, layout };
}
export function mathArtifactFromHTML(html: string): { svg: string; mathml: string } {
  const svg = html.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  const mathml = html.match(/<math\b[\s\S]*?<\/math>/)?.[0];
  if (!svg || !mathml) throw new Error("数式の描画結果が不完全です");
  return { svg, mathml };
}
export function mediaImageHTML(
  kind: RenderKind,
  src: string,
  width: number,
  height: number,
  layout: ArtifactLayout = {},
  id = "",
  eager = false,
): string {
  const source = escapeMedia(src),
    identity = escapeMedia(id);
  const loading = eager ? "eager" : "lazy";
  if (kind === "mermaid")
    return `<img class="mermaid-image" data-article-image data-image-state="pending" data-variant-id="${identity}" alt="Mermaid図" width="${width}" height="${height}" style="width:${width / 16}em;height:auto;aspect-ratio:${width} / ${height};--article-image-ratio:${width} / ${height}" src="${source}" loading="${loading}" decoding="async">`;
  return `<mjx-container class="MathJax" jax="SVG"${kind === "blockMath" ? ' display="true"' : ""}><img class="math-image" data-image-state="pending" data-math-image data-variant-id="${identity}" alt="" aria-hidden="true" width="${width}" height="${height}" style="width:${(layout.widthEm ?? 0) * 2}ex;height:${(layout.heightEm ?? 0) * 2}ex;vertical-align:${(layout.verticalAlignEm ?? 0) * 2}ex" src="${source}" loading="${loading}" decoding="async"><mjx-assistive-mml>${layout.mathml ?? ""}</mjx-assistive-mml></mjx-container>`;
}
