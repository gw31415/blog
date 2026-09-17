# Layout Parity and Table Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make view/edit rendering pixel-identical, label sections as 第一節・第二節, and add per-row/per-column table handles for contextual editing and reordering.

**Architecture:** Static rendering and TipTap runtime rendering will share stable node markup and CSS box metrics. A browser parity harness will compare block rectangles and line rectangles across initial view, edit, and post-edit view. Table mutations live in a pure rectangular-table transform module; a ProseMirror plugin renders flow-independent handle, menu, drag-ghost, and insertion-line overlays.

**Tech Stack:** Qwik 2, TypeScript, TipTap 3 / ProseMirror, CSS, Vite Plus tests, Playwright browser tests.

**Spec:** `docs/superpowers/specs/2026-09-17-layout-parity-table-handles-design.md`

## Global Constraints

- DB保存や永続化は対象外で、現在の一時編集モデルを維持する。
- 閲覧前、編集開始後、編集後の閲覧で記事要素の座標、寸法、テキスト行矩形を完全一致させる。
- 編集専用UI、ドラッグゴースト、挿入線、メニューは文書フローへ参加させない。
- 最後の行または列を削除できない。
- 安全に変換できない結合セル表では並べ替えを無効化する。
- エディター本体は遅延チャンクのまま維持する。

---

### Task 1: Section suffix and layout test foundation

