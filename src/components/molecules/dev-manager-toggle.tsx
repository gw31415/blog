import { component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { DEV_MANAGER_COOKIE } from "~/dev/manager";

export const DevManagerToggle = component$<{ enabled: boolean }>(({ enabled }) => (
  <label css={toggleStyles}>
    <input
      type="checkbox"
      checked={enabled}
      onChange$={(_, input) => {
        document.cookie = `${DEV_MANAGER_COOKIE}=${input.checked ? "1" : "0"}; Path=/; SameSite=Strict`;
        window.location.reload();
      }}
    />
    <span>
      管理者目線 <small>開発用</small>
    </span>
  </label>
));

const toggleStyles = css`
  position: fixed;
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 13px;
  cursor: pointer;
  & input {
    margin: 0;
    accent-color: var(--red);
  }
  & small {
    margin-left: 6px;
    color: var(--muted);
    font-size: 10px;
  }
`;
