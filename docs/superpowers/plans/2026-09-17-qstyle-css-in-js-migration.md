# qstyle CSS-in-JS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all application-owned CSS into qstyle-authored CSS-in-JS while preserving the blog and editor's rendered appearance.

**Architecture:** A module-local `ArticleStyleBoundary` component owns the large qstyle tagged-template and applies its `StyleHandle` in the same module through a `css` prop. `root.tsx` owns the small document/body style object, while KaTeX remains an external vendor CSS import.

**Tech Stack:** Qwik 2, qstyle 0.2, Vite Plus, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-17-qstyle-css-in-js-migration-design.md`

## Global Constraints

- Preserve the current generated article HTML, TipTap class contract, responsive rules, pseudo-elements, and edit-mode overlays.
- Keep `katex/dist/katex.min.css` as the only external CSS import.
- Do not change the qstyle compiler, cache model, hashing implementation, or existing `qstyle()` Vite plugin configuration.
- Define and consume every `StyleHandle` in the same module.
- Production qstyle diagnostics must remain fail-closed.
- Do not redesign the page or change editor behavior.

---

## File Structure

- Create `src/components/editor/article-styles.tsx`: owns the application design tokens, scoped descendant rules, and `ArticleStyleBoundary` component.
- Modify `src/root.tsx`: owns document/body CSS-in-JS and retains the KaTeX import.
- Modify `src/components/editor/article-shell.tsx`: wraps all article and editor UI in `ArticleStyleBoundary`.
- Modify `src/components/blog/blog.tsx`: removes legacy stylesheet injection.
- Modify `src/components/editor/article-shell.test.ts`: keeps generated-content assertions but removes stylesheet source inspection.
- Modify `src/components/editor/rendering-regressions.test.ts`: keeps editor renderer tests and moves visual CSS assertions to Playwright.
- Modify `src/components/blog/visual-texture-contract.test.ts`: keeps SVG grid assertions and moves texture appearance checks to Playwright.
- Create `tests/layout/qstyle-style-contract.spec.ts`: verifies qstyle delivery and representative computed styles in the real browser.
- Delete `src/components/blog/blog.css` and `src/global.css` after all application rules are represented in qstyle.
- Modify `README.md` and `vite.config.ts`: describe the CSS-in-JS layout and remove obsolete CSS-file references.

### Task 1: Establish the browser-visible qstyle contract

**Files:**
- Create: `tests/layout/qstyle-style-contract.spec.ts`
- Modify: `src/components/editor/article-shell.test.ts`
- Modify: `src/components/editor/rendering-regressions.test.ts`
- Modify: `src/components/blog/visual-texture-contract.test.ts`

**Interfaces:**
- Consumes: the existing page at `/`, current class names, and the existing Playwright web server.
- Produces: a browser contract requiring `[data-qstyle-boundary]`, a generated `q_` class, and preserved computed styles.

- [x] **Step 1: Add the failing qstyle delivery test**

Create `tests/layout/qstyle-style-contract.spec.ts` with a single representative contract:

```ts
import { expect, test } from "@playwright/test";

