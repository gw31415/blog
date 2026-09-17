# Task 5 report: pointer and keyboard table reordering

## Status

DONE. Commit subject: `feat(editor): reorder table rows and columns`.

## Implementation

- Added exported `TableDragState`, `beginPointerDrag`, `dragTargetIndex`, and `reorderDisabledReason` helpers. Mouse/pen activation requires 3 CSS pixels; touch requires a stationary 300ms hold. Movement on either axis before touch activation cancels the gesture permanently.
- Handles capture the primary pointer. Active gestures render a translucent fixed-position target ghost and insertion line, each marked `data-editor-overlay` and `pointer-events: none`. The ghost stays within viewport bounds and insertion lines use visible table extents.
- Pointer movement updates only transient overlay state. A changed target applies exactly one existing `{ type: "move", axis, from, to }` transform transaction on pointerup. No-op drops and cancellation dispatch no document transaction.
- Escape, pointer cancellation, lost capture, document replacement, read-only transitions, and plugin destruction clear gesture overlays and the hold timer. Completed or cancelled drags suppress the subsequent pointer click; ordinary clicks/taps and keyboard activation still open menus.
- Added 上へ移動/下へ移動 and 左へ移動/右へ移動 menu actions using the same pure move transform. Boundary moves are disabled. Successful moves focus the handle at the moved item's destination.
- Merged-cell tables expose `merged-cells`, explain the restriction in accessible handle descriptions, never begin dragging, and disable keyboard movement. Other contextual actions remain available.
- Existing table identity/position validation remains the final transaction guard, rejecting stale targets.

## TDD RED/GREEN evidence

### Unit RED

`pnpm test src/components/editor/table-controls.test.ts` exited 1 before production changes: 7 new tests failed and 10 existing tests passed. Failures identified missing gesture/target/merged-reason helpers and missing move-action mappings. Tests independently cover mouse threshold, stationary touch hold, pre-hold movement cancellation on both axes, final-index calculation in both directions, merged-cell prevention, one-step movement, and stale move rejection.

### Browser RED

`pnpm test:layout --grep 'reorders rows|cancels an active'` exited 1 before production changes: all 3 new tests failed because no drag ghost appeared. This included desktop mouse dragging, mobile touch hold, and Escape cancellation.

### GREEN and additional browser coverage

- `pnpm test src/components/editor/table-controls.test.ts src/components/editor/table-transforms.test.ts`: exit 0, 42 tests across 2 files.
- The 3 original RED browser tests passed after implementation. They move a row and a column, check actual content order only changes on drop, and restore each with keyboard menu navigation. Full unrounded article element and text-line snapshots (including table/cells) remain exactly equal while drag/menu overlays are visible at 1280px and 390px widths. Destination focus and boundary-disabled menu items are asserted.
- Added real Chromium touch-input coverage for movement before hold, timer cancellation, native `touchCancel`, and a subsequent ordinary tap opening the menu.
- Added a pasted merged-cell fixture proving no drag starts, the accessible reason is present, and both keyboard move directions are disabled. An initial fixture selected the last existing table although paste occurred earlier in the article; selecting by the actual merged-cell attribute corrected the test setup without a production change.

## Verification

- `pnpm test`: exit 0, 80 tests across 11 files.
- `pnpm test:layout`: exit 0, 14 browser tests.
- `pnpm check`: exit 0, all 50 files formatted, no warnings/lint/type errors across 39 checked files.
- `git diff --check`: exit 0.
- The first type check identified Cloudflare's conflicting `append` overload; using the existing DOM `appendChild` pattern resolved it.
- Existing non-fatal qstyle/Vite, Qwik dev-server, and terminal color warnings remain.

## Scope and limitations

- Only the four Task 5 owned implementation/test paths and this report are included. No transform/runtime integration, article content, plan, or ledger changes were made.
- Touch interactions were verified with Chromium's real CDP touch input at a mobile viewport, not on physical iPhone/Safari hardware.
- Full build, lazy-chunk checks, final visual review, and integration/push belong to Task 6 and are not claimed here.
- Used the test-driven-development and verification-before-completion skills for implementation and evidence collection.
