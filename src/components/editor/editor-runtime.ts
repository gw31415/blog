import { Editor, Extension, findChildren } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { replaceCodeLanguage } from "./code-language";
import { createEditorExtensions } from "./editor-extensions";
import type {
  EditorCommand,
  EditorHandle,
  MountArticleEditorOptions,
  ToolbarState,
} from "./editor-controller";
import { serializeArticleMarkdown } from "./markdown";
import { createTableControlsPlugin } from "./table-controls";

interface MathEditRequest {
  kind: "inline" | "block";
  latex: string;
  position: number;
}

type HighlightCode = typeof import("./editor-syntax-highlighting").highlightCode;

function createSyntaxHighlighting(highlightCode: HighlightCode): Extension {
  return Extension.create({
    name: "articleSyntaxHighlighting",
    addProseMirrorPlugins() {
      const key = new PluginKey<DecorationSet>("articleSyntaxHighlighting");
      const decorations = (doc: Parameters<typeof DecorationSet.create>[0]) => {
        const ranges: Decoration[] = [];
        for (const block of findChildren(doc, (node) => node.type.name === "codeBlock")) {
          let from = block.pos + 1;
          const language = String(block.node.attrs.language ?? "");
          for (const span of highlightCode(language, block.node.textContent)) {
            const to = from + span.text.length;
            if (span.classes.length > 0) {
              ranges.push(Decoration.inline(from, to, { class: span.classes.join(" ") }));
            }
            from = to;
          }
        }
        return DecorationSet.create(doc, ranges);
      };

      return [
        new Plugin({
          key,
          state: {
            init: (_, state) => decorations(state.doc),
            apply: (transaction, current) =>
              transaction.docChanged
                ? decorations(transaction.doc)
                : current.map(transaction.mapping, transaction.doc),
          },
          props: { decorations: (state) => key.getState(state) ?? null },
        }),
      ];
    },
  });
}

export function requestMathEditWhenEditable(
  editable: boolean,
  request: MathEditRequest,
  onMathEdit: (request: MathEditRequest) => void,
): void {
  if (editable) onMathEdit(request);
}

function toolbarState(editor: Editor): ToolbarState {
  const heading = editor.isActive("heading", { level: 2 })
    ? 2
    : editor.isActive("heading", { level: 3 })
      ? 3
      : null;
  return {
    paragraph: editor.isActive("paragraph"),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    heading,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    blockquote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

function runCommand(editor: Editor, command: EditorCommand): boolean {
  if (command.type === "setCodeLanguage") {
    const node = editor.state.doc.nodeAt(command.position);
    if (!node || node.type.name !== "codeBlock") return false;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(command.position, node.type, {
        ...node.attrs,
        language: replaceCodeLanguage(String(node.attrs.language ?? ""), command.language),
      }),
    );
    return true;
  }

  if (command.type === "updateMath") {
    const node = editor.state.doc.nodeAt(command.position);
    const expectedType = command.kind === "inline" ? "inlineMath" : "blockMath";
    if (!node || node.type.name !== expectedType) return false;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(command.position, node.type, {
        ...node.attrs,
        latex: command.latex,
      }),
    );
    return true;
  }

  const chain = editor.chain().focus();
  switch (command.type) {
    case "undo":
      return chain.undo().run();
    case "redo":
      return chain.redo().run();
    case "paragraph":
      return chain.setParagraph().run();
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "strike":
      return chain.toggleStrike().run();
    case "heading":
      return chain.toggleHeading({ level: command.level }).run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.toggleCodeBlock().run();
    case "horizontalRule":
      return chain.setHorizontalRule().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
    case "inlineMath":
      return chain.insertContent({ type: "inlineMath", attrs: { latex: "x^2" } }).run();
    case "blockMath":
      return chain.insertContent({ type: "blockMath", attrs: { latex: "y = x + 1" } }).run();
    case "link":
      return chain.extendMarkRange("link").setLink({ href: command.href }).run();
    case "image":
      return chain.setImage({ src: command.src, alt: command.alt, title: command.caption }).run();
    case "callout":
      return chain
        .insertContent({
          type: "callout",
          attrs: { label: command.label },
          content: [{ type: "paragraph", content: [{ type: "text", text: "補足を書きます。" }] }],
        })
        .run();
    case "details":
      return chain
        .insertContent({
          type: "details",
          attrs: { summary: command.summary, body: command.body },
        })
        .run();
  }
  return false;
}

export async function mountArticleEditor(
  options: MountArticleEditorOptions,
): Promise<EditorHandle> {
  const { highlightCode } = await import("./editor-syntax-highlighting");
  let lastMarkdown = serializeArticleMarkdown(options.content);
  let editor: Editor;
  editor = new Editor({
    element: null,
    extensions: createEditorExtensions({
      additionalExtensions: [
        createSyntaxHighlighting(highlightCode),
        Extension.create({
          name: "articleTableControls",
          addProseMirrorPlugins: () => [createTableControlsPlugin()],
        }),
      ],
      onMathEdit: (request) => {
        const current = editor.state.doc.nodeAt(request.position);
        requestMathEditWhenEditable(
          editor.isEditable,
          {
            ...request,
            latex: String(current?.attrs.latex ?? request.latex),
          },
          (currentRequest) => options.onMathEdit(currentRequest),
        );
      },
    }),
    content: options.content,
    editable: false,
    injectCSS: false,
    onUpdate: ({ editor: current }) => {
      lastMarkdown = serializeArticleMarkdown(current.getJSON());
      options.onUpdate(lastMarkdown);
    },
    onSelectionUpdate: ({ editor: current }) => {
      options.onSelectionChange(toolbarState(current));
    },
  });

  // Disclosure state belongs to the reader, not the article document. Preserve it
  // when the identical document replaces the static markup on the first mount.
  const detailsOpen = [...options.element.querySelectorAll("details")].map(
    (details) => details.open,
  );
  options.element.replaceChildren();
  editor.mount(options.element);
  options.element.querySelectorAll("details").forEach((details, index) => {
    details.open = detailsOpen[index] ?? false;
  });
  options.element.dataset.editorReady = "";
  options.onSelectionChange(toolbarState(editor));

  return {
    setEditable(editable) {
      editor.setEditable(editable, false);
      options.element.dataset.editorMode = editable ? "edit" : "view";
    },
    run(command) {
      const result = runCommand(editor, command);
      options.onSelectionChange(toolbarState(editor));
      return result;
    },
    getMarkdown() {
      return lastMarkdown;
    },
    destroy() {
      editor.destroy();
      delete options.element.dataset.editorReady;
      delete options.element.dataset.editorMode;
    },
  };
}
