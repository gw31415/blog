import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { SiteLink } from "../atoms/site-link";

export const BlogTopbar = component$<{
  title?: string;
  showTitle?: boolean;
  variant?: "bar" | "inline";
  class?: string;
}>((props) => (
  <div
    css={blogTopbarStyles}
    class={`site-topbar type-meta ${props.class ?? ""}`}
    data-topbar-variant={props.variant ?? "bar"}
  >
    <nav class="site-breadcrumbs" aria-label="パンくずリスト">
      <ol>
        <li class="site-breadcrumb-home">
          <SiteLink current={!props.title} />
        </li>
        {props.title && props.showTitle !== false && (
          <li class="site-breadcrumb-current">
            <span class="article-sticky-separator" aria-hidden="true">
              ›
            </span>
            <span class="article-sticky-title" aria-current="page" title={props.title}>
              {props.title}
            </span>
          </li>
        )}
      </ol>
    </nav>
    <div class="site-topbar-actions">
      <Slot />
    </div>
  </div>
));

const blogTopbarStyles = css`
  --topbar-site-size: 16px;
  --topbar-inset: var(--site-chrome-inset);
  --topbar-action-inset: var(--site-chrome-inset);
  --topbar-action-border: 1px;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  min-width: 0;
  color: var(--ink);

  &[data-topbar-variant="inline"] {
    --topbar-inset: 0px;
    --topbar-action-inset: 0.5em;
    --topbar-action-border: 0px;
  }
  &[data-topbar-variant="inline"] .site-topbar-actions {
    margin-inline-end: -0.5em;
  }
  & .site-breadcrumbs {
    display: flex;
    align-items: center;
    flex: 1 1 0;
    min-width: 0;
    padding-inline: var(--topbar-inset);
  }
  & .site-breadcrumbs ol {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  & .site-breadcrumb-home {
    display: flex;
    flex: none;
  }
  & .site-breadcrumb-home .site-link {
    display: flex;
    align-items: center;
    color: var(--ink);
    -webkit-text-fill-color: var(--ink);
    font-size: var(--topbar-site-size);
    letter-spacing: 0.02em;
    text-decoration: none;
  }
  & .site-breadcrumb-home .site-link:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  & .site-breadcrumb-current {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  & .article-sticky-separator {
    flex: none;
    color: var(--muted);
  }
  & .article-sticky-title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  & .site-topbar-actions {
    display: flex;
    flex: none;
    align-items: center;
  }
  & .site-topbar-actions:empty {
    display: none;
  }
  & .site-topbar-actions > :is(form, button, a) {
    border-left: var(--topbar-action-border) solid var(--surface-rule, var(--line-soft));
    padding-inline: var(--topbar-action-inset);
    height: 100%;
  }
`;
