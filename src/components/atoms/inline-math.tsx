import { component$ } from "@qwik.dev/core";

interface InlineMathProps {
  /** SSR 済み HTML (mjx-container を含む) */
  html: string;
}

/** 文中の数式。 */
export const InlineMath = component$((props: InlineMathProps) => {
  return <span class="math-tex" dangerouslySetInnerHTML={props.html}></span>;
});
