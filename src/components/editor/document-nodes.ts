import { Node, Extension, type MarkdownToken } from "@tiptap/core";
import Code from "@tiptap/extension-code";
import Link from "@tiptap/extension-link";
import { createFigureField, figureFieldDOMSpec } from "./article-surface-contract";

// Code wraps Link (priority 1000) in both ProseMirror and the static renderer.
export const ArticleCode = Code.extend({ priority: 1100, excludes: "" });
export const ArticleLink = Link.extend({
  addAttributes() {
    return { href: { default: null }, title: { default: null } };
  },
  parseMarkdown: (token, h) =>
    h.parseInline(token.tokens ?? []).map((n) => ({
      ...n,
      marks: [
        ...(n.marks ?? []),
        { type: "link", attrs: { href: token.href, title: token.title ?? null } },
      ],
    })),
}).configure({
  openOnClick: false,
  autolink: false,
  HTMLAttributes: { rel: "noopener noreferrer", target: null, class: null },
});
export const ListSpacing = Extension.create({
  name: "listSpacing",
  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList", "taskList"],
        attributes: {
          tight: {
            default: true,
            parseHTML: (e) => e.dataset.tight !== "false",
            renderHTML: (a) => ({ "data-tight": String(a.tight) }),
          },
        },
      },
    ];
  },
});
export const SoftBreak = Node.create({
  name: "softBreak",
  group: "inline",
  inline: true,
  atom: true,
  parseHTML: () => [{ tag: "span[data-soft-break]" }],
  renderHTML: () => ["span", { "data-soft-break": "" }, "\n"],
  renderMarkdown: () => "\n",
});
function escapeTitle(s: string) {
  return s.replace(/[\\`*{}[\]()#+.!_:<>~-]/g, "\\$&");
}
function decodeTitle(s: string) {
  return decodeHTML(s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1"));
}
function directive(name: "callout" | "details" | "figure") {
  const names =
    name === "callout" ? ["note", "warning"] : name === "details" ? ["dropdown"] : ["figure"];
  return Node.create({
    name,
    group: "block",
    content: name === "figure" ? "paragraph" : "block+",
    defining: true,
    addAttributes() {
      return name === "callout"
        ? { kind: { default: "note" }, title: { default: null } }
        : name === "details"
          ? { title: { default: "" } }
          : { src: { default: "" }, alt: { default: null } };
    },
    parseHTML() {
      return [{ tag: `[data-article-node="${name}"]` }];
    },
    renderHTML({ node }) {
      if (name === "callout")
        return [
          "aside",
          { "data-article-node": name, "data-kind": node.attrs.kind, class: "aside ink ink-muted" },
          [
            "span",
            {
              class: "aside-label",
              "data-article-role": "callout-label",
              contenteditable: "false",
            },
            node.attrs.title ?? (node.attrs.kind === "warning" ? "WARN" : "INFO"),
          ],
          ["div", { class: "callout-content" }, 0],
        ];
      if (name === "details")
        return [
          "details",
          { "data-article-node": name },
          [
            "summary",
            { contenteditable: "false" },
            ["span", { "data-article-role": "details-title" }, node.attrs.title],
          ],
          ["div", { class: "details-body" }, 0],
        ];
      return [
        "figure",
        { "data-article-node": name },
        figureFieldDOMSpec(["img", { src: node.attrs.src, alt: node.attrs.alt, loading: "lazy" }]),
        ["figcaption", {}, 0],
      ];
    },
    addNodeView() {
      if (name === "figure") {
        return ({ node, view }) => {
          let currentNode = node;
          const document = view.dom.ownerDocument;
          const dom = document.createElement("figure");
          dom.dataset.articleNode = "figure";
          const field = createFigureField(document);
          const image = document.createElement("img");
          image.loading = "lazy";
          field.appendChild(image);
          const contentDOM = document.createElement("figcaption");
          const render = () => {
            image.src = String(currentNode.attrs.src ?? "");
            image.alt = String(currentNode.attrs.alt ?? "");
          };
          dom.appendChild(field);
          dom.appendChild(contentDOM);
          render();
          return {
            dom,
            contentDOM,
            update(updated) {
              if (updated.type !== currentNode.type) return false;
              currentNode = updated;
              render();
              return true;
            },
          };
        };
      }
      if (name !== "details") return null;
      return ({ node, view, getPos }) => {
        let currentNode = node;
        let composing = false;
        const document = view.dom.ownerDocument;
        const dom = document.createElement("details");
        dom.dataset.articleNode = "details";
        const summary = document.createElement("summary");
        summary.contentEditable = "false";
        const title = document.createElement("span");
        title.dataset.articleRole = "details-title";
        title.contentEditable = view.editable ? "plaintext-only" : "false";
        title.textContent = node.attrs.title;
        summary.appendChild(title);
        const contentDOM = document.createElement("div");
        contentDOM.className = "details-body";
        dom.appendChild(summary);
        dom.appendChild(contentDOM);
        const syncTitle = () => {
          const text = (title.textContent ?? "").replace(/\r?\n/g, " ");
          if (!text.trim()) return;
          if (text === currentNode.attrs.title) return;
          const position = getPos();
          if (typeof position !== "number") return;
          view.dispatch(
            view.state.tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              title: text,
            }),
          );
        };
        title.addEventListener("click", (event) => {
          if (view.editable) event.preventDefault();
        });
        title.addEventListener("beforeinput", (event) => {
          if (["insertParagraph", "insertLineBreak"].includes(event.inputType))
            event.preventDefault();
        });
        title.addEventListener("keydown", (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
            event.preventDefault();
            event.stopPropagation();
            const selection = document.getSelection();
            const range = document.createRange();
            range.selectNodeContents(title);
            selection?.removeAllRanges();
            selection?.addRange(range);
            return;
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          title.blur();
        });
        title.addEventListener("paste", (event) => {
          if (!view.editable) return;
          event.preventDefault();
          const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\r?\n/g, " ");
          const selection = document.getSelection();
          if (!selection?.rangeCount || !title.contains(selection.anchorNode)) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const inserted = document.createTextNode(text);
          range.insertNode(inserted);
          range.setStartAfter(inserted);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          syncTitle();
        });
        title.addEventListener("input", () => {
          if (!composing) syncTitle();
        });
        title.addEventListener("compositionstart", () => {
          composing = true;
        });
        title.addEventListener("compositionend", () => {
          composing = false;
          syncTitle();
        });
        title.addEventListener("blur", () => {
          if (!(title.textContent ?? "").trim()) {
            title.textContent = currentNode.attrs.title;
            return;
          }
          syncTitle();
        });
        return {
          dom,
          contentDOM,
          update(updated) {
            if (updated.type !== node.type) return false;
            currentNode = updated;
            if (!composing && title.textContent !== updated.attrs.title)
              title.textContent = updated.attrs.title;
            return true;
          },
          ignoreMutation(mutation) {
            return (
              (mutation.type === "attributes" && mutation.attributeName === "open") ||
              title.contains(mutation.target)
            );
          },
          stopEvent(event) {
            return (
              view.editable &&
              event.target instanceof globalThis.Node &&
              title.contains(event.target)
            );
          },
        };
      };
    },
    markdownTokenizer: {
      name,
      level: "block",
      start: (s) => {
        const m = /^:{3,}\{(?:note|warning|dropdown|figure)\}/m.exec(s);
        return m?.index ?? -1;
      },
      tokenize(source, _tokens, lexer) {
        const m = /^(:{3,})\{(note|warning|dropdown|figure)\}(?:[ \t]+([^\n]*))?\n/.exec(source);
        if (!m || !names.includes(m[2])) return undefined;
        const lines = source.slice(m[0].length).split("\n");
        let length = m[0].length;
        const body: string[] = [];
        let code = "";
        let closed = false;
        for (const line of lines) {
          length += line.length + 1;
          const f = /^\s*(`{3,}|~{3,})/.exec(line);
          if (f) {
            if (!code) code = f[1];
            else if (f[1][0] === code[0] && f[1].length >= code.length) code = "";
          }
          if (!code && line === m[1]) {
            closed = true;
            break;
          }
          body.push(line);
        }
        if (!closed) return undefined;
        let rawBody = body.join("\n");
        let alt: string | null = null;
        if (name === "figure") {
          const a = /^:alt:[ \t]?([^\n]*)(?:\n|$)/.exec(rawBody);
          if (a) {
            alt = decodeTitle(a[1]);
            rawBody = rawBody.slice(a[0].length);
          }
          rawBody = rawBody.replace(/^\n/, "");
        }
        return {
          type: name,
          raw: source.slice(0, length),
          kind: m[2],
          title: m[3] === undefined ? null : decodeTitle(m[3]),
          alt,
          tokens: lexer.blockTokens(rawBody),
        };
      },
    },
    parseMarkdown(token, helpers) {
      const t = token;
      const content = (helpers.parseBlockChildren ?? helpers.parseChildren)(t.tokens ?? []);
      if (name === "figure" && content[0]?.type === "codeBlock") {
        if (
          t.title !== null ||
          content.length !== 2 ||
          content[0].attrs?.language !== "mermaid" ||
          content[1].type !== "paragraph"
        )
          throw new Error("Mermaid図のキャプション形式が不正です");
        const caption = (content[1].content ?? []).map((part) => part.text ?? "").join("");
        if (!caption) throw new Error("Mermaid図のキャプションが必要です");
        return { ...content[0], attrs: { language: "mermaid", caption } };
      }
      if (name === "figure" && (content.length !== 1 || content[0].type !== "paragraph"))
        throw new Error("図にはキャプション一段落だけを指定してください");
      return {
        type: name,
        attrs:
          name === "callout"
            ? { kind: t.kind, title: t.title }
            : name === "details"
              ? { title: t.title ?? "" }
              : { src: t.title ?? "", alt: t.alt },
        content: content.length ? content : [{ type: "paragraph" }],
      };
    },
    renderMarkdown(node, helpers) {
      const body = helpers.renderChildren(node.content ?? [], "\n\n");
      const longest = Math.max(2, ...Array.from(body.matchAll(/^(:{3,})/gm), (m) => m[1].length));
      const fence = ":".repeat(longest + 1);
      const kind =
        name === "callout" ? node.attrs?.kind : name === "details" ? "dropdown" : "figure";
      const title = name === "figure" ? String(node.attrs?.src ?? "") : node.attrs?.title;
      return `${fence}{${kind}}${title === null || title === undefined ? "" : " " + escapeTitle(String(title))}\n${name === "figure" ? ":alt: " + escapeTitle(String(node.attrs?.alt ?? "")) + "\n\n" : ""}${body}\n${fence}`;
    },
  });
}
export const Figure = directive("figure");
export const Callout = directive("callout");
export const Details = directive("details");

