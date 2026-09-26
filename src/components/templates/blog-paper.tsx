import { css } from "@qstyle/qwik";
import { component$, Slot } from "@qwik.dev/core";
import { PaperContainer } from "../atoms/paper-container";
import { GridLayer } from "../atoms/grid-layer";
import { PaperMaterial } from "../atoms/paper-material";

/** 紙面の土台。方眼・紙テクスチャ・本文カラムを提供する。 */
export const BlogPaper = component$(() => {
  return (
    <PaperContainer class="paper" layoutKey="paper">
      <PaperMaterial class="article-stock" x={13} y={19} />
      <GridLayer />
      <div class="paper-texture" aria-hidden="true"></div>
      <div class="content">
        <Slot />
      </div>
      <div css={paperFooterStyles}>
        <Slot name="footer" />
      </div>
    </PaperContainer>
  );
});

// Release only the footer from the paper inset; the article column stays unchanged.
const paperFooterStyles = css`
  position: relative;
  z-index: 2;
  @media (min-width: 601px) {
    margin-inline: calc(-1 * var(--paper-inset));
    margin-bottom: calc(-1 * var(--paper-inset));
  }
  @media (max-width: 600px) {
    margin-left: calc(-1 * max(var(--paper-inset), env(safe-area-inset-left)));
    margin-right: calc(-1 * max(var(--paper-inset), env(safe-area-inset-right)));
    margin-bottom: calc(-1 * (var(--paper-inset) + env(safe-area-inset-bottom)));
  }
`;
