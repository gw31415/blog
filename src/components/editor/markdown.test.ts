import { describe, expect, it } from "vite-plus/test";

import { parseArticleMarkdown, serializeArticleMarkdown } from "./markdown";

function roundTrip(source: string): string {
  return serializeArticleMarkdown(parseArticleMarkdown(source));
}

describe("article Markdown", () => {
  it.each([
    ["callout", ":::{note} 補足\n本文\n:::"],
    ["figure", ":::{figure} /image.jpg\n:alt: 代替\n\n図の説明\n:::"],
    ["details", ":::{dropdown} 詳細\n本文です。\n:::"],
  ])("round-trips the %s extension", (_name, source) => {
    expect(roundTrip(source)).toBe(source);
  });

  it("treats escaped dollar signs as text", () => {
    const output = roundTrip("価格は \\$10 です。\n");
    expect(output).toContain("価格は \\$10 です。");
  });
});