**Files:**
- Modify: `src/components/blog/blog.css`
- Modify: `src/components/editor/article-shell.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `playwright.config.ts`
- Create: `tests/layout/article-layout-parity.spec.ts`

**Interfaces:**
- Consumes: `data-layout-key`, `data-article-field`, `data-editor-mount`, and the existing 閲覧/編集 buttons.
- Produces: `captureArticleLayout(page): Promise<ArticleLayoutSnapshot>` and `expectLayoutEqual(before, after)` for later tasks.

- [ ] **Step 1: Write the failing section-label test**

Add a CSS source assertion that the heading counter uses exactly:

```ts
expect(css).toMatch(/content:\s*"第"\s+counter\(section, cjk-ideographic\)\s+"節"/);
expect(INITIAL_ARTICLE_HTML).not.toMatch(/第[一二三四五六七八九十]+節/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/components/editor/article-shell.test.ts`

Expected: FAIL because the generated CSS content currently omits `"節"`.

- [ ] **Step 3: Implement the automatic suffix**

Change only the generated-content declaration:

```css
content: "第" counter(section, cjk-ideographic) "節";
```

- [ ] **Step 4: Add Playwright and the layout snapshot helper**

Add `@playwright/test` as a dev dependency and scripts:

```json
{
  "test:layout": "playwright test tests/layout/article-layout-parity.spec.ts"
}
```

Configure `webServer.command` to run the existing dev server on a fixed localhost port. In `captureArticleLayout`, collect every descendant of `[data-editor-mount]` plus header/footer fields. Use stable keys based on DOM path and semantic attributes. Record `x`, `y`, `width`, `height`, and every text node's `Range.getClientRects()` as unrounded numbers. Exclude `.mode-switch`, `.editor-dock`, `.editor-error`, `.math-dialog`, and `[data-editor-overlay]`.

```ts
export interface ArticleLayoutSnapshot {
  elements: Record<string, { x: number; y: number; width: number; height: number }>;
  lines: Record<string, Array<{ x: number; y: number; width: number; height: number }>>;
}
```

The first test captures initial view, clicks 編集, waits for `[data-editor-mode="edit"]`, captures edit, clicks 閲覧, waits for `[data-editor-mode="view"]`, and captures final view at 1280×900 and 390×844. Assert exact deep equality and print the first differing key.

- [ ] **Step 5: Run the layout test and verify RED**

Run: `pnpm test:layout`

Expected: FAIL with the first real box or line mismatch, establishing the current regression rather than a harness error.

- [ ] **Step 6: Run unit checks and commit the foundation**

Run: `pnpm test src/components/editor/article-shell.test.ts && pnpm check`

Commit:

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests/layout/article-layout-parity.spec.ts src/components/blog/blog.css src/components/editor/article-shell.test.ts
git commit -m "test(editor): measure view and edit layout parity"
```

---

### Task 2: Shared rendering contract and zero-difference layout

**Files:**
- Create: `src/components/editor/code-block-view.ts`
- Create: `src/components/editor/code-block-view.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/render-initial-article.mjs`
- Modify: `src/components/editor/editor-extensions.ts`
- Modify: `src/components/editor/editor-runtime.ts`
- Modify: `src/components/blog/blog.css`
- Modify: `src/components/editor/rendering-regressions.test.ts`
- Regenerate: `src/content/initial-article.generated.ts`
- Test: `tests/layout/article-layout-parity.spec.ts`

**Interfaces:**
- Consumes: `CODE_LANGUAGES`, `codeLanguage`, `replaceCodeLanguage`, and Task 1 layout helpers.
- Produces: `codeBlockDOMSpec(languageInfo: string): DOMOutputSpec`, `createCodeBlockControl(...)`, and identical `.code-language-control` markup in static/runtime states.

- [ ] **Step 1: Write failing shared-markup and control-metric tests**

Assert that static HTML and runtime code-block creation use the same classes and nesting:

```ts
expect(codeBlockDOMSpec("html caption")).toEqual([
  "pre",
  expect.objectContaining({ class: "code-block", "data-code-language": "html" }),
  ["span", { class: "code-language-control", contenteditable: "false" },
    ["span", { class: "code-language-label" }, "html"],
    ["select", expect.objectContaining({ class: "code-language-select" })]],
  ["code", { class: "language-html" }, 0],
]);
```

Extend the browser test to compare `.code-language-control`, `.code-language-label`, and `.code-language-select` outer rectangles. The inactive label/select must use `visibility`, `opacity`, and pointer control, not `display: none`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test src/components/editor/code-block-view.test.ts src/components/editor/rendering-regressions.test.ts && pnpm test:layout`

Expected: FAIL because static rendering and the ProseMirror widget currently use different parents, and the hidden select has no rectangle.

- [ ] **Step 3: Implement one code-block DOM contract**

Add `@tiptap/extension-code-block` at version `3.31.3` as a direct dependency. Move label/select construction into `code-block-view.ts`. Disable StarterKit's bundled code block and extend the direct CodeBlock extension with a node view whose `dom`, `contentDOM`, label, and select match the static renderer. Route language changes through a callback that preserves the Markdown fence caption. Update the static generation script to serialize the same contract rather than hand-building an alternate structure.

Use a fixed control box in CSS:

```css
.code-language-control { inline-size: 108px; block-size: 24px; }
.code-language-label,
.code-language-select { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
[data-editor-mode="view"] .code-language-select { visibility: hidden; pointer-events: none; }
[data-editor-mode="edit"] .code-language-label { visibility: hidden; pointer-events: none; }
```

Do not change code-block padding, border, font metrics, or overflow between modes.

- [ ] **Step 4: Fix each layout mismatch at its source**

Run `pnpm test:layout` after each minimal CSS/DOM correction. For every first-difference diagnostic, make the static and runtime nodes share tag, class, attributes, child order, and metric-affecting CSS. Do not add numeric tolerances or round measurements. Keep editing affordances as outline/overlay only.

- [ ] **Step 5: Regenerate and verify GREEN**

Run:

```bash
pnpm generate:article
pnpm test src/components/editor/code-block-view.test.ts src/components/editor/rendering-regressions.test.ts
pnpm test:layout
pnpm check
```

Expected: all tests pass at both configured viewport widths.

- [ ] **Step 6: Commit shared rendering**

```bash
git add package.json pnpm-lock.yaml scripts/render-initial-article.mjs src/components/editor/code-block-view.ts src/components/editor/code-block-view.test.ts src/components/editor/editor-extensions.ts src/components/editor/editor-runtime.ts src/components/blog/blog.css src/components/editor/rendering-regressions.test.ts src/content/initial-article.generated.ts tests/layout/article-layout-parity.spec.ts
git commit -m "fix(editor): keep view and edit layout identical"
```

---

### Task 3: Pure rectangular-table transforms

**Files:**
- Create: `src/components/editor/table-transforms.ts`
- Create: `src/components/editor/table-transforms.test.ts`

**Interfaces:**
- Consumes: ProseMirror `Node`, `Fragment`, and the existing table/tableRow/tableCell/tableHeader schema nodes.
- Produces:

```ts
export type TableAxis = "row" | "column";
export type TableAction =
  | { type: "insertBefore" | "insertAfter" | "duplicate" | "delete"; axis: TableAxis; index: number }
  | { type: "move"; axis: TableAxis; from: number; to: number };

export type TableTransformResult =
  | { ok: true; table: ProseMirrorNode }
  | { ok: false; reason: "last-axis" | "merged-cells" | "out-of-range" };

export function transformTable(table: ProseMirrorNode, action: TableAction): TableTransformResult;
export function canReorderTable(table: ProseMirrorNode): boolean;
```

- [ ] **Step 1: Write failing transform tests**

Build real schema table nodes and cover:

- insert blank row above/below with matching cell types;
- insert blank column left/right;
- duplicate row/column including cell content;
- delete row/column while more than one remains;
- reject deletion of the last row/column;
- move row up/down and column left/right;
- reject invalid indexes;
- reject move when any cell has `rowspan !== 1` or `colspan !== 1`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test src/components/editor/table-transforms.test.ts`

Expected: FAIL because `transformTable` does not exist.

- [ ] **Step 3: Implement immutable transforms**

Read rows and cells into arrays without mutating ProseMirror nodes. For blank insertion, preserve the source cell type and attrs but replace content with `schema.nodes.paragraph.create()`. Rebuild rows and the table with `Fragment.fromArray`. Return an error without producing a transaction for every rejected operation.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm test src/components/editor/table-transforms.test.ts`

Expected: all transform tests pass.

- [ ] **Step 5: Commit transforms**

```bash
git add src/components/editor/table-transforms.ts src/components/editor/table-transforms.test.ts
git commit -m "feat(editor): add safe table transforms"
```

---

### Task 4: Per-row and per-column handles with contextual menus

**Files:**
- Create: `src/components/editor/table-controls.ts`
- Create: `src/components/editor/table-controls.test.ts`
- Modify: `src/components/editor/editor-runtime.ts`
- Modify: `src/components/blog/blog.css`
- Test: `tests/layout/article-layout-parity.spec.ts`

**Interfaces:**
- Consumes: `transformTable`, `TableAction`, ProseMirror `EditorView`, and each table DOM node's `getBoundingClientRect()`.
- Produces: `createTableControlsPlugin(): Plugin`, overlay elements carrying `data-editor-overlay`, `data-table-axis`, and `data-table-index`.

- [ ] **Step 1: Write failing overlay-geometry and action tests**

Test pure geometry helpers with table, row, and cell rectangles. Assert row handles align to row centers and column handles align to column centers without changing the table rectangle. Test menu action mapping:

```ts
expect(menuAction("row", 2, "after")).toEqual({ type: "insertAfter", axis: "row", index: 2 });
expect(menuAction("column", 1, "delete")).toEqual({ type: "delete", axis: "column", index: 1 });
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test src/components/editor/table-controls.test.ts`

Expected: FAIL because the plugin and helpers do not exist.

- [ ] **Step 3: Implement the flow-independent overlay plugin**

Create one overlay root appended to the editor mount with `data-editor-overlay="table-controls"`. On editor updates, selection changes, resize, and scroll, find visible tables and position row/column handle buttons from DOM rectangles relative to the mount. Remove or hide controls in view mode without changing article descendants.

Opening a handle menu records the table document position, axis, and index. Before applying an action, resolve the position again and verify that it is still a table. Replace the table node with `transformTable(...).table` in one transaction. Close on action, outside pointerdown, or Escape.

- [ ] **Step 4: Add accessible menu behavior**

Give handles names such as `2行目の操作` and `3列目の操作`. Support click, Enter, and Space. Render axis-appropriate labels and disable deletion for the last row/column. Return focus to the originating handle after menu close when it still exists.

- [ ] **Step 5: Verify controls do not move content**

Extend `tests/layout/article-layout-parity.spec.ts` to assert the table and every cell rectangle before and after opening each kind of handle menu. Run:

```bash
pnpm test src/components/editor/table-controls.test.ts
pnpm test:layout
pnpm check
```

- [ ] **Step 6: Commit contextual controls**

```bash
git add src/components/editor/table-controls.ts src/components/editor/table-controls.test.ts src/components/editor/editor-runtime.ts src/components/blog/blog.css tests/layout/article-layout-parity.spec.ts
git commit -m "feat(editor): add contextual table handles"
```

---

### Task 5: Pointer drag reordering and keyboard movement

**Files:**
- Modify: `src/components/editor/table-controls.ts`
- Modify: `src/components/editor/table-controls.test.ts`
- Modify: `src/components/blog/blog.css`
- Modify: `tests/layout/article-layout-parity.spec.ts`

**Interfaces:**
- Consumes: table handle metadata and `{ type: "move", axis, from, to }` transforms.
- Produces: `TableDragState`, pointer gesture helpers, overlay ghost/insertion line, and keyboard move menu actions.

- [ ] **Step 1: Write failing gesture-state tests**

Cover mouse threshold, touch hold, cancellation, and target calculation:

```ts
expect(beginPointerDrag({ pointerType: "mouse", start: 10 }, 14, 3).active).toBe(true);
expect(beginPointerDrag({ pointerType: "touch", startedAt: 0 }, 10, 200).active).toBe(false);
expect(beginPointerDrag({ pointerType: "touch", startedAt: 0 }, 10, 360).active).toBe(true);
```

Also test that merged-cell tables return the `merged-cells` disabled reason and never enter drag state.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test src/components/editor/table-controls.test.ts`

Expected: FAIL on missing gesture functions.

- [ ] **Step 3: Implement Pointer Events drag state**

Use pointer capture. Mouse drag activates after a 3 CSS-pixel movement; touch drag activates after 300 ms and cancels on scrolling movement before activation. Position a fixed/absolute ghost and insertion line with `pointer-events: none`, both marked `data-editor-overlay`. Do not transform or reorder live table DOM during movement. Apply one move transaction on pointerup.

- [ ] **Step 4: Add keyboard move actions**

Row menus expose 上へ移動/下へ移動; column menus expose 左へ移動/右へ移動. Disable boundary actions. Map them to the same move transform used by pointer drop.

- [ ] **Step 5: Add browser interaction coverage**

At desktop and mobile viewport sizes, use pointer events to move one row and one column, verify cell text order, then open the handle menu and move the item back with keyboard. Capture table/cell rectangles while the menu and drag overlays are visible and assert the underlying table remains unchanged until drop.

Run:

```bash
pnpm test src/components/editor/table-controls.test.ts src/components/editor/table-transforms.test.ts
pnpm test:layout
pnpm check
```

- [ ] **Step 6: Commit drag and keyboard behavior**

```bash
git add src/components/editor/table-controls.ts src/components/editor/table-controls.test.ts src/components/blog/blog.css tests/layout/article-layout-parity.spec.ts
git commit -m "feat(editor): reorder table rows and columns"
```

---

### Task 6: Full regression and delivery

**Files:**
- Modify only files required by failures found during final verification.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a verified branch whose article layout is identical across modes and whose table controls meet the spec.

- [ ] **Step 1: Run the complete verification matrix**

```bash
pnpm generate:article
pnpm fmt
pnpm test
pnpm test:layout
pnpm check
pnpm build
pnpm check:editor-chunk
git diff --check
```

Expected: all commands exit 0. The existing non-fatal chunk-size warning may remain, but the editor runtime must still be reported as dynamically imported.

- [ ] **Step 2: Perform manual visual checks**

At desktop and 390 px width, verify initial view, edit, post-edit view, open/closed details, math selection, code language selection, table menus, mouse drag, touch-equivalent drag, and keyboard moves. Confirm no content jumps when controls appear or disappear.

- [ ] **Step 3: Review requirement coverage and staged paths**

Compare the final diff against every spec acceptance bullet. Stage only owned implementation, test, generated, dependency, spec, and plan paths. Run `git diff --cached --name-only` and `git diff --cached --check`.

- [ ] **Step 4: Commit final verification fixes if any**

If Step 1 or 2 required changes, commit only those verified changes:

```bash
git commit -m "fix(editor): close layout parity regressions"
```

- [ ] **Step 5: Integrate and publish**

Fast-forward the approved implementation branch into `main`, push `origin main`, and verify the pushed commit with `git log -1 --oneline` and a clean `git status --short`.
