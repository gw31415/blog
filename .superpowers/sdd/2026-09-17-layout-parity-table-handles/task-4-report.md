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

Original approach, superseded by the review correction below: added `details:not([open]) > .details-body { display: none; }`. Although visual snapshots passed, review found that it removed hidden text from browser find-in-page. The rule has now been removed.

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

## Task 4 review correction

Both requested review fixes are implemented in a separate commit, `fix(editor): preserve details search and visible table handles`.

### Native details behavior and semantic measurement

- Removed the `display: none` rule so closed native details remain searchable.
- Snapshot capture now excludes only descendants hidden by a closed details element. The details box and visible summary remain measured, and all body element/text-line rectangles are measured when open. Exact values and strict comparisons remain unchanged for visible content.
- The browser regression proves `window.find` locates the closed-body text, checks body elements and lines are absent only while closed, compares initial/edit/final geometry exactly, then opens the details and checks body elements and lines are included.

RED: `pnpm test:layout --grep 'closed details|keyboard on mobile'` exited 1 with `window.find` returning false. After removing the CSS rule and updating capture semantics, both focused browser tests passed.

### Narrow-screen handle bounds

- Row handle centers retain their row's vertical center and normal 14px horizontal offset when space permits. Near a viewport edge the center is clamped to 16px inside that edge, fitting the 24px button plus 2px outline and 2px outline offset.
- Added a pure geometry regression and a 390px browser assertion for every row button: exact `x: 4`, `width: 24`, `height: 24`, with full focus-outline bounds inside both viewport dimensions.

RED: the focused unit test expected relative `x: -6` but received `-14`; the browser expected left edge `4` but received `-4`. Both became GREEN with viewport-aware positioning.

### Verification after review fixes

- `pnpm test src/components/editor/table-controls.test.ts`: exit 0; 10 passed.
- `pnpm test`: exit 0; 73 tests in 11 files passed.
- `pnpm test:layout`: exit 0; 9 browser tests passed.
- `pnpm check`: exit 0; 50 files formatted and no warnings/lint/type errors in 39 checked files. The native Chromium `window.find` typing and test-helper scoping were corrected after the first check identified them.
- `git diff --check`: exit 0.

The correction uses five paths from the existing owned-path allowlist: table controls, their unit tests, the blog stylesheet, browser layout tests, and this report. Runtime integration, transform implementation, and other agents' files are untouched.
