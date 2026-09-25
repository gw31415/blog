import { component$, Slot } from "@qwik.dev/core";
import { articleSurface } from "../editor/article-surface-contract";

interface FigureProps {
  caption: string;
}

/**
 * 図版。枠内には図・写真など任意の内容を置く。
 * 画像の色は変えず、紙面の枠で本文と馴染ませる。
 */
export const Figure = component$((props: FigureProps) => {
  return (
    <figure>
      <div class="figure-field" data-blog-surface={articleSurface.figure}>
        <Slot />
      </div>

      <figcaption>{props.caption}</figcaption>
    </figure>
  );
});
