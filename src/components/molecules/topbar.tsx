import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { SiteLink } from "../atoms/site-link";

export const BlogTopbar = component$<{
  title?: string;
  date?: string;
  dateLabel?: string;
  class?: string;
}>((props) => (
  <nav
    css={blogTopbarStyles}
    class={`site-topbar type-meta ${props.class ?? ""}`}
    aria-label="記事の現在位置"
  >
    <SiteLink />
    {props.title && (
      <>
        <span class="article-sticky-separator" aria-hidden="true">
          &gt;
        </span>
        <span class="article-sticky-title">{props.title}</span>
      </>
    )}
    {props.dateLabel && (
      <time class="article-sticky-date" dateTime={props.date}>
        （{props.dateLabel}）
      </time>
    )}
    <Slot />
  </nav>
));

const blogTopbarStyles = css`
  & .article-sticky-site,
  & .article-sticky-separator,
  & .article-sticky-date {
    flex: none;
  }
  & .article-sticky-title {
    min-width: 0;
    flex: 1 1 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  & .article-sticky-date {
    color: var(--muted);
  }
  display: flex;
  align-items: center;
  gap: 0.55em;
  color: var(--ink);
`;
