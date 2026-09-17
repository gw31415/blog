import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { transformTable, type TableAction, type TableAxis } from "./table-transforms";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface TableTarget {
  position: number;
  table: ProseMirrorNode;
}
type MenuAction = "before" | "after" | "duplicate" | "delete";

export function handlePosition(
  mount: Rect,
  table: Rect,
  item: Rect,
  axis: TableAxis,
  viewportWidth = Infinity,
): { x: number; y: number } {
  return axis === "row"
    ? {
        // Keep the 24px hit target plus its 4px focus ring inside narrow viewports.
        x: Math.max(16, Math.min(table.x - 14, viewportWidth - 16)) - mount.x,
        y: item.y - mount.y + item.height / 2,
      }
    : { x: item.x - mount.x + item.width / 2, y: table.y - mount.y - 14 };
}

export function menuAction(axis: TableAxis, index: number, action: MenuAction): TableAction {
  const type = action === "before" ? "insertBefore" : action === "after" ? "insertAfter" : action;
  return { type, axis, index };
}

export function tableActionTransaction(
  state: EditorState,
  target: TableTarget,
  action: TableAction,
): Transaction | null {
  if (target.position < 0 || target.position > state.doc.content.size) return null;
  const table = state.doc.nodeAt(target.position);
  if (!table || table.type.name !== "table" || table !== target.table) return null;
  const result = transformTable(table, action);
  return result.ok
    ? state.tr.replaceWith(target.position, target.position + table.nodeSize, result.table)
    : null;
}

interface Handle extends TableTarget {
  axis: TableAxis;
  index: number;
  button: HTMLButtonElement;
  tableDOM: HTMLTableElement;
  itemDOM: HTMLElement;
}

class TableControls {
  private readonly root: HTMLDivElement;
  private readonly mount: HTMLElement;
  private readonly observer: ResizeObserver;
  private handles: Handle[] = [];
  private menu: HTMLDivElement | null = null;
  private active: Handle | null = null;
  private frame = 0;

  constructor(private readonly view: EditorView) {
    this.mount = view.dom.parentElement!;
    this.root = document.createElement("div");
    this.root.dataset.editorOverlay = "table-controls";
    this.root.className = "table-controls";
    this.mount.appendChild(this.root);
    this.observer = new ResizeObserver(this.schedule);
    this.observer.observe(view.dom);
    window.addEventListener("resize", this.schedule);
    document.addEventListener("scroll", this.schedule, true);
    document.addEventListener("pointerdown", this.outsidePointer, true);
    this.root.addEventListener("keydown", this.keyDown);
    this.rebuild();
  }

