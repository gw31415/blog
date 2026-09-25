import { component$ } from "@qwik.dev/core";
import { articleSurface } from "../editor/article-surface-contract";

interface CodeBlockProps {
  /** キャプション左 (例: "文章の構造") */
  caption: string;
  /** キャプション右の言語表示 (例: "HTML") */
  languageLabel: string;
  /** <code> の言語クラス (例: "language-html") */
  languageClass: string;
  /** highlight.js SSR 済みの HTML (エスケープ済みコード断片) */
  html: string;
}

/** コードブロック (キャプション + ハイライト済み pre)。 */
export const CodeBlock = component$((props: CodeBlockProps) => {
  return (
    <div class="code-block" data-blog-surface={articleSurface.code}>
      <div class="code-caption">
        <span>{props.caption}</span>
        <span>{props.languageLabel}</span>
      </div>

      <pre>
        <code class={props.languageClass} dangerouslySetInnerHTML={props.html}></code>
      </pre>
    </div>
  );
});
