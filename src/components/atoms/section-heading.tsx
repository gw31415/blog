import { component$ } from "@qwik.dev/core";

interface SectionHeadingProps {
  title: string;
}

/** 節見出し。番号は CSS counter から自動生成する。 */
export const SectionHeading = component$((props: SectionHeadingProps) => {
  return <h2 class="ink type-heading">{props.title}</h2>;
});
