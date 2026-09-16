/**
 * 記事ページ「秋の気配」。
 *
 * sample.html を BlogPaper / BlogHeader / SectionHeading / MathBlock /
 * CodeBlock などの記事コンポーネントで書き直したもの。今後の記事も
 * 同じ部品で組み立てる想定。
 *
 * 数式・コードは SSR 済み HTML (rendered.ts) を埋め込むだけなので、
 * MathJax / highlight.js の CDN スクリプトやクライアント実行は不要。
 */
import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";

import {
  AsideNote,
  BlogArticle,
  BlogFooter,
  BlogHeader,
  BlogPaper,
  CodeBlock,
  DetailsNote,
  InlineMath,
  MathBlock,
  ProseP,
  SectionHeading,
  TableWrap,
  UrlLinkList,
} from "~/components/blog/blog";
import { CODE_HTML, MATH_HTML } from "~/components/blog/rendered";

export default component$(() => {
  return (
    <BlogPaper>
      <BlogHeader
        category="随筆"
        dateTime="2026-09-17"
        dateLabel="九月十七日　木曜日"
        title="秋の気配"
        subtitle="静かな朝に、窓辺で書き留めた小さな記録。"
      />

      <BlogArticle>
        <ProseP>
          朝、窓を開けると、昨日までとは少し違う風が入ってきた。
          夏の名残を含みながらも、どこか乾いていて、 遠くから秋の気配を連れてくるような風だった。
          机の上には読みかけの本と、一晩そのままになっていた珈琲のカップがある。
        </ProseP>

        <SectionHeading number="一" title="組版の覚え書き" />

        <ProseP>
          本文では<code>palt</code>と<code>text-autospace</code>を併用している。 本文サイズを
          <InlineMath html={MATH_HTML.inlineF} />、 行高倍率を
          <InlineMath html={MATH_HTML.inlineLambda} />
          とすると、一行の送りは
          <InlineMath html={MATH_HTML.inlineLineHeight} />
          になる。
        </ProseP>

        <MathBlock html={MATH_HTML.blockLineHeight} caption="本文一行を方眼二マスへ対応させる。" />

        <ProseP>
          MathJaxなら、正規分布
          <InlineMath html={MATH_HTML.inlineNormal} />
          や分数、積分、行列も同じ記法で組める。
        </ProseP>

        <MathBlock html={MATH_HTML.blockNormal} />

        <SectionHeading number="二" title="コード" />

        <ProseP>
          シンタックスハイライトには
          <a href="https://highlightjs.org/">highlight.js</a>
          を利用する。 ライブラリ既定の濃いテーマをそのまま使うのではなく、
          古い技術書の多色刷りに近い色へ置き換えている。
        </ProseP>

        <CodeBlock
          caption="文章の構造"
          languageLabel="HTML"
          languageClass="language-html"
          html={CODE_HTML.htmlDiary}
        />

        <CodeBlock
          caption="和文本文"
          languageLabel="CSS"
          languageClass="language-css"
          html={CODE_HTML.cssBody}
        />

        <SectionHeading number="三" title="リンクとURL" />

        <ProseP>
          通常のリンクもURL直書きと同じ赤褐色にする。 たとえば
          <a href="https://zenn.dev/masahiko888/articles/0e6301de9f4a08">
            日本語の段落組についての記事
          </a>
          や、
          <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace">
            MDNのtext-autospace解説
          </a>
          は本文より明確に色を変え、さらに下線を残す。
        </ProseP>

        <ProseP>
          リンクを色だけで区別すると判別しにくいため、 下線も通常よりやや濃く・太くしている。
          <a href="https://www.mathjax.org/">MathJaxの公式サイト</a>
          のような短いリンクでも、リンクであることがすぐ分かる。
        </ProseP>

        <ProseP>URLそのものを表示する場合も同じ色を使う。</ProseP>

        <UrlLinkList
          items={[
            {
              href: "https://zenn.dev/masahiko888/articles/0e6301de9f4a08",
              label: "https://zenn.dev/masahiko888/articles/0e6301de9f4a08",
            },
            {
              href: "https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace",
              label: "https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace",
            },
            {
              href: "https://example.com/archive/2026/09/17/typesetting/japanese-layout/document.html?source=notebook&mode=preview&feature=proportional-metrics&language=ja-JP&experimental=true&another-very-long-query-parameter=this-is-intentionally-extremely-long-to-test-responsive-line-breaking#paragraph-with-extremely-long-fragment-identifier",
              label:
                "https://example.com/archive/2026/09/17/typesetting/japanese-layout/document.html?source=notebook&mode=preview&feature=proportional-metrics&language=ja-JP&experimental=true&another-very-long-query-parameter=this-is-intentionally-extremely-long-to-test-responsive-line-breaking#paragraph-with-extremely-long-fragment-identifier",
            },
          ]}
        />

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>要素</th>
                <th>処理</th>
                <th>目的</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>通常リンク</td>
                <td>赤褐色 + 下線</td>
                <td>本文中でも明確に判別</td>
              </tr>

              <tr>
                <td>長いURL</td>
                <td>
                  <code>overflow-wrap: anywhere</code>
                </td>
                <td>狭い画面でも版面内に収める</td>
              </tr>

              <tr>
                <td>コード</td>
                <td>highlight.js</td>
                <td>多色の構文強調</td>
              </tr>

              <tr>
                <td>数式</td>
                <td>MathJax</td>
                <td>TeXによる数式組版</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>

        <AsideNote label="補足">
          リンク部分では文字のピクセル欠け処理を解除し、 赤褐色を直接描画している。
          そのため、親要素が<code>.ink</code>
          でもリンク色が透明化しない。
        </AsideNote>

        <DetailsNote summary="リンク表現について">
          通常時は赤褐色の文字 + 下線。 マウスホバー時はさらに濃い赤褐色になり、
          ごく薄い背景色を加える。 キーボードフォーカス時には破線のアウトラインも表示する。
        </DetailsNote>

        <hr />

        <SectionHeading number="四" title="夕暮れまで" />

        <ProseP>
          それでも午後五時を過ぎると、光の色がまた変わった。
          道路の端に伸びる影が長くなり、建物の壁は少し赤みを帯びて見える。
          夏ならまだ一日の途中だった時間が、いつの間にか夕方として感じられるようになっている。
        </ProseP>

        <ProseP>
          けれども、このページだけは残る。
          紙の色も、方眼の褪せた赤も、文字の小さなかすれも、そのまま残っている。
          <strong>
            記録とは、忘れないためのものというより、忘れたあとに戻る場所なのかもしれない。
          </strong>
        </ProseP>
      </BlogArticle>

      <BlogFooter left="日々の記録" right="令和八年 / 2026" />
    </BlogPaper>
  );
});

export const head: DocumentHead = {
  title: "秋の気配",
  meta: [
    {
      name: "description",
      content: "静かな朝に、窓辺で書き留めた小さな記録。",
    },
  ],
};
