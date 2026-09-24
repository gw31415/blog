import { finalizeWorkingDocument } from "../../content/document";
import { DocumentTypingRules } from "./typing-rules";
import { createCommandPalette, paletteExtension } from "./command-palette";
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
      return chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
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
          attrs: { kind: "note", title: command.label || null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "補足を書きます。" }] }],
        })
        .run();
    case "details":
      return chain
        .insertContent({
          type: "details",
          attrs: { title: command.summary },
          content: [
            {
              type: "paragraph",
              content: command.body ? [{ type: "text", text: command.body }] : [],
            },
          ],
        })
        .run();
  }
  return false;
}

export async function mountArticleEditor(
  options: MountArticleEditorOptions,
): Promise<EditorHandle> {
  const { highlightCode } = await import("./editor-syntax-highlighting");

  let editor: Editor;
  let palette: ReturnType<typeof createCommandPalette> | undefined;
  editor = new Editor({
    element: null,
    extensions: createEditorExtensions({
      additionalExtensions: [
        createSyntaxHighlighting(highlightCode),
        paletteExtension(() => palette),
        DocumentTypingRules,
        Extension.create({
          name: "articleTableControls",
          addProseMirrorPlugins: () => [createTableControlsPlugin()],
        }),
      ],
      mermaidHTML: new Map(
        [...options.element.querySelectorAll<HTMLElement>(".mermaid-diagram")].map((element) => [
          element.dataset.mermaidSource ?? "",
          element.querySelector(".mermaid-preview")?.innerHTML ?? "",
        ]),
      ),
      onMermaidEdit: (position) => {
        if (!editor.isEditable) return;
        editor.commands.setNodeSelection(position);
        palette?.open(undefined, "edit-element");
      },
      onMathEdit: (request) => {
        if (!editor.isEditable) return;
        editor.commands.setNodeSelection(request.position);
        palette?.open(undefined, "edit-element");
      },
    }),
    content: (options.workingState?.document as typeof options.content) ?? options.content,
    editable: false,
    injectCSS: false,
    onUpdate: ({ editor: current }) => {
      options.onUpdate(current.getJSON());
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
  palette = createCommandPalette(editor);
  const editCalloutLabel = (event: MouseEvent) => {
    if (!editor.isEditable || !(event.target instanceof Element)) return;
    const label = event.target.closest('[data-article-role="callout-label"]');
    const element = label?.closest('[data-article-node="callout"]');
    if (!element || !options.element.contains(element)) return;
    let position: number | undefined;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "callout" && editor.view.nodeDOM(pos) === element) position = pos;
    });
    if (position === undefined) return;
    event.preventDefault();
    editor.commands.setNodeSelection(position);
    palette?.open(undefined, "edit-element");
  };
  options.element.addEventListener("click", editCalloutLabel);
  let pending = options.workingState?.pending as
    | Parameters<NonNullable<typeof palette>["resume"]>[0]
    | undefined;
  let pendingObserver: MutationObserver | undefined;
  const resumePending = () => {
    if (!pending || !editor.isEditable) return;
    const viewport = options.element.closest("[data-virtual-keyboard-viewport]");
    if (!viewport) return;
    if (!viewport.querySelector(".editor-dock")) {
      pendingObserver ??= new MutationObserver(resumePending);
      pendingObserver.observe(viewport, { childList: true, subtree: true });
      return;
    }
    pendingObserver?.disconnect();
    pendingObserver = undefined;
    const state = pending;
    pending = undefined;
    palette?.resume(state);
  };
  options.element.dataset.editorReady = "";
  options.onSelectionChange(toolbarState(editor));

  return {
    setEditable(editable) {
      editor.setEditable(editable, false);
      options.element.dataset.editorMode = editable ? "edit" : "view";
      options.element
        .querySelectorAll<HTMLInputElement>('ul[data-type="taskList"] input[type="checkbox"]')
        .forEach((checkbox) => (checkbox.disabled = !editable));
      options.element
        .querySelectorAll<HTMLElement>('[data-article-role="details-title"]')
        .forEach((title) => (title.contentEditable = editable ? "plaintext-only" : "false"));
      options.element
        .querySelectorAll<HTMLElement>('[data-article-role="mermaid-caption"], [data-article-role="table-title"]')
        .forEach((field) => {
          field.contentEditable = editable ? "plaintext-only" : "false";
          field.hidden = !editable && !field.textContent?.trim();
        });
      if (editable) resumePending();
      else {
        pendingObserver?.disconnect();
        pendingObserver = undefined;
      }
    },
    run(command) {
      if (command.type === "palette") {
        palette?.open(undefined, command.command);
        return true;
      }
      const result = runCommand(editor, command);
      options.onSelectionChange(toolbarState(editor));
      return result;
    },
    getWorkingState() {
      return { document: editor.getJSON(), pending: palette?.getState() ?? null };
    },
    getJSON() {
      return finalizeWorkingDocument(palette?.documentForSave() ?? editor.getJSON());
    },
    getMarkdown() {
      return serializeArticleMarkdown(editor.getJSON());
    },
    destroy() {
      options.element.removeEventListener("click", editCalloutLabel);
      pendingObserver?.disconnect();
      palette?.destroy();
      editor.destroy();
      delete options.element.dataset.editorReady;
      delete options.element.dataset.editorMode;
    },
  };
}
