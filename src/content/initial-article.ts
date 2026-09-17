import type { ArticleDraft } from "./article";

export const INITIAL_ARTICLE = {
  category: "随筆",
  publishedAt: "2026-09-17",
  title: "秋の気配",
  subtitle: "静かな朝に、窓辺で書き留めた小さな記録。",
  bodyMarkdown: `朝、窓を開けると、昨日までとは少し違う風が入ってきた。夏の名残を含みながらも、どこか乾いていて、遠くから秋の気配を連れてくるような風だった。机の上には読みかけの本と、一晩そのままになっていた珈琲のカップがある。

## 組版の覚え書き

本文では \`palt\` と \`text-autospace\` を併用している。本文サイズを $f=15\\,\\mathrm{px}$、行高倍率を $\\lambda=1.3$ とすると、一行の送りは $L=f\\lambda=19.5\\,\\mathrm{px}$ になる。

$$
\\begin{aligned} L &= f\\lambda \\\\[3pt] &= 15\\,\\mathrm{px} \\times 1.3 \\\\[3pt] &= 19.5\\,\\mathrm{px}, \\\\[8pt] g &= \\frac{L}{2} \\\\[3pt] &= 9.75\\,\\mathrm{px}. \\end{aligned}
$$

_本文一行を方眼二マスへ対応させる。_

MathJaxなら、正規分布 $X\\sim\\mathcal N(\\mu,\\sigma^2)$ や分数、積分、行列も同じ記法で組める。

$$
p(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} \\exp\\!\\left( -\\frac{(x-\\mu)^2}{2\\sigma^2} \\right)
$$

## コード

シンタックスハイライトには [highlight.js](https://highlightjs.org/) を利用する。ライブラリ既定の濃いテーマをそのまま使うのではなく、古い技術書の多色刷りに近い色へ置き換えている。

\`\`\`html 文章の構造
<!-- 一日の記録 -->
<article class="diary">
  <time datetime="2026-09-17">
    九月十七日
  </time>

  <p data-season="autumn">
    朝の風が少し乾いていた。
  </p>
</article>
\`\`\`

\`\`\`css 和文本文
article {
  font-family:
    "Times New Roman",
    "Yu Mincho",
    serif;
  font-size: 15px;
  line-height: 1.3;
  font-feature-settings: "palt" 1, "kern" 1;
  text-autospace: normal;
  line-break: strict;
  text-align: justify;
  text-align-last: start;
}
\`\`\`

## リンクとURL

通常のリンクもURL直書きと同じ赤褐色にする。たとえば [日本語の段落組についての記事](https://zenn.dev/masahiko888/articles/0e6301de9f4a08) や、[MDNのtext-autospace解説](https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace) は本文より明確に色を変え、さらに下線を残す。

リンクを色だけで区別すると判別しにくいため、下線も通常よりやや濃く・太くしている。[MathJaxの公式サイト](https://www.mathjax.org/) のような短いリンクでも、リンクであることがすぐ分かる。

URLそのものを表示する場合も同じ色を使う。

- <https://zenn.dev/masahiko888/articles/0e6301de9f4a08>
- <https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace>
- <https://example.com/archive/2026/09/17/typesetting/japanese-layout/document.html?source=notebook&mode=preview&feature=proportional-metrics&language=ja-JP&experimental=true&another-very-long-query-parameter=this-is-intentionally-extremely-long-to-test-responsive-line-breaking#paragraph-with-extremely-long-fragment-identifier>

| 要素 | 処理 | 目的 |
| --- | --- | --- |
| 通常リンク | 赤褐色 + 下線 | 本文中でも明確に判別 |
| 長いURL | \`overflow-wrap: anywhere\` | 狭い画面でも版面内に収める |
| コード | highlight.js | 多色の構文強調 |
| 数式 | MathJax | TeXによる数式組版 |

> [!NOTE 補足]
> リンク部分では文字のピクセル欠け処理を解除し、赤褐色を直接描画している。そのため、親要素が \`.ink\` でもリンク色が透明化しない。

:::mark-figure{mark="秋" caption="図一　文字だけで作った簡素な図版。写真や画像も同じ余白設計で置ける。"}
:::

:::details{summary="リンク表現について"}
通常時は赤褐色の文字 + 下線。マウスホバー時はさらに濃い赤褐色になり、ごく薄い背景色を加える。キーボードフォーカス時には破線のアウトラインも表示する。
:::

---

## 夕暮れまで

それでも午後五時を過ぎると、光の色がまた変わった。道路の端に伸びる影が長くなり、建物の壁は少し赤みを帯びて見える。夏ならまだ一日の途中だった時間が、いつの間にか夕方として感じられるようになっている。

:::figure{src="/images/dusk-hills.jpg" alt="夕光に霞む山並み" caption="図二　夕暮れに霞む谷。写真は紙面に馴染むよう彩度を落としている。"}
:::

けれども、このページだけは残る。紙の色も、方眼の褪せた赤も、文字の小さなかすれも、そのまま残っている。**記録とは、忘れないためのものというより、忘れたあとに戻る場所なのかもしれない。**
`,
} as const satisfies Readonly<ArticleDraft>;
