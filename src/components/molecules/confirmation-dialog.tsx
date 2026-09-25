import { css } from "@qstyle/qwik";
import { component$, type QRL, type Signal } from "@qwik.dev/core";
import { PostActions } from "../atoms/action-surface";

export const ConfirmationDialog = component$<{
  id: string;
  dialog: Signal<HTMLDialogElement | undefined>;
  title: string;
  subject: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  onConfirm$: QRL<() => void | Promise<void>>;
}>((props) => (
  <PostActions>
    <dialog
      ref={props.dialog}
      css={confirmationDialogStyles}
      class="delete-dialog"
      aria-labelledby={`${props.id}-title`}
      aria-describedby={`${props.id}-description`}
      onCancel$={(event) => {
        if (props.busy) event.preventDefault();
      }}
    >
      <h2 id={`${props.id}-title`}>{props.title}</h2>
      <p class="delete-name">{props.subject}</p>
      <p id={`${props.id}-description`}>{props.description}</p>
      {props.error && <p role="alert">{props.error}</p>}
      <div class="dialog-actions">
        <button
          type="button"
          autoFocus
          disabled={props.busy}
          onClick$={() => props.dialog.value?.close()}
        >
          キャンセル
        </button>
        <button
          type="button"
          class="delete-confirm"
          disabled={props.busy}
          onClick$={props.onConfirm$}
        >
          {props.busy ? "…" : props.confirmLabel}
        </button>
      </div>
    </dialog>
  </PostActions>
));

const confirmationDialogStyles = css`
  box-sizing: border-box;
  width: min(440px, calc(100% - 32px));
  margin: auto;
  padding: 28px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--red);
  font-family: var(--serif);

  &::backdrop {
    background: rgb(40 30 20 / 40%);
  }
  & h2 {
    font-size: var(--heading-size);
    margin: 0 0 20px;
  }
  & p {
    font-size: var(--body-size);
    line-height: var(--body-leading);
    overflow-wrap: anywhere;
  }
  & .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 24px;
    margin-top: 28px;
  }
  & .delete-confirm {
    color: var(--link);
  }
`;
