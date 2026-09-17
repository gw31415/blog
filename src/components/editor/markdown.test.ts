import { describe, expect, it } from "vite-plus/test";

import { parseArticleMarkdown, serializeArticleMarkdown } from "./markdown";

function roundTrip(source: string): string {
  return serializeArticleMarkdown(parseArticleMarkdown(source));
}

describe("article Markdown", () => {
  it("round-trips headings, GFM content, and standard math delimiters", () => {
    const source = [
      "## 節",
      "",
      "本文の $x^2$。",
      "",
      "$$",
      "y = x + 1",
      "$$",
      "",
      "| 左 | 右 |",
      "| --- | --- |",
      "| A | B |",
      "",
    ].join("\n");

    const output = roundTrip(source);

    expect(output).toContain("## 節");
    expect(output).toContain("本文の $x^2$。");
    expect(output).toContain("$$\ny = x + 1\n$$");
    expect(output).toMatch(/\| 左\s+\| 右\s+\|/);
  });

  it.each([
    ["callout", "> [!NOTE 補足]\n> 本文\n", "> [!NOTE 補足]\n> 本文"],
    [
      "figure",
      ':::figure{src="/image.jpg" alt="代替" caption="図の説明"}\n:::\n',
      ':::figure{src="/image.jpg" alt="代替" caption="図の説明"}\n:::',
    ],
    [
      "mark figure",
      ':::mark-figure{mark="秋" caption="文字図"}\n:::\n',
      ':::mark-figure{mark="秋" caption="文字図"}\n:::',
    ],
    [
      "details",
      ':::details{summary="詳細"}\n本文です。\n:::\n',
      ':::details{summary="詳細"}\n本文です。\n:::',
    ],
  ])("round-trips the %s extension", (_name, source, expected) => {
    expect(roundTrip(source)).toContain(expected);
  });

  it("treats escaped dollar signs as text", () => {
    const output = roundTrip("価格は \\$10 です。\n");
    expect(output).toContain("価格は \\$10 です。");
  });
});