  private schedule = (): void => {
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.position();
      });
  };

  private outsidePointer = (event: PointerEvent): void => {
    if (event.target instanceof Node && !this.root.contains(event.target)) this.close();
  };

  private keyDown = (event: KeyboardEvent): void => {
    if (!this.menu) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      this.close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...this.menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const current = items.findIndex((item) => item === document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[next]?.focus({ preventScroll: true });
  };

  private close(restoreFocus = true): void {
    const origin = this.active?.button;
    origin?.setAttribute("aria-expanded", "false");
    this.menu?.remove();
    this.menu = null;
    this.active = null;
    if (restoreFocus && origin?.isConnected) origin.focus({ preventScroll: true });
  }

  private open(handle: Handle): void {
    this.close(false);
    this.active = handle;
    handle.button.setAttribute("aria-expanded", "true");
    const menu = document.createElement("div");
    menu.className = "table-controls-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", handle.button.getAttribute("aria-label")!);
    const labels =
      handle.axis === "row"
        ? ["上へ追加", "下へ追加", "行を複製", "行を削除"]
        : ["左へ追加", "右へ追加", "列を複製", "列を削除"];
    (["before", "after", "duplicate", "delete"] as const).forEach((action, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.textContent = labels[index];
      item.disabled =
        action === "delete" &&
        (handle.axis === "row" ? handle.table.childCount : handle.table.firstChild!.childCount) ===
          1;
      item.addEventListener("click", () =>
        this.apply(handle, menuAction(handle.axis, handle.index, action)),
      );
      menu.appendChild(item);
    });
    this.menu = menu;
    this.root.appendChild(menu);
    this.position();
    menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  private apply(handle: Handle, action: TableAction): void {
    const transaction = this.view.editable
      ? tableActionTransaction(this.view.state, handle, action)
      : null;
    this.close(false);
    if (!transaction) {
      const error = document.createElement("div");
      error.className = "table-controls-error";
      error.setAttribute("role", "alert");
      error.textContent = "表が変更されたため操作できません。もう一度選択してください。";
      error.style.left = handle.button.style.left;
      error.style.top = handle.button.style.top;
      this.root.appendChild(error);
      handle.button.focus({ preventScroll: true });
      return;
    }
    this.view.dispatch(transaction);
    this.handles
      .find(
        (current) =>
          current.position === handle.position &&
          current.axis === handle.axis &&
          current.index === handle.index,
      )
      ?.button.focus({ preventScroll: true });
  }

  private rebuild(): void {
    this.close(false);
    this.root.replaceChildren();
    this.handles = [];
    this.root.hidden = !this.view.editable;
    if (!this.view.editable) return;
    this.view.state.doc.descendants((table, position) => {
      if (table.type.name !== "table") return true;
      const nodeDOM = this.view.nodeDOM(position);
      const tableDOM =
        nodeDOM instanceof HTMLTableElement
          ? nodeDOM
          : nodeDOM instanceof HTMLElement
            ? nodeDOM.querySelector("table")
            : null;
      if (!tableDOM) return false;
      for (const axis of ["row", "column"] as const) {
        const items = axis === "row" ? [...tableDOM.rows] : [...(tableDOM.rows[0]?.cells ?? [])];
        items.forEach((itemDOM, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "table-handle";
          button.dataset.tableAxis = axis;
          button.dataset.tableIndex = String(index);
          button.setAttribute("aria-label", `${index + 1}${axis === "row" ? "行" : "列"}目の操作`);
          button.setAttribute("aria-haspopup", "menu");
          button.setAttribute("aria-expanded", "false");
          button.textContent = axis === "row" ? "⋮" : "⋯";
          const handle = { table, position, axis, index, button, tableDOM, itemDOM };
          button.addEventListener("click", () => this.open(handle));
          this.handles.push(handle);
          this.root.appendChild(button);
        });
      }
      return false;
    });
    this.position();
  }

  private position(): void {
    const mount = this.root.getBoundingClientRect();
    for (const handle of this.handles) {
      const table = handle.tableDOM.getBoundingClientRect();
      const item = handle.itemDOM.getBoundingClientRect();
      const point = handlePosition(mount, table, item, handle.axis, window.innerWidth);
      handle.button.hidden = table.width === 0 || table.height === 0;
      handle.button.style.left = `${point.x}px`;
      handle.button.style.top = `${point.y}px`;
    }
    if (this.menu && this.active) {
      const anchor = this.active.button.getBoundingClientRect();
      const menu = this.menu.getBoundingClientRect();
      this.menu.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - menu.width - 4)) - mount.left}px`;
      this.menu.style.top = `${Math.max(4, Math.min(anchor.bottom + 4, window.innerHeight - menu.height - 4)) - mount.top}px`;
    }
  }

  update(view: EditorView, previous: EditorState): void {
    if (previous.doc !== view.state.doc || this.root.hidden === view.editable) this.rebuild();
    else this.schedule();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener("resize", this.schedule);
    document.removeEventListener("scroll", this.schedule, true);
    document.removeEventListener("pointerdown", this.outsidePointer, true);
    this.root.remove();
  }
}

export function createTableControlsPlugin(): Plugin {
  return new Plugin({ view: (view) => new TableControls(view) });
}
