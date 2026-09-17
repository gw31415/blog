import type { JSONContent } from "@tiptap/core";

export type EditorCommand =
  | { type: "undo" | "redo" | "paragraph" | "bold" | "italic" | "strike" }
  | { type: "heading"; level: 2 | 3 }
  | { type: "bulletList" | "orderedList" | "taskList" | "blockquote" | "codeBlock" }
  | { type: "horizontalRule" | "table" | "inlineMath" | "blockMath" }
  | { type: "link"; href: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "callout"; label: string }
  | { type: "details"; summary: string; body: string }
  | { type: "updateMath"; kind: "inline" | "block"; position: number; latex: string };

export interface ToolbarState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  heading: 2 | 3 | null;
  canUndo: boolean;
  canRedo: boolean;
}

export interface MathEditRequest {
  kind: "inline" | "block";
  latex: string;
  position: number;
}

export interface EditorHandle {
  setEditable(editable: boolean): void;
  run(command: EditorCommand): boolean;
  getMarkdown(): string;
  destroy(): void;
}

export interface MountArticleEditorOptions {
  element: HTMLElement;
  content: JSONContent;
  onUpdate(markdown: string): void;
  onSelectionChange(state: ToolbarState): void;
  onMathEdit(request: MathEditRequest): void;
}

export interface EditorRuntimeModule {
  mountArticleEditor(options: MountArticleEditorOptions): EditorHandle;
}

export type EditorRuntimeLoader = () => Promise<EditorRuntimeModule>;

export interface EditorController {
  enterEdit(
    element: HTMLElement,
    options?: Omit<MountArticleEditorOptions, "element">,
  ): Promise<EditorHandle>;
  enterView(): void;
  getMarkdown(): string | undefined;
  run(command: EditorCommand): boolean;
  isReady(): boolean;
  destroy(): void;
}

const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const NOOP = () => {};

export function createEditorController(loadRuntime: EditorRuntimeLoader): EditorController {
  let handle: EditorHandle | undefined;

  return {
    async enterEdit(element, options) {
      if (handle) {
        handle.setEditable(true);
        return handle;
      }

      const staticHtml = element.innerHTML;
      try {
        const runtime = await loadRuntime();
        handle = runtime.mountArticleEditor({
          element,
          content: options?.content ?? EMPTY_DOCUMENT,
          onUpdate: options?.onUpdate ?? NOOP,
          onSelectionChange: options?.onSelectionChange ?? NOOP,
          onMathEdit: options?.onMathEdit ?? NOOP,
        });
        handle.setEditable(true);
        return handle;
      } catch (error) {
        element.innerHTML = staticHtml;
        throw error;
      }
    },

    enterView() {
      handle?.setEditable(false);
    },

    getMarkdown() {
      return handle?.getMarkdown();
    },

    run(command) {
      return handle?.run(command) ?? false;
    },

    isReady() {
      return handle !== undefined;
    },

    destroy() {
      handle?.destroy();
      handle = undefined;
    },
  };
}
