import { component$, Slot } from "@qwik.dev/core";

/** 本文段落。 */
export const ProseP = component$(() => {
  return (
    <p>
      <span class="ink">
        <Slot />
      </span>
    </p>
  );
});
