import { component$ } from "@qwik.dev/core";

/** 方眼レイヤー (sample.html の SVG を移植)。 */
export const GridLayer = component$(() => {
  return (
    <svg class="grid-layer" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="graph-paper" width="39" height="39" patternUnits="userSpaceOnUse">
          <path
            d="M 9.75 0 V 39"
            fill="none"
            stroke="rgb(135 76 68 / 20%)"
            stroke-width=".6"
            stroke-dasharray="1.5 2.7"
          />

          <path
            d="M 19.5 0 V 39"
            fill="none"
            stroke="rgb(128 71 65 / 16%)"
            stroke-width=".62"
            stroke-dasharray="2.1 2.4"
            stroke-dashoffset=".8"
          />

          <path
            d="M 29.25 0 V 39"
            fill="none"
            stroke="rgb(139 79 69 / 18%)"
            stroke-width=".58"
            stroke-dasharray="1.3 2.9"
            stroke-dashoffset="1.1"
          />

          <path
            d="M 0 9.75 H 39"
            fill="none"
            stroke="rgb(135 76 68 / 20%)"
            stroke-width=".6"
            stroke-dasharray="2.2 2.8"
            stroke-dashoffset=".4"
          />

          <path
            d="M 0 19.5 H 39"
            fill="none"
            stroke="rgb(128 71 65 / 16%)"
            stroke-width=".62"
            stroke-dasharray="1.6 2.5"
            stroke-dashoffset="1.2"
          />

          <path
            d="M 0 29.25 H 39"
            fill="none"
            stroke="rgb(139 79 69 / 18%)"
            stroke-width=".58"
            stroke-dasharray="2.3 3.1"
            stroke-dashoffset=".6"
          />

          <path
            d="M 0 0 H 39"
            fill="none"
            stroke="rgb(119 64 58 / 32%)"
            stroke-width=".78"
            stroke-dasharray="14 .8 8 1.3 12 .9"
          />

          <path
            d="M 0 0 V 39"
            fill="none"
            stroke="rgb(119 64 58 / 32%)"
            stroke-width=".78"
            stroke-dasharray="9 .7 15 1.1 11 .8"
            stroke-dashoffset="3"
          />

          <path
            d="
              M .27 .18 H 39
              M .27 .18 V 39
            "
            fill="none"
            stroke="rgb(151 83 72 / 10%)"
            stroke-width=".7"
            stroke-dasharray="11 1 16 2 7 1"
          />

          <path d="M 9.75 23 V 27" stroke="rgb(242 234 213 / 52%)" stroke-width="1.8" />

          <path d="M 25 19.5 H 29" stroke="rgb(242 234 213 / 43%)" stroke-width="1.8" />

          <circle cx="0" cy="0" r=".68" fill="rgb(115 61 55 / 16%)" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#graph-paper)" />
    </svg>
  );
});
