import { css } from "@qstyle/qwik";
import { component$ } from "@qwik.dev/core";

/** Calendar label inside the list surface, whose breakpoint controls sticky placement. */
export const MonthMarker = component$<{ month: string }>((props) => (
  <h2 css={monthMarkerStyles} class="month-marker">
    <span class="month-year">{props.month.slice(0, 4)}</span>
    <span class="month-number">
      {props.month.slice(5)}
      <small>月</small>
    </span>
  </h2>
));

const monthMarkerStyles = css`
  &.month-marker {
    position: sticky;
    z-index: 2;
    color: var(--date-ink);
    font-weight: 400;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  & .month-year {
    display: block;
    font-family: var(--sans);
    font-size: var(--small-size);
  }
  & .month-year::after {
    content: "";
    height: 20px;
    width: 1px;
    background: var(--line-soft);
    margin: 10px auto;
  }
  & .month-number {
    display: block;
  }
  & .month-number small {
    font: 10px var(--sans);
    margin-left: 2px;
  }
  @media (max-width: 600px) {
    &.month-marker {
      float: none;
      display: flex;
      align-items: baseline;
      gap: 12px;
      width: auto;
      margin: 0 0 20px;
      padding: 10px 16px;
      text-align: left;
      background: var(--desk);
      border-bottom: 1px solid var(--edge);
      top: var(--scroll-header-height, 0px);
    }
    & .month-year::after {
      display: none;
    }
    & .month-number {
      font-size: 16px;
    }
    & .month-number::before {
      content: "/";
      margin-right: 12px;
      color: var(--muted);
    }
  }
  @media (min-width: 601px) {
    &.month-marker {
      top: var(--scroll-header-height, 0px);
      float: left;
      width: 52px;
      margin: 0 0 0 -102px;
      text-align: center;
    }
    & .month-year::after {
      display: block;
    }
    & .month-number {
      font-size: 24px;
    }
  }
`;
