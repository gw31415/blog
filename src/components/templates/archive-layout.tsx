import { StickyHeader } from "~/components/molecules/sticky-header";
import { PaperContainer } from "~/components/atoms/paper-container";
import { component$, Slot } from "@qwik.dev/core";
import { VirtualKeyboardViewport } from "~/components/templates/virtual-keyboard-viewport";
import { css } from "@qstyle/qwik";

const archiveStyles = css`
  display: contents;

  & .archive {
    padding: 0 0 32px;
  }
  & .archive-header {
    background: var(--page-background);
    border-bottom: 1px solid var(--line-soft);
  }
  & .archive-header form {
    margin-left: auto;
  }
  & h1 {
    margin: 0;
  }
  & .archive-header button,
  & .more a {
    font: var(--small-size)/1.5 var(--sans);
    color: var(--muted);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 4px;
  }
  & .more {
    text-align: center;
    padding: 16px 0 24px 64px;
    color: var(--muted);
    font-size: var(--small-size);
  }
  & .more p {
    margin: 12px 0;
  }
  & .more a {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  & button:focus-visible,
  & a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (max-width: 600px) {
    & .archive-header {
      padding: calc(env(safe-area-inset-top) + 10px) 8px 10px;
    }
    & .heading {
      margin: 24px 16px 18px;
    }
    & .more {
      padding-left: 0;
    }
  }
  @media (min-width: 601px) {
    & .archive-header {
      padding: calc(env(safe-area-inset-top) + 14px) 0 14px;
    }
    & .heading {
      margin: 30px 0 24px 64px;
    }
  }
`;

export const ArchiveLayout = component$(() => (
  <div css={archiveStyles}>
    <PaperContainer class="archive">
      <VirtualKeyboardViewport internalScroll={false}>
        <StickyHeader q:slot="top">
          <Slot name="sticky-actions" />
        </StickyHeader>
        <header class="archive-header">
          <Slot name="header" />
        </header>
        <Slot />
      </VirtualKeyboardViewport>
    </PaperContainer>
  </div>
));
