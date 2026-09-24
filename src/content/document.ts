import type { JSONContent } from "@tiptap/core";

export const FORMAT_VERSION = 2;
export const CONTENT_SCHEMA_VERSION = 1;
export const EMPTY_DOCUMENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
export class DocumentError extends Error {
  path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
  }
}
const blocks = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule",
  "codeBlock",
  "table",
  "blockMath",
  "callout",
  "details",
  "figure",
];
const inlines = ["text", "image", "inlineMath", "hardBreak", "softBreak"];
const defaults: Record<string, Record<string, unknown>> = {
  heading: { level: 2 },
  bulletList: { tight: true },
  orderedList: { start: 1, tight: true },
  taskList: { tight: true },
  taskItem: { checked: false },
  codeBlock: { language: null },
  image: { src: "", alt: null, title: null },
  inlineMath: { latex: "" },
  blockMath: { latex: "" },
  callout: { kind: "note", title: null },
  details: { title: "" },
  figure: { src: "", alt: null },
  tableCell: { align: null, colspan: 1, rowspan: 1, colwidth: null },
  tableHeader: { align: null, colspan: 1, rowspan: 1, colwidth: null },
};
const markOrder = ["bold", "italic", "strike", "code", "link"];
export function safeUrl(value: string, image = false): boolean {
  return (
    !/[\u0000-\u0020\u007f]/.test(value) &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    (!/^[a-z][a-z\d+.-]*:/i.test(value) ||
      (image ? /^https?:/i : /^(https?:|mailto:|tel:)/i).test(value))
  );
}
export function normalizeDocument(
  input: unknown,
  options: { editing?: boolean } = {},
): JSONContent {
  function fail(path: string, message: string): never {
    throw new DocumentError(path, message);
  }
  function scalar(value: unknown, path: string): void {
    if (
      typeof value === "string" &&
      /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\r/.test(value)
    )
      fail(path, "NUL・不正なUnicode・CRは保存できません");
  }
  function visit(value: unknown, path: string, parent?: string): JSONContent {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(path, "ノードオブジェクトが必要です");
    const n = value as JSONContent;
    for (const key of Object.keys(n))
      if (!["type", "attrs", "content", "marks", "text"].includes(key))
        fail(path, `未知のフィールド ${key}`);
    const type = n.type;
    if (
      !type ||
      ![
        "doc",
        ...blocks,
        ...inlines,
        "listItem",
        "taskItem",
        "tableRow",
        "tableCell",
        "tableHeader",
      ].includes(type)
    )
      fail(path, `未知のノード ${type}`);
    if (type === "doc" && parent) fail(path, "docは根のみです");
    if (type === "text") {
      if (typeof n.text !== "string" || !n.text) fail(path, "空でない文字列が必要です");
      scalar(n.text, path);
      if (parent !== "codeBlock" && /\n/.test(n.text))
        fail(path, "通常文字の改行はsoftBreakまたはhardBreakで指定してください");
    } else if (n.text !== undefined) fail(path, "このノードはtextを持ちません");
    if (n.attrs && (typeof n.attrs !== "object" || Array.isArray(n.attrs)))
      fail(path, "属性が不正です");
    const attrs = { ...defaults[type] };
    for (const [key, val] of Object.entries(n.attrs ?? {})) {
      if (!(key in attrs)) fail(path, `未知の属性 ${key}`);
      scalar(val, path + "." + key);
      attrs[key] = val;
    }
    if (
      type === "heading" &&
      (!Number.isInteger(attrs.level) || Number(attrs.level) < 2 || Number(attrs.level) > 6)
    )
      fail(path, "見出しはH2〜H6です");
    if (
      ["bulletList", "orderedList", "taskList"].includes(type) &&
      typeof attrs.tight !== "boolean"
    )
      fail(path, "tightは真偽値です");
    if (
      type === "orderedList" &&
      (!Number.isInteger(attrs.start) || Number(attrs.start) < 0 || Number(attrs.start) > 999999999)
    )
      fail(path, "開始番号が範囲外です");
    if (type === "taskItem" && typeof attrs.checked !== "boolean")
      fail(path, "checkedは真偽値です");
    if (
      type === "codeBlock" &&
      attrs.language !== null &&
      (typeof attrs.language !== "string" || !attrs.language || /[\s`~]/.test(attrs.language))
    )
      fail(path, "言語は1語です");
    if (["image", "figure"].includes(type)) {
      if (
        typeof attrs.src !== "string" ||
        (!attrs.src && !options.editing) ||
        !safeUrl(attrs.src, true)
      )
        fail(path, "画像URLが不正です");
      if (attrs.alt !== null && typeof attrs.alt !== "string") fail(path, "altが不正です");
      if (attrs.alt === null && !options.editing)
        fail(path, "画像のaltを指定してください（空文字可）");
    }
    if (["inlineMath", "blockMath"].includes(type)) {
      if (typeof attrs.latex !== "string" || (!attrs.latex.trim() && !options.editing))
        fail(path, "TeXを入力してください");
      if (
        type === "inlineMath" &&
        /\n|^\s|\s$|(?<!\\)(?:\\\\)*\$|(?<!\\)(?:\\\\)*\\$/.test(String(attrs.latex))
      )
        fail(path, "インライン数式の区切り条件に適合しません");
      if (type === "blockMath" && /(^|\n)\$\$(\n|$)|\n[ \t]*\n/.test(String(attrs.latex)))
        fail(path, "数式中に区切り行・空行を含められません");
    }
    if (type === "callout" && !["note", "warning"].includes(String(attrs.kind)))
      fail(path, "補足はnote/warningです");
    for (const key of ["title", "alt"])
      if (
        key in attrs &&
        attrs[key] !== null &&
        (typeof attrs[key] !== "string" || String(attrs[key]).includes("\n"))
      )
        fail(path, `${key}は1行の文字列です`);
    if (
      type === "details" &&
      (typeof attrs.title !== "string" || (!attrs.title.trim() && !options.editing))
    )
      fail(path, "トグルの題名が必要です");
    if (
      ["tableCell", "tableHeader"].includes(type) &&
      (attrs.colspan !== 1 ||
        attrs.rowspan !== 1 ||
        attrs.colwidth !== null ||
        ![null, "left", "center", "right"].includes(attrs.align as null | string))
    )
      fail(path, "セル結合・幅・不正な配置は保存できません");
    const result: JSONContent = { type };
    if (Object.keys(attrs).length) result.attrs = attrs;
    if (type === "text") result.text = n.text;
    if (n.marks !== undefined && !Array.isArray(n.marks)) fail(path, "marksは配列です");
    const marks: NonNullable<JSONContent["marks"]> = [];
    for (const mark of n.marks ?? []) {
      if (
        !markOrder.includes(mark.type) ||
        !["text", "image", "hardBreak", "softBreak"].includes(type)
      )
        fail(path, `許可されないマーク ${mark.type}`);
      if (type === "image" && mark.type !== "link") fail(path, "画像にはlinkのみ適用できます");
      for (const key of Object.keys(mark))
        if (!["type", "attrs"].includes(key)) fail(path, `未知のマークフィールド ${key}`);
      const ma = mark.type === "link" ? { href: "", title: null, ...mark.attrs } : {};
      for (const key of Object.keys(mark.attrs ?? {}))
        if (mark.type !== "link" || !["href", "title"].includes(key))
          fail(path, `未知のマーク属性 ${key}`);
      if (mark.type === "link") {
        const a = ma as { href: string; title: string | null };
        if (typeof a.href !== "string" || !a.href || !safeUrl(a.href))
          fail(path, "リンクURLが不正です");
        if (a.title !== null && typeof a.title !== "string") fail(path, "リンクtitleが不正です");
      }
      for (const val of Object.values(ma)) scalar(val, path);
      const normalized =
        mark.type === "link" ? { type: mark.type, attrs: ma } : { type: mark.type };
      const previous = marks.find((m) => m.type === mark.type);
      if (previous && JSON.stringify(previous) !== JSON.stringify(normalized))
        fail(path, "同種の異なるマークが重複しています");
      if (!previous) marks.push(normalized);
    }
    marks.sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type));
    if (marks.some((m) => m.type === "code") && (type !== "text" || /[\n]/.test(n.text ?? "")))
      fail(path, "インラインコードの書式・改行が不正です");
    if (marks.length) result.marks = marks;
    if (n.content !== undefined && !Array.isArray(n.content)) fail(path, "contentは配列です");
    let children = (n.content ?? []).map((c, i) => visit(c, `${path}.content[${i}]`, type));
    const allowed =
      type === "doc" || ["blockquote", "callout", "details", "listItem", "taskItem"].includes(type)
        ? blocks
        : ["paragraph", "heading"].includes(type)
          ? inlines
          : type === "figure"
            ? ["paragraph"]
            : type === "codeBlock"
              ? ["text"]
              : type === "bulletList" || type === "orderedList"
                ? ["listItem"]
                : type === "taskList"
                  ? ["taskItem"]
                  : type === "table"
                    ? ["tableRow"]
                    : type === "tableRow"
                      ? ["tableHeader", "tableCell"]
                      : ["tableCell", "tableHeader"].includes(type)
                        ? ["paragraph"]
                        : [];
    for (const c of children)
      if (!allowed.includes(c.type!)) fail(path, `${type}に${c.type}を含められません`);
    if (
      !options.editing &&
      ["doc", "blockquote", "callout", "details", "listItem", "taskItem"].includes(type) &&
      children.length > 1
    ) {
      children.forEach((child, i) => {
        if (
          child.type === "paragraph" &&
          !child.content?.length &&
          !(["listItem", "taskItem"].includes(type) && i === 0)
        )
          fail(path, "一時空段落は編集状態Wに保持してください");
      });
    }
    if (type === "codeBlock" && children.some((c) => c.marks?.length))
      fail(path, "コードソースに書式を含められません");
    if (type === "paragraph" && !options.editing)
      children.forEach((child, i) => {
        if (child.type !== "softBreak") return;
        const before = children[i - 1],
          after = children[i + 1];
        if (!before || !after || /Break$/.test(before.type!) || /Break$/.test(after.type!))
          fail(path, "softBreakは内容の間だけに置けます");
        for (const mark of child.marks ?? [])
          if (
            ![before, after].every((n) =>
              n.marks?.some((m) => JSON.stringify(m) === JSON.stringify(mark)),
            )
          )
            fail(path, "softBreakのマークは前後で継続する必要があります");
      });
    if (type === "heading" && children.some((c) => c.type === "softBreak"))
      fail(path, "見出しにsoftBreakは使えません");
    if (["listItem", "taskItem"].includes(type) && children[0]?.type !== "paragraph")
      fail(path, "項目の先頭は段落です");
    if (["figure", "tableCell", "tableHeader"].includes(type) && children.length !== 1)
      fail(path, "段落は1個です");
    if (type === "figure" && children[0]?.content?.some((c) => c.type === "image"))
      fail(path, "captionに画像は使えません");
    if (
      ["tableCell", "tableHeader"].includes(type) &&
      children[0]?.content?.some((c) => c.type === "softBreak")
    )
      fail(path, "表内にsoftBreakは使えません");
    if (
      [
        "blockquote",
        "callout",
        "details",
        "bulletList",
        "orderedList",
        "taskList",
        "table",
        "tableRow",
      ].includes(type) &&
      !children.length
    )
      fail(path, "子要素が必要です");
    if (type === "table") {
      const width = children[0].content!.length;
      children.forEach((row, i) => {
        if (row.content!.length !== width) fail(path, "表は矩形にしてください");
        row.content!.forEach((cell, j) => {
          if (cell.type !== (i === 0 ? "tableHeader" : "tableCell"))
            fail(path, "ヘッダーは先頭1行です");
          if (cell.attrs!.align !== children[0].content![j].attrs!.align)
            fail(path, "配置は列全体で統一してください");
        });
      });
    }
    if (["bulletList", "orderedList", "taskList"].includes(type)) {
      const multi = children.some(
        (c) => (c.content ?? []).filter((x) => x.type === "paragraph").length > 1,
      );
      if (attrs.tight && multi) fail(path, "複数段落のリストはlooseです");
      if (!attrs.tight && children.length === 1 && children[0].content?.length === 1)
        fail(path, "単一段落・単一項目ではlooseを表現できません");
    }
    children = children.reduce<JSONContent[]>((out, c) => {
      const last = out.at(-1);
      if (
        c.type === "text" &&
        last?.type === "text" &&
        JSON.stringify(c.marks) === JSON.stringify(last.marks)
      )
        last.text += c.text!;
      else out.push(c);
      return out;
    }, []);
    if (type === "doc" && !children.length) children = [{ type: "paragraph" }];
    if (children.length) result.content = children;
    return result;
  }
  const result = visit(input, "body");
  if (result.type !== "doc") fail("body", "根はdocです");
  return result;
}

/** Only editor snapshots may discard known temporary empty paragraphs; W retains the original. */
export function finalizeWorkingDocument(input: JSONContent): JSONContent {
  const visit = (node: JSONContent): JSONContent => {
    if (!node.content) return node;
    let content = node.content.map(visit);
    if (
      ["doc", "blockquote", "callout", "details", "listItem", "taskItem"].includes(node.type ?? "")
    ) {
      const listItem = node.type === "listItem" || node.type === "taskItem";
      content = content.filter(
        (child, i) =>
          child.type !== "paragraph" || !!child.content?.length || (listItem && i === 0),
      );
      if (!content.length) content = [{ type: "paragraph" }];
    }
    return { ...node, content };
  };
  return visit(input);
}
