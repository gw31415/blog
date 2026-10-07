import { Slot, component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";
import { ArticleSurfaceBoundary } from "./article-surface-styles";

const articleShellStyles = css`
  display: contents;
  & .article-content h4 {
    margin-block: 1.5em 0.5em;
    font-weight: 600;
    font-size: 1.1em;
  }
  & .article-content .ProseMirror {
    white-space: pre-wrap;
  }
  & .article-content [data-soft-break] {
    white-space: normal;
  }

  --syn-text: #3d342d;
  --syn-comment: #655c4e;
  --syn-red: #a0443f;
  --syn-purple: #704985;
  --syn-blue: #496b8a;
  --syn-green: #506f45;
  --syn-orange: #795026;
  --syn-gold: #74551f;
  --syn-pink: #984e68;
  --syn-teal: #47716d;
  --syn-punctuation: #74685b;

  & * {
    box-sizing: border-box;
  }
  & .paper {
    position: relative;
    isolation: isolate;

    min-height: 100dvh;

    padding: var(--paper-inset);

    overflow: hidden;

    background-color: color-mix(in srgb, var(--paper) 50%, white);
    font-size: var(--body-size);

    box-shadow:
      inset 0 1px rgb(255 253 246 / 62%),
      inset 1px 0 rgb(255 253 246 / 30%),
      inset -1px 0 rgb(83 66 40 / 9%),
      0 1px 2px rgb(40 30 20 / 8%),
      0 16px 48px rgb(40 30 20 / 10%);
  }

  & .paper > .article-stock {
    mix-blend-mode: multiply;
    z-index: -1;
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
    /* Retain the graph-paper pattern without competing with fine text strokes. */
    opacity: 0.55;
  }

  & .paper-texture {
    position: absolute;
    inset: 0;
    z-index: 1;

    pointer-events: none;

    background-image: linear-gradient(
      102deg,
      rgb(255 254 247 / 12%),
      transparent 24% 75%,
      rgb(92 72 39 / 3%)
    );
    opacity: 1;
  }

  & .content {
    position: relative;
    z-index: 2;

    max-width: var(--content-measure);
    margin-inline: auto;
  }

  /* ─────────────────────────────
       ピクセル欠け
       ───────────────────────────── */

  /* ─────────────────────────────
       Header
       ───────────────────────────── */

  & .article-topbar {
    margin-bottom: 2lh;
    line-height: 1.5;
  }

  & [data-layout-key="header"] {
    margin-bottom: 2lh;
  }

  & .meta {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5em;
    flex-wrap: nowrap;
    min-height: 2em;
    margin-block-start: 1lh;

    letter-spacing: normal;
  }

  & .meta-controls {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.25em;
    max-inline-size: 100%;
    margin-inline-start: auto;
    text-align: end;
  }

  & [data-virtual-keyboard-viewport][data-scrolled] .article-header-edit {
    visibility: hidden;
    pointer-events: none;
  }

  /* Keep metadata geometry identical across reading, editing and focus. */
  & [data-article-field="title"],
  & [data-article-field="subtitle"],
  & [data-article-field="description"],
  & [data-article-field="tags"] {
    padding-bottom: 0.2em;
    border-bottom: 1px solid transparent;
  }

  & .meta-tags {
    display: inline-block;
    min-inline-size: 1em;
    max-inline-size: 100%;
    min-height: 1.8em;
    white-space: pre;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  & [data-article-field][contenteditable="true"] {
    outline: 0;
    border-bottom-color: var(--line-soft);
    caret-color: var(--red);
    cursor: text;
  }

  & [data-article-field][contenteditable="true"]:focus {
    border-bottom-color: var(--red);
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
    display: none;
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
    text-align: end;
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
  }

  & .subtitle {
    margin: 0;
    min-block-size: 1lh;
  }

  & .article-description {
    position: relative;
    margin: 1lh 0 0;
    min-block-size: calc(1lh + 0.2em + 1px);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  & [data-article-field="subtitle"]:is(:empty, :has(> br:only-child)) {
    min-block-size: calc(1lh + 0.2em + 1px);
  }

  & .subtitle::before,
  & .subtitle::after {
    content: "";
    display: inline-block;
    inline-size: 1em;
    block-size: 1em;
    background: linear-gradient(var(--muted), var(--muted)) center / 100% 0.06em no-repeat;
    vertical-align: text-top;
  }

  & .subtitle:is([data-empty="true"], :empty, :has(> br:only-child))::after {
    content: none;
  }

  & .subtitle::before {
    margin-inline-end: 0.5em;
  }

  & .subtitle::after {
    margin-inline-start: 0.5em;
  }

  /* Trim only the exterior text edge; preserve the 1.5 line-height between lines. */
  & [data-article-field="title"],
  & [data-article-field="subtitle"] {
    position: relative;
    min-block-size: 1lh;
    padding-bottom: 0;
    text-box-trim: trim-end;
    text-box-edge: text;
  }

  & [data-article-field="tags"] {
    position: relative;
  }

  & .meta-tags:empty {
    min-inline-size: 4em;
  }

  & [data-article-field="title"]:empty::before,
  & .subtitle[data-article-field="subtitle"]:empty::before,
  & [data-article-field="description"]:empty::before,
  & [data-article-field="tags"]:empty::before {
    content: attr(data-placeholder);
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
    inline-size: auto;
    block-size: auto;
    margin: 0;
    background: none;
    color: var(--muted);
    -webkit-text-fill-color: var(--muted);
    font: inherit;
    white-space: nowrap;
    visibility: hidden;
    pointer-events: none;
  }

  & [data-article-field][contenteditable="true"]:empty::before {
    visibility: visible;
  }

  /* ─────────────────────────────
       本文
       ───────────────────────────── */

  & .article-content {
    position: relative;
    counter-reset: section equation figure table;
  }

  & .article-content > .ProseMirror {
    outline: none;
    /* Keep contenteditable UA line-breaking rules from changing justification. */
    line-break: strict;
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
    & article > p:not(:has(img)),
    & .article-content > .tiptap > p:not(:has(img)) {
      text-box-trim: trim-both;
      text-box-edge: text;
      overflow: visible;
    }

    /* 連続する段落と小見出し直後の段落は内側の行端を切らず、
       段落内と境界の行間を同じ line-height に任せる。 */
    & article > p:not(:has(img)):has(+ p),
    & .article-content > .tiptap > p:not(:has(img)):has(+ p) {
      text-box-trim: trim-start;
    }

    & article > :is(p, h3, h4) + p:not(:has(img)),
    & .article-content > .tiptap > :is(p, h3, h4) + p:not(:has(img)) {
      text-box-trim: trim-end;
    }

    & article > :is(p, h3, h4) + p:not(:has(img)):has(+ p),
    & .article-content > .tiptap > :is(p, h3, h4) + p:not(:has(img)):has(+ p) {
      text-box-trim: none;
    }
  }

  & strong,
  & b {
    font-family: var(--sans);

    font-weight: 700;
    letter-spacing: normal;
  }

  & strong {
    color: var(--strong);
    -webkit-text-fill-color: var(--strong);
  }

  & i {
    font-style: oblique 10deg;
    /* Override the root synthesis ban only for italic fallback (e.g. Japanese). */
    font-synthesis: style;
  }
  & u {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  & sub,
  & sup {
    font-size: 0.75em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }
  & sub {
    bottom: -0.25em;
  }
  & sup {
    top: -0.5em;
  }

  & em {
    font-style: normal;
    /* Native fallback until the non-layout painter is ready. */
    text-emphasis: filled dot var(--ink-color, var(--ink));
    text-emphasis-position: over right;
  }

  & ruby,
  & ruby *,
  & rt {
    text-emphasis: none;
  }

  & .article-emphasis-layer {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    /* Chromium does not paint an SVG with a zero-sized viewport, even when
       overflowing circles have valid geometry. Absolute positioning keeps
       this nonzero viewport out of the article's line layout. */
    height: 1px;
    overflow: visible;
    pointer-events: none;
    user-select: none;
  }

  & ruby:has(> [data-ruby-base]) > rt {
    font-size: 0.5em;
    color: var(--ink-color, var(--ink));
    -webkit-text-fill-color: var(--ink-color, var(--ink));
  }

  /* Keep media branches exclusive: qstyle may emit them before base rules. */
  @media screen and (forced-colors: none) {
    & .article-content[data-annotations-ready] em {
      text-emphasis: none;
    }
    /* Future ruby DOM: retain real ruby/rt and reserve annotation width.
       Transform moves the reading without moving the base or the line box. */
    & ruby:has(> [data-ruby-base]):not([data-ruby-natural]) {
      display: inline-grid;
      grid-template-areas: "annotation";
      vertical-align: baseline;
      text-align: center;
      text-indent: 0;
      white-space: nowrap;
    }
    & ruby:not([data-ruby-natural]) > [data-ruby-base] {
      grid-area: annotation;
      justify-self: center;
      text-align: center;
    }
    & ruby:has(> [data-ruby-base]):not([data-ruby-natural]) > rt {
      grid-area: annotation;
      display: flex;
      justify-content: space-evenly;
      align-self: start;
      justify-self: stretch;
      block-size: 0;
      line-height: 1;
      text-align: center;
      font-size: 0.4375em;
      transform: translateY(var(--ruby-offset, -0.4em));
    }
    & ruby:has(> [data-ruby-base]):not([data-ruby-natural]) > rt > span {
      flex: none;
    }
  }

  @media print, (forced-colors: active) {
    & .article-emphasis-layer {
      display: none;
    }
  }

  @media (forced-colors: active) {
    & .article-content[data-annotations-ready] em {
      text-emphasis-color: CanvasText;
    }
    & .article-content ruby:has(> [data-ruby-base]) > rt {
      color: CanvasText;
      -webkit-text-fill-color: CanvasText;
    }
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

    font-size: 1em;
    line-height: __BLOG_BODY_LINE_HEIGHT__;
  }

  & .link-list li {
    position: relative;

    margin: 0;

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
    font-size: 1em !important;
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
    font-family: var(--sans);
    font-size: var(--small-size);
    letter-spacing: normal;
  }

  & .article-content > h2,
  & .article-content > .tiptap > h2 {
    counter-increment: section;
  }

  & .article-content > h2::before,
  & .article-content > .tiptap > h2::before {
    content: "第" counter(section, cjk-ideographic) "節";

    color: var(--muted);
    -webkit-text-fill-color: var(--muted);

    pointer-events: none;
    user-select: none;
  }

  & h2 {
    margin: 0;
  }

  & .article-content :is(h3, h4) {
    margin-block: var(--body-leading) 0;
    margin-inline: 0;

    font-family: var(--sans);
    font-size: var(--body-size);
    font-weight: 600;
    line-height: __BLOG_BODY_LINE_HEIGHT__;
    letter-spacing: normal;

    text-align: start;
  }

  & .article-content h4 {
    padding-inline-start: 1em;
  }

  & .article-content > :is(ul, ol),
  & .article-content > .tiptap > :is(ul, ol) {
    margin: var(--body-leading) 0;
    padding-inline-start: 1.8em;
  }

  & .article-content li {
    padding-inline-start: 0.2em;
  }

  & .article-content li > p {
    margin: 0;
  }

  & .article-content li + li {
    margin-top: 0;
  }

  & .article-content > ul[data-type="taskList"],
  & .article-content > .tiptap > ul[data-type="taskList"],
  & .article-content ul[data-type="taskList"] ul[data-type="taskList"] {
    list-style: none;
    padding-inline-start: 0.75em;
  }

  & .article-content ul[data-type="taskList"] > li {
    display: grid;
    grid-template-columns: 1em minmax(0, 1fr);
    align-items: start;
    column-gap: 0.25em;
    padding-inline-start: 0;
  }

  & .article-content ul[data-type="taskList"] > li > label {
    display: flex;
    align-items: center;
    block-size: 1lh;
  }

  & .article-content ul[data-type="taskList"] > li > div {
    min-width: 0;
  }

  & .article-content ul[data-type="taskList"] > li > div > p {
    margin: 0;
  }

  & .article-content ul[data-type="taskList"] > li > div > ul {
    margin: 0;
  }

  &
    :is(.article-content ul[data-type="taskList"] > li, .table-controls-menu)
    input[type="checkbox"] {
    appearance: none;
    display: inline-grid;
    place-items: center;
    inline-size: 1em;
    block-size: 1em;
    margin: 0;
    border: 0.1em solid currentColor;
    border-radius: 0;
    color: var(--ink);
    background: transparent;
    font: inherit;
  }

  &
    :is(.article-content ul[data-type="taskList"] > li, .table-controls-menu)
    input[type="checkbox"]:checked::after {
    content: "✓";
    font-size: 0.85em;
    line-height: 1;
  }

  &
    :is(.article-content ul[data-type="taskList"] > li, .table-controls-menu)
    input[type="checkbox"]:focus-visible {
    outline: 0.15em solid var(--red);
    outline-offset: 0.15em;
  }

  &
    :is(.article-content ul[data-type="taskList"] > li, .table-controls-menu)
    input[type="checkbox"]:disabled {
    cursor: default;
    opacity: 1;
  }

  @media (forced-colors: active) {
    & .paper.paper {
      background: Canvas;
      background-blend-mode: normal;
      box-shadow: none;
    }
    & .paper .paper-texture,
    & .paper .grid-layer {
      display: none;
    }
    & .ink {
      color: CanvasText;
      -webkit-text-fill-color: CanvasText;
      background-image: none;
    }
    &
      :is(.article-content ul[data-type="taskList"] > li, .table-controls-menu)
      input[type="checkbox"] {
      color: CanvasText;
      border-color: CanvasText;
    }
  }

  /* ─────────────────────────────
       引用
       ───────────────────────────── */

  & blockquote {
    margin: var(--body-leading) 0;
    padding: 0.5lh 1em;
    border-inline-start: 0.2em solid var(--line-strong);
    background: rgb(112 65 58 / 7%);

    line-height: __BLOG_BODY_LINE_HEIGHT__;

    font-feature-settings:
      "palt" 1,
      "kern" 1;

    line-break: strict;

    text-align: justify;
    text-align-last: start;
  }

  & blockquote blockquote {
    margin-block: 0.5lh 0;
    padding-block: 0.25lh;
    border-inline-start-width: 0.1em;
    background: transparent;
  }

  & blockquote p {
    margin: 0;
  }

  /* ─────────────────────────────
       Inline code
       ───────────────────────────── */

  & :not(pre) > code {
    padding: 0.42em 0.32em;

    color: var(--inline-code-ink);

    -webkit-text-fill-color: var(--inline-code-ink);

    background: rgb(121 79 65 / 8%);

    border: 0;

    border-radius: 0;

    box-decoration-break: clone;

    font-family: var(--mono);
    font-size: var(--small-size);
    vertical-align: calc((var(--body-size) - var(--small-size)) / 2);

    text-autospace: no-autospace;

    font-feature-settings: normal;
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
  .table-controls-menu button:focus-visible,
  .table-header-toggle input:focus-visible {
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

  & .table-header-toggle {
    display: flex;
    align-items: center;
    grid-column: 1 / -1;
    gap: 0.5em;
    padding: 0.5em 0.75em;
    border-bottom: 1px solid var(--line-soft);
    cursor: pointer;
  }

  & .table-header-toggle input {
    margin: 0;
    accent-color: var(--red);
  }

  & .table-controls-menu button:nth-of-type(2n) {
    border-right: 0;
  }

  & .table-controls-menu button:nth-last-of-type(-n + 2) {
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
    margin: var(--body-leading) 0;

    overflow-x: auto;
  }

  & .article-content table {
    margin: var(--body-leading) 0;

    border-top: 0.125em solid var(--line-strong);

    border-bottom: 0.125em solid var(--line-strong);
  }

  & .tableWrapper {
    margin: var(--body-leading) 0;
    overflow-x: auto;
  }

  & .article-content .tableWrapper table {
    margin: 0;
  }

  & table {
    position: relative;
    width: 100%;
    min-width: 0;

    border-collapse: separate;
    border-spacing: 0;

    font-size: 1em;
    line-height: __BLOG_BODY_LINE_HEIGHT__;

    font-feature-settings: "palt" 1;

    text-autospace: normal;
  }

  & .article-content table:has(> caption:not(:empty):not([hidden])) {
    counter-increment: table;
  }

  & .article-content table > caption {
    caption-side: top;
    margin-block-end: 0.5lh;
    color: var(--muted);
    font-family: var(--serif);
    font-size: var(--small-size);
    line-height: 1.5;
    text-align: start;
  }

  & .article-content table > caption:not(:empty):not([hidden])::before {
    content: "表" counter(table);
    display: inline;
    margin-inline-end: 0.5em;
    font-family: var(--sans);
    font-weight: 500;
  }

  & .article-content table > caption:empty:not([hidden]) {
    position: absolute;
    inset-block-end: 100%;
    inset-inline-start: 0;
    margin: 0;
    padding: 0;
    background: var(--paper);
  }

  & .article-content table > caption:empty:not([hidden])::before {
    content: none;
  }

  & [data-editor-mode="edit"] [data-article-role="table-title"]:empty::after {
    content: "表の題名を入力";
    color: var(--muted);
  }

  & th,
  & td {
    padding: 0.25em 0.5em;

    text-align: start;
    vertical-align: top;

    border-bottom: 0.046875em solid rgb(80 51 39 / 52%);
  }

  & :is(th, td) > p {
    margin: 0;
  }

  & th {
    font-family: var(--sans);
    font-weight: 500;
  }

  & .article-content table tbody tr:first-child:not(:last-child) > th,
  & .article-content table thead tr:last-child > th {
    border-bottom: 0.078125em solid rgb(80 51 39 / 66%);
  }

  & tbody tr:last-child > :is(th, td) {
    border-bottom: 0;
  }

  /* ─────────────────────────────
       Figure / Caption
       ───────────────────────────── */

  & figure {
    margin: var(--body-leading) 0;
  }

  & .figure-mark {
    width: 4.5em;
    aspect-ratio: 1;

    display: grid;
    place-items: center;

    color: var(--red);

    border: 1px solid var(--line);

    border-radius: 0;

    font-family: var(--serif);
    font-size: 1.5em;

    transform: rotate(-5deg);
  }

  /*
     * 写真は紙面に馴染むよう彩度を落とし、わずかに暖色へ寄せる。
     */
  & .article-content img[data-article-image] {
    object-fit: contain;
    /* Leave room for surrounding text; svh stays stable as browser chrome moves. */
    max-height: 80svh;
    max-width: min(100%, calc(80svh * (var(--article-image-ratio, 960 / 540))));
  }
  & .article-content img[data-image-state="pending"] {
    background: linear-gradient(
      100deg,
      rgb(110 95 75 / 7%) 20%,
      rgb(110 95 75 / 16%) 50%,
      rgb(110 95 75 / 7%) 80%
    );
    background-size: 200% 100%;
    animation: article-image-shimmer 1.6s ease-in-out infinite;
    color: transparent;
  }
  @keyframes article-image-shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .article-content img[data-image-state][data-image-state] {
      animation: none;
    }
  }

  & .article-content p img {
    max-width: 100%;
    height: auto;
    vertical-align: middle;
  }

  & .article-content > .tiptap > p:has(img),
  & .article-content p:has(img) {
    text-box-trim: none;
    text-indent: 0;
    text-align: start;
  }

  & .article-content p:has(img) .ProseMirror-trailingBreak {
    display: none;
  }

  & .article-content p:has(img) .ProseMirror-separator {
    display: none;
  }

  & figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 1em;
    margin-top: 0;

    color: var(--muted);

    font-family: var(--serif);
    font-size: var(--small-size);
    line-height: 1.5;
    letter-spacing: normal;
    text-align: start;
  }

  & .article-content figure {
    position: relative;
  }

  & .article-content figure > figcaption:empty:not([hidden]) {
    position: absolute;
    inset-inline-start: 0;
    inset-block-end: 0;
    margin: 0;
    padding: 0.25em 0.5em;
    background: var(--paper);
  }

  & figcaption > p {
    flex: 1 1 12em;
    margin: 0;
  }

  & .article-content figure:has(> figcaption > p:not(:empty)),
  & .article-content figure.mermaid-diagram:has(> figcaption:not(:empty)) {
    counter-increment: figure;
  }

  & .article-content figure > figcaption:has(> p:not(:empty))::before,
  & .article-content figure.mermaid-diagram > figcaption:not(:empty)::before {
    content: "図" counter(figure);
    font-family: var(--sans);
    font-weight: 500;
    white-space: nowrap;
  }

  & [data-editor-mode="edit"] [data-article-role="mermaid-caption"]:empty::after {
    content: "図の題名を入力";
    color: var(--muted);
  }

  /* ─────────────────────────────
       Aside / details
       ───────────────────────────── */

  & .aside {
    --callout-space: calc(var(--body-leading) / 4);
    --callout-rule-width: 1px;
    --callout-icon-size: var(--body-size);

    margin: var(--body-leading) 0;
    padding-block: var(--callout-space);
    padding-inline: calc(var(--callout-space) * 2);

    /* Separate edges so qstyle's output order cannot override the thick rule. */
    border-block: var(--callout-rule-width) solid var(--line-soft);
    border-inline-end: var(--callout-rule-width) solid var(--line-soft);
    border-inline-start: calc(var(--callout-rule-width) * 3) solid var(--line-strong);

    font-family: var(--serif);
    font-size: 1em;
    line-height: __BLOG_BODY_LINE_HEIGHT__;
  }

  & .aside .callout-content > :first-child,
  & .aside > p:first-of-type {
    margin-block-start: 0;
  }

  & .aside .callout-content > :last-child,
  & .aside > p:last-of-type {
    margin-block-end: 0;
  }

  & .aside-label {
    display: grid;
    grid-template-columns: var(--callout-icon-size) minmax(0, 1fr);
    column-gap: var(--callout-space);
    margin-block-end: var(--callout-space);
    font-family: var(--sans);
    font-size: var(--small-size);
    line-height: var(--body-leading);
    letter-spacing: normal;
    text-align: start;
  }

  /* ASCII letters with CSS frames: no SVG, emoji or special-symbol font dependency. */
  & .aside-label::before {
    content: "i";
    display: grid;
    place-items: center;
    align-self: start;
    inline-size: var(--callout-icon-size);
    block-size: var(--callout-icon-size);
    box-sizing: border-box;
    margin-block-start: calc((var(--body-leading) - var(--callout-icon-size)) / 2);
    border: var(--callout-rule-width) solid currentColor;
    border-radius: 50%;
    color: var(--muted);
    -webkit-text-fill-color: currentColor;
    font-family: sans-serif;
    font-weight: 600;
    line-height: 1;
  }

  & .aside[data-kind="warning"] .aside-label::before {
    content: "!";
    border-radius: 0;
  }

  & .article-content[data-editor-mode="edit"] [data-article-role="callout-label"] {
    cursor: pointer;
  }

  & details {
    margin: var(--body-leading) 0;

    border-top: 1px dashed var(--line);

    border-bottom: 1px dashed var(--line);
  }

  & summary {
    padding: 0.5lh 0;

    cursor: pointer;

    font-family: var(--sans);

    font-size: 1em;
    font-weight: 500;
  }

  & .article-content[data-editor-mode="edit"] [data-article-role="details-title"] {
    text-decoration: underline dotted var(--line);
    text-underline-offset: 3px;
    outline: none;
    caret-color: var(--red);
    cursor: text;
  }

  & .article-content[data-editor-mode="edit"] [data-article-role="details-title"]:focus {
    text-decoration: underline solid var(--red);
  }

  & .article-content[data-editor-mode="edit"] [data-article-role="details-title"]:hover {
    color: var(--link);
  }

  & .details-body {
    padding: 0 0 0.5lh 1.5em;
    font-size: 1em;
    line-height: __BLOG_BODY_LINE_HEIGHT__;
  }

  & hr {
    margin: calc(var(--body-leading) * 2) auto;

    width: 42%;

    border-top: 1px solid var(--line-strong);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
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

    width: min(var(--paper-measure), 100vw);
    max-height: min(52vh, 420px);
    margin-inline: auto;
    overflow: visible;

    border-top: 1px solid var(--line-soft);
    border-bottom: 0;
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
    justify-content: space-between;
    gap: 0;
    width: min(var(--content-measure), calc(100% - 2 * var(--paper-inset)));
    margin-inline: auto;
    height: 32px;
    padding-block: 2px;
    padding-inline: 0;
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

  & .document-command-dialog {
    width: min(440px, calc(100vw - 28px));
    max-height: min(80dvh, 640px);
    margin: auto;
    padding: 0;
    overflow: auto;
    color: var(--ink);
    -webkit-text-fill-color: currentcolor;
    border: 1px solid var(--line-strong);
    border-radius: 0;
    background: var(--paper);
    box-shadow: 8px 8px 0 rgb(53 47 37 / 14%);
    font-family: var(--sans);
    text-align: start;
  }

  & .document-command-dialog::backdrop {
    background: rgb(53 47 37 / 32%);
  }

  & .document-command-dialog:not([data-command-form]) {
    padding: 12px;
  }

  & .document-command-dialog[data-command-form] > h2 {
    margin: 0;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line-soft);
    font-size: 17px;
    font-weight: 400;
  }

  & .document-command-dialog form {
    margin: 0;
  }

  & .document-command-fields {
    display: grid;
    gap: 14px;
    padding: 16px;
  }

  & .document-command-fields label {
    display: grid;
    gap: 6px;
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.05em;
  }

  & .document-command-dialog input,
  & .document-command-fields select,
  & .document-command-fields textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 36px;
    padding: 7px 9px;
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 0;
    background-color: #fffaf0;
    font: 13px/1.35 var(--sans);
    letter-spacing: normal;
  }

  & .document-command-dialog:not([data-command-form]) > input {
    margin-bottom: 8px;
  }

  & .document-command-fields select {
    appearance: none;
    padding-right: 32px;
    background-image:
      linear-gradient(45deg, transparent 50%, var(--muted) 50%),
      linear-gradient(135deg, var(--muted) 50%, transparent 50%);
    background-position:
      calc(100% - 17px) 50%,
      calc(100% - 12px) 50%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
  }

  & .document-command-fields textarea {
    min-height: 10rem;
    resize: vertical;
  }

  & .document-command-dialog input:focus,
  & .document-command-fields select:focus,
  & .document-command-fields textarea:focus {
    outline: 2px solid rgb(135 89 79 / 42%);
    outline-offset: 2px;
  }

  & .document-command-dialog [role="alert"] {
    margin: 0 16px;
    color: var(--link);
    font-size: 11px;
  }

  & .document-command-dialog [role="alert"]:empty {
    display: none;
  }

  & .document-command-actions {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--line-soft);
  }

  & .document-command-actions button {
    min-width: 84px;
    min-height: 36px;
    padding: 2px 10px;
    color: var(--ink);
    border: 0;
    border-left: 1px solid var(--line-soft);
    border-radius: 0;
    background: transparent;
    font: 11px/1.3 var(--sans);
    cursor: pointer;
  }

  & .document-command-actions button[type="submit"] {
    color: #fffaf0;
    -webkit-text-fill-color: #fffaf0;
    background: var(--ink);
  }

  & .document-command-dialog button:disabled {
    opacity: 0.5;
  }

  & .document-command-dialog.document-insert-popover {
    position: fixed;
    margin: 0;
    width: min(280px, calc(100vw - 16px));
    z-index: 100;
    box-shadow: 2px 3px 0 rgb(53 47 37 / 14%);
  }

  & .document-table-popover .document-command-fields {
    display: flex;
    align-items: end;
    gap: 8px;
    padding: 10px;
  }

  & .document-table-popover .document-command-fields label {
    flex: 1;
    min-width: 0;
    gap: 4px;
  }

  & .document-table-popover .document-command-fields input {
    width: 100%;
    padding: 4px 6px;
  }

  & .document-table-popover .document-command-actions button {
    padding: 6px 12px;
  }

  & .editor-formatting button svg {
    display: block;
    width: 1.4em;
    height: 1.4em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  & .document-link-popover .document-command-fields {
    padding: 10px;
    gap: 8px;
  }

  & .document-link-popover .document-command-fields label {
    gap: 3px;
  }

  & .document-link-popover .document-command-fields input {
    padding: 4px 6px;
  }

  & .document-link-popover .document-command-actions button {
    padding: 6px 12px;
  }

  & .document-command-suggestions {
    position: fixed;
    z-index: 100;
    width: min(216px, calc(100vw - 16px));
    max-height: 224px;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 3px;
    border: 1px solid var(--line-strong);
    background: var(--paper);
    box-shadow: 2px 3px 0 rgb(53 47 37 / 12%);
    color: var(--ink);
    font: var(--small-size)/1.5 var(--sans);
  }

  & .document-command-suggestions input {
    box-sizing: border-box;
    width: 100%;
    padding: 4px 6px;
    border: 0;
    border-bottom: 1px solid var(--line-soft);
    background: transparent;
    color: inherit;
    font: inherit;
  }

  & .document-command-suggestions [role="option"] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 4px 7px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  & .document-command-label,
  & .document-command-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  & .document-command-name {
    max-width: 50%;
    flex-shrink: 1;
    opacity: 0.55;
    font: 0.85em/1.5 var(--mono);
  }

  & .document-command-suggestions [role="option"]:is(:hover, [aria-selected="true"]) {
    background: var(--ink);
    color: var(--paper);
    -webkit-text-fill-color: var(--paper);
  }

  & .editor-invisible-characters {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
  }

  & .editor-invisible-characters span {
    position: absolute;
    transform: translateY(-50%);
    color: var(--muted);
    -webkit-text-fill-color: var(--muted);
    opacity: 0.6;
    font: 9px/1 var(--sans);
    white-space: nowrap;
  }

  & .document-upload-status {
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--paper);
    color: var(--ink);
    padding: 8px;
    z-index: 100;
  }

  & .document-command-dialog [role="listbox"] {
    max-height: 50dvh;
    overflow: auto;
  }

  & .document-command-dialog [role="option"] {
    display: block;
    width: 100%;
    padding: 8px;
    color: var(--ink);
    border: 0;
    background: transparent;
    font: 12px/1.4 var(--sans);
    text-align: left;
    cursor: pointer;
  }

  & .document-command-dialog [role="option"][aria-selected="true"] {
    color: #fffaf0;
    -webkit-text-fill-color: #fffaf0;
    background: var(--ink);
  }

  /* ─────────────────────────────
       Smartphone
       ───────────────────────────── */

  @media (max-width: 600px) {
    & .paper {
      --paper-inset: 1.5em;

      padding: calc(env(safe-area-inset-top) + var(--paper-inset))
        max(var(--paper-inset), env(safe-area-inset-right))
        calc(env(safe-area-inset-bottom) + var(--paper-inset))
        max(var(--paper-inset), env(safe-area-inset-left));

      box-shadow: none;
    }

    & .editor-dock {
      --paper-inset: 1.5em;
      width: 100vw;
    }

    & .editor-formatting {
      width: calc(100% - 2 * var(--paper-inset));
    }

    & .editor-dialog {
      width: min(100%, 420px);
    }

    & .content {
      max-width: none;
    }

    & [data-blog-surface="math"] {
      margin-inline: 0;
    }
  }

  @media (max-width: 31.5em) {
    & .meta {
      flex-wrap: wrap;
    }
  }

  & .editor-dock--source {
    background: var(--paper);
    max-height: calc(100 * var(--virtual-keyboard-svh, 1svh) - 32px);
    display: flex;
    flex-direction: column;
  }
  & .editor-dock--source .editor-formatting {
    display: none;
  }
  & .render-source-dialog {
    position: static;
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    width: min(var(--render-article-width), 100%);
    max-width: none;
    min-height: 0;
    max-height: none;
    margin-block: 0;
    margin-inline-start: var(--render-article-inline-start, 0px);
    margin-inline-end: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--ink);
  }
  & .render-source-dialog:not([open]) {
    display: none;
  }
  & .render-source-preview {
    font-size: var(--body-size);
    line-height: var(--body-leading);
    display: flex;
    flex: 0 1 auto;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    margin-block: 0.5lh;
    margin-inline: 0;
    overflow: hidden;
    background: var(--paper);
  }
  & .render-source-preview figure,
  & .render-source-preview [data-blog-surface="math"] {
    margin: 0;
    min-height: 0;
    overflow: auto;
  }
  & .render-source-preview figure {
    display: flex;
  }
  & .render-source-preview [data-blog-surface="figure"] {
    min-height: 0;
    width: 100%;
    overflow: auto;
  }
  & [data-blog-role="source-code"] .hljs-operator {
    color: var(--syn-purple);
    -webkit-text-fill-color: var(--syn-purple);
  }
  & .render-source-preview [role="alert"]:empty {
    display: none;
  }
  & .render-source-panel {
    flex: 0 0 auto;
    width: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: var(--paper);
    border: 0;
  }
  & .render-source-panel pre[data-blog-surface="code"] {
    margin: 0;
    padding-top: 34px;
    padding-bottom: 15px;
  }
  & .render-source-surface {
    position: relative;
    height: clamp(64px, 14svh, 120px);
  }
  & .render-source-surface code,
  & .render-source-surface textarea {
    box-sizing: border-box;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    font: inherit;
    letter-spacing: normal;
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }
  & .render-source-surface code {
    pointer-events: none;
    scrollbar-width: none;
  }
  & .render-source-surface textarea {
    resize: none;
    background: transparent;
    color: transparent;
    -webkit-text-fill-color: transparent;
    caret-color: var(--syn-text);
    outline: none;
  }
  & .render-source-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0;
    margin-top: 8px;
    border-top: 1px solid var(--line-soft);
  }
  & .render-source-actions button {
    min-width: 72px;
    min-height: 30px;
    padding: 2px 10px;
    border-left: 1px solid var(--line-soft);
    border-radius: 0;
    font-size: 11px;
  }
  & .render-source-actions button[type="submit"] {
    color: #fffaf0;
    -webkit-text-fill-color: #fffaf0;
    background: #352f25;
  }
  & .render-source-actions button[type="submit"]:disabled {
    opacity: 0.48;
  }
`;

export const ArticleStyleBoundary = component$(() => (
  <div class="article-style" css={articleShellStyles} data-qstyle-boundary>
    <ArticleSurfaceBoundary>
      <Slot />
    </ArticleSurfaceBoundary>
  </div>
));
