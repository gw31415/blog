import { PaperContainer } from "~/components/atoms/paper-container";
import { StickyHeader } from "~/components/molecules/sticky-header";
import { component$, Slot } from "@qwik.dev/core";
import { VirtualKeyboardViewport } from "~/components/templates/virtual-keyboard-viewport";
import { css } from "@qstyle/qwik";

const archiveStyles = css`
  display: contents;

  & .archive {
    height: 100svh;
    min-height: 0;
    overflow: hidden;
  }
  & .archive > [data-virtual-keyboard-viewport] {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }
  & .archive > [data-virtual-keyboard-viewport] > [data-virtual-keyboard-region="top"] {
    position: relative;
    flex: none;
  }
  & .archive > [data-virtual-keyboard-viewport] > [data-virtual-keyboard-region="content"] {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
  }
  & #articles {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
  }
`;

export const ArchiveLayout = component$(() => (
  <div css={archiveStyles}>
    <PaperContainer class="archive">
      <VirtualKeyboardViewport internalScroll={false}>
        <StickyHeader q:slot="top" class="archive-header" mode="persistent" surface="glass">
          <Slot name="header-actions" />
        </StickyHeader>
        <Slot />
      </VirtualKeyboardViewport>
    </PaperContainer>
  </div>
));
