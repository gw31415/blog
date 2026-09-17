import { Editor } from "@tiptap/core";
import katex from "katex";

import { createEditorExtensions } from "./editor-extensions";
import type {
  EditorCommand,
  EditorHandle,
  MountArticleEditorOptions,
  ToolbarState,
} from "./editor-controller";
import { serializeArticleMarkdown } from "./markdown";

function toolbarState(editor: Editor): ToolbarState {
  const heading = editor.isActive("heading", { level: 2 })
    ? 2
    : editor.isActive("heading", { level: 3 })
      ? 3
      : null;
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    heading,
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

function runCommand(editor: Editor, command: EditorCommand): boolean {
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
    const mathDom = editor.view.nodeDOM(command.position);
    if (mathDom instanceof HTMLElement) {
      mathDom.dataset.latex = command.latex;
      const renderTarget =
        command.kind === "block"
          ? mathDom.querySelector<HTMLElement>(".block-math-inner")
          : mathDom;
      if (renderTarget) {
        katex.render(command.latex, renderTarget, { throwOnError: false, displayMode: false });
      }
    }
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
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "inlineMath":
      return chain.insertInlineMath({ latex: "x^2" }).run();
    case "blockMath":
      return chain.insertBlockMath({ latex: "y = x + 1" }).run();
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

export function mountArticleEditor(options: MountArticleEditorOptions): EditorHandle {
  let lastMarkdown = serializeArticleMarkdown(options.content);
  let editor: Editor;
  editor = new Editor({
    element: null,
    extensions: createEditorExtensions({
      onMathEdit: (request) => {
        const current = editor.state.doc.nodeAt(request.position);
        options.onMathEdit({
          ...request,
          latex: String(current?.attrs.latex ?? request.latex),
        });
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

  options.element.replaceChildren();
  editor.mount(options.element);
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
