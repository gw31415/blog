import { component$, Slot } from "@qwik.dev/core";

interface AsideNoteProps {
  label: string;
}

/** 補足 (aside)。 */
export const AsideNote = component$((props: AsideNoteProps) => {
  return (
    <aside class="aside ink ink-muted" data-kind={props.label === "WARN" ? "warning" : "note"}>
      <span class="aside-label">{props.label}</span>
      <Slot />
    </aside>
  );
});
