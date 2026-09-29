# 依存パッケージのパッチ

適用一覧の正本は [pnpm-workspace.yaml](../pnpm-workspace.yaml) の `patchedDependencies`、パッチ本体は [patches/](../patches/) です。依存更新時は、上流での修正と以下の対象動作を確認してから解除します。

## Tiptap static renderer: mark nesting

`@tiptap__static-renderer@3.31.3.patch` fixes the shared static renderer's mark
fold direction (`reduce` → `reduceRight`). ProseMirror's schema orders marks
from outermost to innermost; wrapping the accumulated HTML in that same order
inverts nesting. The editor's DOM serializer instead wraps the last mark first.
This affects linked inline code, including inherited colors and underlines.

The patch changes the source and its published ESM/CJS bundles. It does not
change stored JSON or compensate with CSS. pnpm applies it through
`patchedDependencies`. When upgrading Tiptap, remove it only after verifying
[rendering-regressions.test.ts](../src/components/editor/rendering-regressions.test.ts) and
[inline-link-code-parity.spec.ts](../tests/layout/inline-link-code-parity.spec.ts) against the
unpatched renderer.

## qstyle: Vite runtime version

`@qstyle__vite@0.2.0.patch` reads Vite's exported `version` for its compatibility
check. Vite+ publishes `@voidzero-dev/vite-plus-core` under its own version
(`1.0.0` in the current override), independently of its Vite 8 API version. Package metadata therefore produces
a false unsupported-version warning. Qwik's package check and all diagnostics
remain enabled. Remove the patch when qstyle checks the runtime API version.

## Qwik CLI: color environment

`@qwik.dev__core@2.0.0-beta.45.patch` preserves `NO_COLOR` when launching build
subprocesses, instead of unconditionally forcing color and making Node print a
warning in every child process. It also preserves an explicit `FORCE_COLOR`
when `NO_COLOR` is absent. Remove when Qwik's CLI respects these settings.

## Qwik Router: visible-link bundle prefetch

`@qwik.dev__router-prefetch@2.0.0-beta.45.patch` resolves visible links through
the route trie before asking the bundle graph preloader for their JavaScript.
The unpatched observer passes a concrete pathname to a graph keyed by route
names, so dynamic article URLs can prefetch loader data without prefetching the
matching route bundles. Remove when the observer delegates both bundle and data
prefetching to `prefetchRoute()` upstream.

## Miniflare: local CLI exit

`miniflare@5.20260926.0-alpha.patch` sets the development registry watcher to
`persistent: false`. On macOS, a watcher can remain after runtime disposal and
keep completed `cf d1` commands running. The watcher still receives events while
the development server is running. Remove when unpatched local migration and SQL
commands exit normally after completion.
