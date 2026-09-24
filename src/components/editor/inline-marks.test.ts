import { describe, expect, it } from "vite-plus/test";
import { getSchema } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { createEditorExtensions } from "./editor-extensions";
import { parseArticleMarkdown, serializeArticleMarkdown } from "./markdown";
import { normalizeDocument } from "../../content/document";
import { inlineTags } from "./inline-marks";
import { COMMANDS } from "./command-palette";

describe("semantic inline marks", () => {
  it.each(Object.entries(inlineTags))(
    "round trips %s with nested code and a break",
    (name, tag) => {
      const doc = normalizeDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "A|B", marks: [{ type: name }, { type: "code" }] },
              { type: "hardBreak", marks: [{ type: name }] },
              { type: "text", text: "末尾", marks: [{ type: name }] },
            ],
          },
        ],
      });
      const encoded = serializeArticleMarkdown(doc);
      expect(encoded).toContain(`<${tag}>`);
      expect(parseArticleMarkdown(encoded)).toEqual(doc);
      getSchema(createEditorExtensions()).nodeFromJSON(doc).check();
      expect(renderToHTMLString({ content: doc, extensions: createEditorExtensions() })).toContain(
        `<${tag}>`,
      );
    },
  );
  it("keeps standard Markdown meanings independent of typing rules", () => {
    const doc = parseArticleMarkdown("**重要** __重要__ *傍点* _傍点_");
    expect(doc.content![0].content!.filter((n) => n.marks).map((n) => n.marks![0].type)).toEqual([
      "bold",
      "bold",
      "italic",
      "italic",
    ]);
  });
  it.each([
    '<b onclick="bad()">x</b>',
    "<dfn>x</dfn>",
    "<b>x</i>",
    "<b>x",
    "<b><script>x</script></b>",
  ])("rejects unsupported HTML: %s", (source) => {
    expect(() => parseArticleMarkdown(source)).toThrow();
  });
  it("preserves a literal closing tag inside code", () => {
    expect(serializeArticleMarkdown(parseArticleMarkdown("<b>`</b>`</b>"))).toBe("<b>`</b>`</b>");
  });
  it("keeps sub and sup exclusive and exposes only supported commands", () => {
    expect(() =>
      normalizeDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "subscript" }, { type: "superscript" }],
              },
            ],
          },
        ],
      }),
    ).toThrow();
    for (const id of ["strong", "bold", "italic", "underline", "em", "mark", "sub", "sup"])
      expect(COMMANDS.filter((c) => c.id === id)).toHaveLength(1);
    for (const id of ["dfn", "cite", "var", "ins", "del", "small"])
      expect(COMMANDS.some((c) => c.id === id)).toBe(false);
  });
});

it.each([
  ["bold", "**"],
  ["italic", "*"],
  ["strike", "~~"],
])("spaces exported %s runs without changing source text", (type, delimiter) => {
  for (const [before, after, expected] of [
    ["日本語", "です", `日本語 ${delimiter}重要${delimiter} です`],
    ["ASCII", "text", `ASCII ${delimiter}重要${delimiter} text`],
    ["既存 ", " 空白", `既存 ${delimiter}重要${delimiter} 空白`],
    ["", "", `${delimiter}重要${delimiter}`],
  ]) {
    const doc = normalizeDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            ...(before ? [{ type: "text", text: before }] : []),
            { type: "text", text: "重要", marks: [{ type }] },
            ...(after ? [{ type: "text", text: after }] : []),
          ],
        },
      ],
    });
    const snapshot = JSON.stringify(doc);
    expect(serializeArticleMarkdown(doc)).toBe(expected);
    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(serializeArticleMarkdown(parseArticleMarkdown(expected))).toBe(expected);
  }
});
