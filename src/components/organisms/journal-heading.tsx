import { component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

export const JournalHeading = component$(() => (
  <div id="journal" css={journalHeadingStyles} tabIndex={-1}>
    <h1 id="articles-title" class="type-heading ink">
      記事
    </h1>
  </div>
));

const journalHeadingStyles = css`
  scroll-margin-top: 12px;
  & h1 {
    margin: 0;
  }
  @media (max-width: 600px) {
    padding: 0 20px 16px;
  }
  @media (min-width: 601px) {
    padding: 0 68px 18px;
  }
`;
