import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { PaperMaterialDefinitions } from "../atoms/paper-material";

/** Site tokens and shared typography for Qwik, SSR and editor surfaces. */
const blogThemeStyles = css`
  line-height: normal;
  min-height: 100%;
  margin: 0;
  color: var(--ink);
  font-family: var(--serif);
  font-kerning: normal;
  font-synthesis: none;
  text-autospace: normal;
  /* Decorate the existing body without adding a viewport-sized scroll ancestor. */
  --surface-ground: #e5e0d4;
  --surface-sheet: #f0eadc;
  --surface-ink: #39372f;
  --surface-rule: color-mix(in srgb, var(--surface-ink) 28%, transparent);
  --surface-grain-opacity: 0.46;
  --surface-tint-opacity: calc(100% - var(--surface-grain-opacity) * 100%);
  --surface-ground-tint: color-mix(
    in srgb,
    var(--surface-ground) var(--surface-tint-opacity),
    transparent
  );
  --surface-dot-tint: color-mix(
    in srgb,
    color-mix(in srgb, var(--surface-ink) 28%, var(--surface-ground)) var(--surface-tint-opacity),
    transparent
  );
  --site-header-height: calc(52px + env(safe-area-inset-top));
  position: relative;
  isolation: isolate;
  background-color: var(--surface-ground);
  /* Both layers must propagate to the document canvas, including overscroll.
     Tint the grayscale stock to preserve the previous translucent grain. */
  background-image:
    radial-gradient(circle, var(--surface-dot-tint) 0.6px, var(--surface-ground-tint) 0.85px),
    var(--paper-stock);
  background-size:
    14px 14px,
    var(--paper-stock-size);
  &::after {
    content: "";
    position: absolute;
    pointer-events: none;
    inset: 0;
    z-index: -1;
    width: min(calc(100% - 20px), calc(48rem + 44px));
    border-inline: 1px solid var(--surface-rule);
    margin-inline: auto;
  }
  &.blog-theme[data-dark="true"] {
    --surface-ground: #22231f;
    --surface-sheet: #30312a;
    --surface-ink: #e0ddcf;
    --surface-grain-opacity: 0.055;
    --muted: #b5b2a5;
    --red: #cbb1a6;
    --strong: #dda59d;
    --inline-code-ink: var(--ink);
    --link: #d8bab0;
    --link-hover: #f0d0c4;
    --link-underline: rgb(216 186 176 / 65%);
    --link-hover-bg: rgb(216 186 176 / 8%);
    --line-strong: rgb(224 221 207 / 45%);
    --rule: var(--surface-rule);
    --faint: var(--muted);
  }
  &.blog-theme[data-dark="true"] .paper {
    background-color: var(--surface-sheet);
    box-shadow: 0 8px 32px rgb(0 0 0 / 18%);
  }
  &.blog-theme[data-dark="true"] .paper > .article-stock {
    mix-blend-mode: screen;
    filter: grayscale(1);
    opacity: 0.035;
  }
  &.blog-theme[data-dark="true"] .grid-layer {
    opacity: 0.3;
  }
  &.blog-theme[data-dark="true"] .grid-layer path {
    stroke: var(--surface-rule);
  }
  &.blog-theme[data-dark="true"] .paper-texture {
    opacity: 0.12;
  }
  &.blog-theme[data-dark="true"] .ink-quote {
    --ink-color: var(--muted);
  }
  &.blog-theme[data-dark="true"] .article-content {
    --syn-text: #e0ddcf;
    --syn-comment: #b5b2a5;
    --syn-red: #dda59d;
    --syn-purple: #c4b2d9;
    --syn-blue: #a8c3d7;
    --syn-green: #bbcca9;
    --syn-orange: #d6b591;
    --syn-gold: #d3c099;
    --syn-pink: #d4a9ba;
    --syn-teal: #a7cac5;
    --syn-punctuation: #b5b2a5;
  }
  &.blog-theme[data-dark="true"] :is(.archive, .post-stream) {
    --desk: #35362f;
    --desk-dot: rgb(0 0 0 / 19%);
    --desk-glint: rgb(238 236 215 / 5%);
    --edge: rgb(220 216 197 / 15%);
  }
  &.blog-theme[data-dark="true"] .dated-letter {
    --ink: #302d25;
    --muted: #51493e;
    --red: #75473c;
  }
  &.blog-theme[data-dark="true"] .dated-letter .paper-material {
    filter: brightness(0.86) sepia(0.12);
  }
  @media (max-width: 600px) {
    &::after {
      display: none;
    }
  }
  @media (forced-colors: active) {
    &.blog-theme {
      background: Canvas;
      --surface-ink: CanvasText;
      --surface-sheet: Canvas;
      --surface-rule: CanvasText;
    }
    &::after {
      display: none;
    }
  }

  &::selection,
  & ::selection {
    color: var(--ink);
    background: rgb(135 89 79 / 28%);
  }

  --page-background: var(--surface-sheet);
  --paper: var(--surface-sheet);
  --paper-deep: #e9dfc7;
  --paper-stock: url("/assets/materials/fiber-paper-9142573283.avif");
  --paper-stock-size: 32px 32px;
  --desk-texture:
    linear-gradient(rgb(243 234 210 / 84%), rgb(243 234 210 / 84%)), var(--paper-stock);

  --ink: var(--surface-ink);
  --muted: #656155;
  --faint: #655c4e;

  --red: #87594f;
  --strong: #701c28;
  --inline-code-ink: #57443a;
  --rule: rgb(80 51 39 / 60%);

  --line-soft: var(--surface-rule);
  --line: var(--surface-rule);
  --line-strong: rgb(80 51 39 / 72%);
  --highlight: rgb(166 124 83 / 15%);

  --link: #8c4037;
  --link-hover: #682c27;
  --link-underline: rgb(140 64 55 / 72%);
  --link-hover-bg: rgb(140 64 55 / 7%);

  --body-size: 1rem;
  --heading-size: calc(var(--body-size) * 1.2);
  --small-size: calc(var(--body-size) * 0.75);
  --body-leading: calc(var(--body-size) * 2);
  --site-chrome-inset: max(16px, env(safe-area-inset-left), env(safe-area-inset-right));
  --paper-inset: clamp(1.5em, 5vw, 3em);
  --paper-measure: 48em;
  --content-measure: 36em;
  --section-gap: 2lh;

  --latin-serif:
    "Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", "DejaVu Serif", Georgia;

  --serif:
    var(--latin-serif), "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro",
    "Noto Serif JP", "Noto Serif CJK JP", serif;

  --sans:
    var(--latin-serif), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "YuGothic",
    "Noto Sans JP", "Noto Sans CJK JP", sans-serif;

  --mono:
    "SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;

  & .site-link:hover {
    color: var(--link-hover);
    -webkit-text-fill-color: var(--link-hover);
  }
  & .ink {
    --ink-color: var(--ink);

    color: transparent;
    -webkit-text-fill-color: transparent;

    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='97' height='89' viewBox='0 0 97 89' shape-rendering='geometricPrecision'%3E%3Cg fill='%23fffaf0'%3E%3Cellipse cx='8.4' cy='13.2' rx='.55' ry='1.15' opacity='.82'/%3E%3Ccircle cx='26.7' cy='5.8' r='.7' opacity='.82'/%3E%3Cpath d='M42 19c1.8-.8 3.5-.2 3.7.8s-1.4 1.6-2.8 1.2-1.8-1.2-.9-2z' opacity='.82'/%3E%3Cellipse cx='71.4' cy='11.6' rx='1.3' ry='.48' opacity='.82'/%3E%3Ccircle cx='88.2' cy='34.7' r='.62' opacity='.82'/%3E%3Cpath d='M14 49c1.4-.5 2.8.1 2.7.9s-1.5 1.2-2.5.7-1.1-1.2-.2-1.6z' opacity='.82'/%3E%3Cellipse cx='54.1' cy='61.8' rx='.55' ry='1.55' opacity='.82'/%3E%3Ccircle cx='83.8' cy='77.3' r='.8' opacity='.82'/%3E%3C/g%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='113' height='101' viewBox='0 0 113 101' shape-rendering='geometricPrecision'%3E%3Cg fill='%23faf5e8'%3E%3Ccircle cx='17.6' cy='8.5' r='.5' opacity='.82'/%3E%3Cellipse cx='38.4' cy='27.1' rx='1.5' ry='.52' opacity='.82'/%3E%3Cpath d='M67 14c1.5-.7 3.2-.2 3.4.7s-1.2 1.5-2.7 1.2-1.8-1.1-.7-1.9z' opacity='.82'/%3E%3Ccircle cx='101.2' cy='38.7' r='.68' opacity='.82'/%3E%3Cellipse cx='9.7' cy='69.3' rx='.48' ry='1.35' opacity='.82'/%3E%3Cpath d='M49 78c1.9-.6 3.4.2 3.4 1.1s-1.7 1.3-3.1.8-1.4-1.3-.3-1.9z' opacity='.82'/%3E%3Ccircle cx='78.8' cy='58.2' r='.78' opacity='.82'/%3E%3Cellipse cx='99.1' cy='91.4' rx='1.2' ry='.46' opacity='.82'/%3E%3C/g%3E%3C/svg%3E"),
      linear-gradient(var(--ink-color), var(--ink-color));

    background-size:
      97px 89px,
      113px 101px,
      100% 100%;

    background-position:
      0 0,
      41px 29px,
      0 0;

    background-repeat: repeat, repeat, no-repeat;

    background-clip: text;
    -webkit-background-clip: text;
  }
  & .ink-muted {
    --ink-color: var(--muted);
  }
  & .ink-faint {
    --ink-color: var(--muted);
  }
  & .ink-quote {
    --ink-color: #51493d;
  }
  /* Keep ink wear on the decorative letters; uninterrupted strokes on the
     reading sheet preserve thin Mincho glyphs and small metadata. */
  & .paper .ink {
    background-image: linear-gradient(var(--ink-color), var(--ink-color));
    background-size: 100% 100%;
    background-position: 0 0;
    background-repeat: no-repeat;
  }
  & .type-title {
    font-family: var(--serif);

    font-size: 1.7em;

    font-weight: 400;
    line-height: 1.5;
    letter-spacing: normal;

    font-feature-settings: "pkna" 1;
  }
  & .type-subtitle {
    font-family: var(--serif);
    font-size: 1em;
    line-height: 1.5;
    letter-spacing: normal;
  }
  & .type-body,
  & .article-content {
    font-family: var(--serif);

    font-size: var(--body-size);
    line-height: 2;

    letter-spacing: normal;

    font-feature-settings:
      "palt" 1,
      "kern" 1;

    text-autospace: normal;

    word-break: normal;
    overflow-wrap: break-word;

    line-break: strict;

    text-align: justify;
    text-align-last: start;
    text-justify: auto;

    text-spacing-trim: normal;

    hanging-punctuation: last allow-end;
  }
  & .type-meta {
    font-family: var(--sans);
    font-size: var(--small-size);
    line-height: 1.5;
    letter-spacing: normal;
  }
  & .type-heading,
  & .article-content h2 {
    font-family: var(--serif);
    font-size: var(--heading-size);
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: normal;
  }
  & .site-link,
  & .article-style a {
    color: var(--link);

    -webkit-text-fill-color: var(--link);

    text-decoration-line: underline;

    text-decoration-style: solid;

    text-decoration-thickness: 0.075em;

    text-underline-offset: 0.2em;

    text-decoration-color: var(--link-underline);

    text-decoration-skip-ink: auto;

    background-image: none;
    background-color: transparent;

    transition:
      color 120ms ease,
      text-decoration-color 120ms ease,
      background-color 120ms ease;
  }
  @media (forced-colors: active) {
    &.blog-theme {
      background: Canvas;
      --desk-texture: none;
    }
    & .ink,
    & .paper .ink {
      color: CanvasText;
      -webkit-text-fill-color: CanvasText;
      background-image: none;
    }
    & .site-link,
    & .article-style a {
      color: LinkText;
      -webkit-text-fill-color: LinkText;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .site-link,
    & .article-style a {
      transition: none;
    }
  }
`;

export const BlogTheme = component$(() => (
  <body class="blog-theme" css={blogThemeStyles}>
    <PaperMaterialDefinitions />
    <Slot />
  </body>
));
