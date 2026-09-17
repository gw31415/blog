# Task 6 report: full regression and delivery verification

## Status and ownership

VERIFIED, pending controller review and integration. Starting commit was `ce5dabfec43afbf82d106f150a4acfff5c2277e4` on `codex/layout-parity-table-handles`. Initial verification fixes were committed as `b5325073efd47d420f14d473e20311ca944679ec` (`fix(editor): close layout parity regressions`). The final-review follow-up below supersedes the initial verification totals: **83 unit tests and 22 browser tests pass**. No merge, push, main modification, or subagent delegation was performed.

The exact `owned_path_allowlist` for the initial fix commit was:

- `src/components/editor/article-shell.tsx`
- `src/components/editor/article-shell.test.ts`
- `src/components/editor/editor-runtime.ts`
- `tests/layout/article-layout-parity.spec.ts`
- `.superpowers/sdd/2026-09-17-layout-parity-table-handles/task-6-report.md`

Task 6 steps 1–4 are implemented. Step 5 (integration/publish) is explicitly deferred to the controller. The approved design, implementation plan, Task 6 brief, and SDD ledger were read; the plan and ledger were preserved.

## Discovered regressions and RED/GREEN evidence

### Open disclosure state was lost on the first editor mount

Opening the article's details in initial view, then entering edit, removed `open` because `mountArticleEditor` replaced the static DOM with a newly rendered document. This collapsed the body and moved following content.

- Added `preserves open details layout across the first editor mount` at 1280×900 and 390×844.
- `pnpm test:layout --grep 'preserves open details'` failed both tests before the fix: expected `open=""`, received `null` after the complete edit-shell transition.
- The runtime now captures disclosure booleans immediately before the synchronous initial DOM replacement and restores them to matching details in document order after mount. State remains transient and is not written into article JSON or Markdown.
- The same command passed both tests after the fix. Tests compare all visible element and text-line rectangles exactly across initial open view, edit, view again, then close and re-enter edit.

### Header editing stopped updating after a math dialog round-trip

The reproducible sequence was edit → open/cancel the block-math dialog → view → edit. The mode switch, runtime and dock entered edit, but the header retained no `contenteditable` and no date input. This also reproduced without screenshot capture.

- Added `keeps header editing available after a math dialog and mode round-trip` at both widths.
- `pnpm test:layout --grep 'header editing available'` failed both tests before the fix, waiting for the title's `contenteditable="true"` after the second transition.
- The shell now supplies `BlogHeader` with an explicit `useComputed$` edit-state value. The behavioral regression passes at both widths, including the date-input readiness check and exact whole-article layout equality.
- Removed the older unit assertion requiring the literal source spelling `editable={ui.mode === "edit"}`. Its user-visible contract is exercised by the browser tests; the remaining metadata tests are retained. An intermediate full-unit run identified this obsolete assertion (79/80 passed); final verification is 80/80.

The systematic-debugging, test-driven-development, verification-before-completion, and archive-commit skills were used. No feature or data-model expansion was introduced.

## Initial verification matrix

The exact ordered matrix below was run on the initial verification fixes on 2026-09-17. All commands exited 0. The chained run ended successfully, so no downstream command was skipped. The final-review follow-up matrix appears below.

| Command | Final result |
| --- | --- |
| `pnpm generate:article` | Re-generated `src/content/initial-article.generated.ts`; no tracked output difference. |
| `pnpm fmt` | Completed on 50 files. |
| `pnpm test` | 11 files, 80 tests passed; final run started 17:17:04 JST. |
| `pnpm test:layout` | 18 browser tests passed in 15.2 seconds; includes the 4 new regression cases. |
| `pnpm check` | Formatting, lint and type checks passed. |
| `pnpm build` | Client, SSR/SSG, type and lint stages passed; generated one page. |
| `pnpm check:editor-chunk` | `editor runtime: q-CeKtQAsN.js (516814 bytes), dynamically imported by q-CHq9vEcq.js`. |
| `git diff --check` | No whitespace errors. |

The baseline before final fixes also passed the full matrix (80 unit tests and 14 browser tests). These additional regressions were found by exercising states absent from that baseline coverage.

