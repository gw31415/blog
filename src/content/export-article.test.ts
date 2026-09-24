import { describe, expect, it } from "vite-plus/test";
import type { JSONContent } from "@tiptap/core";
import { exportArticle, type ExportTarget } from "./export-article";
import { documentMarkdown } from "../components/editor/document-markdown";

const text = (value: string): JSONContent => ({ type: "text", text: value });
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const math = (latex: string): JSONContent => ({ type: "inlineMath", attrs: { latex } });
const article = (...content: JSONContent[]) => ({
  title: "Title",
  subtitle: null,
  tags: [],
  body: { type: "doc", content } as JSONContent,
});
const exportTo = (target: ExportTarget, ...content: JSONContent[]) =>
  exportArticle(article(...content), target, "https://example.com");
const targets = ["zenn", "github", "qiita"] as const;
const table = (header: boolean): JSONContent => ({
  type: "table",
  attrs: { title: "表 *題*" },
  content: ["A", "B"].map((value, index) => ({
    type: "tableRow",
    content: [
      {
        type: header && index === 0 ? "tableHeader" : "tableCell",
        attrs: { align: "right" },
        content: [paragraph(text(value), math("x|y"))],
      },
    ],
  })),
});
const diagram: JSONContent = {
  type: "codeBlock",
  attrs: { language: "mermaid", caption: "図 *題*" },
  content: [text("graph LR\n A-->B")],
};

describe("article Markdown exports", () => {
  it.each(["github", "qiita"] as const)(
    "writes %s math without replacing matching code, links or text",
    (target) => {
      const code = { ...text("$x$"), marks: [{ type: "code" }] };
      const link = {
        ...text("link"),
        marks: [{ type: "link", attrs: { href: "https://example.com/$x$" } }],
      };
      const result = exportTo(
        target,
        paragraph(code, text(" $x$ "), link, math("x"), text(" and "), math("x")),
      );
      expect(result.markdown).toContain(
        "`$x$` \\$x\\$ [link](<https://example.com/$x$>)$`x`$ and $`x`$",
      );
      expect(exportTo(target, paragraph(math("x"))).markdown).toContain("$`x`$");
      expect(exportTo(target, paragraph(math("x\\$&"))).markdown).toContain("$`x\\$&`$");
    },
  );

  it.each(targets)(
    "exports %s tables with captions and an empty header without losing rows",
    (target) => {
      const result = exportTo(target, table(false));
      const delimiter = target === "zenn" ? "$x\\|y$" : "$`x\\|y`$";
      expect(result.markdown).toContain(
        `表 \\*題\\*\n\n|  |\n| ---: |\n| A${delimiter} |\n| B${delimiter} |`,
      );
      expect(result.markdown).not.toContain(":::{table}");
      expect(result.diagnostics).toHaveLength(2);
      const headed = exportTo(target, table(true));
      expect(headed.markdown).toContain(`| A${delimiter} |\n| ---: |\n| B${delimiter} |`);
      expect(headed.diagnostics).toHaveLength(1);
    },
  );

  it.each(targets)("exports %s Mermaid captions as escaped paragraphs", (target) => {
    const result = exportTo(target, diagram);
    expect(result.markdown).toContain("```mermaid\ngraph LR\n A-->B\n```\n\n図 \\*題\\*");
    expect(result.markdown).not.toContain(":::{figure}");
    expect(result.diagnostics).toContain("Mermaidのキャプションを通常段落に分離しました。");
  });

  it.each(targets)(
    "converts %s nested tables and diagrams while leaving source JSON unchanged",
    (target) => {
      const input = article({
        type: "blockquote",
        content: [
          {
            type: "bulletList",
            attrs: { tight: false },
            content: [
              {
                type: "listItem",
                content: [paragraph(text("item")), table(false), diagram],
              },
            ],
          },
        ],
      });
      const before = structuredClone(input);
      const original = documentMarkdown(input.body);
      const result = exportArticle(input, target, "https://example.com");
      expect(result.markdown).not.toMatch(/:::\{(?:table|figure)\}/);
      expect(result.markdown).toContain(">   ```mermaid");
      expect(result.markdown).toContain(">   表 \\*題\\*");
      expect(input).toEqual(before);
      expect(exportArticle(input, "canonical", "https://example.com").markdown).toBe(original);
      expect(original).toContain(":::{table}");
      expect(original).toContain(":::{figure}");
    },
  );
});
