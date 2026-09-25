import { inlineTags } from "./inline-format-contract";
import type { JSONContent } from "@tiptap/core";
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/[\\`*{}[\]()#+.!_:<>~$|=-]/g, "\\$&");
const title = (s: string | null | undefined) => escape(s ?? "");
function destination(s: string | null | undefined) {
  return `<${(s ?? "").replace(/\\/g, "\\\\").replace(/</g, "\\<").replace(/>/g, "\\>")}>`;
}
function linkTitle(s: string | null | undefined) {
  return s === null || s === undefined ? "" : ` "${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
type MathWriter = (latex: string) => string;
const dollarMath: MathWriter = (latex) => `$${latex}$`;
function inline(
  nodes: JSONContent[],
  table = false,
  heading = false,
  math: MathWriter = dollarMath,
): string {
  // Serialize shared mark runs together, including marked soft breaks.
  const run = nodes.findIndex((n) => n.marks?.some((m) => m.type !== "code"));
  if (run >= 0) {
    const mark = nodes[run].marks!.find((m) => m.type !== "code")!;
    let end = run + 1;
    const same = (n: JSONContent) =>
      n.marks?.some((m) => JSON.stringify(m) === JSON.stringify(mark));
    while (end < nodes.length && same(nodes[end])) end++;
    const stripped = nodes.slice(run, end).map((n) => ({
      ...n,
      marks: n.marks?.filter((m) => JSON.stringify(m) !== JSON.stringify(mark)),
    }));
    let content = inline(stripped, table, heading, math);
    if (mark.type === "link")
      content = `[${content}](${destination(mark.attrs?.href)}${linkTitle(mark.attrs?.title)})`;
    else if (inlineTags[mark.type])
      content = `<${inlineTags[mark.type]}>${content}</${inlineTags[mark.type]}>`;
    else {
      const delimiter = mark.type === "bold" ? "**" : mark.type === "italic" ? "*" : "~~";
      content =
        delimiter +
        content.replace(/^ +| +$/g, (s) => Array.from(s, () => "&#32;").join("")) +
        delimiter;
    }
    const before = inline(nodes.slice(0, run), table, heading, math);
    const after = inline(nodes.slice(end), table, heading, math);
    const delimited = ["bold", "italic", "strike"].includes(mark.type);
    // Export-only separators: leave the source JSON and typing rules untouched.
    const left = delimited && before && !/\s$/.test(before) ? " " : "";
    const right = delimited && after && !/^\s/.test(after) ? " " : "";
    return before + left + content + right + after;
  }
  return nodes
    .map((n, i) => {
      let out = "";
      const marks = n.marks ?? [];
      if (n.type === "text") {
        if (marks.some((m) => m.type === "code")) {
          const raw = n.text ?? "";
          const fence = "`".repeat(
            Math.max(0, ...Array.from(raw.matchAll(/`+/g), (m) => m[0].length)) + 1,
          );
          const padding =
            raw.startsWith("`") || raw.endsWith("`") || (/^ .* $/.test(raw) && !!raw.trim())
              ? " "
              : "";
          out = fence + padding + raw + padding + fence;
        } else out = escape(n.text ?? "");
        if (nodes[i - 1]?.type === "inlineMath" && /^\d/.test(out))
          out = `&#${out.charCodeAt(0)};` + out.slice(1);
      } else if (n.type === "image")
        out = `![${title(n.attrs?.alt)}](${destination(n.attrs?.src)}${linkTitle(n.attrs?.title)})`;
      else if (n.type === "inlineMath") out = math(String(n.attrs?.latex ?? ""));
      else if (n.type === "hardBreak")
        out =
          table || heading || i === nodes.length - 1 || nodes[i + 1]?.type?.endsWith("Break")
            ? "<br>"
            : "\\\n";
      else if (n.type === "softBreak") out = "\n";
      for (let markIndex = marks.length - 1; markIndex >= 0; markIndex--) {
        const m = marks[markIndex];
        if (m.type === "code") continue;
        if (m.type === "link")
          out = `[${out}](${destination(m.attrs?.href)}${linkTitle(m.attrs?.title)})`;
        else if (inlineTags[m.type]) out = `<${inlineTags[m.type]}>${out}</${inlineTags[m.type]}>`;
        else {
          const delimiter = m.type === "bold" ? "**" : m.type === "italic" ? "*" : "~~";
          out = out.replace(/^ +| +$/g, (s) => Array.from(s, () => "&#32;").join(""));
          out = delimiter + out + delimiter;
        }
      }
      if (table)
        out =
          n.type === "inlineMath" || marks.some((m) => m.type === "code")
            ? out.replaceAll("|", "\\|")
            : out.replace(/(?<!\\)((?:\\\\)*)\|/g, "$1\\|");
      return out;
    })
    .join("");
}
export function documentMarkdown(document: JSONContent): string {
  return documentMarkdownWithMath(document, dollarMath);
}

export function documentMarkdownWithMath(document: JSONContent, math: MathWriter): string {
  function sequence(nodes: JSONContent[]): string {
    return nodes.map((node, i) => block(node, nodes[i - 1], i)).join("\n\n");
  }
  function block(n: JSONContent, previous?: JSONContent, index = 0): string {
    const children = n.content ?? [],
      a = n.attrs ?? {};
    switch (n.type) {
      case "doc":
        return sequence(children);
      case "paragraph":
        return inline(children, false, false, math);
      case "heading":
        return "#".repeat(a.level) + " " + inline(children, false, true, math);
      case "horizontalRule":
        return "---";
      case "blockquote":
        return sequence(children)
          .split("\n")
          .map((line) => "> " + line)
          .join("\n");
      case "codeBlock": {
        const source = children.map((c) => c.text ?? "").join("");
        const fence = "`".repeat(
          Math.max(2, ...Array.from(source.matchAll(/`+/g), (m) => m[0].length)) + 1,
        );
        const code = `${fence}${a.language ?? ""}\n${source}\n${fence}`;
        if (a.language === "mermaid" && a.caption) {
          const wrapper = ":".repeat(
            Math.max(2, ...Array.from(code.matchAll(/^(:{3,})/gm), (m) => m[1].length)) + 1,
          );
          return `${wrapper}{figure}\n${code}\n\n${title(a.caption)}\n${wrapper}`;
        }
        return code;
      }
      case "blockMath":
        return `$$\n${a.latex}\n$$`;
      case "bulletList":
      case "orderedList":
      case "taskList":
        return children
          .map((item, i) => {
            const alternate = previous?.type === n.type && index % 2 === 1;
            const marker =
              n.type === "orderedList"
                ? `${i === 0 ? a.start : 1}${alternate ? ")" : "."} `
                : `${alternate ? "*" : "-"} ${n.type === "taskList" ? `[${item.attrs?.checked ? "x" : " "}] ` : ""}`;
            const content = (item.content ?? [])
              .map((child, j) => block(child, item.content?.[j - 1], j))
              .join(a.tight ? "\n" : "\n\n");
            const lines = content.split("\n");
            return (
              marker +
              lines[0] +
              lines
                .slice(1)
                .map((line) => "\n" + " ".repeat(n.type === "taskList" ? 2 : marker.length) + line)
                .join("")
            );
          })
          .join(a.tight ? "\n" : "\n\n");
      case "table": {
        const rows = children.map(
          (row) =>
            "| " +
            (row.content ?? [])
              .map((cell) => inline(cell.content?.[0].content ?? [], true, false, math))
              .join(" | ") +
            " |",
        );
        const delimiters =
          "| " +
          children[0]
            .content!.map((cell) =>
              cell.attrs?.align === "left"
                ? ":---"
                : cell.attrs?.align === "center"
                  ? ":---:"
                  : cell.attrs?.align === "right"
                    ? "---:"
                    : "---",
            )
            .join(" | ") +
          " |";
        const table = [rows[0], delimiters, ...rows.slice(1)].join("\n");
        if (children[0]?.content?.[0]?.type === "tableCell")
          return `:::{table}${a.title ? " " + title(a.title) : ""}\n:header: false\n\n${table}\n:::`;
        return a.title ? `:::{table} ${title(a.title)}\n${table}\n:::` : table;
      }
      case "callout":
      case "details":
      case "figure": {
        const body = sequence(children);
        const fence = ":".repeat(
          Math.max(2, ...Array.from(body.matchAll(/^(:{3,})/gm), (m) => m[1].length)) + 1,
        );
        const name = n.type === "callout" ? a.kind : n.type === "details" ? "dropdown" : "figure";
        const argument = n.type === "figure" ? a.src : a.title;
        return `${fence}{${name}}${argument === null || argument === undefined ? "" : " " + (n.type === "figure" ? String(argument) : title(argument))}\n${n.type === "figure" ? ":alt: " + title(a.alt) + "\n\n" : ""}${body}\n${fence}`;
      }
      default:
        throw new Error(`Markdownに変換できません: ${n.type}`);
    }
  }
  return block(document);
}