Non-fatal existing warnings remain: qstyle reports unsupported Vite version `0.3.0`, terminal `NO_COLOR`/`FORCE_COLOR`, Qwik dev-server `emitFile` compatibility, and a minified chunk above 500 kB. Build and lazy-runtime checks nevertheless passed; no thresholds were weakened.

## Browser interaction and manual visual review

An independent Chromium session exercised the UI at 1280×900 and 390×844 using the local dev server. Command: `node .cache/task6-manual.mjs`. Both widths reported `PASS`, with zero browser page errors. The script and viewport screenshots remain locally under `.cache/task6-manual.mjs` and `.cache/task6-visual/`; these verification artifacts are ignored and are not part of the commit.

Screenshots were inspected manually for initial/edit/final views, open details before/after mount, math dialog/view, code selector/label, both menu axes, and drag overlays at both widths. Browser input was scripted and the screenshots were manually reviewed; this was not physical-device testing.

| Scenario | Observations at both widths |
| --- | --- |
| Initial → edit → final view | Header, prose, section labels and math remain aligned. Edit dock overlays content. Final view hides table controls and retains article positions. |
| Details open/closed and search | Opening in initial view survives the first edit mount. Closing works. Native Chromium `window.find` finds hidden details text in both initial view and edit; wrap-around is enabled in the independent script. |
| Math selection and read-only view | Clicking block math opens the editing dialog without moving underlying article boxes; cancel returns to the same article. Clicking math in view does not open the dialog. Header editing works when returning to edit. |
| Code language | Changed the first block from `html` to `javascript`, confirmed select and view label updates, then restored `html`. Control bounds and underlying article boxes remain exactly equal. |
| Row/column menus | Correct target labels and six actions are visible. Escape closes each and restores focus; mobile controls and menu edges stay inside the viewport. |
| Mouse drag | At both widths, dragged row 2 to row 3 and column 1 to column 2. Ghost and insertion line appear; original order and article rectangles stay unchanged until drop. |
| Touch-equivalent drag | Repeated both axes at both widths using native Chromium CDP touch input and the actual hold threshold. Drop gives the expected order. |
| Keyboard moves | Enter opens the destination handle menu; End/ArrowUp/Enter moves the item back using the same transform. Original text order is restored. |
| No content jumps | Exact block-coordinate checks stay equal while menus, math dialog and drag overlays are visible. The committed browser suite additionally checks every measured descendant and text-line rectangle without rounding/tolerance. Intentional details expansion and actual row/column reorder are content changes. |

### Screenshot tooling observation

Playwright's default screenshot caret hiding mutates editable DOM styles. In this editor it caused a same-document ProseMirror redraw that detached cached table DOM references and hid handles during the *instrumented* screenshot run. Debugging confirmed unchanged document identity with disconnected cached table DOM. Capturing with `caret: 'initial'` avoids that synthetic mutation; the complete independent scenario then passed at both widths, including all mouse/touch/keyboard operations. No unrelated table-control workaround was added. Use `caret: 'initial'` for subsequent screenshot reviews. The separately reproduced header bug did not require screenshots and is fixed above.

## Acceptance mapping

| Approved acceptance bullet | Evidence |
| --- | --- |
| CSS-generated 第一節 / 第二節, absent from stored article | Section-counter and article-shell unit tests pass; screenshot review shows the labels. Generated content uses the counter and is not an editable text node. |
| Identical element rectangles in the three modes | Desktop/mobile exact layout tests pass, extended to open-details state and math-dialog round-trip. |
| Identical text-line rectangles | `Range.getClientRects()` records unrounded values and exact snapshot equality passes. No tolerance or rounding was added. |
| Code label/select share outer geometry without moving code | Shared-control tests, three-state control rectangles, and actual language-change interaction at both widths pass. |
| Complete initial-article layout coverage | Harness traverses all article descendants plus header/footer and text nodes. All present math, code, table, details, lists, image, heading, paragraph and inline content participate. Closed details bodies alone are omitted while invisible and measured when opened; UI overlays alone are excluded. |
| Per-row left / per-column top handles; drag and target menu | Browser menu tests, row/column text-order tests, manual screenshot review, desktop and 390px gestures pass. |
| Table UI does not enter flow | Exact whole-article snapshots remain equal during menu/drag overlays; screenshots show ghost and insertion line without shifting the table. |
| Mouse, touch, keyboard; final row/column protected | Both input types and keyboard restore tested at both widths independently; committed browser action test reduces the table to 1×1 and asserts deletion disabled. Pure transform tests enforce the same guard and merged-cell/stale-target rejection. |
| Editor remains a lazy chunk, view does not require it | Production manifest/initial-HTML static-graph check passes and confirms the editor runtime is dynamically imported. |

