import { describe, expect, it } from "vite-plus/test";
import type { JSONContent } from "@tiptap/core";
import { exportArticle, type ExportTarget } from "./export-article";
import { documentMarkdown } from "../components/editor/document-markdown";
import { marked } from "marked";

const text = (value: string): JSONContent => ({ type: "text", text: value });
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const math = (latex: string): JSONContent => ({ type: "inlineMath", attrs: { latex } });
const article = (...content: JSONContent[]) => ({
  title: "Title",
  subtitle: null,
  tags: [],
  body: { type: "doc", content } satisfies JSONContent,
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
  it.each(["canonical", "github"] as const)(
    "adds one escaped title to %s output without changing the body",
    (target) => {
      const input = { ...article(paragraph(text("本文"))), title: "A *title* <tag> &amp;\n# Next" };
      const before = structuredClone(input);
      const result = exportArticle(input, target, "https://example.com");
      const headings = marked.lexer(result.markdown).filter((token) => token.type === "heading");
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({ type: "heading", depth: 1 });
      expect(marked.parse(result.markdown)).toContain(
        "A *title* &lt;tag&gt; &amp;amp; # Next</h1>",
      );
      expect(result.markdown.endsWith(documentMarkdown(input.body))).toBe(true);
      expect(input).toEqual(before);
    },
  );

  it("uses an untitled heading even when the body is empty", () => {
    expect(
      exportArticle({ ...article(), title: " " }, "canonical", "https://example.com").markdown,
    ).toBe("# 無題");
  });

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
      expect(exportArticle(input, "canonical", "https://example.com").markdown).toBe(
        `# Title\n\n${original}`,
      );
      expect(original).toContain(":::{table}");
      expect(original).toContain(":::{figure}");
    },
  );
});

describe("semantic mark exports", () => {
  it("retains supported inline HTML and diagnoses Zenn fallbacks without changing JSON", () => {
    const input = article(
      paragraph(
        { ...text("太字"), marks: [{ type: "b" }] },
        { ...text("italic"), marks: [{ type: "i" }] },
        { ...text("注目"), marks: [{ type: "highlight" }] },
        { ...text("2"), marks: [{ type: "superscript" }] },
      ),
    );
    const original = structuredClone(input);
    for (const target of ["github", "qiita"] as const) {
      const result = exportArticle(input, target, "https://example.com");
      expect(result.markdown).toContain("<b>太字</b><i>italic</i><mark>注目</mark><sup>2</sup>");
      expect(result.diagnostics).not.toHaveLength(0);
    }
    const zenn = exportArticle(input, "zenn", "https://example.com");
    expect(zenn.markdown).toContain("**太字** *italic* 注目2");
    expect(zenn.diagnostics).toHaveLength(4);
    expect(input).toEqual(original);
  });
});

it.each(["canonical", ...targets] as const)(
  "separates inline delimiters in %s output",
  (target) => {
    const body = paragraph(
      text("日本語"),
      { type: "text", text: "重要", marks: [{ type: "bold" }] },
      text("です"),
    );
    expect(exportTo(target, body).markdown).toContain("日本語 **重要** です");
    expect(body.content?.[0].text).toBe("日本語");
  },
);
