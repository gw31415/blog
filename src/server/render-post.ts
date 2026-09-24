import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

import { codeBlockDOMSpec } from "~/components/editor/code-block-view";
import { articleSurface, mermaidFigureDOMSpec } from "~/components/editor/article-surface-contract";
import { createEditorExtensions } from "~/components/editor/editor-extensions";
import { highlightCode } from "~/components/editor/editor-syntax-highlighting";
import { normalizeDocument } from "~/content/document";
import { validateLatex } from "~/components/editor/mathjax-renderer";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderDOMSpec(spec: unknown, holeContent: string): string {
  if (spec === 0) return holeContent;
  if (typeof spec === "string") return escapeHtml(spec);
  if (!Array.isArray(spec)) return "";
  const [tag, attributesOrChild, ...remainingChildren] = spec;
  const hasAttributes =
    attributesOrChild && typeof attributesOrChild === "object" && !Array.isArray(attributesOrChild);
  const attributes = hasAttributes ? Object.fromEntries(Object.entries(attributesOrChild)) : {};
  const children = hasAttributes ? remainingChildren : [attributesOrChild, ...remainingChildren];
  const serializedAttributes = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join("");
  return `<${tag}${serializedAttributes}>${children
    .filter((child) => child !== undefined)
    .map((child) => renderDOMSpec(child, holeContent))
    .join("")}</${tag}>`;
}

export function renderPost(
  document: unknown,
  diagrams: string[] = [],
  math: import("../content/render-contract").RenderResult[] = [],
) {
  const content = normalizeDocument(document);
  let diagramIndex = 0;
  let mathIndex = 0;
  const body = renderToHTMLString({
    content,
    extensions: createEditorExtensions(),
    options: {
      nodeMapping: {
        inlineMath: ({ node }) => mathHtml(node, false, math[mathIndex], mathIndex++),
        blockMath: ({ node }) => mathHtml(node, true, math[mathIndex], mathIndex++),
        codeBlock: ({ node }) => {
          const language = typeof node.attrs.language === "string" ? node.attrs.language : "";
          if (language === "mermaid") {
            const diagram =
              diagrams[diagramIndex++] ?? '<p role="alert">Mermaidの描画を確認してください。</p>';
            return renderDOMSpec(mermaidFigureDOMSpec(node.textContent), diagram);
          }
          const highlighted = highlightCode(language, node.textContent)
            .map(({ classes, text }) =>
              classes.length
                ? `<span class="${classes.join(" ")}">${escapeHtml(text)}</span>`
                : escapeHtml(text),
            )
            .join("");
          return renderDOMSpec(codeBlockDOMSpec(language), highlighted);
        },
      },
    },
  }).replaceAll(/<table\b[\s\S]*?<\/table>/g, '<div class="tableWrapper">$&</div>');
  return { content, html: `<div class="tiptap ProseMirror">${body}</div>` };
}

function mathHtml(
  node: { attrs: Record<string, unknown> },
  displayMode: boolean,
  cached?: import("../content/render-contract").RenderResult,
  index = 0,
): string {
  const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
  const rendered = cached
    ? cached.output !== null
      ? { ok: true as const, html: cached.output }
      : { ok: false as const }
    : validateLatex(latex, displayMode);
  if (!rendered.ok) return `<code>${escapeHtml(latex)}</code>`;
  // Cached MathJax glyph IDs must be unique for each occurrence in the page.
  const ids = new Map(
    [...rendered.html.matchAll(/\bid="([^"]+)"/g)].map((match) => [
      match[1],
      `math-${index}-${match[1]}`,
    ]),
  );
  const html = rendered.html.replace(/(id="|href="#)([^"#]+)(")/g, (original, prefix, id, end) =>
    ids.has(id) ? `${prefix}${ids.get(id)}${end}` : original,
  );
  const tag = displayMode ? "div" : "span";
  const inner = displayMode ? `<div class="block-math-inner">${html}</div>` : html;
  const surface = displayMode ? ` data-blog-surface="${articleSurface.math}"` : "";
  return `<${tag} class="tiptap-mathematics-render" data-type="${displayMode ? "block-math" : "inline-math"}"${surface} data-latex="${escapeHtml(latex)}" contenteditable="false">${inner}</${tag}>`;
}
