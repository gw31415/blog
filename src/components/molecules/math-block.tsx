import { component$ } from "@qwik.dev/core";
import { articleSurface } from "../editor/article-surface-contract";

interface MathBlockProps {
  /** SSR 済み HTML (display="true" の mjx-container) */
  html: string;
}

/** 別行立て数式。 */
export const MathBlock = component$((props: MathBlockProps) => {
  return (
    <div class="math-block" data-blog-surface={articleSurface.math}>
      <div dangerouslySetInnerHTML={props.html}></div>
    </div>
  );
});
