import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";

import { createEditorExtensions } from "./editor-extensions.ts";

function createManager(): MarkdownManager {
  return new MarkdownManager({
    extensions: createEditorExtensions(),
    indentation: { style: "space", size: 2 },
    markedOptions: { gfm: true, breaks: false },
  });
}

function normalize(markdown: string): string {
  return `${markdown.replace(/\r\n?/g, "\n").trimEnd()}\n`;
}

const DOLLAR_SENTINEL = "\uE000";

function protectTextDollars(node: JSONContent, insideCode = false): JSONContent {
  const nextInsideCode = insideCode || node.type === "codeBlock";
  const isCodeText =
    nextInsideCode ||
    node.marks?.some((mark) => (typeof mark === "string" ? mark : mark.type) === "code");

  return {
    ...node,
    ...(node.text && !isCodeText ? { text: node.text.replace(/\$/g, DOLLAR_SENTINEL) } : {}),
    ...(node.content
      ? { content: node.content.map((child) => protectTextDollars(child, nextInsideCode)) }
      : {}),
  };
}

export function parseArticleMarkdown(markdown: string): JSONContent {
  return createManager().parse(normalize(markdown));
}

export function serializeArticleMarkdown(content: JSONContent): string {
  const serialized = createManager().serialize(protectTextDollars(content));
  return normalize(serialized.replaceAll(DOLLAR_SENTINEL, "\\$"));
}
