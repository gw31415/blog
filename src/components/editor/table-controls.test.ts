import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";
import { createEditorExtensions } from "./editor-extensions";
import { handlePosition, menuAction, tableActionTransaction } from "./table-controls";

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
});

describe("table menu actions", () => {
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
