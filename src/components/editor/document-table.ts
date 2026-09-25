import { Table } from "@tiptap/extension-table";
import type { MarkdownToken } from "@tiptap/core";
function cells(line: string): string[] {
  const result: string[] = [];
  let current = "";
  line = line.trim();
  if (line.startsWith("|")) line = line.slice(1);
  if (line.endsWith("|") && line.at(-2) !== "\\") line = line.slice(0, -1);
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|" && current.endsWith("\\")) current = current.slice(0, -1) + "|";
    else if (line[i] === "|") {
      result.push(current.trim());
      current = "";
    } else current += line[i];
  }
  result.push(current.trim());
  return result;
}
export const DocumentTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), title: { default: null, rendered: false } };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "table",
      { ...HTMLAttributes, "data-article-table": "" },
      ...(node.attrs.title ? [["caption", {}, String(node.attrs.title)]] : []),
      ["tbody", 0],
    ];
  },
  addNodeView() {
    return ({ node, view, getPos }) => {
      let currentNode = node;
      const document = view.dom.ownerDocument;
      const dom = document.createElement("table");
      dom.dataset.articleTable = "";
      const caption = document.createElement("caption");
      caption.dataset.articleRole = "table-title";
      const contentDOM = document.createElement("tbody");
      dom.appendChild(caption);
      dom.appendChild(contentDOM);
      const render = () => {
        caption.hidden = !currentNode.attrs.title && !view.editable;
        caption.contentEditable = view.editable ? "plaintext-only" : "false";
        if (document.activeElement !== caption)
          caption.textContent = String(currentNode.attrs.title ?? "");
      };
      caption.addEventListener("blur", () => {
        if (!view.editable) return;
        const position = getPos();
        if (typeof position !== "number") return;
        view.dispatch(
          view.state.tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            title: caption.textContent?.trim() || null,
          }),
        );
      });
      render();
      return {
        dom,
        contentDOM,
        update(updated) {
          if (updated.type !== currentNode.type) return false;
          currentNode = updated;
          render();
          return true;
        },
        ignoreMutation: (mutation) => caption.contains(mutation.target),
        stopEvent: (event) =>
          event.target instanceof globalThis.Node && caption.contains(event.target),
      };
    };
  },
  parseMarkdown(token, helpers) {
    const t: {
      type?: string;
      title?: string | null;
      hasHeader?: boolean;
      header?: Array<{ tokens?: MarkdownToken[] }>;
      rows?: Array<Array<{ tokens?: MarkdownToken[] }>>;
      align?: Array<string | null>;
    } = token;
    const alignments = Array.isArray(t.align) ? t.align : [];
    const rows = [];
    for (const [rowIndex, row] of [t.header ?? [], ...(t.rows ?? [])].entries()) {
      rows.push(
        helpers.createNode(
          "tableRow",
          {},
          row.map((cell, index) =>
            helpers.createNode(
              rowIndex === 0 && t.hasHeader !== false ? "tableHeader" : "tableCell",
              {
                align: alignments[index] ?? null,
              },
              [{ type: "paragraph", content: helpers.parseInline(cell.tokens ?? []) }],
            ),
          ),
        ),
      );
    }
    return helpers.createNode("table", { title: t.title ?? null }, rows);
  },
  markdownTokenizer: {
    name: "table",
    level: "block",
    start: (source) => /^:{3,}\{table\}/m.exec(source)?.index ?? -1,
    tokenize(source, _tokens, lexer) {
      const wrapper =
        /^(:{3,})\{table\}(?:[ \t]+([^\n]+))?\n(?:(:header:[ \t]*false)\n\n?)?([\s\S]*?)\n\1(?=\n|$)/.exec(
          source,
        );
      const original = source;
      const title =
        wrapper?.[2]?.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1") ?? null;
      if (wrapper) source = wrapper[4];
      const lines = source.split("\n");
      if (lines.length < 2 || !lines[0].includes("|") || !lines[1].includes("|")) return undefined;
      const delimiters = cells(lines[1]);
      if (!delimiters.every((d) => /^:?-{3,}:?$/.test(d))) return undefined;
      const header = cells(lines[0]);
      if (header.length !== delimiters.length)
        throw new Error("表のヘッダーと区切りの列数が一致しません");
      const align = delimiters.map((d) =>
        d.startsWith(":")
          ? d.endsWith(":")
            ? "center"
            : "left"
          : d.endsWith(":")
            ? "right"
            : null,
      );
      const parse = (row: string[]) => {
        if (row.length > header.length)
          throw new Error("表の列数が超過しています。原文を保持しています");
        return Array.from({ length: header.length }, (_, i) => ({
          text: row[i] ?? "",
          tokens: lexer.inlineTokens(row[i] ?? ""),
        }));
      };
      const rows = [];
      let used = 2;
      while (used < lines.length && lines[used].trim() && lines[used].includes("|")) {
        rows.push(parse(cells(lines[used])));
        used++;
      }
      return {
        type: "table",
        raw: wrapper
          ? original.slice(0, wrapper[0].length)
          : lines.slice(0, used).join("\n") + (used < lines.length ? "\n" : ""),
        header: parse(header),
        rows,
        align,
        title,
        hasHeader: !wrapper?.[3],
      };
    },
  },
}).configure({ resizable: false });
