import CodeBlock from "@tiptap/extension-code-block";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  type AnyExtension,
  type MarkdownToken,
  Node,
  type NodeViewRendererProps,
  mergeAttributes,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import katex from "katex";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { codeBlockDOMSpec, createCodeBlockControl } from "./code-block-view.ts";
import { codeLanguage, replaceCodeLanguage } from "./code-language.ts";

type DirectiveAttributes = Record<string, string>;

function parseAttributes(source: string): DirectiveAttributes {
  const attributes: DirectiveAttributes = {};
  const pattern = /([\w-]+)="((?:\\.|[^"])*)"/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = match[2].replace(/\\([\\"])/g, "$1");
  }
  return attributes;
}

function quoteAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function leafDirective(name: string, attributes: readonly string[]) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,

    addAttributes() {
      return Object.fromEntries(attributes.map((attribute) => [attribute, { default: "" }]));
    },

    parseHTML() {
      return [{ tag: `[data-article-node="${name}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      if (name === "figure") {
        return [
          "figure",
          mergeAttributes(HTMLAttributes, { "data-article-node": name }),
          [
            "div",
            { class: "figure-field" },
            [
              "img",
              {
                src: HTMLAttributes.src,
                alt: HTMLAttributes.alt,
                width: "1200",
                height: "715",
                loading: "lazy",
                decoding: "async",
              },
            ],
          ],
          ["figcaption", {}, HTMLAttributes.caption],
        ];
      }

      return [
        "figure",
        mergeAttributes(HTMLAttributes, { "data-article-node": name }),
        ["div", { class: "figure-field" }, ["div", { class: "figure-mark" }, HTMLAttributes.mark]],
        ["figcaption", {}, HTMLAttributes.caption],
      ];
    },

    markdownTokenizer: {
      name,
      level: "block",
      start: (source: string) => source.indexOf(`:::${name}{`),
      tokenize: (source: string) => {
        const pattern = new RegExp(`^:::${name}\\{([^\\n]*)\\}\\n:::(?:\\n|$)`);
        const match = pattern.exec(source);
        if (!match) return undefined;
        return { type: name, raw: match[0], attributes: parseAttributes(match[1]) };
      },
    },

    parseMarkdown: (token) => {
      const directive = token as MarkdownToken & { attributes?: DirectiveAttributes };
      return {
        type: name,
        attrs: directive.attributes ?? {},
      };
    },

    renderMarkdown: (node) => {
      const serialized = attributes
        .map(
          (attribute) => `${attribute}="${quoteAttribute(String(node.attrs?.[attribute] ?? ""))}"`,
        )
        .join(" ");
      return `:::${name}{${serialized}}\n:::`;
    },
  });
}

const Figure = leafDirective("figure", ["src", "alt", "caption"]);
const MarkFigure = leafDirective("mark-figure", ["mark", "caption"]);

const Callout = Node.create({
  name: "callout",
  priority: 1_000,
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return { label: { default: "補足" } };
  },

  parseHTML() {
    return [{ tag: 'aside[data-article-node="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        class: "aside ink ink-muted",
        "data-article-node": "callout",
      }),
      ["span", { class: "aside-label", contenteditable: "false" }, HTMLAttributes.label],
      ["div", { class: "callout-content" }, 0],
    ];
  },

  markdownTokenizer: {
    name: "callout",
    level: "block",
    start: (source: string) => source.indexOf("> [!NOTE"),
    tokenize: (source: string, _tokens, lexer) => {
      const match = /^> \[!NOTE(?: ([^\]]+))?\]\n((?:>[^\n]*(?:\n|$))+)/.exec(source);
      if (!match) return undefined;
      const body = match[2]
        .split("\n")
        .map((line) => line.replace(/^> ?/, ""))
        .join("\n")
        .trimEnd();
      return {
        type: "callout",
        raw: match[0],
        label: match[1] ?? "補足",
        tokens: lexer.blockTokens(body),
      };
    },
  },

  parseMarkdown: (token, helpers) => {
    const callout = token as MarkdownToken & { label?: string };
    return {
      type: "callout",
      attrs: { label: callout.label ?? "補足" },
      content: (helpers.parseBlockChildren ?? helpers.parseChildren)(callout.tokens ?? []),
    };
  },

  renderMarkdown: (node, helpers) => {
    const label = String(node.attrs?.label ?? "補足");
    const body = helpers.renderChildren(node.content ?? [], "\n\n");
    return `> [!NOTE ${label}]\n${body
      .split("\n")
      .map((line) => `> ${line}`.trimEnd())
      .join("\n")}`;
  },
});

const Details = Node.create({
  name: "details",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      summary: { default: "" },
      body: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'details[data-article-node="details"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, { "data-article-node": "details" }),
      ["summary", {}, HTMLAttributes.summary],
      ["div", { class: "details-body" }, HTMLAttributes.body],
    ];
  },

  markdownTokenizer: {
    name: "details",
    level: "block",
    start: (source: string) => source.indexOf(":::details{"),
    tokenize: (source: string) => {
      const match = /^:::details\{([^\n]*)\}\n([\s\S]*?)\n:::(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return {
        type: "details",
        raw: match[0],
        attributes: parseAttributes(match[1]),
        body: match[2],
      };
    },
  },

  parseMarkdown: (token) => {
    const details = token as MarkdownToken & { attributes?: DirectiveAttributes; body?: string };
    return {
      type: "details",
      attrs: {
        summary: details.attributes?.summary ?? "",
        body: details.body ?? "",
      },
    };
  },

  renderMarkdown: (node) =>
    `:::details{summary="${quoteAttribute(String(node.attrs?.summary ?? ""))}"}\n${String(node.attrs?.body ?? "")}\n:::`,
});

const SharedCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element: HTMLElement) => {
          const explicitLanguage = element.dataset.codeLanguage?.trim();
          if (explicitLanguage) return explicitLanguage;

          const code = element.querySelector(":scope > code");
          const languageClassPrefix = this.options.languageClassPrefix;
          if (!code || !languageClassPrefix) return null;

          const languageClass = [...code.classList].find((className) =>
            className.startsWith(languageClassPrefix),
          );
          return languageClass?.slice(languageClassPrefix.length) || null;
        },
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full",
        contentElement: (element: HTMLElement) =>
          element.querySelector<HTMLElement>(":scope > code") ?? element,
      },
    ];
  },

  renderHTML({ node }) {
    return codeBlockDOMSpec(String(node.attrs.language ?? ""));
  },

  addNodeView() {
    return ({ node: initialNode, view, getPos }) => {
      let currentNode = initialNode;
      const ownerDocument = view.dom.ownerDocument;
      const dom = ownerDocument.createElement("pre");
      dom.className = "code-block";

      const contentDOM = ownerDocument.createElement("code");
      const control = createCodeBlockControl(
        String(currentNode.attrs.language ?? ""),
        (language) => {
          const position = getPos();
          if (typeof position !== "number") return;
          const node = view.state.doc.nodeAt(position);
          if (!node || node.type.name !== "codeBlock") return;
          view.dispatch(
            view.state.tr.setNodeMarkup(position, node.type, {
              ...node.attrs,
              language: replaceCodeLanguage(String(node.attrs.language ?? ""), language),
            }),
          );
        },
        ownerDocument,
      );
      dom.appendChild(control.control);
      dom.appendChild(contentDOM);

      const updateDOM = () => {
        const languageInfo = String(currentNode.attrs.language ?? "");
        const language = codeLanguage(languageInfo);
        dom.dataset.codeLanguage = language;
        contentDOM.className = `language-${language}`;
        control.update(languageInfo);
      };
      updateDOM();

      return {
        dom,
        contentDOM,
        update(node) {
          if (node.type !== currentNode.type) return false;
          currentNode = node;
          updateDOM();
          return true;
        },
        stopEvent: (event) =>
          event.target instanceof HTMLElement && control.control.contains(event.target),
      };
    };
  },
});

export function renderMathContentHTML(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    output: "htmlAndMathml",
  });
}

function sharedMathNodeView(displayMode: boolean) {
  return function addNodeView(this: {
    options: { onClick?: (node: ProseMirrorNode, position: number) => void };
  }) {
    const onClick = this.options.onClick;
    return ({ node: initialNode, view, getPos }: NodeViewRendererProps) => {
      let currentNode = initialNode;
      const ownerDocument = view.dom.ownerDocument;
      const dom = ownerDocument.createElement(displayMode ? "div" : "span");
      dom.className = "tiptap-mathematics-render";
      dom.dataset.type = displayMode ? "block-math" : "inline-math";
      dom.contentEditable = "false";

      const render = () => {
        const latex = String(currentNode.attrs.latex ?? "");
        dom.dataset.latex = latex;
        if (displayMode) {
          const inner = ownerDocument.createElement("div");
          inner.className = "block-math-inner";
          inner.innerHTML = renderMathContentHTML(latex);
          dom.replaceChildren(inner);
        } else {
          dom.innerHTML = renderMathContentHTML(latex);
        }
      };
      render();
      dom.addEventListener("click", () => {
        const position = getPos();
        if (typeof position === "number") onClick?.(currentNode, position);
      });

      return {
        dom,
        update(node: ProseMirrorNode) {
          if (node.type !== currentNode.type) return false;
          currentNode = node;
          render();
          return true;
        },
      };
    };
  };
}

const SharedInlineMath = InlineMath.extend({
  addNodeView: sharedMathNodeView(false),
});

const SharedBlockMath = BlockMath.extend({
  addNodeView: sharedMathNodeView(true),
});

interface EditorExtensionOptions {
  additionalExtensions?: AnyExtension[];
  onMathEdit?: (request: { kind: "inline" | "block"; latex: string; position: number }) => void;
}

export function createEditorExtensions(options: EditorExtensionOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      link: false,
      codeBlock: false,
      paragraph: { HTMLAttributes: { class: "ink" } },
      heading: { HTMLAttributes: { class: "ink" } },
    }),
    SharedCodeBlock,
    ...(options.additionalExtensions ?? []),
    Link.configure({ openOnClick: false, autolink: true }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false, allowBase64: false }),
    SharedInlineMath.configure({
      katexOptions: { throwOnError: false },
      onClick: (node, position) =>
        options.onMathEdit?.({ kind: "inline", latex: String(node.attrs.latex), position }),
    }),
    SharedBlockMath.configure({
      katexOptions: { throwOnError: false },
      onClick: (node, position) =>
        options.onMathEdit?.({ kind: "block", latex: String(node.attrs.latex), position }),
    }),
    Placeholder.configure({ placeholder: "ここに書き始めます…" }),
    Callout,
    Figure,
    MarkFigure,
    Details,
  ];
}
