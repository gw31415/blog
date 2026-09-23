import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

import { codeBlockDOMSpec } from "~/components/editor/code-block-view";
import { createEditorExtensions } from "~/components/editor/editor-extensions";
import { highlightCode } from "~/components/editor/editor-syntax-highlighting";
import { parseArticleMarkdown } from "~/components/editor/markdown";
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

export function renderPost(markdown: string) {
  const content = parseArticleMarkdown(markdown);
  const body = renderToHTMLString({
    content,
    extensions: createEditorExtensions(),
    options: {
      nodeMapping: {
        inlineMath: ({ node }) => mathHtml(node, false),
        blockMath: ({ node }) => mathHtml(node, true),
        codeBlock: ({ node }) => {
          const language = typeof node.attrs.language === "string" ? node.attrs.language : "";
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

function mathHtml(node: { attrs: Record<string, unknown> }, displayMode: boolean): string {
  const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
  const rendered = validateLatex(latex, displayMode);
  if (!rendered.ok) return `<code>${escapeHtml(latex)}</code>`;
  const tag = displayMode ? "div" : "span";
  const inner = displayMode
    ? `<div class="block-math-inner">${rendered.html}</div>`
    : rendered.html;
  return `<${tag} class="tiptap-mathematics-render" data-type="${displayMode ? "block-math" : "inline-math"}" data-latex="${escapeHtml(latex)}" contenteditable="false">${inner}</${tag}>`;
}
