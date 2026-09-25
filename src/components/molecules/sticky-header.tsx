import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { BlogTopbar } from "./topbar";

/** Shared chrome; VirtualKeyboardViewport owns scroll visibility and positioning. */
export const StickyHeader = component$<{
  title?: string;
  date?: string;
  dateLabel?: string;
  class?: string;
}>((props) => (
  <header css={stickyHeaderStyles} class={`type-meta ${props.class ?? ""}`} data-scroll-header>
    <BlogTopbar title={props.title} date={props.date} dateLabel={props.dateLabel}>
      <Slot />
    </BlogTopbar>
  </header>
));

const stickyHeaderStyles = css`
  --sticky-header-height: calc(1.5lh + env(safe-area-inset-top) + 1px);
  position: sticky;
  z-index: 2;
  box-sizing: border-box;
  top: 0;
  height: var(--sticky-header-height);
  margin-inline: auto;
  margin-bottom: calc(-1 * var(--sticky-header-height));
  width: min(100%, 48rem);
  padding: calc(env(safe-area-inset-top) + 0.25lh) var(--paper-inset) 0.25lh;
  color: var(--ink);
  border-bottom: 1px solid var(--line-soft);
  background: rgb(242 234 213 / 98%);
  box-shadow: 0 3px 12px rgb(40 30 20 / 8%);
  transform: translateY(0);
  transition:
    opacity 240ms ease-out,
    transform 240ms ease-out,
    visibility 240ms;

  & form {
    margin: 0 0 0 auto;
    flex: none;
  }
  & button {
    font: inherit;
    color: var(--muted);
    background: transparent;
    border: 0;
    padding: 0;
    min-height: 1lh;
    cursor: pointer;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
