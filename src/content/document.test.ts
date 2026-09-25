import { describe, it, expect } from "vite-plus/test";
import { normalizeDocument, finalizeWorkingDocument } from "./document";
import { sampleDocument } from "./sample-document";
import { parseArticleMarkdown, serializeArticleMarkdown } from "../components/editor/markdown";
import { getSchema } from "@tiptap/core";
import { createEditorExtensions } from "../components/editor/editor-extensions";
describe("document contract", () => {
  it("preserves sample JSON through the editor schema and normalization", () => {
    const schema = getSchema(createEditorExtensions());
    const node = schema.nodeFromJSON(sampleDocument);
    node.check();
    expect(normalizeDocument(node.toJSON())).toEqual(sampleDocument);
    expect(normalizeDocument(sampleDocument)).toEqual(sampleDocument);
  });
  it("rejects unknown attributes instead of discarding them", () =>
    expect(() =>
      normalizeDocument({ type: "doc", content: [{ type: "paragraph", attrs: { color: "red" } }] }),
    ).toThrow("未知"));
  it("keeps the sample Markdown stable after its documented boundary spacing is added", () => {
    const markdown = serializeArticleMarkdown(sampleDocument);
    const parsed = normalizeDocument(parseArticleMarkdown(markdown));
    expect(markdown).toMatch(/続いて、 \*\*重要\*\*/);
    expect(parsed).not.toEqual(sampleDocument);
    expect(serializeArticleMarkdown(parsed)).toBe(markdown);
  });
});

const p = (...content: any[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: any[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const round = (content: any[]) => {
  const doc = normalizeDocument({ type: "doc", content });
  const encoded = serializeArticleMarkdown(doc);
  expect(normalizeDocument(parseArticleMarkdown(encoded))).toEqual(doc);
  expect(serializeArticleMarkdown(parseArticleMarkdown(encoded))).toBe(encoded);
};

describe("Markdown boundary contracts", () => {
  it("uses divider priority and no Setext/front matter", () => {
    expect(parseArticleMarkdown("前\n---\n後").content?.map((n) => n.type)).toEqual([
      "paragraph",
      "horizontalRule",
      "paragraph",
    ]);
    expect(parseArticleMarkdown("前\n===")).toMatchObject({ content: [{ type: "paragraph" }] });
    expect(() => parseArticleMarkdown("# H1")).toThrow("H2");
  });
  it("keeps distinct list boundaries, zero start, and source endings", () =>
    round([
      {
        type: "bulletList",
        attrs: { tight: true },
        content: [{ type: "listItem", content: [p(t("one"))] }],
      },
      {
        type: "bulletList",
        attrs: { tight: true },
        content: [{ type: "listItem", content: [p(t("two"))] }],
      },
      {
        type: "orderedList",
        attrs: { start: 0, tight: true },
        content: [{ type: "listItem", content: [p(t("zero"))] }],
      },
      {
        type: "orderedList",
        attrs: { start: 9, tight: true },
        content: [{ type: "listItem", content: [p(t("nine"))] }],
      },
      { type: "codeBlock", attrs: { language: "text" }, content: [t("  a\n\n```\n  \n")] },
    ]));
  it("preserves hard breaks, soft breaks, numeric entities and literal HTML text", () =>
    round([
      p(t("<br> &#35;"), { type: "hardBreak" }, t("after"), { type: "softBreak" }, t("source"), {
        type: "hardBreak",
      }),
      { type: "heading", attrs: { level: 4 }, content: [t("a"), { type: "hardBreak" }, t("b")] },
    ]));
  it("preserves math pipe and escaped dollar source", () =>
    round([
      {
        type: "table",
        content: [
          { type: "tableRow", content: [{ type: "tableHeader", content: [p(t("x"))] }] },
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [p({ type: "inlineMath", attrs: { latex: "|x|+\\|y\\|" } })],
              },
            ],
          },
        ],
      },
      p({ type: "inlineMath", attrs: { latex: "\\$x" } }, t("2")),
    ]));
  it("retains decorated spaces and code with other marks", () =>
    round([
      p(
        t(" ", [{ type: "bold" }]),
        t("x", [
          { type: "bold" },
          { type: "italic" },
          { type: "code" },
          { type: "link", attrs: { href: "https://example.com", title: "title" } },
        ]),
      ),
    ]));
  it("keeps source when rejecting HTML or unknown directives", () => {
    for (const source of ["<div>raw</div>", ":::{unknown}\nbody\n:::"]) {
      try {
        parseArticleMarkdown(source);
        throw new Error("expected rejection");
      } catch (error) {
        expect(error).toHaveProperty("source", source);
      }
    }
  });
});

it("retains continuous marks across soft breaks", () => {
  const marks = [
    { type: "bold" },
    { type: "link", attrs: { href: "https://example.com", title: null } },
  ];
  const doc = normalizeDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "before", marks },
          { type: "softBreak", marks },
          { type: "text", text: "after", marks },
        ],
      },
    ],
  });
  expect(parseArticleMarkdown(serializeArticleMarkdown(doc))).toEqual(doc);
});
it("uses the explicitly selected external grammar", () => {
  expect(parseArticleMarkdown("Title\n===", "commonmark").content?.[0]).toMatchObject({
    type: "heading",
    attrs: { level: 2 },
  });
  expect(parseArticleMarkdown("```math\nx^2\n```", "qiita").content?.[0]).toMatchObject({
    type: "blockMath",
    attrs: { latex: "x^2" },
  });
  expect(parseArticleMarkdown(":::message alert\ncareful\n:::", "zenn").content?.[0]).toMatchObject(
    { type: "callout", attrs: { kind: "warning" } },
  );
  expect(() => parseArticleMarkdown("[unused]: https://example.com")).toThrow("未使用");
});
it("preserves boundaries between separate block quotes", () => {
  const doc = normalizeDocument({
    type: "doc",
    content: ["one", "two"].map((text) => ({
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  });
  expect(parseArticleMarkdown(serializeArticleMarkdown(doc))).toEqual(doc);
});

it("separates temporary empty paragraphs without mutating the recovery snapshot", () => {
  const working = {
    type: "doc",
    content: [
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "kept" }] },
      { type: "paragraph" },
    ],
  };
  expect(() => normalizeDocument(working)).toThrow("編集状態W");
  expect(finalizeWorkingDocument(working).content).toHaveLength(1);
  expect(working.content).toHaveLength(3);
});
