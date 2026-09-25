import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";

export type TableAxis = "row" | "column";

export type TableAction =
  | { type: "setHeader"; enabled: boolean }
  | {
      type: "insertBefore" | "insertAfter" | "duplicate" | "delete";
      axis: TableAxis;
      index: number;
    }
  | { type: "move"; axis: TableAxis; from: number; to: number };

export type TableTransformResult =
  | { ok: true; table: ProseMirrorNode }
  | { ok: false; reason: "last-axis" | "merged-cells" | "out-of-range" | "header-row" };

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => children.push(child));
  return children;
}

function isIndexInRange(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

function blankCell(source: ProseMirrorNode): ProseMirrorNode {
  return source.type.create(
    source.attrs,
    source.type.schema.nodes.paragraph.create(),
    source.marks,
  );
}

function rebuildRow(row: ProseMirrorNode, cells: readonly ProseMirrorNode[]): ProseMirrorNode {
  return row.type.create(row.attrs, Fragment.fromArray(cells), row.marks);
}

function rebuildTable(
  table: ProseMirrorNode,
  rows: readonly ProseMirrorNode[],
): TableTransformResult {
  return {
    ok: true,
    table: table.type.create(table.attrs, Fragment.fromArray(rows), table.marks),
  };
}

function hasRectangularRows(rows: readonly ProseMirrorNode[], columnCount: number): boolean {
  return rows.length > 0 && rows.every((row) => row.childCount === columnCount);
}

export function canReorderTable(table: ProseMirrorNode): boolean {
  let canReorder = true;
  table.descendants((node) => {
    if (
      (node.type.name === "tableCell" || node.type.name === "tableHeader") &&
      (node.attrs.rowspan !== 1 || node.attrs.colspan !== 1)
    ) {
      canReorder = false;
      return false;
    }
    return canReorder;
  });
  return canReorder;
}

export function transformTable(table: ProseMirrorNode, action: TableAction): TableTransformResult {
  if (action.type === "setHeader") {
    const rows = childNodes(table);
    if (!rows.length) return { ok: false, reason: "out-of-range" };
    const cellType = table.type.schema.nodes[action.enabled ? "tableHeader" : "tableCell"];
    const firstRow = rebuildRow(
      rows[0],
      childNodes(rows[0]).map((cell) => cellType.create(cell.attrs, cell.content, cell.marks)),
    );
    return rebuildTable(table, [firstRow, ...rows.slice(1)]);
  }
  // These transforms address physical cells, which only match logical columns
  // in an unmerged table. Reject every structural operation before indexing.
  if (!canReorderTable(table)) {
    return { ok: false, reason: "merged-cells" };
  }
  const rows = childNodes(table);
  const columnCount = rows[0]?.childCount ?? 0;
  const axisLength = action.axis === "row" ? rows.length : columnCount;

  if (
    !hasRectangularRows(rows, columnCount) ||
    (action.type === "move"
      ? !isIndexInRange(action.from, axisLength) || !isIndexInRange(action.to, axisLength)
      : !isIndexInRange(action.index, axisLength))
  ) {
    return { ok: false, reason: "out-of-range" };
  }

  if (action.type === "delete" && axisLength === 1) {
    return { ok: false, reason: "last-axis" };
  }

  if (action.axis === "row") {
    const hasHeader = rows[0].firstChild?.type.name === "tableHeader";
    if (
      hasHeader &&
      ((action.type === "delete" && action.index === 0) ||
        (action.type === "move" && (action.from === 0 || action.to === 0)))
    )
      return { ok: false, reason: "header-row" };
    if (action.type === "move") {
      return rebuildTable(table, moveItem(rows, action.from, action.to));
    }

    if (action.type === "delete") {
      return rebuildTable(
        table,
        rows.filter((_row, index) => index !== action.index),
      );
    }

    const source = rows[action.index];
    let inserted =
      action.type === "duplicate"
        ? source
        : rebuildRow(
            source,
            childNodes(source).map((sourceCell) => blankCell(sourceCell)),
          );
    if (hasHeader)
      inserted = rebuildRow(
        inserted,
        childNodes(inserted).map((cell) =>
          table.type.schema.nodes.tableCell.create(cell.attrs, cell.content, cell.marks),
        ),
      );
    const insertionIndex = Math.max(
      hasHeader ? 1 : 0,
      action.type === "insertBefore" ? action.index : action.index + 1,
    );
    const nextRows = [...rows];
    nextRows.splice(insertionIndex, 0, inserted);
    return rebuildTable(table, nextRows);
  }

  const nextRows = rows.map((row) => {
    const cells = childNodes(row);

    if (action.type === "move") {
      return rebuildRow(row, moveItem(cells, action.from, action.to));
    }

    if (action.type === "delete") {
      return rebuildRow(
        row,
        cells.filter((_cell, index) => index !== action.index),
      );
    }

    const source = cells[action.index];
    const inserted = action.type === "duplicate" ? source : blankCell(source);
    const insertionIndex = action.type === "insertBefore" ? action.index : action.index + 1;
    const nextCells = [...cells];
    nextCells.splice(insertionIndex, 0, inserted);
    return rebuildRow(row, nextCells);
  });

  return rebuildTable(table, nextRows);
}
