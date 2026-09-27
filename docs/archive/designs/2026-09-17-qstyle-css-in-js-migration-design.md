# qstyle CSS-in-JS Migration Design

> 履歴資料（2026-09-17）。当時の設計・手順を保存したもので、現在の仕様や未完了タスクの一覧ではありません。現在の実装・仕様は [開発ドキュメント](../../README.md)、変更点は [履歴資料の案内](../README.md) を参照してください。

## Goal

Move the application-owned stylesheet into qstyle-authored CSS-in-JS without changing the rendered blog or editor layout. The migration must preserve the current generated article HTML, TipTap class contract, responsive rules, pseudo-elements, and edit-mode overlays.

## Scope

In scope:

- `src/components/blog/blog.css`
- the empty `src/global.css` import and file
- the `useStyles$` injection in `BlogPaper`
- CSS-specific tests that currently inspect `blog.css` source text
- browser verification of the qstyle delivery path and visible layout

Out of scope:

- KaTeX's vendor stylesheet, which remains imported from `katex/dist/katex.min.css`
- changing class names emitted by TipTap, highlight.js, MathJax, or the initial article renderer
- changing the qstyle compiler, its cache model, or its hashing implementation
- visual redesign or editor behavior changes

## Architecture

The main article and editor stylesheet will become a module-local qstyle tagged-template `StyleHandle`. A small styling boundary component will define the handle and apply it through a `css` prop in the same module. The component will wrap the whole `ArticleShell` output and use `display: contents` so it introduces no layout box while still providing a scoped ancestor for the article, editor dock, error, and math dialog.

This same-module definition and use is required because qstyle does not resolve imported `StyleHandle` values across modules. The stylesheet will therefore not export a handle for use elsewhere.

Document-level declarations will stay in `root.tsx` as a small qstyle object applied directly to `<body>`. It will own the page background, minimum height, margin, base typography, and selection styling. Application design tokens will live on the article styling boundary and inherit into all application content.

The existing Vite `qstyle()` plugin configuration remains unchanged. This avoids the previously observed native-style graph-freeze path and keeps the current fail-closed build diagnostics.

## Selector Migration

Existing selectors will keep their current specificity and order as closely as qstyle permits:

- selectors for generated article content remain descendant selectors under the boundary
- pseudo-classes, pseudo-elements, attribute selectors, and comma-separated selectors remain nested `&...` rules
- `@media` and `@supports` blocks remain condition blocks around the equivalent scoped selectors
- CSS custom properties remain inherited from the boundary
- editor overlays remain descendants of the boundary even though they are visually fixed to the viewport

No generated HTML will receive new styling-only wrapper elements inside the article body.

## TDD and Regression Protection

The migration starts with a browser-level failing test. The test will require a qstyle-generated class on the styling boundary and will assert a small set of representative computed styles covering the paper, article typography, table rules, and fixed editor UI. It must fail before the CSS migration because the qstyle boundary does not yet exist.

The existing unit tests that grep `blog.css` will be replaced by observable DOM or computed-style assertions where the behavior is user-visible. Tests that protect generated article structure remain unchanged.

Before production code changes, reference screenshots will be captured at desktop and mobile widths. After the migration, the same browser and viewport settings will be used for pixel comparison. Existing view/edit layout-parity tests remain the main protection for mode-switch reflow.

Fresh verification will include:

1. the focused failing test before implementation
2. the focused passing test after implementation
3. the existing layout-parity browser suite
4. the full unit test suite
5. type checking and lint/check
6. the production build, including qstyle diagnostics and CSS asset emission
7. desktop and mobile before/after image comparison

## qstyle Pipeline Contract

| Input                           | Expected output                            | Failure condition                            |
| ------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Static declarations             | qstyle atomic classes and route CSS asset  | missing class or computed declaration        |
| Nested selectors                | scoped selector beneath the boundary class | residual diagnostic or selector loss         |
| `@media` / `@supports`          | condition-wrapped scoped rules             | build diagnostic or responsive mismatch      |
| Existing duplicate declarations | stable qstyle deduplication                | cascade or computed-style change             |
| Unsupported syntax              | fail-closed production build               | warning-only build or silently missing style |

Hash-collision handling and cache invalidation are compiler-owned contracts and are not changed here. The application verifies that the production build emits content-hashed CSS and that a style source edit changes the built asset rather than relying on a runtime stylesheet compiler. HMR receives a focused development smoke check after the build path is green.

## Completion Criteria

- no application-owned `.css` file remains
- KaTeX remains the only CSS import
- `BlogPaper` no longer uses `useStyles$`
- the page and editor are styled through qstyle `css` props
- qstyle production diagnostics remain fail-closed
- automated browser checks and before/after visual comparison find no layout regression
- full tests, checks, type checking, and production build pass
