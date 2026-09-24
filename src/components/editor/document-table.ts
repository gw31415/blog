import { Table } from "@tiptap/extension-table";
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
  markdownTokenizer: {
    name: "table",
    level: "block",
    start: () => -1,
    tokenize(source, _tokens, lexer) {
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
        raw: lines.slice(0, used).join("\n") + (used < lines.length ? "\n" : ""),
        header: parse(header),
        rows,
        align,
      };
    },
  },
}).configure({ resizable: false });