import { BulletList, OrderedList, TaskList } from "@tiptap/extension-list";
import type { JSONContent, MarkdownParseHelpers } from "@tiptap/core";
function parseList(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
  type: string,
): JSONContent | [] {
  const items = token.items ?? [];
  const tasks = items.some((item) => item.task);
  if (
    type === "orderedList" ? !token.ordered : type === "taskList" ? !tasks : token.ordered || tasks
  )
    return [];
  if (tasks && items.some((item) => !item.task))
    throw new Error("通常項目とタスク項目が混在しています");
  const content = items.map((item) => {
    const tokens = (item.tokens ?? []).map((t) =>
      t.type === "text" ? { ...t, type: "paragraph" } : t,
    );
    const children = (helpers.parseBlockChildren ?? helpers.parseChildren)(tokens);
    return {
      type: type === "taskList" ? "taskItem" : "listItem",
      ...(type === "taskList" ? { attrs: { checked: !!item.checked } } : {}),
      content: children.length ? children : [{ type: "paragraph" }],
    };
  });
  return {
    type,
    attrs: { tight: !token.loose, ...(type === "orderedList" ? { start: token.start ?? 1 } : {}) },
    content,
  };
}
export const ArticleBulletList = BulletList.extend({
  parseMarkdown: (t, h) => parseList(t, h, "bulletList"),
});
export const ArticleOrderedList = OrderedList.extend({
  addAttributes() {
    return { start: { default: 1 } };
  },
  markdownTokenizer: {
    name: "profileList",
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
  parseMarkdown: (t, h) => parseList(t, h, "orderedList"),
});
export const ArticleTaskList = TaskList.extend({
  markdownTokenizer: {
    name: "profileList",
    level: "block",
    start: () => -1,
    tokenize: () => undefined,
  },
  markdownTokenName: "list",
  parseMarkdown: (t, h) => parseList(t, h, "taskList"),
});

import { decodeHTML } from "entities";
export const ProfileInline = Node.create({
  name: "profileInline",
  priority: 2000,
  markdownTokenizer: {
    name: "profileInline",
    level: "inline",
    start: (source) => {
      const m = /\n|&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);|<br\s*\/?\s*>/i.exec(source);
      return m?.index ?? -1;
    },
    tokenize(source) {
      const m = /^(?:\n|&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);|<br\s*\/?\s*>)/i.exec(
        source,
      );
      if (!m) return undefined;
      return { type: "profileInline", raw: m[0], text: m[0] };
    },
  },
  parseMarkdown: (token) =>
    token.text === "\n"
      ? { type: "softBreak" }
      : /^<br/i.test(token.text ?? "")
        ? { type: "hardBreak" }
        : { type: "text", text: decodeHTML(token.text ?? "") },
});
