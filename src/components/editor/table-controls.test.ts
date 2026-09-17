import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";
import { createEditorExtensions } from "./editor-extensions";
import {
  beginPointerDrag,
  dragTargetIndex,
  handlePosition,
  menuAction,
  reorderDisabledReason,
  tableActionTransaction,
} from "./table-controls";

describe("table pointer gestures", () => {
  it("starts a mouse drag only at three CSS pixels, in either direction", () => {
    const gesture = { pointerType: "mouse", start: 10, startedAt: 0 };
    expect(beginPointerDrag(gesture, 12, 10).active).toBe(false);
    expect(beginPointerDrag(gesture, 13, 10).active).toBe(true);
    expect(beginPointerDrag(gesture, 7, 10).active).toBe(true);
  });

  it("requires a stationary 300ms touch hold and retains activation while moving", () => {
    const gesture = { pointerType: "touch", start: 10, startedAt: 0 };
    expect(beginPointerDrag(gesture, 10, 200).active).toBe(false);
    const held = beginPointerDrag(gesture, 10, 300);
    expect(held.active).toBe(true);
    expect(beginPointerDrag(held, 90, 350).active).toBe(true);
  });

  it("cancels touch scrolling before activation on either axis and never restarts", () => {
    const gesture = { pointerType: "touch", start: 10, startedAt: 0 };
    const cancelled = beginPointerDrag(gesture, 20, 100);
    expect(cancelled).toMatchObject({ active: false, cancelled: true });
    expect(beginPointerDrag(cancelled, 10, 500).active).toBe(false);
    expect(beginPointerDrag(gesture, 10, 100, 10).cancelled).toBe(true);
  });

  it("maps pointer midpoint crossings to final indexes, accounting for removed source", () => {
    const bounds = [
      { start: 20, end: 40 },
      { start: 40, end: 80 },
      { start: 80, end: 100 },
    ];
    expect(dragTargetIndex(bounds, 0, -100)).toBe(0);
    expect(dragTargetIndex(bounds, 0, 59)).toBe(0);
    expect(dragTargetIndex(bounds, 0, 61)).toBe(1);
    expect(dragTargetIndex(bounds, 0, 200)).toBe(2);
    expect(dragTargetIndex(bounds, 2, 29)).toBe(0);
    expect(dragTargetIndex(bounds, 2, 59)).toBe(1);
  });
});

describe("table handle geometry", () => {
  const mount = { x: 80, y: 100, width: 500, height: 900 };
  const table = { x: 100, y: 300, width: 400, height: 120 };

  it("anchors row controls outside the table at each row center", () => {
    expect(handlePosition(mount, table, { x: 100, y: 340, width: 400, height: 50 }, "row")).toEqual(
      { x: 6, y: 265 },
    );
    expect(table).toEqual({ x: 100, y: 300, width: 400, height: 120 });
  });

  it("anchors column controls above the table at each cell center", () => {
    expect(
      handlePosition(mount, table, { x: 200, y: 300, width: 150, height: 40 }, "column"),
    ).toEqual({ x: 195, y: 186 });
  });

  it("keeps the full row button and focus outline within a narrow viewport", () => {
    expect(
      handlePosition(
        { x: 22, y: 100, width: 346, height: 900 },
        { x: 22, y: 300, width: 430, height: 120 },
        { x: 22, y: 340, width: 430, height: 50 },
        "row",
        390,
      ),
    ).toEqual({ x: -6, y: 265 });
  });
});

describe("table menu actions", () => {
  it("maps keyboard movement to the same final-index move transform", () => {
    expect(menuAction("row", 2, "previous")).toEqual({ type: "move", axis: "row", from: 2, to: 1 });
    expect(menuAction("column", 1, "next")).toEqual({
      type: "move",
      axis: "column",
      from: 1,
      to: 2,
    });
  });
  it.each([
    ["row", 2, "after", "insertAfter"],
    ["column", 1, "delete", "delete"],
    ["row", 0, "before", "insertBefore"],
    ["column", 2, "duplicate", "duplicate"],
  ] as const)("maps %s %i %s to the selected axis", (axis, index, item, type) => {
    expect(menuAction(axis, index, item)).toEqual({ type, axis, index });
  });
});

const schema = getSchema(createEditorExtensions());
const paragraph = (text: string) => schema.nodes.paragraph.create(null, schema.text(text));
const source = schema.nodes.table.create(null, [
  schema.nodes.tableRow.create(null, [schema.nodes.tableCell.create(null, paragraph("A"))]),
  schema.nodes.tableRow.create(null, [schema.nodes.tableCell.create(null, paragraph("B"))]),
]);
const state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, source) });

describe("table action transaction", () => {
  it("rejects merged-cell drags before activation and mutation", () => {
    const merged = schema.nodes.table.create(null, [
      schema.nodes.tableRow.create(null, [
        schema.nodes.tableCell.create({ colspan: 2 }, paragraph("A")),
      ]),
    ]);
    const disabledReason = reorderDisabledReason(merged);
    expect(disabledReason).toBe("merged-cells");
    expect(
      beginPointerDrag({ pointerType: "mouse", start: 0, startedAt: 0, disabledReason }, 40, 500),
    ).toMatchObject({ active: false, cancelled: true });
    expect(reorderDisabledReason(source)).toBeNull();
  });

  it("moves in one replacement step and rejects stale moves", () => {
    const action = menuAction("row", 0, "next");
    const transaction = tableActionTransaction(state, { position: 0, table: source }, action)!;
    expect(transaction.steps).toHaveLength(1);
    expect(transaction.doc.firstChild?.textContent).toBe("BA");
    expect(
      tableActionTransaction(state.apply(transaction), { position: 0, table: source }, action),
    ).toBeNull();
    expect(state.doc.firstChild?.textContent).toBe("AB");
  });
  it("replaces just the selected table in one transaction step", () => {
    const transaction = tableActionTransaction(
      state,
      { position: 0, table: source },
      menuAction("row", 1, "duplicate"),
    );
    expect(transaction?.steps).toHaveLength(1);
    expect(transaction?.doc.firstChild?.textContent).toBe("ABB");
    expect(state.doc.firstChild?.textContent).toBe("AB");
  });

  it("rejects a stale position even when a different table occupies it", () => {
    const changed = state.apply(state.tr.insertText("changed", 4));
    expect(
      tableActionTransaction(
        changed,
        { position: 0, table: source },
        menuAction("row", 1, "delete"),
      ),
    ).toBeNull();
    expect(
      tableActionTransaction(state, { position: 2, table: source }, menuAction("row", 0, "delete")),
    ).toBeNull();
  });

  it("does not create a transaction for deleting the final column", () => {
    expect(
      tableActionTransaction(
        state,
        { position: 0, table: source },
        menuAction("column", 0, "delete"),
      ),
    ).toBeNull();
  });
});
