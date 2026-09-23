import { Slot, component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

const articleShellStyles = css`
  display: contents;
  --page-background: #f2ead5;
  --paper: #f2ead5;
  --paper-deep: #e9dfc7;

  --ink: #352f25;
  --muted: #766e61;
  --faint: #918778;

  --red: #87594f;
  --rule: rgb(112 65 58 / 32%);

  /*
       * 構造線の濃さ三段階。方眼（～16%）より明確に濃くし、
       * 表・引用・区切りなどが背景と混ざらないようにする。
       * 色相は方眼・アクセントと同系で雰囲気を維持。
       */
  --line-soft: rgb(112 65 58 / 30%);
  --line: rgb(112 65 58 / 40%);
  --line-strong: rgb(112 65 58 / 55%);
  --highlight: rgb(166 124 83 / 15%);

  /*
       * リンクは本文の墨色より明確に赤みを持たせる。
       * 通常リンクとURL直書きリンクで共通。
       */
  --link: #8c4037;
  --link-hover: #682c27;
  --link-underline: rgb(140 64 55 / 72%);
  --link-hover-bg: rgb(140 64 55 / 7%);

  --body-size: 15px;
  --body-leading: 22.5px;
  --paper-inset: clamp(22px, 7vw, 68px);
  --sticky-edit-inset: calc(clamp(22px, 4vw, 32px) - 8px);
  --section-gap: clamp(22px, 4vw, 40px);

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

  --syn-text: #3d342d;
  --syn-comment: #918477;
  --syn-red: #a0443f;
  --syn-purple: #704985;
  --syn-blue: #496b8a;
  --syn-green: #506f45;
  --syn-orange: #a06432;
  --syn-gold: #957029;
  --syn-pink: #984e68;
  --syn-teal: #47716d;
  --syn-punctuation: #74685b;

  & * {
    box-sizing: border-box;
  }
  & .paper {
    --paper-inner-width: calc(min(100vw, 760px) - var(--paper-inset) - var(--paper-inset));

    position: relative;
    isolation: isolate;

    width: min(100%, 760px);
    min-height: 100dvh;
    margin-inline: auto;

    padding: var(--paper-inset);

    overflow: hidden;

    background: var(--paper);

    box-shadow:
      0 1px 2px rgb(40 30 20 / 8%),
      0 16px 48px rgb(40 30 20 / 10%);
  }

  /* ─────────────────────────────
       方眼
       ───────────────────────────── */

  & .grid-layer {
    position: absolute;
    inset: 0;
    z-index: 0;

    width: 100%;
    height: 100%;

    pointer-events: none;
  }

  & .paper-texture {
    position: absolute;
    inset: 0;
    z-index: 1;

    pointer-events: none;

    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='%236f5843'%3E%3Ccircle cx='13' cy='22' r='.45' opacity='.12'/%3E%3Ccircle cx='67' cy='11' r='.35' opacity='.1'/%3E%3Ccircle cx='123' cy='37' r='.5' opacity='.08'/%3E%3Ccircle cx='179' cy='18' r='.35' opacity='.12'/%3E%3Ccircle cx='199' cy='74' r='.55' opacity='.08'/%3E%3Ccircle cx='31' cy='91' r='.4' opacity='.1'/%3E%3Ccircle cx='83' cy='126' r='.35' opacity='.12'/%3E%3Ccircle cx='142' cy='108' r='.45' opacity='.1'/%3E%3Ccircle cx='207' cy='151' r='.4' opacity='.09'/%3E%3Ccircle cx='56' cy='183' r='.45' opacity='.09'/%3E%3Ccircle cx='118' cy='201' r='.35' opacity='.11'/%3E%3Ccircle cx='172' cy='188' r='.5' opacity='.08'/%3E%3C/g%3E%3Cg stroke='%23816c52' stroke-width='.45' stroke-linecap='round' opacity='.09'%3E%3Cpath d='M18 52l7 -1'/%3E%3Cpath d='M91 69l11 1'/%3E%3Cpath d='M156 53l5 -2'/%3E%3Cpath d='M38 146l9 -1'/%3E%3Cpath d='M132 160l8 2'/%3E%3Cpath d='M188 123l6 -1'/%3E%3Cpath d='M72 211l10 -1'/%3E%3C/g%3E%3Cg fill='%23382f26' opacity='.14'%3E%3Ccircle cx='24' cy='71' r='.55'/%3E%3Ccircle cx='102' cy='19' r='.4'/%3E%3Ccircle cx='163' cy='92' r='.65'/%3E%3Ccircle cx='211' cy='202' r='.45'/%3E%3Ccircle cx='46' cy='166' r='.35'/%3E%3C/g%3E%3Cg stroke='%23382f26' stroke-width='.5' stroke-linecap='round' opacity='.11'%3E%3Cpath d='M7 119l4 -.4'/%3E%3Cpath d='M74 48l7 1'/%3E%3Cpath d='M119 181l5 -1'/%3E%3Cpath d='M184 43l3 .6'/%3E%3C/g%3E%3Cg fill='%23a27f5d' opacity='.035'%3E%3Cpath d='M22 32c8-5 17-3 20 2s-8 8-16 6-10-5-4-8z'/%3E%3Cpath d='M150 137c7-4 19-2 21 3s-9 7-17 6-10-6-4-9z'/%3E%3C/g%3E%3C/svg%3E");

    background-size: 220px 220px;
    opacity: 0.85;
  }

  & .content {
    position: relative;
    z-index: 2;

    max-width: 36em;
    margin-inline: auto;
  }

  /* ─────────────────────────────
       ピクセル欠け
       ───────────────────────────── */

  & .ink {
    --ink-color: var(--ink);

    color: transparent;
    -webkit-text-fill-color: transparent;

    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='97' height='89' viewBox='0 0 97 89' shape-rendering='geometricPrecision'%3E%3Cg fill='%23fffaf0'%3E%3Cellipse cx='8.4' cy='13.2' rx='.55' ry='1.15' opacity='.58'/%3E%3Ccircle cx='26.7' cy='5.8' r='.7' opacity='.46'/%3E%3Cpath d='M42 19c1.8-.8 3.5-.2 3.7.8s-1.4 1.6-2.8 1.2-1.8-1.2-.9-2z' opacity='.55'/%3E%3Cellipse cx='71.4' cy='11.6' rx='1.3' ry='.48' opacity='.48'/%3E%3Ccircle cx='88.2' cy='34.7' r='.62' opacity='.66'/%3E%3Cpath d='M14 49c1.4-.5 2.8.1 2.7.9s-1.5 1.2-2.5.7-1.1-1.2-.2-1.6z' opacity='.44'/%3E%3Cellipse cx='54.1' cy='61.8' rx='.55' ry='1.55' opacity='.52'/%3E%3Ccircle cx='83.8' cy='77.3' r='.8' opacity='.5'/%3E%3C/g%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='113' height='101' viewBox='0 0 113 101' shape-rendering='geometricPrecision'%3E%3Cg fill='%23faf5e8'%3E%3Ccircle cx='17.6' cy='8.5' r='.5' opacity='.61'/%3E%3Cellipse cx='38.4' cy='27.1' rx='1.5' ry='.52' opacity='.48'/%3E%3Cpath d='M67 14c1.5-.7 3.2-.2 3.4.7s-1.2 1.5-2.7 1.2-1.8-1.1-.7-1.9z' opacity='.53'/%3E%3Ccircle cx='101.2' cy='38.7' r='.68' opacity='.59'/%3E%3Cellipse cx='9.7' cy='69.3' rx='.48' ry='1.35' opacity='.5'/%3E%3Cpath d='M49 78c1.9-.6 3.4.2 3.4 1.1s-1.7 1.3-3.1.8-1.4-1.3-.3-1.9z' opacity='.45'/%3E%3Ccircle cx='78.8' cy='58.2' r='.78' opacity='.56'/%3E%3Cellipse cx='99.1' cy='91.4' rx='1.2' ry='.46' opacity='.49'/%3E%3C/g%3E%3C/svg%3E"),
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
    --ink-color: var(--faint);
  }

  & .ink-quote {
    --ink-color: #51493d;
  }

  /* ─────────────────────────────
       Header
       ───────────────────────────── */

  & [data-virtual-keyboard-region="top"]:has(.article-sticky-header) {
    height: 0;
  }

  & .article-sticky-header {
    position: absolute;
    top: 0;
    left: 50%;
    display: flex;
    width: min(100%, 760px);
    align-items: center;
    gap: 0.55em;
    padding: calc(env(safe-area-inset-top) + 7px) clamp(22px, 4vw, 32px) 7px;
    overflow: hidden;
    color: var(--ink);
    border-bottom: 1px solid var(--line-soft);
    background: rgb(242 234 213 / 98%);
    box-shadow: 0 3px 12px rgb(40 30 20 / 8%);
    font-family: var(--sans);
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translate(-50%, -8px);
    transition:
      opacity 240ms ease-out,
      transform 240ms ease-out,
      visibility 240ms;
  }

  & [data-virtual-keyboard-viewport][data-scrolled] .article-sticky-header {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }

  & .article-sticky-site,
  & .article-sticky-separator,
  & .article-sticky-date {
    flex: none;
  }

  & .article-sticky-title {
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  & .article-sticky-date {
    color: var(--muted);
  }

  & .article-sticky-edit {
    flex: none;
    min-width: 44px;
    min-height: 32px;
    margin: -7px -8px -7px auto;
    padding: 0 8px;
    color: var(--muted);
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    cursor: pointer;
  }

  & .article-sticky-edit:hover {
    color: var(--link);
    background: var(--highlight);
  }

  & .article-sticky-edit:focus-visible {
    outline: 1px solid var(--red);
    outline-offset: -1px;
  }

  & .article-sticky-edit:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  @media (prefers-reduced-motion: reduce) {
    & .article-sticky-header {
      transition: none;
    }
  }

  & .article-topbar {
    margin-bottom: var(--section-gap);
    font-family: var(--sans);
    font-size: 11px;
    line-height: 1.5;
  }

  & .article-site-title {
    font-weight: 600;
  }

  & [data-layout-key="header"] {
    margin-bottom: var(--section-gap);
  }

  & .meta {
    --meta-overhang: max(0px, calc((var(--paper-inner-width) - 100%) / 2));

    position: relative;
    display: flex;
    width: calc(var(--paper-inner-width) + var(--paper-inset) - var(--sticky-edit-inset));
    align-items: flex-start;
    gap: 0.5em;

    margin: 0 0 1.2rem calc(0px - var(--meta-overhang));
    padding-left: var(--meta-overhang);

    font-family: var(--sans);
    font-size: 11px;
    line-height: 22px;

    letter-spacing: 0.09em;
  }

  & .article-header-edit {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    flex: none;
    min-width: 44px;
    min-height: 32px;
    margin-left: auto;
    padding: 0 8px;
    color: var(--muted);
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    cursor: pointer;
  }

  & .article-header-edit:hover {
    color: var(--link);
    background: var(--highlight);
  }

  & .article-header-edit:focus-visible {
    outline: 1px solid var(--red);
    outline-offset: -1px;
  }

  & .article-header-edit:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  & [data-virtual-keyboard-viewport][data-scrolled] .article-header-edit {
    visibility: hidden;
    pointer-events: none;
  }

  & .meta-category {
    flex: none;
    white-space: nowrap;
    padding: 0 0.58em;
    line-height: 20px;

    border: 1px solid var(--line);

    font-size: 10px;
    letter-spacing: 0.12em;
  }

  & [data-article-field][contenteditable="true"] {
    outline: 0;
    caret-color: var(--red);
    cursor: text;
  }

  & [data-article-field][contenteditable="true"]:focus {
    box-shadow: 0 1px 0 var(--red);
  }

  & .article-date-control {
    position: relative;
    display: inline-grid;
    min-width: 0;
    vertical-align: baseline;
  }

  & .article-date-control > * {
    grid-area: 1 / 1;
  }

  & .article-date-group {
    display: inline-block;
    max-width: 100%;
    vertical-align: top;
  }

  & .article-date-unit {
    white-space: nowrap;
  }

  & .article-date-input {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 0;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  & .meta-separator {
    flex: none;
    width: 12px;
    height: 1px;
    margin-top: 10.5px;

    background: var(--line);
  }

  & .publication-status {
    display: inline-grid;
    flex: none;
    white-space: nowrap;
  }

  & .publication-status-measure,
  & .publication-status-button {
    grid-area: 1 / 1;
  }

  & .publication-status-measure {
    visibility: hidden;
  }

  & .publication-status-button {
    width: 100%;
    margin: 0;
    padding: 0;
    color: var(--muted);
    border: 0;
    border-radius: 0;
    background-color: transparent;
    font: inherit;
    letter-spacing: inherit;
    line-height: inherit;
    text-align: start;
    -webkit-appearance: none;
    appearance: none;
  }

  & .publication-status-button:disabled {
    cursor: default;
    opacity: 1;
  }

  & .publication-status-button:not(:disabled) {
    cursor: pointer;
  }

  & .publication-status-button:not(:disabled):hover,
  & .publication-status-button:not(:disabled):focus-visible {
    color: var(--link);
  }

  & h1 {
    margin: 0;

    font-family: var(--serif);

    font-size: clamp(29px, 7vw, 38px);

    font-weight: 400;
    line-height: 1.2;

    letter-spacing: 0.055em;

    font-feature-settings: "pkna" 1;
  }

  & .subtitle {
    margin: 0.9rem 0 0;

    font-size: 14px;
    line-height: 1.4;

    letter-spacing: 0.025em;
  }

  /* ─────────────────────────────
       本文
       ───────────────────────────── */

  & article {
    /* 和文の文字サイズと行送りの差を、段落間の余白の初期値にする。
       em は text の実測高ではない。外側のトリムは text-box-trim に任せる。 */
    --paragraph-gap: calc(1lh - 1em);

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

  & .article-content {
    position: relative;
    counter-reset: section;
  }

  & .article-content > .ProseMirror {
    outline: none;
  }

  & .article-content > .ProseMirror[contenteditable="true"] {
    caret-color: var(--red);
  }

  & .article-content > .ProseMirror[contenteditable="true"] > *:hover {
    outline: 1px dashed rgb(135 89 79 / 20%);
    outline-offset: 4px;
  }

  &
    .article-content
    [data-editor-mode="edit"]
    .ProseMirror-selectednode:not(.tiptap-mathematics-render):not(details) {
    outline: 2px solid rgb(135 89 79 / 45%);
    outline-offset: 3px;
  }

  @supports (text-spacing-trim: trim-start) {
    & article,
    & blockquote {
      text-spacing-trim: trim-start;
    }
  }

  & article > p,
  & .article-content > .tiptap > p {
    margin: 0;

    text-indent: 1em;
  }

  @supports (text-box-trim: trim-both) {
    & article > p,
    & .article-content > .tiptap > p {
      text-box-trim: trim-both;
      overflow: visible;
    }

    & article > p + p,
    & .article-content > .tiptap > p + p {
      margin-block-start: var(--paragraph-gap);
    }
  }

  & strong {
    font-family: var(--sans);

    font-weight: 600;

    letter-spacing: 0.01em;
  }

  & em {
    font-style: italic;
  }

  & mark {
    color: inherit;

    background: linear-gradient(
      transparent 52%,
      var(--highlight) 52%,
      var(--highlight) 90%,
      transparent 90%
    );
  }

  /* ─────────────────────────────
       Links

       通常リンク・URL直書きとも同じ赤褐色。
       .ink の transparent fill を上書きする。
       ───────────────────────────── */

  & a,
  & a:link,
  & a:visited {
    color: var(--link);

    /*
       * .ink の -webkit-text-fill-color: transparent
       * を継承させない。
       */
    -webkit-text-fill-color: var(--link);

    text-decoration-line: underline;

    text-decoration-style: solid;

    text-decoration-thickness: 0.075em;

    text-underline-offset: 0.2em;

    text-decoration-color: var(--link-underline);

    text-decoration-skip-ink: auto;

    /*
       * リンク部分には文字用background-clipを
       * 引き継がせない。
       */
    background-image: none;
    background-color: transparent;

    transition:
      color 120ms ease,
      text-decoration-color 120ms ease,
      background-color 120ms ease;
  }

  /*
     * 通常のリンクにも、
     * URL直書きと同じ視認性を持たせる。
     */
  & article a:not(.url-link) {
    padding-inline: 0.04em;
  }

  @media (hover: hover) and (pointer: fine) {
    & a:hover {
      color: var(--link-hover);

      -webkit-text-fill-color: var(--link-hover);

      text-decoration-color: var(--link-hover);

      background-color: var(--link-hover-bg);
    }
  }

  & a:focus-visible {
    color: var(--link-hover);

    -webkit-text-fill-color: var(--link-hover);

    outline: 1px dashed rgb(140 64 55 / 55%);

    outline-offset: 3px;

    background-color: var(--link-hover-bg);
  }

  /*
     * URLそのものを表示する場合。
     */
  & .url-link {
    font-family: var(--latin-serif);

    font-size: 0.94em;

    overflow-wrap: anywhere;
    word-break: break-word;

    text-autospace: no-autospace;

    /*
       * URLは少しだけ濃い下線にして
       * 長文中でも追いやすくする。
       */
    text-decoration-thickness: 0.085em;

    text-decoration-color: rgb(140 64 55 / 82%);

    font-feature-settings: "kern" 1;
  }

  & .link-list {
    margin: var(--body-leading) 0 calc(var(--body-leading) * 2);

    padding: 0;

    list-style: none;

    font-size: 13px;
    line-height: 1.45;
  }

  & .link-list li {
    position: relative;

    margin: 0.8em 0;

    padding-left: 1.25em;
  }

  & .link-list li::before {
    content: "※";

    position: absolute;
    left: 0;

    color: var(--red);
  }

  /* ─────────────────────────────
       MathJax
       ───────────────────────────── */

  & .math-tex,
  & .tiptap-mathematics-render[data-type="inline-math"] {
    color: var(--ink) !important;

    -webkit-text-fill-color: var(--ink) !important;

    background: none !important;
    background-image: none !important;

    text-autospace: no-autospace;
  }

  & mjx-container,
  & mjx-container * {
    color: #45392f !important;

    -webkit-text-fill-color: #45392f !important;

    background: none !important;
    background-image: none !important;

    text-shadow: none !important;
  }

  & mjx-assistive-mml {
    position: absolute !important;

    width: 1px !important;
    height: 1px !important;

    padding: 0 !important;
    margin: -1px !important;

    overflow: hidden !important;

    clip: rect(0 0 0 0) !important;
    clip-path: inset(50%) !important;

    white-space: nowrap !important;

    border: 0 !important;
  }

  & mjx-container:not([display="true"]) {
    margin-inline: 0.045em !important;

    font-size: 101% !important;
  }

  & .math-block,
  & .tiptap-mathematics-render[data-type="block-math"] {
    margin: calc(var(--body-leading) * 2) 0;

    padding: 12px 14px;

    overflow-x: auto;
    overflow-y: hidden;

    background: rgb(105 75 58 / 4%);

    border-top: 1px solid var(--line);

    border-bottom: 1px solid var(--line);

    text-align: center;

    text-autospace: no-autospace;
  }

  & .math-block mjx-container[display="true"],
  & .tiptap-mathematics-render[data-type="block-math"] mjx-container[display="true"] {
    margin: 0.5em 0 !important;

    font-size: 112% !important;
  }

  & .math-caption {
    margin-top: 0.65em;

    color: var(--muted);

    font-family: var(--sans);

    font-size: 9px;
    line-height: 1.4;

    letter-spacing: 0.05em;
  }

  /* ─────────────────────────────
       見出し
       ───────────────────────────── */

  & .section-heading,
  & .article-content > h2,
  & .article-content > .tiptap > h2 {
    margin: calc(var(--body-leading) * 2) 0 var(--body-leading);

    text-align: start;
  }

  & .section-number,
  & .article-content > h2::before,
  & .article-content > .tiptap > h2::before {
    display: block;

    margin-bottom: 0.65em;

    font-family: var(--sans);
    font-size: 10px;

    letter-spacing: 0.12em;
  }

  & .article-content > h2,
  & .article-content > .tiptap > h2 {
    counter-increment: section;
  }

  & .article-content > h2::before,
  & .article-content > .tiptap > h2::before {
    content: "第" counter(section, cjk-ideographic) "節";

    color: var(--faint);
    -webkit-text-fill-color: var(--faint);

    pointer-events: none;
    user-select: none;
  }

  & h2 {
    margin: 0;

    font-size: 18px;
    font-weight: 400;
    line-height: 1.3;

    letter-spacing: 0.07em;
  }

  & .article-content > h3,
  & .article-content > .tiptap > h3 {
    margin: var(--body-leading) 0;

    font-family: var(--sans);
    font-size: var(--body-size);
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0.02em;

    text-align: start;
  }

  & .article-content > :is(ul, ol),
  & .article-content > .tiptap > :is(ul, ol) {
    margin: var(--body-leading) 0;
  }

  & .article-content li > p {
    margin: 0;
  }

  & .article-content li + li {
    margin-top: var(--body-leading);
  }

  /* ─────────────────────────────
       引用
       ───────────────────────────── */

  & blockquote {
    margin: calc(var(--body-leading) * 2) 0;

    padding-left: 1.35em;

    border-left: 1px solid var(--line);

    line-height: 1.3;

    font-feature-settings:
      "palt" 1,
      "kern" 1;

    line-break: strict;

    text-align: justify;
    text-align-last: start;
  }

  /* ─────────────────────────────
       Inline code
       ───────────────────────────── */

  & :not(pre) > code {
    padding: 0.1em 0.32em;

    color: #57443a;

    -webkit-text-fill-color: #57443a;

    background: rgb(121 79 65 / 8%);

    border: 1px solid rgb(121 79 65 / 26%);

    border-radius: 0;

    font-family: var(--mono);
    font-size: 0.86em;

    text-autospace: no-autospace;

    font-feature-settings: normal;
  }

  /* ─────────────────────────────
       Highlight.js
       ───────────────────────────── */

  & .code-block {
    position: relative;

    margin: calc(var(--body-leading) * 2) 0;

    overflow: hidden;

    background: rgb(87 63 51 / 7%);

    border-top: 1px solid var(--line-soft);
    border-right: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    border-left: 3px double var(--line-strong);
  }

  & pre.code-block {
    padding-top: 34px;
  }

  & .code-language-control {
    position: absolute;
    z-index: 1;
    top: 7px;
    right: 9px;

    inline-size: 108px;
    block-size: 24px;

    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;

    color: var(--muted);
    -webkit-text-fill-color: var(--muted);

    font: 11px/1.4 var(--mono);
    letter-spacing: normal;
    text-transform: lowercase;
  }

  & .code-language-label,
  & .code-language-select {
    position: absolute;
    inset: -1px;
    inline-size: calc(100% + 2px);
    block-size: calc(100% + 2px);
    padding: 1px 6px;
  }

  & .code-language-label {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    pointer-events: none;
  }

  & .code-language-select {
    color: transparent;
    border: 0;
    border-radius: 0;
    background: transparent;
    font: inherit;
    letter-spacing: inherit;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
  }

  & [data-editor-mode="edit"] .code-language-control {
    border-color: var(--line-soft);
    background: rgb(255 253 247 / 58%);
  }

  & [data-editor-mode="edit"] .code-language-select {
    visibility: visible;
    opacity: 0;
    pointer-events: auto;
    cursor: pointer;
  }

  & [data-editor-mode="edit"] .code-language-control:focus-within {
    outline: 2px solid var(--red);
    outline-offset: 2px;
  }

  & .code-caption {
    display: flex;

    justify-content: space-between;

    gap: 1rem;

    padding: 7px 11px;

    color: var(--muted);

    border-bottom: 1px dashed var(--line-soft);

    font-family: var(--sans);
    font-size: 9px;

    letter-spacing: 0.08em;
  }

  & pre {
    margin: 0;

    padding: 15px 16px;

    overflow-x: auto;

    font-family: var(--mono);

    font-size: 12px;
    line-height: 1.62;

    tab-size: 2;

    text-align: left;

    text-autospace: no-autospace;

    scrollbar-width: thin;
  }

  & pre code,
  & pre code.hljs {
    display: block;

    padding: 0;

    color: var(--syn-text);

    -webkit-text-fill-color: var(--syn-text);

    background: transparent;

    font: inherit;
  }

  & .hljs-comment,
  & .hljs-quote {
    color: var(--syn-comment) !important;

    -webkit-text-fill-color: var(--syn-comment) !important;

    font-style: italic;
  }

  & .hljs-keyword,
  & .hljs-selector-tag,
  & .hljs-doctag {
    color: var(--syn-red) !important;

    -webkit-text-fill-color: var(--syn-red) !important;

    font-weight: 600;
  }

  & .hljs-built_in,
  & .hljs-type {
    color: var(--syn-purple) !important;

    -webkit-text-fill-color: var(--syn-purple) !important;
  }

  & .hljs-title,
  & .hljs-title.function_,
  & .hljs-section {
    color: var(--syn-blue) !important;

    -webkit-text-fill-color: var(--syn-blue) !important;
  }

  & .hljs-string,
  & .hljs-regexp {
    color: var(--syn-green) !important;

    -webkit-text-fill-color: var(--syn-green) !important;
  }

  & .hljs-number {
    color: var(--syn-orange) !important;

    -webkit-text-fill-color: var(--syn-orange) !important;
  }

  & .hljs-attribute,
  & .hljs-attr {
    color: var(--syn-gold) !important;

    -webkit-text-fill-color: var(--syn-gold) !important;
  }

  & .hljs-tag,
  & .hljs-name {
    color: var(--syn-red) !important;

    -webkit-text-fill-color: var(--syn-red) !important;
  }

  & .hljs-variable,
  & .hljs-template-variable,
  & .hljs-params {
    color: var(--syn-purple) !important;

    -webkit-text-fill-color: var(--syn-purple) !important;
  }

  & .hljs-literal,
  & .hljs-symbol,
  & .hljs-bullet {
    color: var(--syn-pink) !important;

    -webkit-text-fill-color: var(--syn-pink) !important;
  }

  & .hljs-meta {
    color: var(--syn-orange) !important;

    -webkit-text-fill-color: var(--syn-orange) !important;
  }

  & .hljs-selector-class,
  & .hljs-selector-id,
  & .hljs-selector-attr {
    color: var(--syn-teal) !important;

    -webkit-text-fill-color: var(--syn-teal) !important;
  }

  & .hljs-property {
    color: #61713d !important;

    -webkit-text-fill-color: #61713d !important;
  }

  /* ─────────────────────────────
       Table
       ───────────────────────────── */

  & .table-controls {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
  }

  & .table-controls[hidden],
  .table-handle[hidden] {
    display: none;
  }

  & .table-handle {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    width: 14px;
    height: 14px;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper, #faf8f4);
    color: var(--ink);
    font: 10px/1 var(--sans);
    text-align: center;
    cursor: pointer;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  & .table-handle::after {
    content: "";
    position: absolute;
    inset: -5px;
  }

  & .table-handle[data-dragging] {
    cursor: grabbing;
    outline: 2px solid var(--red);
    outline-offset: 2px;
  }

  & .table-drag-ghost,
  .table-drop-line {
    position: fixed;
    z-index: 2;
    pointer-events: none;
  }

  & .table-drag-ghost {
    padding: 6px 10px;
    border: 1px solid var(--red);
    border-radius: 0;
    background: var(--paper, #faf8f4);
    color: var(--ink);
    opacity: 0.85;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
  }

  & .table-drop-line {
    background: var(--red);
  }

  & .table-handle:focus-visible,
  .table-controls-menu button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 2px;
  }

  & .table-controls-menu,
  .table-controls-error {
    position: absolute;
    z-index: 1;
    padding: 4px;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper, #faf8f4);
    box-shadow: 4px 4px 0 rgb(53 47 37 / 10%);
    pointer-events: auto;
  }

  & .table-controls-menu {
    display: grid;
    grid-template-columns: repeat(2, minmax(86px, 1fr));
    gap: 0;
    padding: 0;
  }

  & .table-controls-menu button {
    display: block;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-right: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    text-align: left;
    white-space: nowrap;
    font: inherit;
    cursor: pointer;
  }

  & .table-controls-menu button:nth-child(2n) {
    border-right: 0;
  }

  & .table-controls-menu button:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  & .table-controls-menu button[data-table-action="delete"] {
    color: var(--link);
  }

  & .table-controls-menu button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  & .table-controls-menu button:not(:disabled):hover {
    background: rgb(135 89 79 / 10%);
  }

  & .table-wrap {
    margin: calc(var(--body-leading) * 2) 0;

    overflow-x: auto;
  }

  & .article-content table {
    margin: calc(var(--body-leading) * 2) 0;

    border-top: 2px solid var(--line-strong);

    border-bottom: 2px solid var(--line-strong);
  }

  & .tableWrapper {
    margin: calc(var(--body-leading) * 2) 0;
    overflow-x: auto;
  }

  & .article-content .tableWrapper table {
    margin: 0;
  }

  & table {
    width: 100%;
    min-width: 430px;

    border-collapse: separate;
    border-spacing: 0;

    font-size: 12px;
    line-height: 1.45;

    font-feature-settings: "palt" 1;

    text-autospace: normal;
  }

  & th,
  & td {
    padding: 8px 10px;

    text-align: start;
    vertical-align: top;

    border-bottom: 1px solid var(--line-soft);
  }

  & th {
    font-family: inherit;
    font-weight: inherit;
  }

  & tbody tr:last-child > :is(th, td) {
    border-bottom: 0;
  }

  /* ─────────────────────────────
       Figure / Caption
       ───────────────────────────── */

  & figure {
    margin: calc(var(--body-leading) * 2) 0;
  }

  & .figure-field {
    min-height: 120px;

    display: grid;
    place-items: center;

    padding: 20px;

    background: repeating-linear-gradient(
      -45deg,
      rgb(117 74 62 / 3%) 0,
      rgb(117 74 62 / 3%) 1px,
      transparent 1px,
      transparent 7px
    );

    border: 1px solid var(--line-soft);
  }

  & .figure-mark {
    width: 68px;
    aspect-ratio: 1;

    display: grid;
    place-items: center;

    color: var(--red);

    border: 1px solid rgb(135 89 79 / 42%);

    border-radius: 0;

    font-family: var(--serif);
    font-size: 24px;

    transform: rotate(-5deg);
  }

  /*
     * 写真は紙面に馴染むよう彩度を落とし、わずかに暖色へ寄せる。
     */
  & .figure-field img {
    display: block;

    width: 100%;
    height: auto;

    filter: sepia(38%) saturate(82%) contrast(96%) brightness(102%);
  }

  & figcaption {
    margin-top: 0.55em;

    color: var(--muted);

    font-family: var(--sans);
    font-size: 10px;
    line-height: 1.45;

    letter-spacing: 0.04em;

    text-align: center;
  }

  /* ─────────────────────────────
       Aside / details
       ───────────────────────────── */

  & .aside {
    margin: calc(var(--body-leading) * 2) 0;

    padding: 11px 12px;

    border-top: 1px solid var(--line-soft);

    border-bottom: 1px solid var(--line-soft);

    font-family: var(--sans);

    font-size: 11px;
    line-height: 1.55;
  }

  & .aside-label {
    margin-right: 0.85em;

    font-size: 10px;

    letter-spacing: 0.1em;
  }

  & details {
    margin: calc(var(--body-leading) * 2) 0;

    border-top: 1px dashed var(--line);

    border-bottom: 1px dashed var(--line);
  }

  & summary {
    padding: 10px 2px;

    cursor: pointer;

    font-family: var(--sans);

    font-size: 12px;
    font-weight: 500;
  }

  & .details-body {
    padding: 0 0 12px 1.5em;

    font-size: 13px;
    line-height: 1.5;
  }

  & hr {
    margin: calc(var(--body-leading) * 3) auto;

    width: 42%;

    border-top: 1px solid var(--red);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
  }

  & .page-footer {
    display: flex;

    justify-content: space-between;

    gap: 1rem;

    margin-top: calc(var(--section-gap) / 2);
    padding-top: calc(var(--section-gap) / 2 - 1px);

    border-top: 1px solid var(--line-soft);

    font-family: var(--sans);

    font-size: 10px;
    line-height: 1.3;

    letter-spacing: 0.08em;
  }

  /* ─────────────────────────────
       Transient editor controls
       Fixed overlays keep the paper geometry identical in both modes.
       ───────────────────────────── */

  & .editor-dock,
  & .editor-error,
  & .editor-dialog {
    color: #322b22;
    -webkit-text-fill-color: currentcolor;
    font-family: var(--sans);
    text-align: start;
  }

  & .editor-dock button,
  & .editor-dialog button {
    min-height: 28px;
    padding: 2px 6px;

    color: inherit;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-family: inherit;
    font-size: 11px;
    font-stretch: inherit;
    font-style: inherit;
    font-variant: inherit;
    font-weight: inherit;
    line-height: inherit;
    cursor: pointer;
  }

  & .editor-dock button:hover {
    color: var(--link);
    background: transparent;
  }

  & .editor-formatting button[aria-pressed="true"],
  & .editor-formatting button[aria-pressed="true"]:hover {
    color: #fffaf0;
    -webkit-text-fill-color: #fffaf0;
    border-radius: 0;
    background: #352f25;
  }

  & .editor-dialog button:last-child {
    background: #352f25;
    color: #fffaf0;
  }

  & .editor-dock button:disabled,
  & .editor-dialog button:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  & .editor-error {
    position: fixed;
    z-index: 45;
    top: 58px;
    right: 14px;
    max-width: min(360px, calc(100vw - 28px));
    margin: 0;
    padding: 9px 12px;
    border: 1px solid #a35d51;
    background: #fff8ed;
    font-size: 12px;
  }

  & .editor-dock {
    position: relative;

    width: min(760px, 100vw);
    max-height: min(52vh, 420px);
    margin-inline: auto;
    overflow: visible;

    border-top: 1px solid var(--line-soft);
    border-right: 1px solid var(--line-soft);
    border-bottom: 0;
    border-left: 1px solid var(--line-soft);
    border-radius: 0;
    background: rgb(242 234 213 / 98%);
    box-shadow: none;
  }

  & .editor-dock::after {
    display: block;
    height: calc(0.75rem + env(safe-area-inset-bottom));
    background: var(--page-background);
    content: "";
  }

  & .editor-formatting {
    display: flex;
    gap: 0;
    height: 32px;
    padding: 2px 4px;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom: 1px solid rgb(86 70 55 / 14%);
  }

  & .editor-formatting button {
    flex: 0 0 auto;
  }

  & .editor-dialog label {
    display: grid;
    gap: 5px;
    color: #74685b;
    font-size: 10px;
    letter-spacing: 0.05em;
  }

  & .editor-dialog input,
  & .math-dialog textarea {
    width: 100%;
    min-height: 36px;
    padding: 7px 9px;
    color: #352f25;
    border: 1px solid var(--line);
    border-radius: 0;
    background: #fffaf0;
    font: 13px/1.35 var(--sans);
  }

  & .editor-dialog input:focus,
  & .math-dialog textarea:focus {
    outline: 2px solid rgb(135 89 79 / 42%);
    outline-offset: 2px;
  }

  & .editor-dialog-backdrop {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgb(53 47 37 / 32%);
  }

  & .editor-dialog {
    width: min(560px, 100%);
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 0;
    background: var(--paper);
    box-shadow: 8px 8px 0 rgb(53 47 37 / 14%);
  }

  & .editor-dialog-heading {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line-soft);
  }

  & .editor-dialog-heading p {
    margin: 0 0 3px;
    color: var(--faint);
    font-size: 9px;
    letter-spacing: 0.14em;
  }

  & .editor-dialog h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 400;
  }

  & .editor-dialog-fields,
  & .math-dialog > label {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  & .math-dialog > h2 {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line-soft);
  }

  & .math-dialog textarea {
    resize: vertical;
    font-family: var(--mono);
  }

  & .math-dialog-preview {
    min-height: 64px;
    margin: 0 16px;
    padding: 12px;
    overflow-x: auto;
    border: 1px solid rgb(86 70 55 / 25%);
    text-align: center;
  }

  & .math-dialog-error {
    margin-inline: 16px;
  }

  & .editor-dialog-error {
    margin: 0 16px;
    color: var(--link);
    font-size: 11px;
  }

  & .editor-dialog-actions,
  & .math-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0;
    margin-top: 16px;
    border-top: 1px solid var(--line-soft);
  }

  & .editor-dialog-actions button,
  & .math-dialog-actions button {
    min-width: 84px;
    min-height: 36px;
    border-left: 1px solid var(--line-soft);
  }

  /* ─────────────────────────────
       Smartphone
       ───────────────────────────── */

  @media (max-width: 600px) {
    & .paper {
      --paper-inset: 22px;
      width: 100%;

      padding: calc(env(safe-area-inset-top) + var(--paper-inset))
        max(var(--paper-inset), env(safe-area-inset-right))
        calc(env(safe-area-inset-bottom) + var(--paper-inset))
        max(var(--paper-inset), env(safe-area-inset-left));

      box-shadow: none;
    }

    & .editor-dock {
      width: 100vw;
    }

    & .editor-dialog {
      width: min(100%, 420px);
    }

    & .content {
      max-width: none;
    }

    & .math-block {
      margin-inline: -4px;
    }
  }
`;

export const ArticleStyleBoundary = component$(() => (
  <div css={articleShellStyles} data-qstyle-boundary>
    <Slot />
  </div>
));
