import type { JSONContent } from "@tiptap/core";
import { Marked, marked } from "marked";
import { MarkdownManager } from "@tiptap/markdown";

import { ProfileInline } from "./document-nodes";
import { normalizeDocument } from "../../content/document";
import { createEditorExtensions } from "./editor-extensions.ts";

export type MarkdownSource = "canonical" | "commonmark" | "gfm" | "zenn" | "qiita";
function createManager(source: MarkdownSource = "canonical"): MarkdownManager {
  const instance = new Marked();
  if (source === "canonical") instance.use({ tokenizer: { lheading: () => undefined } });
  return new MarkdownManager({
    marked: instance as unknown as typeof marked,
    extensions: [ProfileInline, ...createEditorExtensions()],
    indentation: { style: "space", size: 2 },
    markedOptions: { gfm: source !== "commonmark", breaks: false },
  });
}

function normalize(markdown: string): string {
  return `${markdown.replace(/\r\n?/g, "\n").trimEnd()}\n`;
}

export class MarkdownImportError extends Error {
  source: string;
  constructor(source: string, message: string) {
    super(message);
    this.source = source;
  }
}
export function parseArticleMarkdown(
  markdown: string,
  source: MarkdownSource = "canonical",
): JSONContent {
  if (!["canonical", "commonmark", "gfm", "zenn", "qiita"].includes(source))
    throw new MarkdownImportError(markdown, "取り込み形式を選択してください");
  const manager = createManager(source);
  const original = markdown;
  if (source === "zenn" || source === "qiita") {
    // Only convert site container syntax outside fenced source blocks.
    let code = "";
    markdown = markdown
      .split("\n")
      .map((line) => {
        const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (fence) {
          if (!code) code = fence;
          else if (fence[0] === code[0] && fence.length >= code.length) code = "";
          return line;
        }
        if (code) return line;
        if (source === "zenn")
          return line
            .replace(
              /^(:{3,})message( alert)?\s*$/,
              (_, f, alert) => `${f}{${alert ? "warning" : "note"}}`,
            )
            .replace(/^(:{3,})details (.+)$/, "$1{dropdown} $2");
        return line.replace(
          /^(:{3,})note (info|warn)\s*$/,
          (_, f, kind) => `${f}{${kind === "warn" ? "warning" : "note"}}`,
        );
      })
      .join("\n");
  }
  try {
    const tokens = manager.instance.lexer(normalize(markdown));
    // Marked drops unused link definitions; diagnose them before constructing JSON.
    const references = Object.keys(tokens.links ?? {});
    const used = new Set<string>();
    for (const match of markdown.matchAll(/!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
      if (/^\s*$/.test(match[1])) continue;
      const key = (match[2] || match[1]).replace(/\s+/g, " ").toLowerCase();
      const after = markdown.slice((match.index ?? 0) + match[0].length);
      if (!after.startsWith(":")) used.add(key);
    }
    if (references.some((key) => !used.has(key)))
      throw new Error("未使用の参照定義があります。原文を保持しています");
    const visit = (token: Record<string, unknown>) => {
      if (token.type === "code") {
        if (typeof token.lang === "string" && /[\s`~]/.test(token.lang))
          throw new Error("追加info文字列を含むコードは取り込めません");
        return;
      }
      if (["inlineMath", "blockMath", "codespan"].includes(String(token.type))) return;
      if (token.type === "html" && !/^<br\s*\/?\s*>$/i.test(String(token.raw).trim()))
        throw new Error("任意HTMLは未対応です。原文を保持しています");
      if (token.type === "paragraph" && /^:{3,}\{/m.test(String(token.raw)))
        throw new Error("未対応または未完のディレクティブです");
      for (const value of Object.values(token))
        if (Array.isArray(value))
          for (const item of value) {
            if (Array.isArray(item))
              item.forEach((cell) => {
                if (cell && typeof cell === "object") visit(cell);
              });
            else if (item && typeof item === "object") visit(item);
          }
    };
    tokens.forEach((token) => visit(token as unknown as Record<string, unknown>));
    const parsed = manager.parse(normalize(markdown));
    if (source !== "canonical") {
      const convert = (node: JSONContent) => {
        if (node.type === "heading" && node.attrs?.level === 1) node.attrs.level = 2;
        if (
          (source === "gfm" || source === "qiita") &&
          node.type === "codeBlock" &&
          node.attrs?.language === "math"
        ) {
          node.type = "blockMath";
          node.attrs = { latex: (node.content ?? []).map((n) => n.text ?? "").join("") };
          delete node.content;
        }
        node.content?.forEach(convert);
      };
      convert(parsed);
    }
    return normalizeDocument(parsed);
  } catch (error) {
    throw new MarkdownImportError(original, error instanceof Error ? error.message : String(error));
  }
}

export function serializeArticleMarkdown(content: JSONContent): string {
  return createManager().serialize(normalizeDocument(content));
}
