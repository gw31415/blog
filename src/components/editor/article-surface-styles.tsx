import { Slot, component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

/** Qwik scope shared by static HTML, Tiptap node views, and the source editor. */
const articleSurfaceStyles = css`
  display: contents;

  & [data-blog-surface="math"] {
    position: relative;
    margin: var(--body-leading) 0;

    padding: 0.5lh 2.5em 0.5lh 1em;

    overflow-x: auto;
    overflow-y: hidden;

    background: rgb(105 75 58 / 4%);

    border-top: 1px solid var(--line);

    border-bottom: 1px solid var(--line);

    text-align: center;

    /* The article's justified last-line rule must not override display math. */
    text-align-last: auto;

    text-autospace: no-autospace;
  }

  & [data-blog-surface="math"] mjx-container[display="true"] {
    margin: 0 !important;

    font-size: 1em !important;
  }

  & .article-content [data-blog-surface="math"] {
    counter-increment: equation;
  }

  & .article-content [data-blog-surface="math"]::after {
    content: "(" counter(equation) ")";
    position: absolute;
    inset-inline-end: 0.5em;
    inset-block-start: 50%;
    transform: translateY(-50%);
    font-family: var(--serif);
    font-size: var(--small-size);
  }

  /* ─────────────────────────────
       Highlight.js
       ───────────────────────────── */

  & [data-blog-surface="code"] {
    position: relative;

    margin: var(--body-leading) 0;

    overflow: hidden;

    background: rgb(87 63 51 / 7%);

    border-top: 1px solid var(--line-soft);
    border-right: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    border-left: 3px double var(--line-strong);
  }

  & [data-blog-surface="code"] [data-blog-role="language-control"] {
    position: absolute;
    z-index: 1;
    top: 0.5em;
    right: 0.5em;

    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    inline-size: max-content;
    min-inline-size: 7em;
    max-inline-size: calc(100% - 1em);
    block-size: 1.8em;

    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;

    color: var(--muted);
    -webkit-text-fill-color: var(--muted);

    font: var(--small-size)/1.5 var(--mono);
    letter-spacing: normal;
    text-transform: lowercase;
  }

  & [data-blog-surface="code"] [data-blog-role="language-label"] {
    overflow: hidden;
    padding: 0.1em 0.4em;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  & [data-blog-surface="code"] [data-blog-role="language-select"] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    padding: 0;
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

  & [data-editor-mode="edit"] [data-blog-surface="code"] [data-blog-role="language-control"],
  & [data-blog-role="source-code"] [data-blog-role="language-control"] {
    border-color: var(--line-soft);
    background: rgb(255 253 247 / 58%);
  }

  & [data-editor-mode="edit"] [data-blog-surface="code"] [data-blog-role="language-select"] {
    visibility: visible;
    opacity: 0;
    pointer-events: auto;
    cursor: pointer;
  }

  &
    [data-editor-mode="edit"]
    [data-blog-surface="code"]
    [data-blog-role="language-control"]:focus-within {
    outline: 2px solid var(--red);
    outline-offset: 2px;
  }

  & [data-blog-surface="code"] .code-caption {
    display: flex;

    justify-content: space-between;

    gap: 1rem;

    padding: 0.5em;

    color: var(--muted);

    border-bottom: 1px dashed var(--line-soft);

    font-family: var(--sans);
    font-size: var(--small-size);

    letter-spacing: 0.08em;
  }

  & pre[data-blog-surface="code"],
  & [data-blog-surface="code"] pre {
    padding: 1em;

    overflow-x: auto;

    font-family: var(--mono);

    font-size: var(--small-size);
    line-height: 1.5;

    tab-size: 2;

    text-align: left;

    text-autospace: no-autospace;

    scrollbar-width: thin;
  }

  & [data-blog-surface="code"] pre {
    margin: 0;
  }

  & pre[data-blog-surface="code"] {
    padding-block-start: 2.5em;
  }

  & pre[data-blog-surface="code"] code,
  & pre[data-blog-surface="code"] code.hljs,
  & [data-blog-surface="code"] pre code,
  & [data-blog-surface="code"] pre code.hljs {
    display: block;

    padding: 0;

    color: var(--syn-text);

    -webkit-text-fill-color: var(--syn-text);

    background: transparent;

    font: inherit;
    min-height: 1lh;
  }

  & [data-blog-surface="code"] .hljs-comment,
  & [data-blog-surface="code"] .hljs-quote {
    color: var(--syn-comment) !important;

    -webkit-text-fill-color: var(--syn-comment) !important;

    font-style: italic;
  }

  & [data-blog-surface="code"] .hljs-keyword,
  & [data-blog-surface="code"] .hljs-selector-tag,
  & [data-blog-surface="code"] .hljs-doctag {
    color: var(--syn-red) !important;

    -webkit-text-fill-color: var(--syn-red) !important;

    font-weight: 600;
  }

  & [data-blog-surface="code"] .hljs-built_in,
  & [data-blog-surface="code"] .hljs-type {
    color: var(--syn-purple) !important;

    -webkit-text-fill-color: var(--syn-purple) !important;
  }

  & [data-blog-surface="code"] .hljs-title,
  & [data-blog-surface="code"] .hljs-title.function_,
  & [data-blog-surface="code"] .hljs-section {
    color: var(--syn-blue) !important;

    -webkit-text-fill-color: var(--syn-blue) !important;
  }

  & [data-blog-surface="code"] .hljs-string,
  & [data-blog-surface="code"] .hljs-regexp {
    color: var(--syn-green) !important;

    -webkit-text-fill-color: var(--syn-green) !important;
  }

  & [data-blog-surface="code"] .hljs-number {
    color: var(--syn-orange) !important;

    -webkit-text-fill-color: var(--syn-orange) !important;
  }

  & [data-blog-surface="code"] .hljs-attribute,
  & [data-blog-surface="code"] .hljs-attr {
    color: var(--syn-gold) !important;

    -webkit-text-fill-color: var(--syn-gold) !important;
  }

  & [data-blog-surface="code"] .hljs-tag,
  & [data-blog-surface="code"] .hljs-name {
    color: var(--syn-red) !important;

    -webkit-text-fill-color: var(--syn-red) !important;
  }

  & [data-blog-surface="code"] .hljs-variable,
  & [data-blog-surface="code"] .hljs-template-variable,
  & [data-blog-surface="code"] .hljs-params {
    color: var(--syn-purple) !important;

    -webkit-text-fill-color: var(--syn-purple) !important;
  }

  & [data-blog-surface="code"] .hljs-literal,
  & [data-blog-surface="code"] .hljs-symbol,
  & [data-blog-surface="code"] .hljs-bullet {
    color: var(--syn-pink) !important;

    -webkit-text-fill-color: var(--syn-pink) !important;
  }

  & [data-blog-surface="code"] .hljs-meta {
    color: var(--syn-orange) !important;

    -webkit-text-fill-color: var(--syn-orange) !important;
  }

  & [data-blog-surface="code"] .hljs-selector-class,
  & [data-blog-surface="code"] .hljs-selector-id,
  & [data-blog-surface="code"] .hljs-selector-attr {
    color: var(--syn-teal) !important;

    -webkit-text-fill-color: var(--syn-teal) !important;
  }

  & [data-blog-surface="code"] .hljs-property {
    color: #61713d !important;

    -webkit-text-fill-color: #61713d !important;
  }

  & [data-blog-surface="figure"] {
    display: grid;
    place-items: center;
    padding: 0.5lh;
    background: rgb(255 253 247 / 12%);

    border: 1px solid var(--line-soft);
  }

  & [data-blog-surface="figure"] img {
    display: block;
    max-width: 100%;
    height: auto;
    filter: none;
  }

  & [data-blog-role="mermaid-field"] {
    overflow-x: auto;
    white-space: normal;
  }

  & [data-blog-role="mermaid-field"] svg {
    display: block;
    max-width: 100%;
    height: auto;
  }

  & [contenteditable="true"] [data-blog-role="mermaid-diagram"] {
    cursor: pointer;
  }

  & .article-content [data-blog-role="mermaid-field"] .mermaid-image {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    filter: none;
  }
`;

export const ArticleSurfaceBoundary = component$(() => (
  <div css={articleSurfaceStyles} data-article-surface-boundary>
    <Slot />
  </div>
));
