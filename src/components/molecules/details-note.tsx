import { component$, Slot } from "@qwik.dev/core";

interface DetailsNoteProps {
  summary: string;
}

/** 折りたたみ補足 (details)。 */
export const DetailsNote = component$((props: DetailsNoteProps) => {
  return (
    <details>
      <summary>{props.summary}</summary>

      <div class="details-body">
        <Slot />
      </div>
    </details>
  );
});
