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
});
