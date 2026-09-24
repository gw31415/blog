import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  canReorderTable,
  transformTable,
  type TableAction,
  type TableAxis,
} from "./table-transforms";

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
type MenuAction = "before" | "after" | "duplicate" | "delete" | "previous" | "next";

export interface TableDragState {
  pointerType: string;
  start: number;
  startedAt: number;
  active?: boolean;
  cancelled?: boolean;
  disabledReason?: "merged-cells" | null;
}

export function reorderDisabledReason(table: ProseMirrorNode): "merged-cells" | null {
  return canReorderTable(table) ? null : "merged-cells";
}

export function beginPointerDrag(
  state: TableDragState,
  position: number,
  now: number,
  crossMovement = 0,
): TableDragState {
  const movement = Math.hypot(position - state.start, crossMovement);
  const cancelled =
    !!state.cancelled ||
    !!state.disabledReason ||
    (!state.active && state.pointerType === "touch" && movement >= 3);
  const active =
    !cancelled &&
    (!!state.active ||
      (state.pointerType === "touch" ? now - state.startedAt >= 300 : movement >= 3));
  return { ...state, active, cancelled };
}

export function dragTargetIndex(
  bounds: readonly { start: number; end: number }[],
  from: number,
  position: number,
): number {
  const next = bounds.findIndex((bound) => position < (bound.start + bound.end) / 2);
  const boundary = next === -1 ? bounds.length : next;
  return Math.max(0, Math.min(bounds.length - 1, boundary > from ? boundary - 1 : boundary));
}

export function handlePosition(
  mount: Rect,
  table: Rect,
  item: Rect,
  axis: TableAxis,
  viewportWidth = Infinity,
): { x: number; y: number } {
  return axis === "row"
    ? {
        // The visible 14px handle touches the rule. Its pseudo-element expands
        // the pointer target to 24px without adding visible whitespace.
        x: Math.max(12, Math.min(table.x - 7, viewportWidth - 12)) - mount.x,
        y: item.y - mount.y + item.height / 2,
      }
    : { x: item.x - mount.x + item.width / 2, y: table.y - mount.y - 7 };
}

