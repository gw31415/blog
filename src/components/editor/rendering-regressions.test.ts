import { describe, expect, it, vi } from "vite-plus/test";

import { parseArticleMarkdown } from "./markdown";
import { renderPost } from "~/server/render-post";

import { renderMathContentHTML } from "./editor-extensions";
import { requestMathEditWhenEditable } from "./editor-runtime";

describe("editor rendering regressions", () => {
  const renderedHtml = renderPost(
    parseArticleMarkdown("## 見出し\n\n```html\n<p>本文</p>\n```\n\n数式 $x^2$。"),
  ).html;

  it("does not request math editing while the editor is read-only", () => {
    const onMathEdit = vi.fn();
    const request = { kind: "inline" as const, latex: "x^2", position: 4 };

    requestMathEditWhenEditable(false, request, onMathEdit);

    expect(onMathEdit).not.toHaveBeenCalled();
  });

  it("keeps syntax-highlight spans in rendered article HTML", () => {
    expect(renderedHtml).toMatch(/class="hljs-[^"]+"/);
  });

  it("ships MathJax SVG in the server-rendered article HTML", () => {
    expect(renderedHtml).toContain('<mjx-container class="MathJax" jax="SVG"');
    expect(renderedHtml).toContain("<svg");
    expect(renderedHtml).not.toContain('class="katex"');
    expect(renderedHtml).not.toContain("data-mjx-error");
  });

  it("labels code blocks with their language in the upper-right control", () => {
    expect(renderedHtml).toContain('data-code-language="html"');
    expect(renderedHtml).toMatch(
      /<span class="code-language-control" data-blog-role="language-control" contenteditable="false"><span class="code-language-label" data-blog-role="language-label">html<\/span><select class="code-language-select" data-blog-role="language-select" aria-label="コード言語">/,
    );
  });

  it.each([
    [String.raw`\texttt{hello} + x`, "hello"],
    [String.raw`\text{hello world}`, "hello(?: |\\u00a0)world"],
  ])("renders MathJax SVG text for %s", (latex, textPattern) => {
    const html = renderMathContentHTML(latex, false);

    expect(html).toContain('<mjx-container class="MathJax" jax="SVG"');
    expect(html).toContain("<svg");
    expect(html).toContain("<mjx-assistive-mml");
    expect(html).toMatch(new RegExp(`<mtext(?: [^>]*)?>${textPattern}</mtext>`));
  });
});

describe("plain source rendering", () => {
  it.each([null, "plaintext", "text", "unregistered-language"])(
    "keeps literal source for %s",
    (language) => {
      const source = "plain text\n  ┌─入力─┐\n\t<&>";
      const html = renderPost({
        type: "doc",
        content: [
          { type: "codeBlock", attrs: { language }, content: [{ type: "text", text: source }] },
        ],
      }).html;
      expect(html).toContain("plain text\n  ┌─入力─┐\n\t&lt;&amp;&gt;");
      expect(html).not.toContain('class="hljs-');
    },
  );
});

describe("Mermaid server markup", () => {
  it("uses server SVG in the image frame and keeps source out of the visible body", () => {
    const source = 'flowchart LR\nA["<test>"] --> B';
    const rendered = renderPost(
      {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "mermaid" },
            content: [{ type: "text", text: source }],
          },
        ],
      },
      ['<svg role="img"><text>diagram</text></svg>'],
    );
    expect(rendered.html).toMatch(
      /class="figure-field mermaid-preview"[^>]*data-blog-surface="figure"[^>]*><svg/,
    );
    expect(rendered.html).not.toContain("<pre");
    expect(rendered.html).not.toContain("<code");
    expect(rendered.html).toContain("&quot;&lt;test&gt;&quot;");
    expect(rendered.content.content?.[0].content?.[0].text).toBe(source);
  });
});

it("keeps separate browser-rendered formulas free of duplicate glyph IDs", () => {
  const first = renderMathContentHTML("x^2", false);
  const second = renderMathContentHTML("y^2", false);
  const ids = [...(first + second).matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});
