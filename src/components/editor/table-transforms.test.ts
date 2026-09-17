import { getSchema } from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";
import { describe, expect, it } from "vite-plus/test";

import { createEditorExtensions } from "./editor-extensions";
import { canReorderTable, transformTable, type TableAction } from "./table-transforms";

const schema = getSchema(createEditorExtensions());

function cell(
  nodeSchema: Schema,
  type: "tableCell" | "tableHeader",
  text: string,
  attrs: Record<string, unknown> = {},
): ProseMirrorNode {
  return nodeSchema.nodes[type].create(
    attrs,
    nodeSchema.nodes.paragraph.create(undefined, text ? nodeSchema.text(text) : undefined),
  );
}

function table(
  rows: ReadonlyArray<ReadonlyArray<["tableCell" | "tableHeader", string]>>,
): ProseMirrorNode {
  return schema.nodes.table.create(
    undefined,
    rows.map((cells) =>
      schema.nodes.tableRow.create(
        undefined,
        cells.map(([type, text]) => cell(schema, type, text)),
      ),
    ),
  );
}

function tableRows(node: ProseMirrorNode): string[][] {
  const rows: string[][] = [];
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((currentCell) => cells.push(currentCell.textContent));
    rows.push(cells);
  });
  return rows;
}

function successfulTable(node: ProseMirrorNode, action: TableAction): ProseMirrorNode {
  const result = transformTable(node, action);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected transform to succeed, got ${result.reason}`);
  return result.table;
}

describe("transformTable", () => {
  const mixedTable = () =>
    table([
      [
        ["tableHeader", "H1"],
        ["tableHeader", "H2"],
      ],
      [
        ["tableCell", "A1"],
        ["tableCell", "A2"],
      ],
      [
        ["tableCell", "B1"],
        ["tableCell", "B2"],
      ],
    ]);

  it.each([
    ["above", "insertBefore" as const, 1],
    ["below", "insertAfter" as const, 2],
  ])("inserts a blank row %s with the source row's cell types", (_label, type, blankIndex) => {
    const source = mixedTable();

    const result = successfulTable(source, { type, axis: "row", index: 1 });

    expect(tableRows(result)).toEqual([
      ["H1", "H2"],
      ...(blankIndex === 1 ? [["", ""]] : []),
      ["A1", "A2"],
      ...(blankIndex === 2 ? [["", ""]] : []),
      ["B1", "B2"],
    ]);
    expect(result.child(blankIndex).child(0).type.name).toBe("tableCell");
    expect(result.child(blankIndex).child(1).type.name).toBe("tableCell");
    expect(result.child(blankIndex).child(0).child(0).type.name).toBe("paragraph");
    expect(source.childCount).toBe(3);
  });

  it.each([
    ["left", "insertBefore" as const, 1],
    ["right", "insertAfter" as const, 2],
  ])(
    "inserts a blank column to the %s with each source cell's type",
    (_label, type, blankIndex) => {
      const source = mixedTable();

      const result = successfulTable(source, { type, axis: "column", index: 1 });

      expect(tableRows(result)).toEqual([
        ["H1", ...(blankIndex === 1 ? [""] : []), "H2", ...(blankIndex === 2 ? [""] : [])],
        ["A1", ...(blankIndex === 1 ? [""] : []), "A2", ...(blankIndex === 2 ? [""] : [])],
        ["B1", ...(blankIndex === 1 ? [""] : []), "B2", ...(blankIndex === 2 ? [""] : [])],
      ]);
      expect(result.child(0).child(blankIndex).type.name).toBe("tableHeader");
      expect(result.child(1).child(blankIndex).type.name).toBe("tableCell");
      expect(source.child(0).childCount).toBe(2);
    },
  );

  it("preserves source cell attributes while replacing inserted content with one paragraph", () => {
    const sourceCell = cell(schema, "tableCell", "source", {
      align: "right",
      colspan: 1,
      rowspan: 1,
      colwidth: [144],
    });
    const source = schema.nodes.table.create(
      undefined,
      schema.nodes.tableRow.create(undefined, sourceCell),
    );
    const sourceJSON = source.toJSON();

    const result = successfulTable(source, { type: "insertAfter", axis: "row", index: 0 });
    const insertedCell = result.child(1).child(0);

    expect(insertedCell.attrs).toEqual(sourceCell.attrs);
    expect(insertedCell.childCount).toBe(1);
    expect(insertedCell.child(0).type.name).toBe("paragraph");
    expect(insertedCell.textContent).toBe("");
    expect(source.toJSON()).toEqual(sourceJSON);
  });

  it("duplicates a row with its cell content", () => {
    const result = successfulTable(mixedTable(), { type: "duplicate", axis: "row", index: 1 });

    expect(tableRows(result)).toEqual([
      ["H1", "H2"],
      ["A1", "A2"],
      ["A1", "A2"],
      ["B1", "B2"],
    ]);
  });

  it("duplicates a column with its cell content", () => {
    const result = successfulTable(mixedTable(), {
      type: "duplicate",
      axis: "column",
      index: 0,
    });

    expect(tableRows(result)).toEqual([
      ["H1", "H1", "H2"],
      ["A1", "A1", "A2"],
      ["B1", "B1", "B2"],
    ]);
  });

  it.each([
    [
      "row" as const,
      1,
      [
        ["H1", "H2"],
        ["B1", "B2"],
      ],
    ],
    ["column" as const, 0, [["H2"], ["A2"], ["B2"]]],
  ])("deletes a %s while more than one remains", (axis, index, expected) => {
    const result = successfulTable(mixedTable(), { type: "delete", axis, index });

    expect(tableRows(result)).toEqual(expected);
  });

  it.each([
    ["row" as const, table([[["tableCell", "only"]]])],
    ["column" as const, table([[["tableHeader", "H"]], [["tableCell", "A"]]])],
  ])("rejects deleting the last %s", (axis, source) => {
    expect(transformTable(source, { type: "delete", axis, index: 0 })).toEqual({
      ok: false,
      reason: "last-axis",
    });
  });

  it.each([
    [
      "row down",
      { type: "move", axis: "row", from: 1, to: 2 } as const,
      [
        ["H1", "H2"],
        ["B1", "B2"],
        ["A1", "A2"],
      ],
    ],
    [
      "row up",
      { type: "move", axis: "row", from: 2, to: 1 } as const,
      [
        ["H1", "H2"],
        ["B1", "B2"],
        ["A1", "A2"],
      ],
    ],
    [
      "column right",
      { type: "move", axis: "column", from: 0, to: 1 } as const,
      [
        ["H2", "H1"],
        ["A2", "A1"],
        ["B2", "B1"],
      ],
    ],
    [
      "column left",
      { type: "move", axis: "column", from: 1, to: 0 } as const,
      [
        ["H2", "H1"],
        ["A2", "A1"],
        ["B2", "B1"],
      ],
    ],
  ])("moves a %s to its final index", (_label, action, expected) => {
    const result = successfulTable(mixedTable(), action);

    expect(tableRows(result)).toEqual(expected);
  });

  it.each([
    { type: "insertBefore", axis: "row", index: -1 } as const,
    { type: "insertAfter", axis: "row", index: 3 } as const,
    { type: "duplicate", axis: "column", index: 2 } as const,
    { type: "delete", axis: "column", index: -1 } as const,
    { type: "move", axis: "row", from: -1, to: 0 } as const,
    { type: "move", axis: "row", from: 0, to: 3 } as const,
    { type: "move", axis: "column", from: 2, to: 0 } as const,
  ])("rejects out-of-range action %#", (action) => {
    expect(transformTable(mixedTable(), action)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it.each([
    ["rowspan", { rowspan: 2 }],
    ["colspan", { colspan: 2 }],
  ])("rejects moves when a cell has a non-unit %s", (_attribute, attrs) => {
    const merged = schema.nodes.table.create(undefined, [
      schema.nodes.tableRow.create(undefined, [
        cell(schema, "tableCell", "merged", attrs),
        cell(schema, "tableCell", "other"),
      ]),
      schema.nodes.tableRow.create(undefined, [
        cell(schema, "tableCell", "next"),
        cell(schema, "tableCell", "last"),
      ]),
    ]);

    expect(canReorderTable(merged)).toBe(false);
    expect(transformTable(merged, { type: "move", axis: "row", from: 0, to: 1 })).toEqual({
      ok: false,
      reason: "merged-cells",
    });
    expect(transformTable(merged, { type: "move", axis: "column", from: 0, to: 1 })).toEqual({
      ok: false,
      reason: "merged-cells",
    });
  });

  it("allows reordering a rectangular table whose cells all span one slot", () => {
    expect(canReorderTable(mixedTable())).toBe(true);
  });

  it.each(["rowspan", "colspan"] as const)(
    "rejects every structural action on a valid %s table without changing its map or data",
    (span) => {
      const cells = (text: string, attrs: Record<string, unknown> = {}) =>
        cell(schema, "tableCell", text, attrs);
      const rows =
        span === "rowspan"
          ? [
              [cells("A", { rowspan: 2 }), cells("B", { colspan: 2 })],
              [cells("C"), cells("D")],
            ]
          : [
              [cells("A", { colspan: 2 }), cells("B")],
              [cells("C"), cells("D", { colspan: 2 })],
            ];
      const source = schema.nodes.table.create(
        null,
        rows.map((items) => schema.nodes.tableRow.create(null, items)),
      );
      const original = source.toJSON();
      const map = TableMap.get(source);
      expect(map.problems).toBeNull();
      expect([map.width, map.height]).toEqual([3, 2]);
      for (const axis of ["row", "column"] as const) {
        for (const type of [
          "insertBefore",
          "insertAfter",
          "duplicate",
          "delete",
          "move",
        ] as const) {
          const action: TableAction =
            type === "move" ? { type, axis, from: 0, to: 1 } : { type, axis, index: 0 };
          expect(transformTable(source, action), `${span} ${axis} ${type}`).toEqual({
            ok: false,
            reason: "merged-cells",
          });
          expect(source.toJSON()).toEqual(original);
          expect(TableMap.get(source).problems).toBeNull();
        }
      }
    },
  );
});
