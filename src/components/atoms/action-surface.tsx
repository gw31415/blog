import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

/** Controls shared by envelope actions and confirmation dialogs. */
const postActionStyles = css`
  display: contents;
  & button,
  & .management a {
    font: inherit;
    color: var(--muted);
    background: none;
    border: 0;
    padding: 6px 1px;
    min-height: 28px;
    cursor: pointer;
    text-decoration: none;
  }
  & button:hover,
  & .management a:hover {
    color: var(--link);
    text-decoration: underline;
  }
  & a:focus-visible,
  & button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 3px;
  }
  & button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
`;

export const PostActions = component$(() => (
  <div css={postActionStyles}>
    <Slot />
  </div>
));