## Changed-path audit

Compared all paths against `5d1c249` (approved-plan baseline) and the Task 6 starting commit. Changes belong to these task-owned groups:

- Plan formatting and task evidence: `docs/superpowers/plans/2026-09-17-layout-parity-table-handles.md`, `.superpowers/sdd/2026-09-17-layout-parity-table-handles/task-4-report.md`, `task-5-report.md`, and this report.
- Test/dependency infrastructure: `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `vite.config.ts` (exclude Playwright tests from unit discovery), and `tests/layout/article-layout-parity.spec.ts`.
- Shared rendering: `scripts/render-initial-article.mjs`, `src/content/initial-article.generated.ts`, `src/components/blog/blog.css`, `src/components/blog/visual-texture-contract.test.ts`, and editor `code-block-view.ts`, `code-block-view.test.ts`, `editor-extensions.ts`, `editor-runtime.ts`, `rendering-regressions.test.ts`.
- Editor shell/metadata: `src/components/editor/article-shell.tsx`, `article-shell.test.ts`.
- Table implementation and behavioral tests: editor `table-controls.ts`, `table-controls.test.ts`, `table-transforms.ts`, `table-transforms.test.ts`.

The initial Task 6 commit changed only the five allowlisted paths. No generated/dependency changes were needed. The index was empty before staging. Staged path names and `git diff --cached --check` were reviewed before commit; post-commit Git readback confirmed the expected commit and clean worktree.

## Final-review follow-up: merged safety, horizontal access, and deletion focus

The controller identified three additional blockers. All were reproduced with failing behavioral tests before implementation. The minimal safe policy explicitly rejects all contextual structural actions on any table containing `rowspan` or `colspan`; fully span-aware editing is not introduced.

### RED/GREEN and acceptance evidence

| Review blocker | Failing evidence before fix | Implemented result and verification |
| --- | --- | --- |
| Structural actions could corrupt a valid merged table | Three new unit cases failed: transforms returned success or a document transaction for valid merged fixtures. Fixtures have equal physical-cell counts but valid, different logical `TableMap` geometry. Browser checks found enabled structural menu actions. | All insert-before, insert-after, duplicate, delete, and move actions for both axes are rejected before physical indexing. Unit fixtures cover rowspan and colspan with `TableMap.problems === null` before/after. Transaction test returns null and retains document identity. Browser fixture has valid combined row/column spans; all six menu items on both axes are disabled, programmatic clicks cause zero document-changing transactions, and JSON stays identical. Drag remains disabled. Handles remain focusable only to expose the disabled menu and explanatory text. |
| Wide tables were inaccessible at 390px | New browser test expected actual `.tableWrapper` overflow `auto`, received `visible`. | Shared CSS targets the real static/runtime wrapper and transfers existing vertical margin to it. The 12-column mobile test scrolls to column 12, verifies offscreen handles are hidden and visible handles remain inside the viewport, opens its menu, and duplicates it. Scrolling 16px moves the cell and handle exactly 16px while the menu tracks its viewport-clamped anchor. Wrapper/paper/footer coordinates stay equal; full article/line snapshots remain equal during menu display and edit/view transition. Page scroll width stays exactly 390px. Row handles and insertion overlays are clipped to the visible wrapper too. |
| Deleting the last row/column focused BODY | Both viewport tests failed the surviving-handle focus assertion. | After dispatch, focus targets the requested index clamped to the nearest remaining index. Desktop and mobile keyboard tests delete the bottom row and rightmost column, verify the surviving handle is focused, and reopen/close its menu with keyboard input. |

The targeted RED run had 3 failures/42 passes in unit tests and 4 browser failures. Targeted GREEN passed all 45 relevant unit tests and all 4 added browser cases. No tolerances or rounding were introduced: an interim test that tried to reconstruct a browser-quantized center coordinate was replaced with the exact 16px cell/handle displacement invariant. Whole-layout equality remains exact.

### Final complete matrix

Executed in this exact order on the final production/test changes, in one successful chained run on 2026-09-17:

```sh
pnpm generate:article && pnpm fmt && pnpm test && pnpm test:layout && pnpm check && pnpm build && pnpm check:editor-chunk && git diff --check
```

| Command | Final result |
| --- | --- |
| `pnpm generate:article` | Exit 0; no tracked generated-content changes. |
| `pnpm fmt` | Exit 0; 50 files formatted. |
| `pnpm test` | Exit 0; 11 files, 83 tests passed; started 17:36:09 JST, 635ms. |
| `pnpm test:layout` | Exit 0; 22 tests passed in 18.0 seconds. |
| `pnpm check` | Exit 0; formatting, lint and types passed. |
| `pnpm build` | Exit 0; client/server/types/lint/SSG succeeded, one page generated. |
| `pnpm check:editor-chunk` | Exit 0; `editor runtime: q-C1oiP2eO.js (517252 bytes), dynamically imported by q-ptARagos.js`. |
| `git diff --check` | Exit 0; no whitespace errors. |

The non-fatal toolchain/bundle warnings listed above remain unchanged. There was no generated/dependency change and no weakened check.

### Independent interaction and visual rerun

After final fixes, `node .cache/task6-manual.mjs && node .cache/task6-wide-review.mjs` exited 0. The desktop/mobile scenario described above again reported PASS with zero page errors, including both mouse and CDP touch-hold row/column drags, keyboard moves, details search/open/close, code language changes, math selection/read-only behavior, and exact underlying block geometry.

The additional 390px scenario scrolled a 12-column table to its last column, displayed the last-column menu, deleted the rightmost column, and verified focus on surviving column 11. Its output was `PASS: wide mobile last column/menu visible, last-column deletion focuses surviving column 11` and `Current visible paper width 390`. Manually inspected `.cache/task6-visual/390-wide-last-column.png` and `390-wide-last-menu.png`: the last column and its handle are visible, the menu stays within the right edge, row handles remain accessible, and article prose is not horizontally shifted. Screenshots use `caret: 'initial'` as documented above. These ignored local artifacts are not committed; physical device/Safari testing remains unperformed.

### Follow-up scope and delivery state

The exact `owned_path_allowlist` for the separate final-verification commit is:

- `src/components/blog/blog.css`
- `src/components/editor/table-controls.ts`
- `src/components/editor/table-controls.test.ts`
- `src/components/editor/table-transforms.ts`
- `src/components/editor/table-transforms.test.ts`
- `tests/layout/article-layout-parity.spec.ts`
- `.superpowers/sdd/2026-09-17-layout-parity-table-handles/task-6-report.md`

All changed production paths implement one of the three review fixes; all changed test paths add their regression evidence. Other agents' edits, the plan, and ledger are preserved. The initial acceptance mapping remains valid and is strengthened by this section's merged-table, wide-table, and focus coverage. This report accompanies `fix(editor): guard merged tables and preserve table navigation`; staged paths and whitespace are checked before commit, and the resulting hash/clean-state readback is supplied in the controller handoff. Integration and push remain exclusively with the controller.

## Remaining concerns and delivery boundary

- Browser verification is Chromium on macOS, with simulated touch input. Physical iPhone/Safari behavior remains unverified.
- Existing toolchain and bundle-size warnings remain as documented above.
- Disclosure-state mapping uses document order only at the first mount of the same article; it does not persist disclosure state or change article format.
- No unresolved acceptance failure remains from the final checks. Controller review, merge/fast-forward, and push are pending and were not performed by this task.
