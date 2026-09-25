import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

/** Shared outer measure for graph paper and archive; small screens reach both edges. */
const paperContainerStyles = css`
  box-sizing: border-box;
  width: min(100%, var(--paper-measure));
  margin-inline: auto;
`;

export const PaperContainer = component$<{ class?: string; layoutKey?: string }>((props) => (
  <main css={paperContainerStyles} class={props.class} data-layout-key={props.layoutKey}>
    <Slot />
  </main>
));
