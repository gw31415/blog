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

  it("labels code blocks with their language in the upper-right control", () => {
    expect(INITIAL_ARTICLE_HTML).toContain('data-code-language="html"');
    expect(INITIAL_ARTICLE_HTML).toMatch(
      /<span class="code-language-control" contenteditable="false"><span class="code-language-label">html<\/span><select class="code-language-select" aria-label="コード言語">/,
    );
  });

  it.each([
    [String.raw`\texttt{hello} + x`, "hello"],
    [String.raw`\text{hello world}`, "hello(?: |\\u00a0)world"],
  ])("preserves MathML text structure for %s", (latex, textPattern) => {
    expect(renderMathContentHTML(latex)).toMatch(
      new RegExp(`<mtext(?: [^>]*)?>${textPattern}</mtext>`),
    );
  });
});
