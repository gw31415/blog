import { component$, Slot, type Signal } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

export const StreamStatus = component$<{ sentinel?: Signal<Element | undefined>; busy?: boolean }>(
  (props) => (
    <div class="more" css={streamStatusStyles} ref={props.sentinel} aria-busy={props.busy}>
      <Slot />
    </div>
  ),
);

const streamStatusStyles = css`
  position: relative;
  min-height: 72px;
  margin: 8px 24px 0 104px;
  padding: 22px 12px 28px;
  box-sizing: border-box;
  color: var(--muted);
  font-size: var(--small-size);
  text-align: center;
  &::before {
    content: "";
    position: absolute;
    top: 0;
    right: 18%;
    left: 18%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--edge) 20% 80%, transparent);
  }
  & p {
    margin: 0;
  }
  & p + p,
  & p + a {
    margin-top: 8px;
  }
  & a {
    font: inherit;
    color: var(--muted);
    text-underline-offset: 4px;
  }
  & a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (max-width: 600px) {
    margin: 6px 6px 0 var(--mobile-calendar-rail);
    padding-bottom: 22px;
  }
`;
