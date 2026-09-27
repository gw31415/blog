import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { PaperContainer } from "~/components/atoms/paper-container";
import { StickyHeader } from "~/components/molecules/sticky-header";

/** The archive stays in document flow; the page owns its scrolling. */
export const ArchiveLayout = component$<{ title?: string }>((props) => (
  <div css={archiveStyles}>
    <a
      class="skip-link"
      href="#journal"
      onClick$={() => document.getElementById("journal")?.focus({ preventScroll: true })}
    >
      {props.title ? `${props.title}へ移動` : "記事一覧へ移動"}
    </a>
    <PaperContainer class="archive">
      <StickyHeader class="archive-header" mode="persistent" surface="paper" title={props.title}>
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
    min-height: 100svh;
  }
  & .archive,
  & .post-stream {
    --desk: #dfdbcd;
    --desk-dot: rgb(80 68 45 / 12%);
    --desk-glint: rgb(255 255 255 / 48%);
    --edge: rgb(90 71 44 / 21%);
    --desk-pattern:
      radial-gradient(circle, var(--desk-dot) 0.55px, transparent 0.8px),
      radial-gradient(circle, var(--desk-glint) 0.55px, transparent 0.8px);
    --desk-edge-shadow: inset 1px 0 var(--edge), inset -1px 0 var(--edge);
    background-color: var(--desk);
    background-image: var(--desk-pattern);
    background-attachment: scroll, scroll;
    background-position:
      0 0,
      1px 1px;
    background-size: 5px 5px;
    box-shadow: var(--desk-edge-shadow);
  }
  & .archive-header[data-header-mode="persistent"] {
    flex: none;
    position: sticky;
    top: 0;
    z-index: 4;
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
    flex: 1 1 auto;
    flex-direction: column;
  }
`;
