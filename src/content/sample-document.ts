import type { JSONContent } from "@tiptap/core";
import { normalizeDocument } from "./document.ts";
const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const heading = (level: number, label: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [text(label)],
});
const code = (
  language: string | null,
  source: string,
  caption: string | null = null,
): JSONContent => ({
  type: "codeBlock",
  attrs: { language, caption },
  content: source ? [text(source)] : [],
});
const item = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content });
const image = "/assets/document-sample.svg";
export const sampleDocument = normalizeDocument({
  type: "doc",
  content: [
    p(
      text(
        "この長い記事は、文書を保存し、読み直し、編集を続けるための観察ノートです。文章の意味と表示の関係を、一つずつ確かめていきます。見出し、補足、数式、図、表を組み合わせても、原文と順番が保存されることを確認します。",
      ),
    ),
    heading(2, "文字と意味を記録する"),
    p(
      text("通常の文字に続いて、"),
      text("重要", [{ type: "bold" }]),
      text("、太字", [{ type: "b" }]),
      text("、italic", [{ type: "i" }]),
      text("、下線", [{ type: "underline" }]),
      text("、ハイライト", [{ type: "highlight" }]),
      text("、H"),
      text("2", [{ type: "subscript" }]),
      text("O、x"),
      text("2", [{ type: "superscript" }]),
      text("、"),
      text("強調", [{ type: "italic" }]),
      text("、"),
      text("取り消した案", [{ type: "strike" }]),
      text("、"),
      text("const value = 1", [{ type: "code" }]),
      text("を配置します。これは装飾ではなく、読み手が情報を読み分ける手がかりです。"),
    ),
    p(
      text("組合せも保持します："),
      text("強く伝える重要語", [{ type: "bold" }, { type: "italic" }]),
      text("と"),
      text("公式コード", [
        { type: "code" },
        { type: "link", attrs: { href: "https://tiptap.dev/", title: "Tiptap公式" } },
      ]),
      text("。普通のリンクは"),
      text("仕様の入口", [
        {
          type: "link",
          attrs: { href: "https://spec.commonmark.org/0.31.2/", title: "CommonMark" },
        },
      ]),
      text("です。"),
    ),
    p(
      text("ソース上の改行"),
      { type: "softBreak" },
      text("は同じ段落に続きます。"),
      { type: "hardBreak" },
      text("この行は意図して改行しています。記号 # * _ | $ と ©、絵文字🌱も文字のまま残ります。"),
    ),
    p(
      text(
        "小見出しは本文の情報を整理します。ページのタイトルとは区別し、見出しの階層を再読込のたびに変えないことが重要です。",
      ),
    ),
    heading(3, "第三階層"),
    p(text("ここには具体的な観察結果を書きます。文章を編集するときにも、この深さは維持されます。")),
    heading(4, "第四階層"),
    p(text("複雑な説明の小項目にも、独立した見出しが必要です。")),
    { type: "horizontalRule" },
    heading(2, "リストと引用"),
    {
      type: "bulletList",
      attrs: { tight: true },
      content: [
        item(p(text("資料を読む"))),
        item(p(text("順序を決める")), {
          type: "orderedList",
          attrs: { start: 3, tight: true },
          content: [item(p(text("三番目から始める"))), item(p(text("続く項目")))],
        }),
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 7, tight: false },
      content: [
        item(
          p(text("七番目の観察。文章の中に空行が必要な場合もあります。")),
          p(text("同じ項目に属する二つ目の段落です。別の項目にはなりません。")),
        ),
        item(p(text("八番目の観察。"))),
      ],
    },
    {
      type: "taskList",
      attrs: { tight: true },
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [p(text("本文の保存形式を確認する"))],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            p(text("表示と操作を確認する")),
            {
              type: "taskList",
              attrs: { tight: true },
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [p(text("小さい画面でも確認する"))],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        p(text("記録は未来の自分への手紙である。")),
        { type: "blockquote", content: [p(text("引用の内側に別の引用を残すこともできます。"))] },
      ],
    },
    heading(2, "コード、文字図、数式"),
    code(
      "typescript",
      'function greet(name: string) {\n\treturn `こんにちは、${name}`;  \n}\n\nconsole.log(greet("世界"));',
    ),
    code("unknown-language", "unknown syntax stays here\n  indentation and spaces  "),
    code(null, ""),
    code("text", "入力 ──→ 検証 ──→ 保存\n           │\n           └──→ 診断を表示"),
    p(
      text("インライン数式 "),
      { type: "inlineMath", attrs: { latex: "E=mc^2" } },
      text(" と、直後が数字の "),
      { type: "inlineMath", attrs: { latex: "x" } },
      text("2 を区別します。"),
    ),
    {
      type: "blockMath",
      attrs: {
        latex:
          "\\begin{aligned}\nf(x) &= \\int_0^x t^2\\,dt \\\\\n     &= \\frac{x^3}{3}\n\\end{aligned}",
      },
    },
    code(
      "mermaid",
      "flowchart TD\n  A[文書を入力] --> B{検証}\n  B -->|適合| C[JSONとして保存]\n  B -->|要修正| D[原文と診断を保持]\n  C --> E[閲覧と再編集]",
      "文書の保存と診断",
    ),
    code(
      "mermaid",
      "sequenceDiagram\n  participant U as 編集者\n  participant E as エディター\n  participant D as 保存先\n  U->>E: 本文を変更\n  E->>D: JSONを保存\n  D-->>E: 保存完了",
      "図の説明だよ",
    ),
    heading(2, "補足と折り畳み"),
    {
      type: "callout",
      attrs: { kind: "note", title: null },
      content: [p(text("既定ラベルの補足です。本文は通常のブロックとして編集できます。"))],
    },
    {
      type: "callout",
      attrs: { kind: "warning", title: "消さずに確認する *重要*" },
      content: [
        p(
          text(
            "対応できない入力は、見た目だけ整えて削除しないようにします。保存結果の診断が出たら、入力した情報と照らし合わせます。",
          ),
        ),
      ],
    },
    {
      type: "details",
      attrs: { title: "検討の詳細を見る" },
      content: [
        heading(3, "折り畳み内部の見出し"),
        p(text("この説明は最初は閉じています。読み手が開いた状態を文書の意味として保存しません。")),
        {
          type: "callout",
          attrs: { kind: "note", title: "内部の補足" },
          content: [p(text("コンテナを入れ子にしても構造が維持されます。"))],
        },
        code("text", "::: はソースの一部です\n---\n/path/to/file"),
      ],
    },
    heading(2, "画像と図"),
    p(
      text("文中の通常画像 "),
      {
        type: "image",
        attrs: { src: image, alt: "四つの色と線を使った文書の模式図", title: "通常画像" },
      },
      text(" の位置も維持します。"),
    ),
    p({
      type: "image",
      attrs: { src: image, alt: "クリックできる模式図", title: "画像のtitle" },
      marks: [{ type: "link", attrs: { href: "https://tiptap.dev/", title: "リンクのtitle" } }],
    }),
    {
      type: "figure",
      attrs: { src: image, alt: "文書の流れを示す図" },
      content: [
        p(
          text("図のキャプションは"),
          text("意味を持つ説明", [{ type: "bold" }]),
          text("です。altとは別に編集します。"),
        ),
      ],
    },
    heading(2, "表と境界"),
    {
      type: "table",
      attrs: { title: "文書要素の対応" },
      content: [
        ["要素", "中央の説明", "値"],
        ["改行", "一行目\n二行目", "1"],
        ["縦棒", "A|B", "2"],
        ["コード", "コード文字列", "3"],
      ].map((cells, r) => ({
        type: "tableRow",
        content: cells.map((value, c) => ({
          type: r === 0 ? "tableHeader" : "tableCell",
          attrs: { align: [null, "center", "right"][c] },
          content: [
            p(
              ...(value.includes("\n")
                ? [text("一行目"), { type: "hardBreak" }, text("二行目")]
                : r === 3 && c === 1
                  ? [text("A|B", [{ type: "code" }])]
                  : [text(value)]),
            ),
          ],
        })),
      })),
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", content: [p(text("ヘッダーだけの一列表"))] }],
        },
      ],
    },
    ...Array.from({ length: 8 }, (_, i) => [
      heading(3, `日々の観察 ${i + 1}`),
      p(
        text(
          `第${i + 1}回の記録では、道具の使いやすさと文章の伝わり方について考えました。入力した時の形だけでなく、時間を置いて読み返した時にも、意図した順序で理解できることが大切です。短い断片をつなぎ、必要な場所に具体例を置きながら、一つの説明として組み立てます。`,
        ),
      ),
      p(
        text(
          "画面が小さいときには表とコードを横にスクロールし、長い文章は読みやすい幅へ折り返します。選択した内容にコマンドを適用し、取り消し、もう一度適用しても、保存される本文が予期せず変わらないかを確認します。書きかけの情報を残し、後から続きを書けることも重要です。",
        ),
      ),
    ]).flat(),
  ],
});
