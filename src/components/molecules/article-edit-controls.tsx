import { component$, type QRL } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { ArticleEditButton } from "../atoms/edit-button";
import type { AutosaveState } from "../editor/draft-autosave";

export const ArticleEditControls = component$(
  (props: {
    placement: "header" | "sticky";
    editable: boolean;
    busy: boolean;
    publishing: boolean;
    published: boolean;
    hasDraft: boolean;
    saveState: AutosaveState;
    onEditIntent$: QRL<() => void>;
    onEditRequest$: QRL<() => void>;
    onDoneRequest$: QRL<() => void>;
    onPublish$: QRL<() => void>;
    onRetry$: QRL<() => void>;
  }) => {
    return (
      <div css={styles}>
        {(props.editable || props.hasDraft) && (
          <>
            <span role="status" aria-live="polite" data-save-status>
              {props.saveState === "saving"
                ? "保存中…"
                : props.saveState === "pending"
                  ? "未保存"
                  : props.saveState === "blocked"
                    ? "入力確定待ち"
                    : props.saveState === "error"
                      ? "保存失敗"
                      : "下書き保存済み"}
            </span>
            {props.saveState === "error" && (
              <button type="button" onClick$={props.onRetry$}>
                再試行
              </button>
            )}
            <button
              type="button"
              data-publish-post
              disabled={props.busy || props.publishing}
              onClick$={props.onPublish$}
            >
              {props.publishing ? "…" : props.published ? "更新" : "公開"}
            </button>
          </>
        )}
        <ArticleEditButton
          placement={props.placement}
          editable={props.editable}
          busy={props.busy || props.publishing}
          onEditIntent$={props.onEditIntent$}
          onEditRequest$={props.onEditRequest$}
          onDoneRequest$={props.onDoneRequest$}
        />
      </div>
    );
  },
);
const styles = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7em;
  margin-inline-start: auto;
  color: var(--muted);
  font-size: 12px;
  & > button {
    border: 0;
    background: transparent;
    color: var(--link);
    font: inherit;
    cursor: pointer;
    padding: 0.2em;
  }
  & > button:disabled {
    opacity: 0.58;
    cursor: wait;
  }
  & > button:focus-visible {
    outline: 1px solid var(--red);
  }
  & > span {
    white-space: nowrap;
  }
`;
