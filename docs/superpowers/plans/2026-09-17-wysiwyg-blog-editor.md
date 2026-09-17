# WYSIWYG Blog Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing static top-page article into a transient, in-place visual Markdown editor without changing the reading layout or loading the editor runtime before the first edit request.

**Architecture:** Qwik continues to SSR a static article from committed generated HTML. A lazy QRL imports a vanilla Tiptap runtime only when editing starts, then keeps that editor mounted while mode changes toggle editability. Metadata stays in Qwik-owned fields; body content round-trips through an explicit Markdown dialect and the footer/section numbers remain derived presentation.

**Tech Stack:** Qwik 2 beta, TypeScript 7, vite-plus/Vitest, Tiptap 3.31.3, ProseMirror, KaTeX 0.18.7, highlight.js, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-wysiwyg-blog-editor-design.md`

## Global Constraints

- Initial SSR must not instantiate or execute Tiptap, ProseMirror, or KaTeX in the browser.
- All Tiptap packages are pinned to exactly `3.31.3`; KaTeX is pinned to exactly `0.18.7`.
- Reloading restores the initial article; do not use local storage, cookies, APIs, or a database.
- Reading and editing use identical paper, header, article, and footer box metrics.
- Level-two section numbers are generated from heading order and never enter editable data.
- The body database boundary is Markdown, while category, ISO publication date, title, and subtitle are separate fields.
- The existing Japanese typography, image treatment, code highlighting, and specialist blocks remain visible.

---

### Task 1: Article data and derived presentation

**Files:**

- Create: `src/content/article.ts`
- Create: `src/content/article.test.ts`
- Create: `src/content/initial-article.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `ArticleDraft`, `formatJapaneseDate(isoDate: string): string`, `formatJapaneseEraYear(isoDate: string): string`, `INITIAL_ARTICLE: Readonly<ArticleDraft>`.
- Consumes: no feature code.

- [ ] **Step 1: Add the test command and write failing metadata tests**

Add `"test": "vp test run"` to `package.json`, then create assertions equivalent to:

```ts
import { describe, expect, it } from "vitest";
import { formatJapaneseDate, formatJapaneseEraYear } from "./article";

describe("article presentation", () => {
  it("derives the localized date from the ISO publication date", () => {
    expect(formatJapaneseDate("2026-09-17")).toBe("九月十七日　木曜日");
  });

  it("derives the Japanese era and western year for the footer", () => {
    expect(formatJapaneseEraYear("2026-09-17")).toBe("令和八年 / 2026");
  });

  it("rejects a non-calendar date", () => {
    expect(() => formatJapaneseDate("2026-02-30")).toThrow("Invalid ISO date");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/content/article.test.ts`

Expected: FAIL because `./article` does not exist.

- [ ] **Step 3: Implement the data contract and initial Markdown**

Implement strict `YYYY-MM-DD` parsing with a UTC round-trip check, Japanese weekday/number formatting, and Reiwa-year calculation. Create `INITIAL_ARTICLE` with the existing category, date, title, subtitle, and a Markdown body that represents every current paragraph, formula, code block, link list, table, note, figure, details block, rule, and final paragraph.

Use these specialist forms consistently:

```md
> [!NOTE 補足]
> 本文

:::figure{src="/images/dusk-hills.jpg" alt="夕光に霞む山並み" caption="図二　夕暮れに霞む谷。写真は紙面に馴染むよう彩度を落としている。"}
:::

:::mark-figure{mark="秋" caption="図一　文字だけで作った簡素な図版。写真や画像も同じ余白設計で置ける。"}
:::

:::details{summary="リンク表現について"}
通常時は赤褐色の文字 + 下線。
:::
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test src/content/article.test.ts`

Expected: 3 passing tests.

- [ ] **Step 5: Commit the article data slice**

```bash
git add package.json src/content/article.ts src/content/article.test.ts src/content/initial-article.ts
git commit -m "feat(content): model transient article draft"
```

### Task 2: Markdown/editor schema and static rendering

**Files:**

