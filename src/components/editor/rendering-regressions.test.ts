import { describe, expect, it, vi } from "vite-plus/test";

import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

import { renderMathContentHTML } from "./editor-extensions";
import { requestMathEditWhenEditable } from "./editor-runtime";

describe("editor rendering regressions", () => {
  it("does not request math editing while the editor is read-only", () => {
    const onMathEdit = vi.fn();
    const request = { kind: "inline" as const, latex: "x^2", position: 4 };

    requestMathEditWhenEditable(false, request, onMathEdit);

    expect(onMathEdit).not.toHaveBeenCalled();
  });

  it("keeps syntax-highlight spans in the initial article HTML", () => {
    expect(INITIAL_ARTICLE_HTML).toMatch(/class="hljs-[^"]+"/);
  });

  it("ships MathJax SVG in the server-rendered article HTML", () => {
    expect(INITIAL_ARTICLE_HTML).toContain('<mjx-container class="MathJax" jax="SVG"');
    expect(INITIAL_ARTICLE_HTML).toContain("<svg");
    expect(INITIAL_ARTICLE_HTML).not.toContain('class="katex"');
    expect(INITIAL_ARTICLE_HTML).not.toContain("data-mjx-error");
  });

  it("labels code blocks with their language in the upper-right control", () => {
    expect(INITIAL_ARTICLE_HTML).toContain('data-code-language="html"');
    expect(INITIAL_ARTICLE_HTML).toMatch(
      /<span class="code-language-control" contenteditable="false"><span class="code-language-label">html<\/span><select class="code-language-select" aria-label="コード言語">/,
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
