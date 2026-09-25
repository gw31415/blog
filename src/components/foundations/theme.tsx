import { component$, Slot } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

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
  background: var(--page-background);
  &::selection,
  & ::selection {
    color: var(--ink);
    background: rgb(135 89 79 / 28%);
  }

  --page-background: #f2ead5;
  --paper: #f2ead5;
  --paper-deep: #e9dfc7;

  --ink: #352f25;
  --muted: #655c4e;
  --faint: #655c4e;

  --red: #87594f;
  --rule: rgb(80 51 39 / 60%);

  --line-soft: rgb(80 51 39 / 44%);
  --line: rgb(80 51 39 / 60%);
  --line-strong: rgb(80 51 39 / 72%);
  --highlight: rgb(166 124 83 / 15%);

  --link: #8c4037;
  --link-hover: #682c27;
  --link-underline: rgb(140 64 55 / 72%);
  --link-hover-bg: rgb(140 64 55 / 7%);

  --body-size: 1rem;
  --heading-size: calc(var(--body-size) * 1.2);
  --small-size: calc(var(--body-size) * 0.75);
  --body-leading: calc(var(--body-size) * 1.5);
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
    line-height: 1.5;

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
`;

export const BlogTheme = component$(() => (
  <body class="blog-theme" css={blogThemeStyles}>
    <Slot />
  </body>
));
