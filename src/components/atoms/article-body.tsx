import { component$, Slot } from "@qwik.dev/core";

/** 本文ブロック (<article class="type-body">)。 */
export const BlogArticle = component$(() => {
  return (
    <article class="type-body">
      <Slot />
    </article>
  );
});