- Create: `src/components/editor/editor-extensions.ts`
- Create: `src/components/editor/markdown.ts`
- Create: `src/components/editor/markdown.test.ts`
- Create: `scripts/render-initial-article.mjs`
- Create: `src/content/initial-article.generated.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `INITIAL_ARTICLE.bodyMarkdown`.
- Produces: `createEditorExtensions(): Extensions`, `parseArticleMarkdown(markdown: string): JSONContent`, `serializeArticleMarkdown(content: JSONContent): string`, `INITIAL_ARTICLE_JSON`, `INITIAL_ARTICLE_HTML`.

- [ ] **Step 1: Install exact editor dependencies**

Run:

```bash
pnpm add -E @tiptap/core@3.31.3 @tiptap/pm@3.31.3 @tiptap/starter-kit@3.31.3 @tiptap/markdown@3.31.3 @tiptap/extension-link@3.31.3 @tiptap/extension-table@3.31.3 @tiptap/extension-task-list@3.31.3 @tiptap/extension-task-item@3.31.3 @tiptap/extension-image@3.31.3 @tiptap/extension-mathematics@3.31.3 @tiptap/extension-placeholder@3.31.3 @tiptap/static-renderer@3.31.3 katex@0.18.7
```

- [ ] **Step 2: Write failing Markdown round-trip tests**

Cover one standard document and each custom form. The assertions must verify semantics rather than whitespace:

```ts
it("round-trips headings, GFM content, and standard math delimiters", () => {
  const source = "## 節\n\n本文の $x^2$。\n\n$$\ny = x + 1\n$$\n";
  const json = parseArticleMarkdown(source);
  const output = serializeArticleMarkdown(json);
  expect(output).toContain("## 節");
  expect(output).toContain("$x^2$");
  expect(output).toContain("$$\ny = x + 1\n$$");
});

it.each(["note", "figure", "mark-figure", "details"])(
  "round-trips the %s extension",
  (fixtureName) => expect(roundTripFixture(fixtureName)).toEqual(normalizedFixture(fixtureName)),
);
```

- [ ] **Step 3: Run the Markdown tests and verify RED**

Run: `pnpm test src/components/editor/markdown.test.ts`

Expected: FAIL because the Markdown adapter does not exist.

- [ ] **Step 4: Implement the schema and Markdown adapter**

Build the extension list from StarterKit plus Link, TableKit, TaskList/TaskItem, Image, Placeholder, math nodes, and four custom nodes. Each custom node defines `parseHTML`, `renderHTML`, `markdownTokenizer`, `parseMarkdown`, and `renderMarkdown`. Configure the Markdown manager for GFM and two-space indentation. Normalize line endings and exactly one terminal newline at the adapter boundary.

Math parsing must treat escaped dollar signs as text, single-dollar single-line spans as inline math, and standalone double-dollar fences as display math. Serialization must restore those standard delimiters rather than Tiptap's default math syntax.

- [ ] **Step 5: Run the Markdown tests and verify GREEN**

Run: `pnpm test src/components/editor/markdown.test.ts`

Expected: all Markdown fixtures pass.

- [ ] **Step 6: Add and run the committed static-render generator**

The generator imports the initial Markdown, parses it to JSON, renders JSON to HTML using `@tiptap/static-renderer/pm/html-string`, renders math mappings with `katex.renderToString`, and writes only these exports:

```ts
import type { JSONContent } from "@tiptap/core";

export const INITIAL_ARTICLE_JSON = {/* generated document */} satisfies JSONContent;
export const INITIAL_ARTICLE_HTML = "<p>...</p>";
```

Add `"generate:article": "node scripts/render-initial-article.mjs"` and run `pnpm generate:article`. Re-run the Markdown tests after generation.

- [ ] **Step 7: Commit the schema slice**

```bash
git add package.json pnpm-lock.yaml scripts/render-initial-article.mjs src/components/editor src/content/initial-article.generated.ts
git commit -m "feat(editor): define Markdown document schema"
```

### Task 3: Static Qwik article shell and automatic section numbering

**Files:**

- Create: `src/components/editor/article-shell.tsx`
- Create: `src/components/editor/article-shell.test.ts`
- Modify: `src/components/blog/blog.tsx`
- Modify: `src/components/blog/blog.css`
- Modify: `src/routes/index.tsx`

**Interfaces:**

- Consumes: `INITIAL_ARTICLE`, `INITIAL_ARTICLE_HTML`, date/footer formatters.
- Produces: `ArticleShell` with stable `data-layout-key` landmarks and a body mount identified by `data-editor-mount`.

- [ ] **Step 1: Write failing shell contract tests**

Extract pure render props where DOM rendering is unnecessary and assert:

```ts
expect(createArticlePresentation(INITIAL_ARTICLE)).toMatchObject({
  dateLabel: "九月十七日　木曜日",
  footerRight: "令和八年 / 2026",
});
expect(INITIAL_ARTICLE_HTML).not.toMatch(/class="section-number"/);
expect(INITIAL_ARTICLE_HTML).toContain("<h2");
```

- [ ] **Step 2: Run the shell test and verify RED**

Run: `pnpm test src/components/editor/article-shell.test.ts`

Expected: FAIL because `ArticleShell` and its presentation helper do not exist.

- [ ] **Step 3: Implement the static shell**

Keep `BlogPaper`, `GridLayer`, and the visual header/footer components. Render the generated article body inside a stable element with `dangerouslySetInnerHTML`. Add exact layout landmarks for paper, header, body, each `h2`, and footer. Remove manual `number` from `SectionHeading`; its rendered number must be a pseudo-element only.

The body rule must use:

```css
.article-content {
  counter-reset: section;
}

