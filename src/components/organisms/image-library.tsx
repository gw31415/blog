import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

export const ImageLibrary = component$(() => (
  <section css={styles} id="journal" tabIndex={-1} aria-label="画像の管理">
    <h1>画像</h1>
    <p>
      オリジナルは保持されます。記事を削除すると、その記事だけで使っている配信用画像を削除します。
    </p>
    <Slot />
  </section>
));
const styles = css`
  padding: 20px clamp(20px, 5vw, 68px) 60px;
  color: var(--ink);
  & nav {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    margin-block: 20px;
  }
  & a {
    color: var(--link);
    overflow-wrap: anywhere;
  }
  & a[aria-current="page"] {
    color: var(--ink);
    text-decoration-thickness: 2px;
  }
  & ul {
    list-style: none;
    padding: 0;
  }
  & li {
    border-top: 1px solid var(--muted);
    padding-block: 16px;
    overflow-wrap: anywhere;
  }
  & li li {
    border: 0;
    padding-block: 4px;
  }
  & h2 {
    font-size: 1.1em;
    margin: 0 0 8px;
  }
  & p {
    margin-block: 8px;
  }
  & button {
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--muted);
    padding: 8px 12px;
    cursor: pointer;
  }
  & button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  & summary {
    cursor: pointer;
  }
  & form {
    margin-block: 12px;
  }
`;
