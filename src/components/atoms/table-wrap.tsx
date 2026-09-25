import { component$, Slot } from "@qwik.dev/core";

/** 表の横スクロール用ラッパー。中に素の table を書く。 */
export const TableWrap = component$(() => {
  return (
    <div class="table-wrap">
      <Slot />
    </div>
  );
});
