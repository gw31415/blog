/**
 * ブログ記事向けの MathJax / highlight.js サーバープリレンダー。
 *
 * mathjax-full (~40MB) は Cloudflare Workers のバンドル制限に収まらないため、
 * ランタイム (`src/`) からは import せず、ここでのみ使って HTML 文字列化する。
 * 生成物は `src/components/blog/rendered.ts` に書き出し、記事コンポーネントは
 * その文字列を `dangerouslySetInnerHTML` で埋め込むだけにする。
 * → SSR/SSG 済み HTML には組版済みの数式・ハイライトが含まれ、CDN スクリプトは不要。
 *
 * 新しい記事を追加したらこのスクリプトに TeX / コードを追記して再実行する:
 *   pnpm prerender:blog
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import hljs from "highlight.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "components", "blog", "rendered.ts");

// ── MathJax 初期化 (TeX 入力 → SVG 出力。SVG はフォント不要で自己完結) ──
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
// fontCache: "local" で各数式を自己完結させ、ID 衝突を避ける。
const svg = new SVG({ fontCache: "local" });
const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });

function renderTex(source, display) {
  const node = doc.convert(source, { display });
  return adaptor.outerHTML(node);
}

// ── 記事「秋の気配」の TeX ──
const MATH = {
  inlineF: renderTex("f=15\\,\\mathrm{px}", false),
  inlineLambda: renderTex("\\lambda=1.3", false),
  inlineLineHeight: renderTex("L=f\\lambda=19.5\\,\\mathrm{px}", false),
  inlineNormal: renderTex("X\\sim\\mathcal N(\\mu,\\sigma^2)", false),
  blockLineHeight: renderTex(
    "\\begin{aligned} L &= f\\lambda \\\\[3pt] &= 15\\,\\mathrm{px} \\times 1.3 \\\\[3pt] &= 19.5\\,\\mathrm{px}, \\\\[8pt] g &= \\frac{L}{2} \\\\[3pt] &= 9.75\\,\\mathrm{px}. \\end{aligned}",
    true,
  ),
  blockNormal: renderTex(
    "p(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} \\exp\\!\\left( -\\frac{(x-\\mu)^2}{2\\sigma^2} \\right)",
    true,
  ),
};

// ── 記事「秋の気配」のコード (highlight.js で SSR) ──
function renderCode(source, language) {
  return hljs.highlight(source, { language }).value;
}

const CODE = {
  htmlDiary: renderCode(
    [
      "<!-- 一日の記録 -->",
      '<article class="diary">',
      '  <time datetime="2026-09-17">',
      "    九月十七日",
      "  </time>",
      "",
      '  <p data-season="autumn">',
      "    朝の風が少し乾いていた。",
      "  </p>",
      "</article>",
    ].join("\n"),
    "xml",
  ),
  cssBody: renderCode(
    [
      "article {",
      "  font-family:",
      '    "Times New Roman",',
      '    "Yu Mincho",',
      "    serif;",
      "",
      "  font-size: 15px;",
      "  line-height: 1.3;",
      "",
      "  font-feature-settings:",
      '    "palt" 1,',
      '    "kern" 1;',
      "",
      "  text-autospace: normal;",
      "  line-break: strict;",
      "",
      "  text-align: justify;",
      "  text-align-last: start;",
      "}",
    ].join("\n"),
    "css",
  ),
};

const header = `/**
 * 自動生成ファイル。直接編集しないこと。
 * 生成元: scripts/prerender-blog.mjs (\`pnpm prerender:blog\` で再生成)
 *
 * MathJax (TeX → SVG) と highlight.js の SSR 済み HTML 文字列。
 * ランタイムは mathjax-full / highlight.js に依存せず、この文字列を
 * dangerouslySetInnerHTML で埋め込むだけ (Workers バンドル肥大化の回避)。
 */
`;

const body =
  `export const MATH_HTML = ${JSON.stringify(MATH, null, 2)} as const;\n\n` +
  `export const CODE_HTML = ${JSON.stringify(CODE, null, 2)} as const;\n`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, header + body);
console.log(`wrote ${outPath}`);
console.log(
  `math bytes: ${Object.values(MATH)
    .map((s) => s.length)
    .join(", ")} / code bytes: ${Object.values(CODE)
    .map((s) => s.length)
    .join(", ")}`,
);
