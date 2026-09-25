import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { PaperContainer } from "~/components/atoms/paper-container";
import { StickyHeader } from "~/components/molecules/sticky-header";

/** The archive owns scroll restoration without the editor's keyboard runtime. */
export const ArchiveLayout = component$(() => (
  <div css={archiveStyles}>
    <a
      class="skip-link"
      href="#journal"
      onClick$={() => document.getElementById("journal")?.focus({ preventScroll: true })}
    >
      記事一覧へ移動
    </a>
    <PaperContainer class="archive">
      <StickyHeader class="archive-header" mode="persistent" surface="paper">
        <Slot name="header-actions" />
      </StickyHeader>
      <Slot />
    </PaperContainer>
  </div>
));

const archiveStyles = css`
  display: contents;
  & .archive {
    display: flex;
    flex-direction: column;
    height: 100svh;
    min-height: 0;
    overflow: hidden;
    background: var(--paper);
  }
  & .archive-header {
    flex: none;
  }
  & .skip-link {
    position: fixed;
    z-index: 20;
    left: 16px;
    top: 12px;
    padding: 14px 20px;
    color: var(--paper);
    background: var(--ink);
    transform: translateY(-200%);
  }
  & .skip-link:focus {
    transform: translateY(0);
    outline: 2px solid var(--link);
    outline-offset: 4px;
  }
  & #articles {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
  }
`;
