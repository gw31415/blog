# Tiptap static renderer: mark nesting

`@tiptap__static-renderer@3.31.3.patch` fixes the shared static renderer's mark
fold direction (`reduce` → `reduceRight`). ProseMirror's schema orders marks
from outermost to innermost; wrapping the accumulated HTML in that same order
inverts nesting. The editor's DOM serializer instead wraps the last mark first.
This affects linked inline code, including inherited colors and underlines.

The patch changes the source and its published ESM/CJS bundles. It does not
change stored JSON or compensate with CSS. pnpm applies it through
`patchedDependencies`. When upgrading Tiptap, remove it only after verifying
`rendering-regressions.test.ts` and `inline-link-code-parity.spec.ts` against the
unpatched renderer.

# qstyle: Vite runtime version

`@qstyle__vite@0.2.0.patch` reads Vite's exported `version` for its compatibility
check. Vite+ publishes `@voidzero-dev/vite-plus-core` under its own version
(0.3.0), while its Vite API version is 8.2.2. Package metadata therefore produces
a false unsupported-version warning. Qwik's package check and all diagnostics
remain enabled. Remove the patch when qstyle checks the runtime API version.

# Qwik CLI: color environment

`@qwik.dev__core@2.0.0-beta.43.patch` preserves `NO_COLOR` when launching build
subprocesses, instead of unconditionally forcing color and making Node print a
warning in every child process. It also preserves an explicit `FORCE_COLOR`
when `NO_COLOR` is absent. Remove when Qwik's CLI respects these settings.