.article-content h2 {
  counter-increment: section;
}

.article-content h2::before {
  content: counter(section, cjk-ideographic);
  pointer-events: none;
  user-select: none;
}
```

Style the heading as the same two-column grid currently produced by `.section-heading`, with no border/padding differences between modes.

- [ ] **Step 4: Run focused tests and production checks**

Run:

```bash
pnpm test src/components/editor/article-shell.test.ts
pnpm check
pnpm build.types
```

Expected: tests and checks pass.

- [ ] **Step 5: Commit the static-shell slice**

```bash
git add src/components/editor/article-shell.tsx src/components/editor/article-shell.test.ts src/components/blog/blog.tsx src/components/blog/blog.css src/routes/index.tsx
git commit -m "refactor(blog): render article from Markdown data"
```

### Task 4: Lazy Tiptap runtime, metadata editing, and toolbar

**Files:**

- Create: `src/components/editor/editor-runtime.ts`
- Create: `src/components/editor/editor-controller.ts`
- Create: `src/components/editor/editor-controller.test.ts`
- Create: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/components/editor/article-shell.tsx`
- Modify: `src/components/blog/blog.css`

**Interfaces:**

- Consumes: `INITIAL_ARTICLE_JSON`, `createEditorExtensions`, `ArticleDraft`.
- Produces: `mountArticleEditor(options): EditorHandle`, `EditorCommand`, `executeEditorCommand(handle, command): boolean`, and the Qwik editing controls.

Define the imperative boundary as:

```ts
export interface EditorHandle {
  setEditable(editable: boolean): void;
  run(command: EditorCommand): boolean;
  getMarkdown(): string;
  destroy(): void;
}

export interface MountArticleEditorOptions {
  element: HTMLElement;
  content: JSONContent;
  onUpdate(markdown: string): void;
  onSelectionChange(state: ToolbarState): void;
  onMathEdit(request: MathEditRequest): void;
}
```

- [ ] **Step 1: Write failing controller tests**

Use a small fake `EditorHandle` to verify command routing and mode state without mocking Tiptap internals:

```ts
it("keeps one editor handle across edit/view toggles", async () => {
  const controller = createEditorController(loadOnce);
  await controller.enterEdit(element);
  controller.enterView();
  await controller.enterEdit(element);
  expect(loadOnce).toHaveBeenCalledTimes(1);
  expect(handle.setEditable).toHaveBeenNthCalledWith(1, true);
  expect(handle.setEditable).toHaveBeenNthCalledWith(2, false);
  expect(handle.setEditable).toHaveBeenNthCalledWith(3, true);
});

it("leaves static content intact when loading fails", async () => {
  const controller = createEditorController(async () => {
    throw new Error("offline");
  });
  await expect(controller.enterEdit(element)).rejects.toThrow("offline");
  expect(element.innerHTML).toBe(originalHtml);
});
```

- [ ] **Step 2: Run controller tests and verify RED**

Run: `pnpm test src/components/editor/editor-controller.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the isolated Tiptap runtime**

`editor-runtime.ts` is the only Qwik-reachable module with static Tiptap runtime imports. It creates a vanilla `Editor`, sets `injectCSS: false`, starts editable, exposes the `EditorHandle`, and serializes Markdown on updates. Add syntax-highlighted code blocks using the existing highlight.js theme. Math node activation reports a `MathEditRequest`; it never calls `prompt()`.

- [ ] **Step 4: Implement the lazy controller and Qwik controls**

The Qwik click QRL must call a dynamic import:

```ts
const { mountArticleEditor } = await import("./editor-runtime");
```

Keep the returned handle behind `noSerialize()`. Do not use `useVisibleTask$`. Only clear the static mount immediately before synchronously mounting a successfully loaded runtime. Use a fixed toggle, fixed toolbar, fixed loading/error status, and `aria-pressed`/`aria-live`.

Category/title/subtitle toggle the existing element's `contenteditable` state. Date activation opens a fixed `<input type="date">`; accepted changes update the Japanese date and derived footer. Ending edit mode removes metadata tab stops and stores `handle.getMarkdown()` only in memory.

- [ ] **Step 5: Run controller and all unit tests**

Run:

```bash
pnpm test src/components/editor/editor-controller.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit the interactive slice**

```bash
git add src/components/editor src/components/blog/blog.css
git commit -m "feat(editor): add lazy in-place editing controls"
```

### Task 5: Math popover, specialist controls, and browser acceptance

**Files:**

