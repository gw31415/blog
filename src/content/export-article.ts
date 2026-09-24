import type { JSONContent } from "@tiptap/core";
import { documentMarkdown } from "../components/editor/document-markdown";
export type ExportTarget = "canonical" | "github" | "zenn" | "qiita";
export interface ExportArticle {
  title: string;
  subtitle: string | null;
  tags: string[];
  body: JSONContent;
}
export function exportArticle(article: ExportArticle, target: ExportTarget, origin: string) {
  const diagnostics: string[] = [];
  if (target === "canonical") return { markdown: documentMarkdown(article.body), diagnostics };
  const canonical = (node: JSONContent) => documentMarkdown({ type: "doc", content: [node] });
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
      JSON.stringify(node).match(/"type":"(?:callout|details|figure|blockMath)"/)
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
    let output = canonical(node);
    if (target !== "zenn") {
      // Operate on the known math nodes, not dollar text in arbitrary code.
      const collect = (n: JSONContent) => {
        if (n.type === "inlineMath") {
          const latex = String(n.attrs?.latex ?? "");
          if (latex.includes("`"))
            diagnostics.push(
              "インライン数式にバッククォートがあります。出力先の区切りを確認してください。",
            );
          output = output.replace(`$${latex}$`, `$\`${latex}\`$`);
        }
        if (n.type !== "codeBlock") n.content?.forEach(collect);
      };
      collect(node);
    }
    return output;
  }
  const body = structuredClone(article.body);
  const urls = (node: JSONContent) => {
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
    markdown = `# ${article.title.replace(/[\\#*_[\]]/g, "\\$&")}\n\n${article.subtitle ? article.subtitle + "\n\n" : ""}${markdown}`;
  if (target === "zenn")
    markdown = `---\ntitle: ${JSON.stringify(article.title)}\nemoji: "📝"\ntype: "tech"\ntopics: ${JSON.stringify(article.tags)}\npublished: false\n---\n\n${article.subtitle ? article.subtitle + "\n\n" : ""}${markdown}`;
  if (target === "qiita" && article.subtitle) markdown = article.subtitle + "\n\n" + markdown;
  return { markdown, diagnostics: [...new Set(diagnostics)] };
}