export function menuAction(axis: TableAxis, index: number, action: MenuAction): TableAction {
  if (action === "previous" || action === "next") {
    return { type: "move", axis, from: index, to: index + (action === "previous" ? -1 : 1) };
  }
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
  if (action.type === "delete" && action.axis === "column" && table.firstChild?.childCount === 1 && table.firstChild.firstChild?.type.name === "tableHeader") return state.tr.delete(target.position,target.position+table.nodeSize);
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

interface PointerGesture {
  handle: Handle;
  pointerId: number;
  state: TableDragState;
  startX: number;
  startY: number;
  x: number;
  y: number;
  to: number;
}

class TableControls {
  private readonly root: HTMLDivElement;
  private readonly mount: HTMLElement;
  private readonly observer: ResizeObserver;
  private handles: Handle[] = [];
  private menu: HTMLDivElement | null = null;
  private active: Handle | null = null;
  private frame = 0;
  private gesture: PointerGesture | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private ghost: HTMLDivElement | null = null;
  private dropLine: HTMLDivElement | null = null;
  private suppressClick = false;

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
    this.root.addEventListener("pointermove", this.pointerMove);
    this.root.addEventListener("pointerup", this.pointerUp);
    this.root.addEventListener("pointercancel", this.pointerCancel);
    this.root.addEventListener("lostpointercapture", this.pointerCancel);
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
    if (event.key === "Escape" && this.gesture) {
      event.preventDefault();
      this.cancelDrag();
      return;
    }
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
        ? ["上へ追加", "下へ追加", "行を複製", "行を削除", "上へ移動", "下へ移動"]
        : ["左へ追加", "右へ追加", "列を複製", "列を削除", "左へ移動", "右へ移動"];
    const length =
      handle.axis === "row" ? handle.table.childCount : handle.table.firstChild!.childCount;
    (["before", "after", "duplicate", "delete", "previous", "next"] as const).forEach(
      (action, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.dataset.tableAction = action;
        item.setAttribute("role", "menuitem");
        const profile = handle.table.firstChild?.firstChild?.type.name === "tableHeader";
        item.textContent = action === "delete" && handle.axis === "column" && length === 1 && profile ? "最終列を削除（表全体）" : labels[index];
        item.disabled =
          !!reorderDisabledReason(handle.table) ||
          (action === "delete" && length === 1 && !(profile && handle.axis === "column")) ||
          (profile && handle.axis === "row" && ((handle.index === 0 && ["delete","previous","next"].includes(action)) || (handle.index === 1 && action === "previous"))) ||
          (action === "previous" && handle.index === 0) ||
          (action === "next" && handle.index === length - 1);
        if (reorderDisabledReason(handle.table)) {
          item.title = "結合セルがある表の行・列は追加・複製・削除・移動できません。";
        }
        item.addEventListener("click", () =>
          this.apply(handle, menuAction(handle.axis, handle.index, action)),
        );
        menu.appendChild(item);
      },
    );
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
    const remaining = this.handles.filter(
      (current) => current.position === handle.position && current.axis === handle.axis,
    );
    const destination = Math.min(
      action.type === "move" ? action.to : handle.index,
      remaining.length - 1,
    );
    const target = remaining.find((current) => current.index === destination);
    if (!target) return;
    if (target.axis === "column") {
      const wrapper = target.tableDOM.closest<HTMLElement>(".tableWrapper");
      if (wrapper) {
        const clip = wrapper.getBoundingClientRect();
        const cell = target.itemDOM.getBoundingClientRect();
        const left = Math.max(0, clip.left + wrapper.clientLeft);
        const right = Math.min(
          window.innerWidth,
          clip.left + wrapper.clientLeft + wrapper.clientWidth,
        );
        // Reveal only within the table's scroller, never by scrolling the page.
        // Round outward because scrollLeft may be quantized to whole pixels.
        if (cell.left < left) wrapper.scrollLeft += Math.floor(cell.left - left);
        else if (cell.right > right) wrapper.scrollLeft += Math.ceil(cell.right - right);
      }
    }
    // Rebuild positions before focusing: a formerly offscreen handle is hidden.
    this.position();
    target.button.focus({ preventScroll: true });
  }

  private rebuild(): void {
    this.cancelDrag(false);
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
          const disabledReason = reorderDisabledReason(table);
          button.title = disabledReason
            ? "結合セルがある表の行・列は追加・複製・削除・移動できません。クリックで制限を確認できます。"
            : "ドラッグ（タッチは長押し）で移動。クリックまたは Enter で操作メニューを開きます。";
          button.setAttribute("aria-description", button.title);
          if (disabledReason) button.dataset.reorderDisabled = disabledReason;
          button.addEventListener("pointerdown", (event) => this.pointerDown(event, handle));
          button.addEventListener("click", (event) => {
            if (this.suppressClick && event.detail !== 0) {
              event.preventDefault();
              return;
            }
            this.open(handle);
          });
          button.addEventListener("contextmenu", (event) => {
            if (this.gesture) event.preventDefault();
          });
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
      const clip = (
        handle.tableDOM.closest(".tableWrapper") ?? handle.tableDOM
      ).getBoundingClientRect();
      const left = Math.max(0, clip.left);
      const right = Math.min(window.innerWidth, clip.right);
      const point = handlePosition(
        mount,
        { x: left, y: table.y, width: table.width, height: table.height },
        item,
        handle.axis,
        window.innerWidth,
      );
      handle.button.hidden =
        table.width === 0 ||
        table.height === 0 ||
        right <= left ||
        (handle.axis === "column" && (item.right <= left || item.left >= right));
      if (handle.axis === "column") {
        // Keep partially visible columns reachable while offscreen handles stay
        // out of the viewport and do not create page-level horizontal overflow.
        point.x = Math.max(left + 16, Math.min(item.x + item.width / 2, right - 16)) - mount.x;
      }
      handle.button.style.left = `${point.x}px`;
      handle.button.style.top = `${point.y}px`;
    }
    if (this.active?.button.hidden) this.close(false);
    if (this.menu && this.active) {
      const anchor = this.active.button.getBoundingClientRect();
      const menu = this.menu.getBoundingClientRect();
      this.menu.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - menu.width - 4)) - mount.left}px`;
      this.menu.style.top = `${Math.max(4, Math.min(anchor.bottom + 2, window.innerHeight - menu.height - 4)) - mount.top}px`;
    }
    if (this.gesture?.state.active) this.positionDrag();
  }

  private pointerDown(event: PointerEvent, handle: Handle): void {
    if (!event.isPrimary || event.button !== 0 || !this.view.editable) return;
    this.cancelDrag(false);
    this.suppressClick = false;
    if (reorderDisabledReason(handle.table)) return;
    this.close(false);
    handle.button.focus({ preventScroll: true });
    this.gesture = {
      handle,
      pointerId: event.pointerId,
      state: {
        pointerType: event.pointerType,
        start: handle.axis === "row" ? event.clientY : event.clientX,
        startedAt: performance.now(),
      },
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      to: handle.index,
    };
    handle.button.setPointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      this.holdTimer = setTimeout(() => this.advanceDrag(), 300);
    }
  }

  private pointerMove = (event: PointerEvent): void => {
    if (!this.gesture || this.gesture.pointerId !== event.pointerId) return;
    this.gesture.x = event.clientX;
    this.gesture.y = event.clientY;
    this.advanceDrag();
    if (this.gesture?.state.active) event.preventDefault();
  };

  private advanceDrag(): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const row = gesture.handle.axis === "row";
    gesture.state = beginPointerDrag(
      gesture.state,
      row ? gesture.y : gesture.x,
      performance.now(),
      row ? gesture.x - gesture.startX : gesture.y - gesture.startY,
    );
    if (gesture.state.cancelled) {
      this.cancelDrag();
      return;
    }
    if (!gesture.state.active) return;
    this.suppressClick = true;
    gesture.handle.button.dataset.dragging = "true";
    if (!this.ghost) {
      this.ghost = document.createElement("div");
      this.ghost.className = "table-drag-ghost";
      this.ghost.dataset.editorOverlay = "table-drag-ghost";
      this.ghost.setAttribute("role", "status");
      this.dropLine = document.createElement("div");
      this.dropLine.className = "table-drop-line";
      this.dropLine.dataset.editorOverlay = "table-drop-line";
      this.dropLine.setAttribute("aria-hidden", "true");
      this.root.appendChild(this.ghost);
      this.root.appendChild(this.dropLine);
    }
    this.positionDrag();
  }

  private positionDrag(): void {
    const gesture = this.gesture;
    if (!gesture || !this.ghost || !this.dropLine) return;
    const { handle } = gesture;
    const row = handle.axis === "row";
    const items = row ? [...handle.tableDOM.rows] : [...handle.tableDOM.rows[0].cells];
    const bounds = items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { start: row ? rect.top : rect.left, end: row ? rect.bottom : rect.right };
    });
    gesture.to = dragTargetIndex(bounds, handle.index, row ? gesture.y : gesture.x);
    const target = bounds[gesture.to];
    const boundary = gesture.to > handle.index ? target.end : target.start;
    const table = handle.tableDOM.getBoundingClientRect();
    const clip = (
      handle.tableDOM.closest(".tableWrapper") ?? handle.tableDOM
    ).getBoundingClientRect();
    const left = Math.max(0, clip.left);
    const right = Math.min(window.innerWidth, clip.right);
    this.ghost.textContent = `${handle.index + 1}${row ? "行" : "列"}目 → ${gesture.to + 1}${row ? "行" : "列"}目`;
    const ghost = this.ghost.getBoundingClientRect();
    this.ghost.style.left = `${Math.max(4, Math.min(gesture.x + 16, window.innerWidth - ghost.width - 4))}px`;
    this.ghost.style.top = `${Math.max(4, Math.min(gesture.y + 16, window.innerHeight - ghost.height - 4))}px`;
    this.dropLine.style.left = `${Math.max(left, Math.min(row ? table.left : boundary - 1, right - 2))}px`;
    this.dropLine.style.top = `${Math.max(0, row ? boundary - 1 : table.top)}px`;
    this.dropLine.style.width = `${row ? Math.max(0, right - left) : 2}px`;
    this.dropLine.style.height = `${row ? 2 : Math.max(0, Math.min(table.bottom, window.innerHeight) - Math.max(0, table.top))}px`;
  }

  private pointerUp = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const move = gesture.state.active && gesture.to !== gesture.handle.index;
    this.cancelDrag(false);
    if (move)
      this.apply(gesture.handle, {
        type: "move",
        axis: gesture.handle.axis,
        from: gesture.handle.index,
        to: gesture.to,
      });
  };

  private pointerCancel = (event: PointerEvent): void => {
    if (this.gesture?.pointerId === event.pointerId) this.cancelDrag();
  };

  private cancelDrag(restoreFocus = true): void {
    clearTimeout(this.holdTimer);
    const gesture = this.gesture;
    this.gesture = null;
    this.ghost?.remove();
    this.dropLine?.remove();
    this.ghost = null;
    this.dropLine = null;
    if (!gesture) return;
    if (gesture.state.active || gesture.state.cancelled || restoreFocus) this.suppressClick = true;
    delete gesture.handle.button.dataset.dragging;
    if (gesture.handle.button.hasPointerCapture(gesture.pointerId)) {
      gesture.handle.button.releasePointerCapture(gesture.pointerId);
    }
    if (restoreFocus) gesture.handle.button.focus({ preventScroll: true });
  }

  update(view: EditorView, previous: EditorState): void {
    if (previous.doc !== view.state.doc || this.root.hidden === view.editable) this.rebuild();
    else this.schedule();
  }

  destroy(): void {
    this.cancelDrag(false);
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
