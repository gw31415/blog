import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

export const BlogFooter = component$<{ left: string; right: string }>((props) => (
  <footer
    css={blogFooterStyles}
    class="page-footer type-meta ink ink-muted"
    data-layout-key="footer"
  >
    <span>{props.left}</span>
    <span>{props.right}</span>
  </footer>
));

const blogFooterStyles = css`
  display: flex;
  flex-wrap: wrap;

  justify-content: space-between;

  gap: 1rem;

  margin-top: var(--body-leading);
  padding-top: 0.5lh;

  border-top: 1px solid var(--line-soft);

  letter-spacing: normal;

  color: var(--muted);
`;

/** Use the article paper's content measure when the footer is outside its column. */
export const BlogFooterContainer = component$(() => (
  <div css={blogFooterContainerStyles}>
    <div class="footer-content">
      <Slot />
    </div>
  </div>
));

const blogFooterContainerStyles = css`
  font-size: var(--body-size);
  padding-inline: max(var(--paper-inset), env(safe-area-inset-left))
    max(var(--paper-inset), env(safe-area-inset-right));

  & .footer-content {
    max-width: var(--content-measure);
    margin-inline: auto;
  }

  @media (max-width: 600px) {
    --paper-inset: 1.5em;
  }
`;
