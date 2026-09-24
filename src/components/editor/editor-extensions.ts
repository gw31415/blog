import { DocumentTable } from "./document-table";
import { documentMarkdown } from "./document-markdown";
import CodeBlock, { type CodeBlockOptions } from "@tiptap/extension-code-block";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import {
  ArticleBulletList,
  ArticleOrderedList,
  ArticleTaskList,
  ArticleCode,
  ArticleLink,
  ListSpacing,
  SoftBreak,
  Figure,
  Callout,
  Details,
} from "./document-nodes";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  type AnyExtension,
  InputRule,
  type MarkdownToken,
  Node,
  type NodeViewRendererProps,
  mergeAttributes,
  textblockTypeInputRule,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import {
  codeBlockDOMSpec,
  createCodeBlockControl,
  createCodeBlockSurface,
} from "./code-block-view.ts";
import { codeLanguage, replaceCodeLanguage } from "./code-language.ts";
import { renderMathContentHTML } from "./mathjax-renderer.ts";
import { articleSurface, createMermaidFigure, setSurface } from "./article-surface-contract.ts";

export { renderMathContentHTML } from "./mathjax-renderer.ts";

const SharedCodeBlock = CodeBlock.extend<
  CodeBlockOptions & {
    onMermaidEdit?: (position: number) => void;
    mermaidHTML?: Map<string, string>;
  }
>({
  addInputRules() {
    return [];
  },
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
    const options = this.options;
    return ({ node: initialNode, view, getPos }) => {
      if (initialNode.attrs.language === "mermaid") {
        let current = initialNode;
        const { figure: dom, field: preview } = createMermaidFigure(view.dom.ownerDocument);
        dom.contentEditable = "false";
        const render = () => {
          dom.dataset.mermaidSource = current.textContent;
          const cached = options.mermaidHTML?.get(current.textContent);
          if (cached) preview.innerHTML = cached;
          else
            void import("./mermaid-renderer").then(({ renderMermaidPreview }) =>
              renderMermaidPreview(preview, current.textContent, true),
            );
        };
        dom.addEventListener("click", () => {
          const position = getPos();
          if (view.editable && typeof position === "number") options.onMermaidEdit?.(position);
        });
        render();
        return {
          dom,
          update(node) {
            if (node.type !== current.type || node.attrs.language !== "mermaid") return false;
            const changed = node.textContent !== current.textContent;
            current = node;
            if (changed) render();
            return true;
          },
          ignoreMutation: () => true,
          stopEvent: () => true,
        };
      }
      let currentNode = initialNode;
      const ownerDocument = view.dom.ownerDocument;
      const { pre: dom, code: contentDOM } = createCodeBlockSurface(ownerDocument);
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
          if (node.type !== currentNode.type || node.attrs.language === "mermaid") return false;
          currentNode = node;
          updateDOM();
          return true;
        },
        // Preview and language controls are UI, not editable source content.
        ignoreMutation: (mutation) =>
          mutation.type !== "selection" && !contentDOM.contains(mutation.target),
        stopEvent: (event) =>
          event.target instanceof HTMLElement && control.control.contains(event.target),
      };
    };
  },
});

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
      if (displayMode) setSurface(dom, articleSurface.math);
      dom.contentEditable = "false";

      const render = () => {
        const latex = String(currentNode.attrs.latex ?? "");
        dom.dataset.latex = latex;
        if (displayMode) {
          const inner = ownerDocument.createElement("div");
          inner.className = "block-math-inner";
          inner.innerHTML = renderMathContentHTML(latex, true);
          dom.replaceChildren(inner);
        } else {
          dom.innerHTML = renderMathContentHTML(latex, false);
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

interface MathNodeOptions {
  onClick?: (node: ProseMirrorNode, position: number) => void;
}

const SharedInlineMath = Node.create<MathNodeOptions>({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return { onClick: undefined };
  },

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex"),
        renderHTML: ({ latex }) => ({ "data-latex": latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "inline-math" })];
  },

  markdownTokenizer: {
    name: "inlineMath",
    level: "inline",
    start: (source: string) => source.indexOf("$"),
    tokenize: (source: string) => {
      const match = /^\$((?:\\.|[^$\\\n])+)\$(?![$0-9])/.exec(source);
      if (!match || /^\s|\s$/.test(match[1])) return undefined;
      return { type: "inlineMath", raw: match[0], latex: match[1] };
    },
  },

  parseMarkdown: (token) => ({
    type: "inlineMath",
    attrs: { latex: (token as MarkdownToken & { latex?: string }).latex ?? "" },
  }),

  renderMarkdown: (node) => `$${String(node.attrs?.latex ?? "")}$`,

  addInputRules() {
    return [
      new InputRule({
        find: /(?<![\\$])\$((?:\\.|[^$\\\n])+)\$ $/,
        handler: ({ state, range, match }) => {
          if (/^\s|\s$/.test(match[1])) return null;
          state.tr.replaceWith(range.from, range.to, [
            this.type.create({ latex: match[1] }),
            state.schema.text(" "),
          ]);
        },
      }),
    ];
  },

  addNodeView: sharedMathNodeView(false),
});