test("delivers application styles through qstyle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const boundary = page.locator("[data-qstyle-boundary]");
  await expect(boundary).toHaveClass(/(?:^|\s)q_[a-z0-9]+(?:\s|$)/);

  const contract = await page.evaluate(() => {
    const style = (selector: string, pseudo?: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element, pseudo);
    };
    const paper = style('[data-layout-key="paper"]');
    const article = style('[data-layout-key="article"]');
    const table = style(".article-content table");
    const sectionNumber = style(".article-content > .tiptap > h2", "::before");
    const ink = style(".ink");
    const texture = style(".paper-texture");
    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      paperBackground: paper.backgroundColor,
      articleFontSize: article.fontSize,
      articleLineHeight: article.lineHeight,
      tableBorderTopWidth: table.borderTopWidth,
      sectionNumberContent: sectionNumber.content,
      inkTileCount: (ink.backgroundImage.match(/url\(/g) ?? []).length,
      textureHasEmbeddedSvg: texture.backgroundImage.includes("data:image/svg+xml"),
    };
  });

  expect(contract).toEqual({
    bodyBackground: "rgb(222, 216, 202)",
    paperBackground: "rgb(242, 234, 213)",
    articleFontSize: "15px",
    articleLineHeight: "19.5px",
    tableBorderTopWidth: "1px",
    sectionNumberContent: '"第一節"',
    inkTileCount: 2,
    textureHasEmbeddedSvg: true,
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec playwright test tests/layout/qstyle-style-contract.spec.ts
```

Expected: FAIL because `[data-qstyle-boundary]` does not exist. The computed-style assertions describe already-supported appearance and must not be the reason for this initial failure.

- [x] **Step 3: Capture temporary before screenshots**

Start the configured dev server, then capture the unchanged page at both target sizes:

```bash
pnpm dev --host 127.0.0.1 --port 4173 --strictPort
pnpm exec playwright screenshot --viewport-size=1280,900 http://127.0.0.1:4173/ .cache/qstyle-before-desktop.png
pnpm exec playwright screenshot --viewport-size=390,844 http://127.0.0.1:4173/ .cache/qstyle-before-mobile.png
```

Keep these files untracked under `.cache`; they are verification evidence, not repository artifacts.

- [x] **Step 4: Replace stylesheet source assertions with observable contracts**

In `article-shell.test.ts`, retain the generated-HTML assertions and remove only the `readFileSync(...blog.css)` and `content:` regex assertion. In `rendering-regressions.test.ts`, remove the four cases that parse CSS for table borders, code-control visibility, node-selection selectors, and selection colors; add equivalent browser checks to `qstyle-style-contract.spec.ts` after entering edit mode. In `visual-texture-contract.test.ts`, retain the SVG grid test and remove CSS source parsing; the qstyle browser contract above owns the texture assertions.

- [x] **Step 5: Run unit tests to keep the test refactor green**

Run:

```bash
pnpm test
```

Expected: PASS. The focused Playwright contract remains red only because the qstyle boundary is not implemented.

- [x] **Step 6: Commit the regression contract**

```bash
git add tests/layout/qstyle-style-contract.spec.ts src/components/editor/article-shell.test.ts src/components/editor/rendering-regressions.test.ts src/components/blog/visual-texture-contract.test.ts
git commit -m "test: define qstyle style delivery contract"
```

### Task 2: Move application styles into module-local qstyle

**Files:**
- Create: `src/components/editor/article-styles.tsx`
- Modify: `src/root.tsx`
- Modify: `src/components/editor/article-shell.tsx`
- Modify: `src/components/blog/blog.tsx`
- Delete: `src/components/blog/blog.css`
- Delete: `src/global.css`

**Interfaces:**
- Consumes: all declarations and selector order from `blog.css` plus the `css` prop augmentation in `src/qstyle.d.ts`.
- Produces: `ArticleStyleBoundary`, a Qwik component with no layout box and `data-qstyle-boundary` on its root element.

- [ ] **Step 1: Add document-level body CSS-in-JS**

Remove `import "./global.css"` from `root.tsx`, retain the KaTeX import, and apply the document declarations directly:

```tsx
<body
  css={{
    minHeight: "100%",
    margin: 0,
    color: "#352f25",
    fontFamily:
      '"Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", "DejaVu Serif", Georgia, "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "Noto Serif CJK JP", serif',
    fontKerning: "normal",
    fontSynthesis: "none",
    textAutospace: "normal",
    background: "#ded8ca",
    "&::selection, & ::selection": {
      color: "#352f25",
      background: "rgb(135 89 79 / 28%)",
    },
    "@media (max-width: 600px)": { background: "#f2ead5" },
  }}
>
```

- [ ] **Step 2: Create the module-local style boundary**

Create `article-styles.tsx` with the handle and its use co-located:

```tsx
import { Slot, component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

const articleShellStyles = css`
  display: contents;
  --paper: #f2ead5;
`;

export const ArticleStyleBoundary = component$(() => (
  <div css={articleShellStyles} data-qstyle-boundary>
    <Slot />
  </div>
));
```

Populate the template by moving all `:root` declarations to the tagged-template root, then add `display: contents`. Omit the moved `html`, `html, body`, `body`, and `::selection` blocks. Prefix every remaining selector list with `& ` so it is scoped to the boundary; inside `@media` and `@supports`, apply the same `& ` prefix to each nested selector list. Omit the mobile `html, body` block moved to `root.tsx`. Preserve every declaration, comment, selector-list member, value, data URL, and source-order relationship byte-for-byte otherwise. The first scoped rule after the custom properties is exactly:

```css
& * {
  box-sizing: border-box;
}
```

The final responsive rule remains exactly:

```css
@media (max-width: 600px) {
  & .math-block {
    margin-inline: -4px;
  }
}
```

- [ ] **Step 3: Apply the boundary around the complete shell**

Import the boundary into `article-shell.tsx`:

```tsx
import { ArticleStyleBoundary } from "./article-styles";
```

Change the opening return fragment from `<>` to `<ArticleStyleBoundary>` and its matching closing `</>` to `</ArticleStyleBoundary>`. Do not alter the children or their order. The wrapper must enclose `BlogPaper`, the editor error, editor dock, and math dialog so each stays in the scoped selector tree.

The wrapper must enclose every existing sibling so fixed editor UI and dialogs remain in the scoped selector tree.

- [ ] **Step 4: Remove legacy stylesheet injection and files**

In `blog.tsx`, remove `useStyles$`, the `blog.css?inline` import, and the `useStyles$(blogCss)` call. Update the file comment to say the components rely on the qstyle boundary. Delete `blog.css` and the empty `global.css`.

- [ ] **Step 5: Run the focused browser test and verify GREEN**

Run:

```bash
pnpm exec playwright test tests/layout/qstyle-style-contract.spec.ts
```

Expected: PASS with a generated `q_` class and every computed-style value equal to the pre-migration contract.

- [ ] **Step 6: Run the production qstyle compiler path**

Run:

```bash
pnpm build
```

Expected: PASS with no qstyle residual diagnostic. Inspect `dist/` for a content-hashed CSS asset and confirm no `blog.css` or `global.css` import remains in application source.

- [ ] **Step 7: Commit the migration**

```bash
git add src/root.tsx src/components/editor/article-styles.tsx src/components/editor/article-shell.tsx src/components/blog/blog.tsx src/components/blog/blog.css src/global.css
git commit -m "refactor: migrate application styles to qstyle"
```

### Task 3: Verify parity and update documentation

**Files:**
- Modify: `README.md`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: the completed qstyle boundary and temporary before screenshots.
- Produces: current project documentation and fresh evidence that the CSS-in-JS migration preserves appearance.

- [ ] **Step 1: Update project documentation**

Change the project tree in `README.md` to list `src/components/editor/article-styles.tsx` instead of `src/global.css`. State that application styles are a module-local qstyle tagged template and KaTeX is the only vendor CSS import. Remove the obsolete `blog.css` formatter-ignore entry and comment from `vite.config.ts`.

- [ ] **Step 2: Capture after screenshots and compare exact pixels**

With the same dev command and browser version used for the before images, run:

```bash
pnpm exec playwright screenshot --viewport-size=1280,900 http://127.0.0.1:4173/ .cache/qstyle-after-desktop.png
pnpm exec playwright screenshot --viewport-size=390,844 http://127.0.0.1:4173/ .cache/qstyle-after-mobile.png
cmp .cache/qstyle-before-desktop.png .cache/qstyle-after-desktop.png
cmp .cache/qstyle-before-mobile.png .cache/qstyle-after-mobile.png
```

Expected: both `cmp` commands exit 0. If a comparison differs, inspect the two images and resolve the first computed-style or layout difference before continuing.

- [ ] **Step 3: Smoke-test development HMR**

While `pnpm dev` is running, make a temporary change to one harmless static value in `articleShellStyles`, confirm the open page receives the corresponding CSS update without a full reload error, then revert that temporary change before verification. Confirm the qstyle-generated class and route remain present.

- [ ] **Step 4: Run complete verification**

Run fresh commands:

```bash
pnpm test
pnpm exec playwright test tests/layout/qstyle-style-contract.spec.ts tests/layout/article-layout-parity.spec.ts
pnpm build.types
pnpm check
pnpm check.fmt
pnpm build
git diff --check
```

Expected: every command exits 0; the tests report zero failures; qstyle emits no residual or diagnostic; the production build emits hashed CSS.

- [ ] **Step 5: Commit documentation and verification-facing cleanup**

```bash
git add README.md vite.config.ts
git commit -m "docs: document qstyle style ownership"
```

- [ ] **Step 6: Review the final repository state**

Run:

```bash
git status --short
git log -4 --oneline
rg -n "blog\.css|global\.css|useStyles\$|\.css\?inline" src README.md vite.config.ts
```

Expected: a clean worktree; the last commits are the design, tests, migration, and docs commits; the search returns no application-owned CSS reference.