- Create: `src/components/editor/math-dialog.tsx`
- Create: `src/components/editor/math-dialog.test.ts`
- Create: `playwright.config.ts`
- Create: `tests/editor.spec.ts`
- Modify: `src/components/editor/article-shell.tsx`
- Modify: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/components/editor/editor-runtime.ts`
- Modify: `src/components/blog/blog.css`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `MathEditRequest`, `EditorHandle`, layout landmarks.
- Produces: accessible LaTeX dialog and end-to-end acceptance coverage.

- [ ] **Step 1: Write failing math state tests**

Test that opening copies the selected LaTeX, cancel preserves the original, apply returns the edited value, and Escape cancels. Validate using KaTeX with `throwOnError: true` while preserving invalid source text for correction.

- [ ] **Step 2: Run the math test and verify RED**

Run: `pnpm test src/components/editor/math-dialog.test.ts`

Expected: FAIL because the dialog state helper does not exist.

- [ ] **Step 3: Implement the fixed math dialog**

Use `role="dialog"`, an accessible title, a controlled LaTeX input, live preview, local error text, apply/cancel buttons, Escape handling, focus trapping, and focus restoration. Applying calls the selected inline/block update command and closes only after the node accepts the new source.

- [ ] **Step 4: Install Playwright and write failing browser scenarios**

Run `pnpm add -D -E @playwright/test@1.63.0`, add `"test:e2e": "playwright test"`, and configure `webServer.command` as `pnpm dev` on an explicit test port.

The test must capture rounded and raw `getBoundingClientRect()` values for `[data-layout-key]` elements, click edit, wait for `[data-editor-ready]`, and assert exact equality. It must repeat after view/edit toggles. Additional scenarios must:

- create a new level-two heading and assert the next generated number;
- prove generated numbers are absent from `textContent` and editor Markdown;
- edit title/category/subtitle/date and observe derived footer output;
- use keyboard input rules for list, quote, code, and headings;
- create/edit inline and display math;
- exercise link, table, image, callout, details, undo, and redo;
- reload and assert the original article returns.

- [ ] **Step 5: Run browser tests and verify RED**

Run: `pnpm test:e2e`

Expected: at least one acceptance assertion fails before the remaining UI wiring is complete.

- [ ] **Step 6: Complete toolbar and specialist-node interactions**

Wire every required command to labelled controls. Use fixed popovers for link URL, image URL/alt/caption, table insertion, callout label, and details summary. Keep all overlays out of document flow. Fix only implementation/CSS until every browser scenario passes; do not weaken geometry assertions.

- [ ] **Step 7: Run browser and unit tests and verify GREEN**

Run:

```bash
pnpm test
pnpm test:e2e
```

Expected: all unit and browser tests pass.

- [ ] **Step 8: Commit the acceptance slice**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests src/components/editor src/components/blog/blog.css
git commit -m "feat(editor): complete Markdown and math editing"
```

### Task 6: Performance, production build, and visual verification

**Files:**

- Create: `scripts/check-editor-chunk.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

- Consumes: production `dist/build` manifest and emitted chunks.
- Produces: `pnpm check:editor-chunk` guard and documented demo behavior.

- [ ] **Step 1: Write the failing chunk-isolation check**

The script must locate the route's initial executable entry graph from the production manifest, recursively follow only static imports, and fail if any reachable file contains `@tiptap`, `prosemirror`, or `katex`. It must separately assert that a lazy chunk contains Tiptap/ProseMirror editor symbols so a false-negative empty integration cannot pass.

Add `"check:editor-chunk": "node scripts/check-editor-chunk.mjs"` and run it against the current build.

Expected: FAIL until the production build and manifest paths are handled.

- [ ] **Step 2: Complete the checker and document the demo**

Document the edit toggle, transient reload behavior, Markdown/math capabilities, and the deliberately deferred database/auth/upload work. Keep the existing project command documentation intact.

- [ ] **Step 3: Run the complete verification matrix**

Run:

```bash
pnpm generate:article
git diff --exit-code src/content/initial-article.generated.ts
pnpm check.fmt
pnpm check
pnpm build.types
pnpm test
pnpm build
pnpm check:editor-chunk
pnpm test:e2e
```

Expected: every command exits 0 with no new warnings.

- [ ] **Step 4: Perform visual smoke checks**

At desktop width `1440x1000` and mobile width `390x844`, capture reading mode, editing mode, the formatting dock, the date picker, and the math dialog. Verify no clipping, paper movement, overlapping controls, lost focus rings, or typography regressions. Confirm that the first-load Network panel does not request an editor runtime chunk before edit activation.

- [ ] **Step 5: Commit the verified feature**

```bash
git add package.json README.md scripts/check-editor-chunk.mjs
git commit -m "test(editor): verify lazy WYSIWYG delivery"
```
