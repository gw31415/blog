import { component$, Slot } from "@qwik.dev/core";
import { PaperContainer } from "../atoms/paper-container";
import { GridLayer } from "../atoms/grid-layer";

/** 紙面の土台。方眼・紙テクスチャ・本文カラムを提供する。 */
export const BlogPaper = component$(() => {
  return (
    <PaperContainer class="paper" layoutKey="paper">
      <GridLayer />
      <div class="paper-texture" aria-hidden="true"></div>
      <div class="content">
        <Slot />
      </div>
    </PaperContainer>
  );
});
