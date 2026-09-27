import { inlineTags } from "../components/editor/inline-format-contract";
import type { JSONContent } from "@tiptap/core";
import { documentMarkdown, documentMarkdownWithMath } from "../components/editor/document-markdown";
import { normalizeSingleLine } from "./article";
export type ExportTarget = "canonical" | "github" | "zenn" | "qiita";
export interface ExportArticle {
  title: string;
  subtitle: string | null;
  tags: string[];
  body: JSONContent;
}
export function exportArticle(article: ExportArticle, target: ExportTarget, origin: string) {
  const diagnostics: string[] = [];
  const heading = documentMarkdown({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: normalizeSingleLine(article.title).trim() || "無題" }],
      },
    ],
  });
  if (target === "canonical")
    return {
      markdown: [heading, documentMarkdown(article.body)].filter(Boolean).join("\n\n"),
      diagnostics,
    };
  const canonical = (node: JSONContent) =>
    documentMarkdownWithMath({ type: "doc", content: [node] }, (latex) => {
      if (target === "zenn") return `$${latex}$`;
      if (latex.includes("`"))
        diagnostics.push(
          "インライン数式にバッククォートがあります。出力先の区切りを確認してください。",
        );
      return "$`" + latex + "`$";
    });
  const paragraph = (text: string) =>
    canonical({
      type: "paragraph",
      content: [{ type: "text", text }],
    });
  function convert(node: JSONContent, depth = 0): string {
    const attrs = node.attrs ?? {},
      children = node.content ?? [];
    if (target === "canonical") return canonical(node);
    if (node.type === "callout") {
      const title = attrs.title ? `**${String(attrs.title).replace(/[\\*]/g, "\\$&")}**\n\n` : "";
      const body = title + children.map((c) => convert(c, depth + 1)).join("\n\n");
      if (target === "github") {
        if (depth) {
          diagnostics.push("入れ子の補足を、種別・題名付きの通常引用へ変換しました。");
          return `${attrs.kind === "warning" ? "WARN" : "INFO"}\n\n${body}`
            .split("\n")
            .map((line) => "> " + line)
            .join("\n");
        }
        return (
          `> [!${attrs.kind === "warning" ? "WARNING" : "NOTE"}]\n` +
          body
            .split("\n")
            .map((line) => "> " + line)
            .join("\n")
        );
      }
      const fence = ":".repeat(
        Math.max(2, ...Array.from(body.matchAll(/^(:{3,})/gm), (m) => m[1].length)) + 1,
      );
      return `${fence}${target === "zenn" ? `message${attrs.kind === "warning" ? " alert" : ""}` : `note ${attrs.kind === "warning" ? "warn" : "info"}`}\n${body}\n${fence}`;
    }
    if (node.type === "details") {
      const body = children.map((c) => convert(c, depth + 1)).join("\n\n");
      if (target === "zenn") {
        const fence = ":".repeat(
          Math.max(2, ...Array.from(body.matchAll(/^(:{3,})/gm), (m) => m[1].length)) + 1,
        );
        return `${fence}details ${attrs.title}\n${body}\n${fence}`;
      }
      const title = String(attrs.title)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `<details>\n<summary>${title}</summary>\n\n${body}\n\n</details>`;
    }
    if (node.type === "figure") {
      diagnostics.push("図を通常画像とキャプション段落に分解しました。");
      return (
        canonical({
          type: "paragraph",
          content: [{ type: "image", attrs: { src: attrs.src, alt: attrs.alt, title: null } }],
        }) +
        "\n\n" +
        children.map((c) => convert(c, depth)).join("\n\n")
      );
    }
    if (node.type === "blockMath" && target !== "zenn") return `\`\`\`math\n${attrs.latex}\n\`\`\``;
    if (
      node.type === "codeBlock" &&
      attrs.language === "mermaid" &&
      children.map((c) => c.text ?? "").join("").length > 2000 &&
      target !== "github"
    )
      diagnostics.push(
        "Mermaidが2000文字を超えています。出力先の制限を確認してください。原文は保持しました。",
      );
    if (node.type === "codeBlock" && attrs.language === "mermaid" && attrs.caption) {
      diagnostics.push("Mermaidのキャプションを通常段落に分離しました。");
      return (
        canonical({ ...node, attrs: { ...attrs, caption: null } }) +
        "\n\n" +
        paragraph(String(attrs.caption))
      );
    }
    if (node.type === "table") {
      let rows = children;
      if (children[0]?.content?.[0]?.type === "tableCell") {
        diagnostics.push(
          "ヘッダーなし表に空のヘッダー行を追加しました。元の行はデータ行として保持しました。",
        );
        rows = [
          {
            type: "tableRow",
            content: children[0].content.map((cell) => ({
              type: "tableHeader",
              attrs: { ...cell.attrs },
              content: [{ type: "paragraph" }],
            })),
          },
          ...children,
        ];
      }
      const table = canonical({ ...node, attrs: { ...attrs, title: null }, content: rows });
      if (!attrs.title) return table;
      diagnostics.push("表題を通常段落に分離しました。");
      return paragraph(String(attrs.title)) + "\n\n" + table;
    }
    if (node.type === "blockquote")
      return children
        .map((c) => convert(c, depth + 1))
        .join("\n\n")
        .split("\n")
        .map((l) => "> " + l)
        .join("\n");
    // Convert nested containers without changing the article's source JSON.
    if (
      ["bulletList", "orderedList", "taskList"].includes(node.type ?? "") &&
      JSON.stringify(node).match(/"type":"(?:callout|details|figure|blockMath|table|codeBlock)"/)
    ) {
      return children
        .map((item, i) => {
          const marker =
            node.type === "orderedList"
              ? `${i ? 1 : attrs.start}. `
              : `- ${node.type === "taskList" ? `[${item.attrs?.checked ? "x" : " "}] ` : ""}`;
          const lines = (item.content ?? [])
            .map((c) => convert(c, depth + 1))
            .join("\n\n")
            .split("\n");
          return (
            marker +
            lines[0] +
            lines
              .slice(1)
              .map((l) => "\n" + " ".repeat(marker.length) + l)
              .join("")
          );
        })
        .join("\n\n");
    }
    return canonical(node);
  }
  const body = structuredClone(article.body);
  const urls = (node: JSONContent) => {
    if (node.marks && target === "zenn") {
      node.marks = node.marks.flatMap((mark) => {
        if (!inlineTags[mark.type]) return [mark];
        if (mark.type === "b" || mark.type === "i") {
          diagnostics.push(
            `Zenn向けに${mark.type}を${mark.type === "b" ? "strong" : "em"}へ変換しました。意味の区別は保持されません。`,
          );
          return [{ type: mark.type === "b" ? "bold" : "italic" }];
        }
        diagnostics.push(
          `Zenn向けでは${inlineTags[mark.type]}の書式を通常文字へ変換しました。元の書式は本文JSONに保持しています。`,
        );
        return [];
      });
      node.marks = node.marks.filter(
        (mark, index, all) => all.findIndex((m) => m.type === mark.type) === index,
      );
    }
    if (
      node.marks &&
      target !== "zenn" &&
      node.marks.some((m) => ["underline", "highlight"].includes(m.type))
    )
      diagnostics.push(
        "下線・ハイライトはHTMLで出力します。出力先のHTML制限により見た目が保持されない場合があります。",
      );
    if (
      ["image", "figure"].includes(node.type ?? "") &&
      node.attrs?.src &&
      !/^[a-z][a-z\d+.-]*:/i.test(node.attrs.src)
    ) {
      node.attrs.src = new URL(node.attrs.src, origin).href;
      diagnostics.push("相対画像URLをブログの絶対URLへ変換しました。");
    }
    node.content?.forEach(urls);
  };
  urls(body);
  let markdown = (body.content ?? []).map((n) => convert(n)).join("\n\n");
  if (target === "github")
    markdown = `${heading}\n\n${article.subtitle ? paragraph(article.subtitle) + "\n\n" : ""}${markdown}`;
  if (target === "zenn")
    markdown = `---\ntitle: ${JSON.stringify(article.title)}\nemoji: "📝"\ntype: "tech"\ntopics: ${JSON.stringify(article.tags)}\npublished: false\n---\n\n${article.subtitle ? article.subtitle + "\n\n" : ""}${markdown}`;
  if (target === "qiita" && article.subtitle) markdown = article.subtitle + "\n\n" + markdown;
  return { markdown, diagnostics: [...new Set(diagnostics)] };
}