const SharedBlockMath = Node.create<MathNodeOptions>({
  name: "blockMath",
  group: "block",
  atom: true,

  addOptions() {
    return { onClick: undefined };
  },

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex"),
        renderHTML: ({ latex }) => ({ "data-latex": latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="block-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "block-math" })];
  },

  markdownTokenizer: {
    name: "blockMath",
    level: "block",
    start: (source: string) => source.indexOf("$$"),
    tokenize: (source: string) => {
      const match = /^\$\$\n([\s\S]*?)\n\$\$(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return { type: "blockMath", raw: match[0], latex: match[1] };
    },
  },

  parseMarkdown: (token) => ({
    type: "blockMath",
    attrs: { latex: (token as MarkdownToken & { latex?: string }).latex ?? "" },
  }),

  renderMarkdown: (node) => ["$$", String(node.attrs?.latex ?? ""), "$$"].join("\n"),

  addInputRules() {
    return [];
  },

  addNodeView: sharedMathNodeView(true),
});

interface EditorExtensionOptions {
  additionalExtensions?: AnyExtension[];
  onMermaidEdit?: (position: number) => void;
  mermaidHTML?: Map<string, string>;
  onMathEdit?: (request: { kind: "inline" | "block"; latex: string; position: number }) => void;
}

const ArticleHeading = Heading.extend({
  addInputRules() {
    return ([2, 3, 4, 5, 6] as const).map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^#{${level - 1}}\\s$`),
        type: this.type,
        getAttributes: { level },
      }),
    );
  },
});

const ArticleParagraph = Paragraph.extend({
  parseMarkdown: (token, h) => ({ type: "paragraph", content: h.parseInline(token.tokens ?? []) }),
  renderHTML({ HTMLAttributes }) {
    // Keep the ink background on an untrimmed inline box, including while editing.
    return [
      "p",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ["span", { class: "ink" }, 0],
    ];
  },
});

export function createEditorExtensions(options: EditorExtensionOptions = {}): AnyExtension[] {
  return [
    StarterKit.extend({
      addExtensions() {
        return (this.parent?.() ?? []).map((extension) =>
          ["bold", "italic", "strike"].includes(extension.name)
            ? extension.extend({
                parseMarkdown: (token: MarkdownToken, helpers: any) =>
                  helpers.parseInline(token.tokens ?? []).map((node: any) => ({
                    ...node,
                    marks: [...(node.marks ?? []), { type: extension.name }],
                  })),
              })
            : extension,
        );
      },
    }).configure({
      link: false,
      code: false,
      orderedList: false,
      bulletList: false,
      underline: false,
      trailingNode: false,
      document: false,
      codeBlock: false,
      paragraph: false,
      heading: false,
    }),
    Node.create({
      name: "doc",
      topNode: true,
      content: "block+",
      renderMarkdown: documentMarkdown,
    }),
    ArticleParagraph,
    ArticleHeading.configure({ levels: [2, 3, 4, 5, 6], HTMLAttributes: { class: "ink" } }),
    SharedCodeBlock.configure({
      onMermaidEdit: options.onMermaidEdit,
      mermaidHTML: options.mermaidHTML,
    }),
    ...(options.additionalExtensions ?? []),
    ArticleLink,
    ArticleCode,
    ListSpacing,
    ArticleBulletList,
    ArticleOrderedList,
    SoftBreak,
    TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
    DocumentTable,
    TableCell.extend({ content: "paragraph" }),
    TableHeader.extend({ content: "paragraph" }),
    ArticleTaskList,
    TaskItem.configure({ nested: true }),
    Image.extend({
      addAttributes() {
        return { src: { default: "" }, alt: { default: null }, title: { default: null } };
      },
    }).configure({ inline: true, allowBase64: false }),
    SharedInlineMath.configure({
      onClick: (node, position) =>
        options.onMathEdit?.({ kind: "inline", latex: String(node.attrs.latex), position }),
    }),
    SharedBlockMath.configure({
      onClick: (node, position) =>
        options.onMathEdit?.({ kind: "block", latex: String(node.attrs.latex), position }),
    }),
    Placeholder.configure({ placeholder: "ここに書き始めます…" }),
    Callout,
    Figure,
    Details,
  ];
}
