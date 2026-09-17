import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vite-plus/test";

import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

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

  it("draws the outer rules on the table itself", () => {
    const css = readFileSync(new URL("../blog/blog.css", import.meta.url), "utf8");
    const tableRule = css.match(/\.article-content\s+table\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(tableRule).toMatch(/border-top\s*:/);
    expect(tableRule).toMatch(/border-bottom\s*:/);
  });

  it("labels code blocks with their language in the upper-right control", () => {
    expect(INITIAL_ARTICLE_HTML).toContain('data-code-language="html"');
    expect(INITIAL_ARTICLE_HTML).toContain('class="code-language-label">html</span>');
  });

  it("only shows node-selection outlines while editing and excludes math and details", () => {
    const css = readFileSync(new URL("../blog/blog.css", import.meta.url), "utf8");

    expect(css).toMatch(/\[data-editor-mode="edit"\]\s+\.ProseMirror-selectednode/);
    expect(css).toContain(":not(.tiptap-mathematics-render):not(details)");
  });

  it("uses the same brown text selection in view and edit modes", () => {
    const css = readFileSync(new URL("../blog/blog.css", import.meta.url), "utf8");
    const selectionRule = css.match(/::selection\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(selectionRule).toMatch(/background\s*:\s*rgb\(135 89 79 \/ 28%\)/);
    expect(selectionRule).toMatch(/color\s*:\s*var\(--ink\)/);
  });
});
