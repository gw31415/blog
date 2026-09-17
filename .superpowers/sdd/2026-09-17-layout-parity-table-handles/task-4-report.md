# Task 4 report: contextual table handles

## Status

DONE. Commit subject: `feat(editor): add contextual table handles`.

## Implementation

- Added `createTableControlsPlugin()` to the lazy editor runtime. Its single `data-editor-overlay="table-controls"` root is a sibling of the ProseMirror content, appended to the editor mount and absolutely positioned outside document flow.
- Every row and column receives a 24px button with axis/index metadata and a Japanese accessible name identifying its target. Geometry is derived from actual table/row/cell rectangles and updated after editor changes, selection changes, resize, and captured scroll events.
- Native buttons support click, keyboard Enter/Space, and touchscreen tap. Menus have axis-specific insert-before, insert-after, duplicate, and delete items; first-item focus, arrow/Home/End navigation, Escape/Tab dismissal, outside-pointer dismissal, and focus restoration are implemented.
- Last-row/column deletion is disabled. Actions re-resolve the document position and require the original table node identity before invoking Task 3's transform. Accepted actions replace the table in one transaction step. Rejected actions leave the document unchanged and show an adjacent alert.
- Read-only mode hides the overlay and removes its controls. Plugin destruction removes listeners, observer, animation frame, and root.
- Drag reorder and keyboard move commands remain deferred to Task 5; no drag scaffolding was needed.

## TDD evidence

### Initial RED

`pnpm test src/components/editor/table-controls.test.ts` exited 1 because `./table-controls` did not exist. Tests specified independent expected row/column center coordinates, all four menu mappings, single-step replacement, stale-table rejection, and final-column rejection.

`pnpm test:layout --grep 'table handle menus'` exited 1 at both desktop and mobile widths because the row handle did not exist, before the plugin implementation.

### GREEN

`pnpm test src/components/editor/table-controls.test.ts` exited 0: 9 tests passed.

The browser suite checks strict, unrounded article element and text-line snapshots across initial view/edit/final view at 1280px and 390px, plus unchanged article/table/cell geometry while row and column menus are open. It exercises keyboard activation and Escape focus restoration, outside-click dismissal, row duplication/deletion, column insertion/deletion, minimum dimensions, real touchscreen tap, and blank-row insertion.

### Discovered closed-details layout instability

The added touchscreen test once exposed a closed details body changing from a zero rectangle to a cached nonzero rectangle between snapshots. A minimal Chromium reproduction confirmed a closed `<details>` may expose body and Range rectangles while `open` remains false. A deterministic application regression test opens and closes details, then checks hidden-body geometry: before the fix it exited 1 with expected height 0 and actual height 51.

Added `details:not([open]) > .details-body { display: none; }` in the owned stylesheet. This stabilizes closed descendant geometry without changing visible or open-details layout, and retains every exact comparison rather than excluding details or adding a tolerance. The new regression and touchscreen test now pass.

## Final verification

- `pnpm test:layout`: exit 0; all 9 browser tests passed, including desktop/mobile exact parity and real touchscreen input.
- `pnpm check`: exit 0; all 50 files formatted, no warnings/lint/type errors in 39 checked files.
- `pnpm test`: exit 0; all 72 tests across 11 files passed.
- `git diff --check`: exit 0.
- The first full browser run had one cold-start 5-second edit-shell timeout; subsequent full runs passed that unchanged test. No timeout was relaxed.
- Existing non-fatal qstyle/Vite and Qwik dev-server warnings remain.

## Owned path allowlist

Only these paths belong in the Task 4 commit:

- `src/components/editor/table-controls.ts`
- `src/components/editor/table-controls.test.ts`
- `src/components/editor/editor-runtime.ts`
- `src/components/blog/blog.css`
- `tests/layout/article-layout-parity.spec.ts`
- `.superpowers/sdd/2026-09-17-layout-parity-table-handles/task-4-report.md`

## Self-review and remaining work

- All Task 4 acceptance items are implemented; only the closed-details stabilization was discovered beyond its initial brief, within owned files and required for reliable exact geometry checks.
- The transform module and article contents were not modified. Other agents' paths and the active ledger/plan were preserved.
- Task 5 owns drag/reorder, and Task 6 owns full build/lazy-chunk verification and delivery. These were not claimed or performed here.
