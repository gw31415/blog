import { css } from "@qstyle/qwik";
import { component$ } from "@qwik.dev/core";

/** Calendar label inside the list surface, whose breakpoint controls sticky placement. */
export const MonthMarker = component$<{ month: string }>((props) => (
  <h2 css={monthMarkerStyles} class="month-marker">
    <span class="month-year">{props.month.slice(0, 4)}</span>
    <span class="month-number">{props.month.slice(5)}</span>
  </h2>
));

const monthMarkerStyles = css`
  &.month-marker {
    position: sticky;
    z-index: 4;
    top: var(--body-leading);
    align-self: start;
    box-sizing: border-box;
    margin: 0;
    color: var(--date-ink);
    font-weight: 400;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    text-align: left;
  }
  & .month-year {
    display: block;
    font-family: var(--sans);
    font-size: var(--small-size);
  }
  & .month-year::after {
    content: "";
    display: block;
    width: 24px;
    height: 1px;
    background: var(--line-soft);
    margin: 8px 0;
  }
  & .month-number {
    display: block;
  }
  @media (max-width: 600px) {
    &.month-marker {
      width: 32px;
      padding: 6px 0 8px 4px;
    }
    & .month-number {
      font-size: 20px;
    }
  }
  @media (min-width: 601px) {
    &.month-marker {
      width: 100%;
      padding: 4px 10px 8px 12px;
    }
    & .month-number {
      font-size: 24px;
    }
  }
`;
