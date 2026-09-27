import { type QRL } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

/** Both article entry points share loading, preloading and mode semantics. */
interface ArticleEditButtonProps {
  placement: "header" | "sticky";
  editable?: boolean;
  busy?: boolean;
  onEditIntent$?: QRL<() => void>;
  onEditRequest$?: QRL<() => void>;
  onDoneRequest$?: QRL<() => void>;
}

export function ArticleEditButton(props: ArticleEditButtonProps) {
  return (
    <button
      type="button"
      css={editButtonStyles}
      class={`article-${props.placement}-edit`}
      aria-busy={props.busy ? "true" : "false"}
      disabled={props.busy ? true : undefined}
      onPointerEnter$={props.editable ? undefined : props.onEditIntent$}
      onFocus$={props.editable ? undefined : props.onEditIntent$}
      onClick$={props.editable ? props.onDoneRequest$ : props.onEditRequest$}
    >
      <span class="article-edit-line">
        <span>{props.busy ? "…" : props.editable ? "完了" : "編集"}</span>
      </span>
    </button>
  );
}

const editButtonStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: var(--muted);
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  cursor: pointer;
  /* Center the same line box as the site name, with the smaller label on its baseline. */
  & .article-edit-line {
    font-size: var(--topbar-site-size, 16px);
    line-height: 1.5;
  }
  & .article-edit-line > span {
    font-size: 0.75em;
  }
  &.article-header-edit {
    justify-content: flex-end;
    min-width: 2.5em;
    min-height: 2em;
    margin: 0;
    padding: 0;
  }
  &.article-sticky-edit {
    min-width: 3em;
    min-height: 1lh;
    margin-inline-start: auto;
    padding: 0;
  }
  &:hover {
    color: var(--link);
    background: var(--highlight);
  }
  &:focus-visible {
    outline: 1px solid var(--red);
    outline-offset: -1px;
  }
  &:disabled {
    cursor: wait;
    opacity: 0.58;
  }
`;
