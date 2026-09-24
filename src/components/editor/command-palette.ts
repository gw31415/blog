import { formatCommands } from "./inline-format-contract";
import { createRenderSourceDialog } from "./render-source-dialog";
import { closeHistory } from "@tiptap/pm/history";
import { documentMarkdown } from "./document-markdown";
import { parseArticleMarkdown } from "./markdown";
import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin, TextSelection, NodeSelection } from "@tiptap/pm/state";
import { CONTENT_SCHEMA_VERSION, normalizeDocument } from "../../content/document";

export interface PaletteCommand {
  id: string;
  label: string;
  aliases: string;
  group: string;
  hint: string;
  block?: boolean;
}
const entry = (
  id: string,
  label: string,
  aliases = "",
  block = false,
  group = "本文",
  hint = "",
): PaletteCommand => ({ id, label, aliases, block, group, hint });
export const COMMANDS: PaletteCommand[] = [
  entry("paragraph", "段落", "text 本文 p"),
  ...([2, 3, 4] as const).map((n) =>
    entry(
      `heading-${n}`,
      `見出し H${n}`,
      `h${n} 見出し${n}`,
      true,
      "本文",
      "#".repeat(n - 1) + " Space",
    ),
  ),
  entry("blockquote", "引用", "quote 引用文", true),
  entry("divider", "区切り線", "hr separator", true),
  entry("bullet-list", "箇条書き", "ul bullet リスト", true, "リスト"),
  entry("ordered-list", "番号付きリスト", "ol number 番号", true, "リスト"),
  entry("task-list", "タスクリスト", "todo checkbox チェック", true, "リスト"),
  ...[
    ["strong", "重要", "strong 重要性"],
    ["bold", "太字", "bold b"],
    ["italic", "イタリック", "italic i 斜体"],
    ["underline", "下線", "underline u"],
    ["em", "強調（傍点）", "emphasis 傍点"],
    ["mark", "ハイライト", "highlight マーカー"],
    ["sub", "下付き", "subscript"],
    ["sup", "上付き", "superscript"],
    ["strike", "打ち消し線", "strikethrough 削除線"],
    ["inline-code", "インラインコード", "code-inline コード文字"],
    ["link", "リンク", "url reference-link autolink"],
    ["hard-break", "強制改行", "br 改行 hardbreak"],
    ["soft-break", "ソフト改行", "softbreak ソース改行"],
    ["literal-text", "文字として挿入", "escape entity 記号"],
  ].map(([id, label, aliases]) => entry(id, label, aliases, false, "書式")),
  entry(
    "code-block",
    "コードブロック",
    "code fence コード 文字図 text-diagram",
    true,
    "コード・数式",
  ),
  entry("math-inline", "インライン数式", "inline-math 文中数式", false, "コード・数式"),
  entry("math-block", "ブロック数式", "display-math 数式ブロック", true, "コード・数式"),
  entry("mermaid", "Mermaid", "diagram フロー図", true, "コード・数式"),
  entry("note", "INFO・補足", "info note 補足", true, "補足・構造"),
  entry("warning", "WARN・警告", "warn warning 注意", true, "補足・構造"),
  entry("dropdown", "トグル", "details toggle 折り畳み", true, "補足・構造"),
  entry("image", "URLから画像", "img 画像 linked-image", false, "画像・表"),
  entry("upload-image", "画像をアップロード", "upload 画像選択", false, "画像・表"),
  entry("figure", "図", "caption キャプション", true, "画像・表"),
  entry("table", "表", "grid table テーブル", true, "画像・表"),
  ...[
    ["edit-element", "選択要素を編集", "edit-image edit-math edit-code"],
    ["unlink", "リンク解除", ""],
    ["clear-inline-formatting", "文字書式を解除", ""],
    ["unwrap", "コンテナを解除", ""],
    ["exit-block", "ブロックの外へ", ""],
    ["indent", "リストを深く", ""],
    ["outdent", "リストを浅く", ""],
    ["list-start", "開始番号", ""],
    ["list-spacing", "リストの間隔", "tight loose"],
    ["list-paragraph", "同じ項目に段落追加", ""],
    ["task-check", "タスクを完了", ""],
    ["task-uncheck", "タスクを未完了", ""],
    ["code-language", "コード言語", ""],
    ["figure-to-image", "図を画像と段落へ", ""],
    ["math-convert", "数式の配置を変換", ""],
    ["mermaid-to-code", "Mermaidを文字図へ", ""],
    ["table-row-before", "前にデータ行を追加", ""],
    ["table-row-after", "後にデータ行を追加", ""],
    ["table-column-before", "前に列を追加", ""],
    ["table-column-after", "後に列を追加", ""],
    ["table-delete-row", "行を削除", ""],
    ["table-delete-column", "列を削除", ""],
    ["table-align", "列の配置", ""],
    ["table-delete", "表を削除", ""],
    ["delete-element", "選択要素を削除", "Undoで戻せます"],
  ].map(([id, label, aliases]) => entry(id, label, aliases, false, "選択要素")),
];
export function searchCommands(query: string) {
  const q = query.toLowerCase().replace(/^\//, "");
  return COMMANDS.filter((c) => `${c.id} ${c.label} ${c.aliases}`.toLowerCase().includes(q));
}
function ancestor(editor: Editor, names: string[]) {
  const { $from } = editor.state.selection;
  if (
    editor.state.selection instanceof NodeSelection &&
    names.includes(editor.state.selection.node.type.name)
  )
    return { node: editor.state.selection.node, pos: editor.state.selection.from };
  for (let d = $from.depth; d > 0; d--)
    if (names.includes($from.node(d).type.name))
      return { node: $from.node(d), pos: $from.before(d) };
  return null;
}
function reason(editor: Editor, c: PaletteCommand): string {
  const source = editor.isActive("codeBlock");
  const cell = editor.isActive("table");
  if (
    source &&
    !["exit-block", "code-language", "mermaid-to-code", "edit-element", "delete-element"].includes(
      c.id,
    )
  )
    return "ソース内では本文の操作を実行できません";
  if (cell && c.block) return "表セル内にはこのブロックを挿入できません";
  if (c.id === "soft-break" && (cell || !editor.isActive("paragraph")))
    return "ソフト改行は通常段落内のみです";
  if (c.id === "table-delete-row" && editor.isActive("tableHeader"))
    return "先頭ヘッダー行は削除できません";
  if (c.id.startsWith("table-") && !cell) return "表のセルを選択してください";
  if (c.group === "選択要素") {
    const types =
      c.id.startsWith("list-") || ["indent", "outdent"].includes(c.id)
        ? ["listItem", "taskItem"]
        : c.id.startsWith("task-")
          ? ["taskItem"]
          : c.id === "figure-to-image"
            ? ["figure"]
            : c.id === "math-convert"
              ? ["inlineMath", "blockMath"]
              : ["code-language", "mermaid-to-code"].includes(c.id)
                ? ["codeBlock"]
                : c.id === "unwrap"
                  ? ["blockquote", "callout", "details"]
                  : null;
    if (types && !ancestor(editor, types)) return "対象の要素を選択してください";
    if (c.id === "unlink" && !editor.isActive("link")) return "リンクを選択してください";
  }
  return "";
}
interface Field {
  name: string;
  label: string;
  value?: string;
  multiline?: boolean;
  type?: string;
  choices?: Array<string | { value: string; label: string }>;
  mermaid?: boolean;
}
export function createCommandPalette(editor: Editor) {
  let dialog: HTMLDialogElement | null = null;
  let currentCommand: string | undefined;
  let choosingSlash = false;
  let saved = editor.state.selection;
  let slash: { from: number; to: number } | null = null;
  const dialogHost = editor.view.dom.closest("[data-qstyle-boundary]") ?? document.body;
  let suggestions: HTMLDivElement | null = null;
  let releaseSuggestions: (() => void) | undefined;
  let releasePopover: (() => void) | undefined;
  const close = () => {
    releaseSuggestions?.();
    releaseSuggestions = undefined;
    suggestions?.remove();
    suggestions = null;
    releasePopover?.();
    releasePopover = undefined;
    const dock = dialog?.closest(".editor-dock");
    dock?.classList.remove("editor-dock--source");
    if (dialog?.open) dialog.close();
    dialog?.remove();
    dialog = null;
  };
  const restore = () => {
    editor.view.dispatch(editor.state.tr.setSelection(saved));
  };
  const commit = (operation: () => boolean) => {
    restore();
    const original = editor.state;
    try {
      if (!choosingSlash) editor.view.dispatch(closeHistory(editor.state.tr));
      if (slash) editor.commands.deleteRange(slash);
      if (!operation()) throw new Error("この位置では実行できません");
      if (currentCommand === "table-row-before" || currentCommand === "table-row-after") {
        const tr = editor.state.tr;
        tr.doc.descendants((table, pos) => {
          if (table.type.name !== "table") return true;
          let offset = pos + 1;
          table.forEach((row, _, index) => {
            if (index > 0) {
              let cellPos = offset + 1;
              row.forEach((cell) => {
                if (cell.type.name === "tableHeader")
                  tr.setNodeMarkup(cellPos, editor.schema.nodes.tableCell, cell.attrs);
                cellPos += cell.nodeSize;
              });
            }
            offset += row.nodeSize;
          });
          return false;
        });
        if (tr.docChanged) editor.view.dispatch(tr);
      }
      if ([...Object.keys(formatCommands), "inline-code", "link"].includes(currentCommand ?? "")) {
        const tr = editor.state.tr;
        tr.doc.descendants((node, pos) => {
          if (!node.isInline || node.isText) return;
          for (const mark of node.marks)
            if (
              node.type.name === "inlineMath" ||
              (node.type.name === "image" && mark.type.name !== "link") ||
              (/Break$/.test(node.type.name) && mark.type.name === "code")
            )
              tr.removeMark(pos, pos + node.nodeSize, mark);
        });
        if (tr.docChanged) editor.view.dispatch(tr);
      }
      normalizeDocument(editor.getJSON(), { editing: true });
      editor.view.dispatch(closeHistory(editor.state.tr));
      slash = null;
      close();
      editor.view.focus();
    } catch (error) {
      editor.view.updateState(original);
      const message = dialog?.querySelector("[role=alert]");
      if (message) message.textContent = String(error);
    }
  };
  const form = (
    title: string,
    fields: Field[],
    apply: (values: Record<string, string>) => boolean,
  ) => {
    close();
    dialog = document.createElement("dialog");
    dialog.className = "document-command-dialog";
    dialog.dataset.commandForm = "";
    dialog.setAttribute("aria-label", title);
    const source = fields.find((field) => field.mermaid || field.name === "latex");
    if (source) {
      const math = ancestor(editor, ["inlineMath", "blockMath"]);
      const sourceDialog = dialog;
      let observer: MutationObserver | undefined;
      const mountSource = () => {
        if (
          !editor.view.dom
            .closest("[data-virtual-keyboard-viewport]")
            ?.querySelector(".editor-dock")
        )
          return;
        observer?.disconnect();
        createRenderSourceDialog({
          dialog: sourceDialog,
          host: editor.view.dom,
          title,
          name: source.name,
          source: source.value ?? "",
          kind: source.mermaid
            ? "mermaid"
            : math?.node.type.name === "inlineMath" || currentCommand === "math-inline"
              ? "inlineMath"
              : "blockMath",
          cancel: () => {
            close();
            editor.view.focus();
          },
          apply: (value) => commit(() => apply({ [source.name]: value })),
        });
        sourceDialog.addEventListener("cancel", () => close());
      };
      observer = new MutationObserver(mountSource);
      observer.observe(dialogHost, { childList: true, subtree: true });
      releasePopover = () => observer?.disconnect();
      mountSource();
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = title;
    const f = document.createElement("form");
    const fieldGroup = document.createElement("div");
    fieldGroup.className = "document-command-fields";
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    for (const field of fields) {
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = field.choices
        ? document.createElement("select")
        : field.multiline
          ? document.createElement("textarea")
          : document.createElement("input");
      if (input instanceof HTMLSelectElement)
        for (const choice of field.choices ?? []) {
          const option = document.createElement("option");
          option.value = typeof choice === "string" ? choice : choice.value;
          option.textContent = typeof choice === "string" ? choice : choice.label;
          input.appendChild(option);
        }
      input.name = field.name;
      input.value = field.value ?? "";
      if (input instanceof HTMLInputElement) input.type = field.type ?? "text";
      label.appendChild(input);
      fieldGroup.appendChild(label);
    }
    const applyButton = document.createElement("button");
    applyButton.textContent = "適用";
    applyButton.type = "submit";
    const cancel = document.createElement("button");
    cancel.textContent = "キャンセル";
    cancel.type = "button";
    cancel.onclick = () => {
      close();
      editor.view.focus();
    };
    const actions = document.createElement("div");
    actions.className = "document-command-actions";
    [cancel, applyButton].forEach((child) => actions.appendChild(child));
    [fieldGroup, alert, actions].forEach((child) => f.appendChild(child));
    f.onsubmit = (e) => {
      e.preventDefault();
      commit(() => apply(Object.fromEntries(new FormData(f)) as Record<string, string>));
    };
    [heading, f].forEach((child) => dialog!.appendChild(child));
    dialogHost.appendChild(dialog);
    dialog.addEventListener("cancel", () => close());
    if (currentCommand === "table" || currentCommand === "link") {
      dialog.classList.add(
        "document-insert-popover",
        currentCommand === "table" ? "document-table-popover" : "document-link-popover",
      );
      heading.remove();
      if (currentCommand === "table") {
        const times = document.createElement("span");
        times.textContent = "×";
        times.setAttribute("aria-hidden", "true");
        fieldGroup.insertBefore(times, fieldGroup.children[1]);
        for (const input of fieldGroup.querySelectorAll("input")) {
          input.min = input.name === "cols" ? "1" : "0";
          input.max = input.name === "cols" ? "30" : "100";
          input.required = true;
        }
      }
      const popup = dialog;
      const anchor = dialogHost.querySelector(
        currentCommand === "table" ? "[data-insert-table]" : "[data-insert-link]",
      );
      const position = () => {
        const rect = anchor?.getBoundingClientRect() ?? editor.view.dom.getBoundingClientRect();
        popup.style.left = `${Math.max(8, Math.min(window.innerWidth - popup.offsetWidth - 8, rect.left + rect.width / 2 - popup.offsetWidth / 2))}px`;
        popup.style.top = `${Math.max(8, rect.top - popup.offsetHeight - 8)}px`;
      };
      const dismiss = (event: Event) => {
        if (!popup.contains(event.target as Node) && !anchor?.contains(event.target as Node))
          close();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          close();
          editor.view.focus();
        }
      };
      popup.show();
      position();
      document.addEventListener("pointerdown", dismiss);
      document.addEventListener("keydown", escape);
      window.addEventListener("resize", position);
      window.addEventListener("scroll", position, true);
      releasePopover = () => {
        document.removeEventListener("pointerdown", dismiss);
        document.removeEventListener("keydown", escape);
        window.removeEventListener("resize", position);
        window.removeEventListener("scroll", position, true);
      };
      fieldGroup.querySelector("input")?.focus();
    } else dialog.showModal();
  };
  const insert = (node: JSONContent) => {
    if (!editor.schema.nodes[node.type!].isBlock) return editor.commands.insertContent(node);
    const { $from } = editor.state.selection;
    if ($from.depth === 0) return editor.commands.insertContentAt(editor.state.selection.to, node);
    const empty = $from.parent.type.name === "paragraph" && !$from.parent.content.size;
    return editor.commands.insertContentAt(
      empty ? { from: $from.before(), to: $from.after() } : $from.after(),
      node,
    );
  };
  const uploadStatus = document.createElement("p");
  uploadStatus.className = "document-upload-status";
  uploadStatus.setAttribute("role", "status");
  const uploadImages = async (files: File[], position = saved.from) => {
    // Map the insertion point through edits made while the request is in flight.
    let bookmark: import("@tiptap/pm/state").SelectionBookmark = TextSelection.create(
      editor.state.doc,
      position,
    ).getBookmark();
    const mapPosition = ({
      transaction,
    }: {
      transaction: import("@tiptap/pm/state").Transaction;
    }) => {
      bookmark = bookmark.map(transaction.mapping);
    };
    editor.on("transaction", mapPosition);
    dialogHost.appendChild(uploadStatus);
    uploadStatus.textContent = "画像をアップロード中…";
    try {
      for (const file of files) {
        const payload = new FormData();
        payload.set("image", file);
        const response = await fetch("/api/images", { method: "POST", body: payload });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error ?? "アップロード失敗");
        if (editor.isDestroyed) return;
        editor.view.dispatch(
          closeHistory(editor.state.tr.setSelection(bookmark.resolve(editor.state.doc))),
        );
        if (slash) {
          editor.commands.deleteRange(slash);
          slash = null;
        }
        if (
          !insert({
            type: "figure",
            attrs: { src: result.url, alt: "" },
            content: [{ type: "paragraph" }],
          })
        )
          throw new Error("この位置には画像を挿入できません");
        editor.view.dispatch(closeHistory(editor.state.tr));
        bookmark = editor.state.selection.getBookmark();
      }
      uploadStatus.remove();
      editor.view.focus();
    } catch (error) {
      uploadStatus.textContent = String(error);
    } finally {
      editor.off("transaction", mapPosition);
    }
  };
  const drop = (event: DragEvent) => {
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
    close();
    slash = null;
    void uploadImages(files, position ?? editor.state.selection.from);
  };
  const dragover = (event: DragEvent) => {
    if (
      Array.from(event.dataTransfer?.items ?? []).some(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      )
    )
      event.preventDefault();
  };
  editor.view.dom.addEventListener("drop", drop, true);
  editor.view.dom.addEventListener("dragover", dragover);
  const fields = (
    label: string,
    definitions: Field[],
    apply: (v: Record<string, string>) => boolean,
  ) => form(label, definitions, apply);
  const run = (id: string, query = "") => {
    currentCommand = id;
    if (id === "import-markdown" || id === "import-json") {
      return fields(
        id === "import-markdown" ? "正規Markdownから本文を取り込む" : "JSONから本文のみを取り込む",
        [
          ...(id === "import-markdown"
            ? [
                {
                  name: "format",
                  label: "入力形式（外部H1はH2へ変換、GFM/Qiitaのmathフェンスは数式へ変換）",
                  value: "canonical",
                  choices: ["canonical", "commonmark", "gfm", "zenn", "qiita"],
                },
              ]
            : []),
          { name: "source", label: "原文（取り込み後もUndoで戻せます）", multiline: true },
        ],
        (values) => {
          let document: JSONContent;
          if (id === "import-markdown")
            document = parseArticleMarkdown(
              values.source,
              values.format as import("./markdown").MarkdownSource,
            );
          else {
            const source = JSON.parse(values.source);
            if (
              source.body &&
              (source.formatVersion !== 2 ||
                source.contentSchemaVersion !== CONTENT_SCHEMA_VERSION ||
                source.bodyFormat !== "tiptap-json")
            )
              throw new Error("未対応の文書形式です");
            document = normalizeDocument(source.body ?? source);
          }
          return editor.commands.setContent(document);
        },
      );
    }
    const selected = ancestor(editor, [
      "image",
      "figure",
      "inlineMath",
      "blockMath",
      "codeBlock",
      "callout",
      "details",
    ]);
    const update = (attrs: Record<string, unknown>) =>
      selected
        ? editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(selected.pos, undefined, { ...selected.node.attrs, ...attrs });
            return true;
          })
        : false;
    const createCode = (language: string) =>
      fields(
        language === "mermaid" ? "Mermaid" : "コードとソース",
        [
          ...(language === "mermaid" ? [] : [{ name: "language", label: "言語", value: language }]),
          {
            name: "source",
            label: "ソース",
            mermaid: language === "mermaid",
            multiline: true,
            value: selected?.node.type.name === "codeBlock" ? selected.node.textContent : "",
          },
        ],
        (v) =>
          selected?.node.type.name === "codeBlock"
            ? editor.commands.insertContentAt(
                { from: selected.pos, to: selected.pos + selected.node.nodeSize },
                {
                  type: "codeBlock",
                  attrs: { language: language === "mermaid" ? "mermaid" : v.language || null },
                  content: v.source ? [{ type: "text", text: v.source }] : [],
                },
              )
            : insert({
                type: "codeBlock",
                attrs: { language: language === "mermaid" ? "mermaid" : v.language || null },
                content: v.source ? [{ type: "text", text: v.source }] : [],
              }),
      );
    if (id === "code-block" || id === "mermaid")
      return createCode(
        id === "mermaid" ? "mermaid" : /文字図|text-diagram/.test(query) ? "text" : "",
      );
    if (
      id === "math-inline" ||
      id === "math-block" ||
      (id === "edit-element" && selected?.node.type.name.endsWith("Math"))
    )
      return fields(
        "数式",
        [
          {
            name: "latex",
            label: "TeX原文",
            multiline: true,
            value: String(
              selected?.node.attrs.latex ?? editor.state.doc.textBetween(saved.from, saved.to),
            ),
          },
        ],
        (v) =>
          selected?.node.type.name.endsWith("Math")
            ? update({ latex: v.latex })
            : insert({
                type: id === "math-inline" ? "inlineMath" : "blockMath",
                attrs: { latex: v.latex },
              }),
      );
    if (id === "link") {
      restore();
      if (editor.state.selection.empty && editor.isActive("link")) {
        editor.commands.extendMarkRange("link");
        saved = editor.state.selection;
      }
      const originalText = editor.state.doc.textBetween(saved.from, saved.to, " ");
      const existing = editor.getAttributes("link");
      return fields(
        "リンクを挿入",
        [
          { name: "text", label: "文章", value: originalText },
          { name: "href", label: "URL", value: existing.href ?? "" },
        ],
        (v) => {
          const href = v.href.trim();
          if (!href || /^(?:javascript|data|vbscript):/i.test(href))
            throw new Error("リンク先のURLを入力してください");
          if (!v.text.trim()) throw new Error("文章を入力してください");
          const attrs = { href, title: existing.title ?? null };
          if (v.text === originalText && !editor.state.selection.empty)
            return editor.chain().setLink(attrs).run();
          return editor.commands.insertContent({
            type: "text",
            text: v.text,
            marks: [{ type: "link", attrs }],
          });
        },
      );
    }
    if (
      id === "image" ||
      id === "figure" ||
      (id === "edit-element" && ["image", "figure"].includes(selected?.node.type.name ?? ""))
    ) {
      const figure = id === "figure" || selected?.node.type.name === "figure";
      return fields(
        figure ? "図" : "画像",
        [
          { name: "src", label: "画像URL", value: String(selected?.node.attrs.src ?? "") },
          {
            name: "alt",
            label: "alt（空欄は明示的な空文字）",
            value: String(selected?.node.attrs.alt ?? ""),
          },
          ...(figure
            ? [
                {
                  name: "caption",
                  label: "キャプション（インラインMarkdown）",
                  value: selected
                    ? documentMarkdown({ type: "doc", content: selected.node.toJSON().content })
                    : "",
                },
              ]
            : [
                {
                  name: "title",
                  label: "画像title",
                  value: String(selected?.node.attrs.title ?? ""),
                },
                {
                  name: "href",
                  label: "外側リンクURL",
                  value: selected?.node.marks.find((m) => m.type.name === "link")?.attrs.href ?? "",
                },
                {
                  name: "linkTitle",
                  label: "外側リンクtitle",
                  value:
                    selected?.node.marks.find((m) => m.type.name === "link")?.attrs.title ?? "",
                },
              ]),
        ],
        (v) => {
          const caption = figure ? parseArticleMarkdown(v.caption) : null;
          if (
            caption &&
            (caption.content?.length !== 1 ||
              caption.content[0].type !== "paragraph" ||
              caption.content[0].content?.some((n) => n.type === "image"))
          )
            throw new Error("キャプションは画像を含まない1段落にしてください");
          const node: JSONContent = figure
            ? {
                type: "figure",
                attrs: { src: v.src, alt: v.alt },
                content: [
                  {
                    type: "paragraph",
                    content: caption?.content?.[0]?.content ?? [],
                  },
                ],
              }
            : {
                type: "image",
                attrs: { src: v.src, alt: v.alt, title: v.title || null },
                marks: v.href
                  ? [{ type: "link", attrs: { href: v.href, title: v.linkTitle || null } }]
                  : [],
              };
          return selected
            ? editor.commands.insertContentAt(
                { from: selected.pos, to: selected.pos + selected.node.nodeSize },
                node,
              )
            : insert(node);
        },
      );
    }
    if (
      ["note", "warning", "dropdown"].includes(id) ||
      (id === "edit-element" && ["callout", "details"].includes(selected?.node.type.name ?? ""))
    ) {
      const details = id === "dropdown" || selected?.node.type.name === "details";
      return fields(
        details ? "トグル" : "補足",
        [
          {
            name: "title",
            label: details ? "題名（必須）" : "題名（任意）",
            value: String(selected?.node.attrs.title ?? ""),
          },
          ...(details
            ? []
            : [
                {
                  name: "kind",
                  label: "種類",
                  value: id === "warning" ? "warning" : String(selected?.node.attrs.kind ?? "note"),
                  choices: [
                    { value: "note", label: "INFO" },
                    { value: "warning", label: "WARN" },
                  ],
                },
              ]),
        ],
        (v) =>
          selected
            ? update(details ? { title: v.title } : { title: v.title || null, kind: v.kind })
            : editor.commands.wrapIn(
                details ? "details" : "callout",
                details ? { title: v.title } : { title: v.title || null, kind: v.kind },
              ),
      );
    }
    if (id === "table")
      return fields(
        "表を挿入",
        [
          { name: "cols", label: "列数", value: "2", type: "number" },
          { name: "rows", label: "データ行数", value: "2", type: "number" },
        ],
        (v) => {
          const cols = Number(v.cols),
            rows = Number(v.rows);
          if (
            !Number.isInteger(cols) ||
            cols < 1 ||
            cols > 30 ||
            !Number.isInteger(rows) ||
            rows < 0 ||
            rows > 100
          )
            throw new Error("列数1〜30、データ行数0〜100を指定してください");
          return insert({
            type: "table",
            content: Array.from({ length: rows + 1 }, (_, r) => ({
              type: "tableRow",
              content: Array.from({ length: cols }, () => ({
                type: r === 0 ? "tableHeader" : "tableCell",
                content: [{ type: "paragraph" }],
              })),
            })),
          });
        },
      );
    if (id === "literal-text")
      return fields("文字として挿入", [{ name: "text", label: "文字", multiline: true }], (v) =>
        editor.commands.insertContent({ type: "text", text: v.text }),
      );
    if (id === "list-start")
      return fields(
        "開始番号",
        [
          {
            name: "start",
            label: "開始番号",
            value: String(editor.getAttributes("orderedList").start ?? 1),
            type: "number",
          },
        ],
        (v) => editor.commands.updateAttributes("orderedList", { start: Number(v.start) }),
      );
    if (id === "list-spacing")
      return fields(
        "リストの間隔",
        [{ name: "spacing", label: "tight / loose", value: "tight" }],
        (v) => {
          const list = ancestor(editor, ["bulletList", "orderedList", "taskList"]);
          return (
            !!list &&
            editor.commands.updateAttributes(list.node.type.name, { tight: v.spacing === "tight" })
          );
        },
      );
    if (id === "code-language")
      return fields(
        "コード言語",
        [{ name: "language", label: "言語", value: String(selected?.node.attrs.language ?? "") }],
        (v) => update({ language: v.language || null }),
      );
    if (id === "table-align")
      return fields(
        "列の配置",
        [{ name: "align", label: "未指定 / left / center / right", value: "" }],
        (v) => {
          const cell = ancestor(editor, ["tableCell", "tableHeader"]);
          if (!cell) return false;
          const $p = editor.state.doc.resolve(cell.pos);
          const table = $p.node(-1),
            column = $p.index();
          const tr = editor.state.tr;
          let pos = $p.before(-1) + 1;
          table.forEach((row) => {
            let cp = pos + 1;
            row.forEach((c, _offset, i) => {
              if (i === column)
                tr.setNodeMarkup(cp, undefined, { ...c.attrs, align: v.align || null });
              cp += c.nodeSize;
            });
            pos += row.nodeSize;
          });
          editor.view.dispatch(tr);
          return true;
        },
      );
    if (id === "edit-element") {
      if (selected?.node.type.name === "codeBlock")
        return createCode(String(selected.node.attrs.language ?? ""));
      if (editor.isActive("link")) return run("link");
      return;
    }
    if (id === "upload-image") {
      close();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) void uploadImages([file]);
      };
      input.click();
      return;
    }
    commit(() => {
      const chain = editor.chain();
      if (id.startsWith("heading-"))
        return chain.setHeading({ level: Number(id.at(-1)) as 2 }).run();
      if (formatCommands[id]) return chain.toggleMark(formatCommands[id]).run();
      const actions: Record<string, () => boolean> = {
        paragraph: () => chain.setParagraph().run(),
        "inline-code": () => chain.toggleCode().run(),
        blockquote: () => chain.toggleBlockquote().run(),
        divider: () => insert({ type: "horizontalRule" }),
        "bullet-list": () => chain.toggleBulletList().run(),
        "ordered-list": () => chain.toggleOrderedList().run(),
        "task-list": () => chain.toggleTaskList().run(),
        "hard-break": () => chain.unsetCode().setHardBreak().run(),
        "soft-break": () => insert({ type: "softBreak" }),
        unlink: () => chain.unsetLink().run(),
        "clear-inline-formatting": () =>
          Object.values(formatCommands).reduce((c, mark) => c.unsetMark(mark), chain).unsetCode().run(),
        indent: () =>
          chain.sinkListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run(),
        outdent: () =>
          chain.liftListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run(),
        "task-check": () => chain.updateAttributes("taskItem", { checked: true }).run(),
        "task-uncheck": () => chain.updateAttributes("taskItem", { checked: false }).run(),
        "mermaid-to-code": () => chain.updateAttributes("codeBlock", { language: "text" }).run(),
        "table-row-before": () =>
          editor.isActive("tableHeader") ? chain.addRowAfter().run() : chain.addRowBefore().run(),
        "table-row-after": () => chain.addRowAfter().run(),
        "table-column-before": () => chain.addColumnBefore().run(),
        "table-column-after": () => chain.addColumnAfter().run(),
        "table-delete-row": () => !editor.isActive("tableHeader") && chain.deleteRow().run(),
        "table-delete-column": () => chain.deleteColumn().run(),
        "table-delete": () => chain.deleteTable().run(),
        "delete-element": () =>
          selected
            ? chain
                .deleteRange({ from: selected.pos, to: selected.pos + selected.node.nodeSize })
                .run()
            : false,
        "figure-to-image": () =>
          selected?.node.type.name === "figure" &&
          chain
            .insertContentAt({ from: selected.pos, to: selected.pos + selected.node.nodeSize }, [
              {
                type: "paragraph",
                content: [
                  {
                    type: "image",
                    attrs: { src: selected.node.attrs.src, alt: selected.node.attrs.alt },
                  },
                ],
              },
              ...selected.node.toJSON().content,
            ])
            .run(),
        unwrap: () => {
          const target = ancestor(editor, ["blockquote", "callout", "details"]);
          if (!target) return false;
          const title = target.node.attrs.title;
          return chain
            .insertContentAt({ from: target.pos, to: target.pos + target.node.nodeSize }, [
              ...(title ? [{ type: "paragraph", content: [{ type: "text", text: title }] }] : []),
              ...target.node.toJSON().content,
            ])
            .run();
        },
        "exit-block": () => {
          const target = ancestor(editor, [
            "codeBlock",
            "inlineMath",
            "blockMath",
            "blockquote",
            "callout",
            "details",
          ]);
          if (!target) return false;
          const pos = target.pos + target.node.nodeSize;
          return chain
            .insertContentAt(pos, { type: "paragraph" })
            .setTextSelection(pos + 1)
            .run();
        },
        "list-paragraph": () => {
          const target = ancestor(editor, ["listItem", "taskItem"]);
          if (!target) return false;
          const list = ancestor(editor, ["bulletList", "orderedList", "taskList"]);
          return chain
            .updateAttributes(list!.node.type.name, { tight: false })
            .insertContentAt(target.pos + target.node.nodeSize - 1, { type: "paragraph" })
            .run();
        },
        "math-convert": () => {
          if (!selected) return false;
          const node = {
            type: selected.node.type.name === "inlineMath" ? "blockMath" : "inlineMath",
            attrs: { latex: selected.node.attrs.latex },
          };
          return chain
            .insertContentAt(
              { from: selected.pos, to: selected.pos + selected.node.nodeSize },
              node,
            )
            .run();
        },
      };
      return actions[id]?.() ?? false;
    });
  };
  const open = (
    range?: { from: number; to: number },
    direct?: string,
    initial: Record<string, string> = {},
  ) => {
    slash = range ?? null;
    saved = editor.state.selection;
    close();
    if (direct) {
      run(direct);
      for (const [name, value] of Object.entries(initial)) {
        const input = dialog?.querySelector(`[name="${name}"]`);
        if (input instanceof HTMLInputElement) {
          if (input.type === "checkbox") input.checked = value === "true";
          else input.value = value;
        } else if (input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
          input.value = value;
        }
        input?.dispatchEvent(new Event("input"));
      }
      return;
    }
    const panel = document.createElement("div");
    suggestions = panel;
    panel.className = "document-command-suggestions";
    panel.setAttribute("aria-label", "本文コマンド");
    const list = document.createElement("div");
    list.id = "document-command-options";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "本文コマンド");
    const input = range ? null : document.createElement("input");
    if (input) {
      input.setAttribute("aria-label", "コマンド検索");
      input.placeholder = "コマンドを検索";
      panel.appendChild(input);
    }
    panel.appendChild(list);
    dialogHost.appendChild(panel);
    let index = -1;
    let commands: PaletteCommand[] = [];
    let query = "";
    const position = () => {
      const rect = editor.view.coordsAtPos(saved.from);
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = Math.min(
        top + (viewport?.height ?? window.innerHeight),
        dialogHost.querySelector(".editor-dock")?.getBoundingClientRect().top ?? window.innerHeight,
      );
      panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, rect.left))}px`;
      const below = bottom - rect.bottom - 8;
      const above = rect.top - top - 8;
      const useBelow = below >= Math.min(panel.scrollHeight, 200) || below >= above;
      panel.style.maxHeight = `${Math.max(48, Math.min(224, useBelow ? below : above))}px`;
      panel.style.top = `${useBelow ? rect.bottom + 4 : Math.max(top + 4, rect.top - panel.offsetHeight - 4)}px`;
    };
    const choose = (command: PaletteCommand) => {
      releaseSuggestions?.();
      releaseSuggestions = undefined;
      panel.remove();
      suggestions = null;
      choosingSlash = !!slash;
      if (slash) {
        editor.view.dispatch(closeHistory(editor.state.tr).delete(slash.from, slash.to));
        saved = editor.state.selection;
        slash = null;
      }
      try {
        run(command.id, query);
      } finally {
        choosingSlash = false;
      }
    };
    const render = (resetSelection = false) => {
      commands = searchCommands(query).filter((command) => !reason(editor, command));
      index = resetSelection
        ? commands.length === 1
          ? 0
          : -1
        : Math.min(index, commands.length - 1);
      list.replaceChildren();
      if (!commands.length) {
        const empty = document.createElement("p");
        empty.textContent = "候補なし";
        list.appendChild(empty);
      }
      commands.forEach((command, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.id = `document-command-option-${i}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(i === index));
        const label = document.createElement("span");
        label.className = "document-command-label";
        label.textContent = command.label;
        const name = document.createElement("span");
        name.className = "document-command-name";
        name.textContent = `/${command.id}`;
        button.appendChild(label);
        button.appendChild(name);
        button.onpointerdown = (event) => event.preventDefault();
        button.onclick = () => choose(command);
        list.appendChild(button);
      });
      const owner = input ?? editor.view.dom;
      owner.setAttribute("aria-controls", list.id);
      if (index >= 0)
        owner.setAttribute("aria-activedescendant", `document-command-option-${index}`);
      else owner.removeAttribute("aria-activedescendant");
      position();
    };
    const update = () => {
      if (!range) return;
      const selection = editor.state.selection;
      if (!selection.empty || selection.from < range.from + 1) {
        close();
        return;
      }
      const text = editor.state.doc.textBetween(range.from, selection.from, "\n");
      if (!text.startsWith("/") || /\s/.test(text)) {
        close();
        return;
      }
      saved = selection;
      slash = { from: range.from, to: selection.from };
      const nextQuery = text.slice(1);
      const changed = query !== nextQuery;
      query = nextQuery;
      render(changed);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || editor.view.composing) return;
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      const control = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      const next =
        (plain && event.key === "ArrowDown") || (control && event.key.toLowerCase() === "n");
      const previous =
        (plain && event.key === "ArrowUp") || (control && event.key.toLowerCase() === "p");
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        editor.view.focus();
        return;
      }
      if (
        (plain && (event.key === "Enter" || event.key === "Tab")) ||
        (event.key === "Tab" && event.shiftKey)
      ) {
        if (index < 0 || event.shiftKey) {
          close();
          if (input) editor.view.focus();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        choose(commands[index]);
        return;
      }
      if (!next && !previous) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!commands.length) return;
      index =
        index < 0
          ? next
            ? 0
            : commands.length - 1
          : (index + (next ? 1 : -1) + commands.length) % commands.length;
      render();
      list.children[index]?.scrollIntoView({ block: "nearest" });
    };
    const dismiss = (event: Event) => {
      if (!panel.contains(event.target as Node)) close();
    };
    const keyTarget = input ?? editor.view.dom;
    keyTarget.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    editor.on("transaction", update);
    releaseSuggestions = () => {
      keyTarget.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      editor.off("transaction", update);
      const owner = input ?? editor.view.dom;
      owner.removeAttribute("aria-controls");
      owner.removeAttribute("aria-activedescendant");
    };
    if (input) {
      input.oninput = () => {
        query = input.value;
        render(true);
      };
      render(true);
      input.focus();
    } else update();
  };
  return {
    open,
    close,
    destroy() {
      close();
      uploadStatus.remove();
      editor.view.dom.removeEventListener("drop", drop, true);
      editor.view.dom.removeEventListener("dragover", dragover);
    },
    documentForSave() {
      return slash && dialog
        ? editor.state.tr.delete(slash.from, slash.to).doc.toJSON()
        : editor.getJSON();
    },
    getState() {
      if (!dialog) return null;
      const values: Record<string, string> = {};
      dialog.querySelectorAll("input[name],textarea[name],select[name]").forEach((element) => {
        const input = element as unknown as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        if (input.type !== "file")
          values[input.name] =
            input instanceof HTMLInputElement && input.type === "checkbox"
              ? String(input.checked)
              : input.value;
      });
      return {
        command: currentCommand,
        values,
        slash,
        selection: { from: saved.from, to: saved.to },
      };
    },
    resume(state: {
      command?: string;
      values?: Record<string, string>;
      slash?: { from: number; to: number } | null;
      selection?: { from: number; to: number };
    }) {
      if (state.selection) editor.commands.setTextSelection(state.selection);
      if (state.command) open(state.slash ?? undefined, state.command, state.values ?? {});
    },
  };
}
export function paletteExtension(
  getPalette: () => ReturnType<typeof createCommandPalette> | undefined,
) {
  return Extension.create({
    name: "documentPalette",
    priority: 2000,
    addKeyboardShortcuts() {
      const editor = this.editor;
      return {
        "Mod-/": () => {
          getPalette()?.open();
          return true;
        },
        "Mod-k": () => {
          if (editor.isActive("codeBlock")) return true;
          getPalette()?.open(undefined, "link");
          return true;
        },
        "Mod-Enter": () => {
          getPalette()?.open(undefined, "exit-block");
          return true;
        },
        Tab: () =>
          editor.isActive("codeBlock") &&
          editor.commands.insertContent({ type: "text", text: "  " }),
        "Mod-b": () => editor.isActive("codeBlock"),
        "Mod-i": () => editor.isActive("codeBlock"),
        "Mod-e": () => editor.isActive("codeBlock"),
        "Alt-Enter": () =>
          editor.isActive("paragraph") &&
          !editor.isActive("table") &&
          editor.commands.insertContent({ type: "softBreak" }),
        Enter: () => {
          if (editor.view.composing || editor.isActive("codeBlock")) return false;
          if (editor.isActive("table"))
            return editor.commands.unsetCode() && editor.commands.setHardBreak();
          const { $from } = editor.state.selection;
          if ($from.parent.type.name !== "paragraph") return false;
          const raw = $from.parent.textContent;
          const range = { from: $from.start(), to: $from.end() };
          if (/(?:\\| {2})$/.test(raw))
            return editor
              .chain()
              .deleteRange({ from: range.to - (raw.endsWith("  ") ? 2 : 1), to: range.to })
              .unsetCode()
              .setHardBreak()
              .run();
          if (raw === "---") return editor.chain().deleteRange(range).setHorizontalRule().run();
          const code = /^```([^\s`~]*)$/.exec(raw);
          if (code?.[1] === "mermaid") {
            getPalette()?.open(range, "mermaid");
            return true;
          }
          if (code)
            return editor
              .chain()
              .deleteRange(range)
              .setCodeBlock(code[1] ? { language: code[1] } : undefined)
              .run();
          if (raw === "$$") {
            getPalette()?.open(range, "math-block");
            return true;
          }
          const directive = /^:::\{(note|warning|dropdown|figure)\}(?: (.*))?$/.exec(raw);
          if (directive) {
            const command = directive[1],
              arg = directive[2] ?? "";
            if (command === "note" || command === "warning")
              return editor
                .chain()
                .deleteRange(range)
                .wrapIn("callout", { kind: command, title: arg || null })
                .run();
            if (command === "dropdown" && arg)
              return editor.chain().deleteRange(range).wrapIn("details", { title: arg }).run();
            getPalette()?.open(range, command, { [command === "figure" ? "src" : "title"]: arg });
            return true;
          }
          return false;
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handlePaste: (view, event) => {
              const text = event.clipboardData?.getData("text/plain");
              if (text === undefined) return false;
              event.preventDefault();
              if (this.editor.isActive("codeBlock")) {
                view.dispatch(view.state.tr.insertText(text.replace(/\r\n?/g, "\n")));
                return true;
              }
              if (this.editor.isActive("table") || this.editor.isActive("heading")) {
                const content = text
                  .replace(/\r\n?/g, "\n")
                  .split("\n")
                  .flatMap((line, i) => [
                    ...(i ? [{ type: "hardBreak" }] : []),
                    ...(line ? [{ type: "text", text: line }] : []),
                  ]);
                this.editor.commands.insertContent(content);
                return true;
              }
              const paragraphs = text
                .split(/\r?\n/)
                .map((line) =>
                  view.state.schema.nodes.paragraph.create(
                    null,
                    line ? view.state.schema.text(line) : undefined,
                  ),
                );
              if (paragraphs.length === 1) view.dispatch(view.state.tr.insertText(text));
              else this.editor.commands.insertContent(paragraphs.map((p) => p.toJSON()));
              return true;
            },
            handleTextInput: (view, from, to, text) => {
              if (
                text !== "/" ||
                view.composing ||
                view.state.selection.$from.parent.type.name !== "paragraph"
              )
                return false;
              const before = view.state.selection.$from.parent.textBetween(
                0,
                view.state.selection.$from.parentOffset,
              );
              if (
                before &&
                !/[\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]$/u.test(
                  before,
                )
              )
                return false;
              view.dispatch(view.state.tr.insertText(text, from, to));
              queueMicrotask(() => getPalette()?.open({ from, to: from + 1 }));
              return true;
            },
          },
        }),
      ];
    },
  });
}
