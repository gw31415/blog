import { component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

const definitionStyles = css`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
`;

/** Shared paint servers: two incommensurate orientations, no enlarged bitmap. */
export const PaperMaterialDefinitions = component$(() => (
  <svg css={definitionStyles} aria-hidden="true" focusable="false">
    <defs>
      <pattern
        id="paper-stock-a"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(17)"
      >
        <image href="/assets/materials/fiber-paper-9142573283.avif" width="32" height="32" />
      </pattern>
      <pattern
        id="paper-stock-b"
        href="#paper-stock-a"
        patternTransform="translate(13 19) rotate(-31)"
      />
    </defs>
  </svg>
));

const materialStyles = css`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  isolation: isolate;
  background-color: #fff;
  filter: brightness(0.956) sepia(0.204);
  @media (forced-colors: active) {
    &.paper-material {
      display: none;
    }
  }
`;

/** Tint the SVG surface: WebKit skips CSS filters inside pattern paint servers. */
export const PaperMaterial = component$<{ class?: string; x?: number; y?: number }>((props) => (
  <svg
    class={`paper-material ${props.class ?? ""}`}
    css={materialStyles}
    aria-hidden="true"
    focusable="false"
  >
    <g transform={`translate(${props.x ?? 0} ${props.y ?? 0})`}>
      <rect
        x={-(props.x ?? 0)}
        y={-(props.y ?? 0)}
        width="100%"
        height="100%"
        fill="url(#paper-stock-a)"
      />
      <rect
        x={-(props.x ?? 0)}
        y={-(props.y ?? 0)}
        width="100%"
        height="100%"
        fill="url(#paper-stock-b)"
        opacity=".5"
      />
    </g>
  </svg>
));
