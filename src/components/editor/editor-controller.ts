import type { JSONContent } from "@tiptap/core";

export type EditorCommand =
  | { type: "palette"; command?: string }
  | { type: "undo" | "redo" | "paragraph" | "bold" | "italic" | "strike" }
  | { type: "heading"; level: 2 | 3 | 4 | 5 | 6 }
  | { type: "bulletList" | "orderedList" | "taskList" | "blockquote" | "codeBlock" }
  | { type: "horizontalRule" | "table" | "inlineMath" | "blockMath" }
  | { type: "link"; href: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "callout"; label: string }
  | { type: "details"; summary: string; body: string }
  | { type: "setCodeLanguage"; position: number; language: string }
  | { type: "updateMath"; kind: "inline" | "block"; position: number; latex: string };

export interface ToolbarState {
  paragraph: boolean;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  heading: 2 | 3 | 4 | 5 | 6 | null;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
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
  getWorkingState?(): Record<string, unknown>;
  replaceDocument?(content: JSONContent): boolean;
  getJSON(): JSONContent;
  getMarkdown(): string;
  destroy(): void;
}

export interface MountArticleEditorOptions<
  Element extends Pick<HTMLElement, "innerHTML"> = HTMLElement,
> {
  postId?: string;
  element: Element;
  content: JSONContent;
  workingState?: Record<string, unknown> | null;
  onUpdate(content: JSONContent): void;
  onSelectionChange(state: ToolbarState): void;
  onMathEdit(request: MathEditRequest): void;
}

export interface EditorRuntimeModule<Element extends Pick<HTMLElement, "innerHTML"> = HTMLElement> {
  mountArticleEditor(
    options: MountArticleEditorOptions<Element>,
  ): EditorHandle | Promise<EditorHandle>;
}

export type EditorRuntimeLoader<Element extends Pick<HTMLElement, "innerHTML"> = HTMLElement> =
  () => Promise<EditorRuntimeModule<Element>>;

export interface EditorController<Element extends Pick<HTMLElement, "innerHTML"> = HTMLElement> {
  enterEdit(
    element: Element,
    options?: Omit<MountArticleEditorOptions<Element>, "element">,
  ): Promise<EditorHandle>;
  enterView(): void;
  getWorkingState(): Record<string, unknown> | undefined;
  replaceDocument(content: JSONContent): boolean;
  getJSON(): JSONContent | undefined;
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

export function createEditorController<
  Element extends Pick<HTMLElement, "innerHTML"> = HTMLElement,
>(loadRuntime: EditorRuntimeLoader<Element>): EditorController<Element> {
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
        handle = await runtime.mountArticleEditor({
          element,
          content: options?.content ?? EMPTY_DOCUMENT,
          postId: options?.postId,
          workingState: options?.workingState,
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

    getWorkingState() {
      return handle?.getWorkingState?.();
    },
    replaceDocument(content) {
      return handle?.replaceDocument?.(content) ?? false;
    },
    getJSON() {
      return handle?.getJSON();
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
