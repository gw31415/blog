import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { BlogTopbar } from "./topbar";

/** Shared site chrome; only reveal behavior and surface treatment vary by page. */
export const StickyHeader = component$<{
  title?: string;
  class?: string;
  mode?: "scroll-reveal" | "persistent";
  surface?: "paper" | "glass";
}>((props) => (
  <header
    css={stickyHeaderStyles}
    class={`type-meta ${props.class ?? ""}`}
    data-site-header
    data-scroll-header={props.mode === "persistent" ? undefined : ""}
    data-header-mode={props.mode ?? "scroll-reveal"}
    data-header-surface={props.surface ?? "paper"}
  >
    <BlogTopbar title={props.title}>
      <Slot />
    </BlogTopbar>
  </header>
));

const stickyHeaderStyles = css`
  --sticky-header-height: var(--site-header-height, calc(52px + env(safe-area-inset-top)));
  position: sticky;
  z-index: 4;
  box-sizing: border-box;
  top: 0;
  height: var(--sticky-header-height);
  margin-inline: auto;
  margin-bottom: calc(-1 * var(--sticky-header-height));
  width: min(100%, 48rem);
  padding: env(safe-area-inset-top) 0 0;
  color: var(--ink);
  border-top: 1px solid var(--surface-rule, var(--line-soft));
  border-bottom: 2px solid var(--surface-rule, var(--line-soft));
  white-space: nowrap;
  transform: translateY(0);
  transition:
    opacity 240ms ease-out,
    transform 240ms ease-out,
    visibility 240ms;

  &[data-header-mode="persistent"] {
    position: relative;
    margin-bottom: 0;
  }
  &[data-header-surface="paper"] {
    background-color: var(--page-background);
    background-image: var(--paper-stock);
    background-size: var(--paper-stock-size);
    background-blend-mode: multiply;
  }
  &[data-header-surface="glass"] {
    background: rgb(242 234 213 / 62%);
    -webkit-backdrop-filter: blur(12px) saturate(112%);
    backdrop-filter: blur(12px) saturate(112%);
  }
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
  & button:hover {
    color: var(--link);
    background: var(--highlight);
  }
  & a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  & button:focus-visible {
    outline: 1px solid var(--red);
    outline-offset: -1px;
  }
  & button:disabled {
    cursor: wait;
    opacity: 0.58;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  @media (forced-colors: active) {
    &[data-header-surface] {
      background: Canvas;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
`;
