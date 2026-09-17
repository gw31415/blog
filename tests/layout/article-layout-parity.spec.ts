import { expect, test, type Page } from "@playwright/test";

// Chromium exposes native find-in-page beyond the standard DOM typings.
declare global {
  interface Window {
    find(text: string): boolean;
  }
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArticleLayoutSnapshot {
  elements: Record<string, LayoutRect>;
  lines: Record<string, LayoutRect[]>;
}

function detailBodyKeys(snapshot: ArticleLayoutSnapshot): string[] {
  return Object.keys(snapshot.elements).filter((key) =>
    key.includes("details[article-node=details] > div"),
  );
}

interface CodeLanguageControlRects {
  control: LayoutRect;
  label: LayoutRect;
  select: LayoutRect;
}

const EXCLUDED_LAYOUT =
  ".mode-switch, .editor-dock, .editor-error, .math-dialog, [data-editor-overlay], details:not([open]) > :not(summary:first-of-type)";

export async function captureArticleLayout(page: Page): Promise<ArticleLayoutSnapshot> {
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate((excludedLayout) => {
    const elements: Record<string, LayoutRect> = {};
    const lines: Record<string, LayoutRect[]> = {};

    // Closed details bodies have no visible layout. Their cached browser rectangles
    // are not stable; keep native find-in-page behavior and measure them when open.
    const isExcluded = (element: Element) =>
      element.matches(excludedLayout) || !!element.closest(excludedLayout);

    // Browser-evaluated helpers stay inside this callback so Playwright can serialize them.
    // oxlint-disable-next-line unicorn/consistent-function-scoping
    const segmentFor = (element: Element): string => {
      if (element instanceof HTMLElement) {
        if (element.dataset.layoutKey)
          return `${element.tagName.toLowerCase()}[layout=${element.dataset.layoutKey}]`;
        if (element.dataset.articleField)
          return `${element.tagName.toLowerCase()}[field=${element.dataset.articleField}]`;
        if (element.hasAttribute("data-editor-mount"))
          return `${element.tagName.toLowerCase()}[editor-mount]`;
        if (element.dataset.articleNode)
          return `${element.tagName.toLowerCase()}[article-node=${element.dataset.articleNode}]`;
      }

      const tagName = element.tagName.toLowerCase();
      const siblings = element.parentElement
        ? [...element.parentElement.children].filter(
            (sibling) => sibling.tagName === element.tagName,
          )
        : [element];
      return `${tagName}:nth-of-type(${siblings.indexOf(element) + 1})`;
    };

    const elementPath = (element: Element): string => {
      const segments: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement) {
        segments.unshift(segmentFor(current));
        current = current.parentElement;
      }
      return segments.join(" > ");
    };

    // oxlint-disable-next-line unicorn/consistent-function-scoping
    const copyRect = (rect: DOMRect | DOMRectReadOnly): LayoutRect => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });

    const measuredElements = [
      ...document.querySelectorAll(
        '[data-layout-key], [data-article-field], [data-editor-mount] *, [data-layout-key="footer"] *',
      ),
    ].filter((element) => !isExcluded(element));

    // ES2022 is the project target, so copy before using the mutating sorter.
    // oxlint-disable-next-line unicorn/no-array-sort
    const sortedElements = measuredElements.sort((left, right) =>
      elementPath(left).localeCompare(elementPath(right)),
    );
    for (const element of sortedElements) {
      elements[elementPath(element)] = copyRect(element.getBoundingClientRect());
    }

    const textRootSelector =
      '[data-layout-key="header"], [data-editor-mount], [data-layout-key="footer"]';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (true) {
      const textNode = walker.nextNode();
      if (!textNode) break;
      if (!(textNode instanceof Text)) continue;

      const parent = textNode.parentElement;
      if (
        !parent ||
        !textNode.textContent ||
        isExcluded(parent) ||
        !parent.closest(textRootSelector)
      ) {
        continue;
      }

      const siblingIndex = [...parent.childNodes]
        .filter((sibling) => sibling.nodeType === Node.TEXT_NODE)
        .indexOf(textNode);
      const key = `${elementPath(parent)} > #text:nth-of-type(${siblingIndex + 1})`;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      lines[key] = [...range.getClientRects()].map(copyRect);
    }

    return { elements, lines };
  }, EXCLUDED_LAYOUT);
}

async function captureCodeLanguageControlRects(page: Page): Promise<CodeLanguageControlRects[]> {
  return page.locator(".code-language-control").evaluateAll((controls) =>
    controls.map((control) => {
      const label = control.querySelector<HTMLElement>(".code-language-label");
      const select = control.querySelector<HTMLElement>(".code-language-select");
      if (!label || !select) throw new Error("Code-language control contract is incomplete");

      // Browser-evaluated helper stays inside this callback so Playwright can serialize it.
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      const copyRect = (rect: DOMRect): LayoutRect => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      return {
        control: copyRect(control.getBoundingClientRect()),
        label: copyRect(label.getBoundingClientRect()),
        select: copyRect(select.getBoundingClientRect()),
      };
    }),
  );
}

function expectCodeLanguageControlRectsEqual(controls: CodeLanguageControlRects[]): void {
  expect(controls.length).toBeGreaterThan(0);
  for (const { control, label, select } of controls) {
    expect(label).toStrictEqual(control);
    expect(select).toStrictEqual(control);
  }
}

function firstDifferingKey(
  before: ArticleLayoutSnapshot,
  after: ArticleLayoutSnapshot,
): { group: keyof ArticleLayoutSnapshot; key: string } | undefined {
  for (const group of ["elements", "lines"] as const) {
    const keys = new Set([...Object.keys(before[group]), ...Object.keys(after[group])]);
    // oxlint-disable-next-line unicorn/no-array-sort
    const sortedKeys = [...keys].sort((left, right) => {
      const depthDifference = right.split(" > ").length - left.split(" > ").length;
      return depthDifference || left.localeCompare(right);
    });
    const dimensionDifference = sortedKeys.find((key) => {
      if (group !== "elements") return false;
      const beforeRect = before.elements[key];
      const afterRect = after.elements[key];
      return (
        !beforeRect ||
        !afterRect ||
        beforeRect.width !== afterRect.width ||
        beforeRect.height !== afterRect.height
      );
    });
    if (dimensionDifference) return { group, key: dimensionDifference };

    for (const key of sortedKeys) {
      if (JSON.stringify(before[group][key]) !== JSON.stringify(after[group][key])) {
        return { group, key };
      }
    }
  }
  return undefined;
}

export function expectLayoutEqual(
  before: ArticleLayoutSnapshot,
  after: ArticleLayoutSnapshot,
): void {
  const firstDifference = firstDifferingKey(before, after);
  if (firstDifference) {
    const { group, key } = firstDifference;
    expect(after[group][key], `First differing layout key: ${group}.${key}`).toStrictEqual(
      before[group][key],
    );
  }
  expect(after).toStrictEqual(before);
}

async function waitForEditShell(page: Page): Promise<void> {
  await expect(page.locator('[data-editor-mode="edit"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "編集" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-article-field="title"]')).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(page.getByLabel("公開日")).toBeAttached();
  await expect(page.getByRole("complementary", { name: "記事編集ツール" })).toBeVisible();
}

async function waitForViewShell(page: Page): Promise<void> {
  await expect(page.locator('[data-editor-mode="view"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "閲覧" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "編集" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("公開日")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "記事編集ツール" })).toHaveCount(0);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`keeps view and edit article layout identical on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.locator("[data-editor-mount]")).toBeVisible();

    const initialView = await captureArticleLayout(page);
    const initialCodeControls = await captureCodeLanguageControlRects(page);

    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    const edit = await captureArticleLayout(page);
    const editCodeControls = await captureCodeLanguageControlRects(page);

    await page.getByRole("button", { name: "閲覧" }).click();
    await waitForViewShell(page);
    const finalView = await captureArticleLayout(page);
    const finalCodeControls = await captureCodeLanguageControlRects(page);

    expectCodeLanguageControlRectsEqual(initialCodeControls);
    expectCodeLanguageControlRectsEqual(editCodeControls);
    expectCodeLanguageControlRectsEqual(finalCodeControls);
    expectLayoutEqual(initialView, edit);
    expectLayoutEqual(initialView, finalView);
  });

  test(`table handle menus preserve geometry and support keyboard on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    const table = page.locator(".ProseMirror table").first();
    await table.scrollIntoViewIfNeeded();
    if (viewport.name === "mobile") {
      const bounds = await page.locator('button[data-table-axis="row"]').evaluateAll((handles) =>
        handles.map((handle) => {
          const rect = handle.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      );
      expect(bounds.length).toBeGreaterThan(0);
      for (const rect of bounds) {
        expect({ x: rect.x, width: rect.width, height: rect.height }).toEqual({
          x: 4,
          width: 24,
          height: 24,
        });
        // The 2px focus outline and 2px offset also fit, with no clipped hit area.
        expect(rect.x - 4).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width + 4).toBeLessThanOrEqual(viewport.width);
        expect(rect.y - 4).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height + 4).toBeLessThanOrEqual(viewport.height);
      }
    }
    const before = await captureArticleLayout(page);
    for (const axis of ["row", "column"] as const) {
      const handle = page
        .locator(`button[data-table-axis="${axis}"][data-table-index="1"]`)
        .first();
      await handle.focus();
      await handle.press(axis === "row" ? "Enter" : "Space");
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: axis === "row" ? "上へ追加" : "左へ追加" }),
      ).toBeFocused();
      expectLayoutEqual(before, await captureArticleLayout(page));
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(handle).toBeFocused();
      await handle.click();
      await page.locator(".ProseMirror th").first().click();
      await expect(menu).toHaveCount(0);
    }
    await page.getByRole("button", { name: "閲覧" }).click();
    await waitForViewShell(page);
    await expect(page.locator('[data-editor-overlay="table-controls"]')).toBeHidden();
  });
}

test("table contextual actions target their row and column and protect the last axis", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  const table = page.locator(".ProseMirror table").first();
  await table.scrollIntoViewIfNeeded();
  const rows = table.locator("tr");
  const initialRows = await rows.count();
  const original = await rows.nth(1).textContent();
  await page.getByRole("button", { name: "2行目の操作", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "行を複製", exact: true }).click();
  await expect(rows).toHaveCount(initialRows + 1);
  await expect(rows.nth(2)).toHaveText(original!);
  await page.getByRole("button", { name: "3行目の操作", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "行を削除", exact: true }).click();
  await expect(rows).toHaveCount(initialRows);
  const initialColumns = await rows.first().locator("th,td").count();
  await page.getByRole("button", { name: "2列目の操作", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "右へ追加", exact: true }).click();
  await expect(rows.first().locator("th,td")).toHaveCount(initialColumns + 1);
  await expect(rows.nth(1).locator("th,td").nth(2)).toHaveText("");
  await page.getByRole("button", { name: "3列目の操作", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "列を削除", exact: true }).click();
  await expect(rows.first().locator("th,td")).toHaveCount(initialColumns);
  for (const axis of ["row", "column"] as const) {
    const handles = page.locator(`button[data-table-axis="${axis}"]`);
    while ((await handles.count()) > 1) {
      await handles.last().click();
      await page
        .getByRole("menuitem", { name: axis === "row" ? "行を削除" : "列を削除", exact: true })
        .click();
    }
    await handles.first().click();
    await expect(
      page.getByRole("menuitem", { name: axis === "row" ? "行を削除" : "列を削除", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
  }
  await expect(table.locator("tr")).toHaveCount(1);
  await expect(table.locator("th,td")).toHaveCount(1);
});

test("opens the selected row menu with a touchscreen tap", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).tap();
    await waitForEditShell(page);
    await page.locator(".ProseMirror table").first().scrollIntoViewIfNeeded();
    const handle = page.getByRole("button", { name: "2行目の操作", exact: true }).first();
    const before = await captureArticleLayout(page);
    await handle.tap();
    await expect(page.getByRole("menu", { name: "2行目の操作", exact: true })).toBeVisible();
    expectLayoutEqual(before, await captureArticleLayout(page));
    await page.getByRole("menuitem", { name: "下へ追加", exact: true }).tap();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator(".ProseMirror table tr").nth(2)).toHaveText("");
  } finally {
    await context.close();
  }
});

test("closed details remain browser-searchable and snapshots omit only hidden descendants", async ({
  page,
}) => {
  await page.goto("/");
  const details = page.locator("details").first();
  await expect(details).not.toHaveAttribute("open");
  const hiddenText = (await details.locator(".details-body").textContent())!.trim();
  expect(await page.evaluate((text) => window.find(text), hiddenText)).toBe(true);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.evaluate(() => document.querySelector("details")?.removeAttribute("open"));
  await page.evaluate(() => window.scrollTo(0, 0));
  const initial = await captureArticleLayout(page);
  expect(detailBodyKeys(initial)).toEqual([]);
  expect(
    Object.keys(initial.lines).some((key) => key.includes("details[article-node=details] > div")),
  ).toBe(false);
  expect(
    Object.keys(initial.elements).some((key) =>
      key.endsWith("details[article-node=details] > summary:nth-of-type(1)"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  expectLayoutEqual(initial, await captureArticleLayout(page));
  await page.getByRole("button", { name: "閲覧" }).click();
  await waitForViewShell(page);
  expectLayoutEqual(initial, await captureArticleLayout(page));
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  const open = await captureArticleLayout(page);
  expect(detailBodyKeys(open).length).toBeGreaterThan(0);
  expect(
    Object.keys(open.lines).some((key) => key.includes("details[article-node=details] > div")),
  ).toBe(true);
});

test("round-trips a shared code block through clipboard HTML", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);

  const codeBlocks = page.locator(".ProseMirror pre.code-block");
  const originalCount = await codeBlocks.count();
  const original = codeBlocks.first();
  const originalCode = await original.locator(":scope > code").textContent();
  const originalHTML = await original.evaluate((element) => element.outerHTML);

  const editorRoot = page.locator(".ProseMirror");
  await editorRoot.click();
  await page.keyboard.press("Control+End");
  await editorRoot.evaluate((editorElement, html) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", html);
    clipboardData.setData("text/plain", "clipboard fallback must not win");
    editorElement.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  }, originalHTML);

  await expect(codeBlocks).toHaveCount(originalCount + 1);
  const codeBlockSnapshots = await codeBlocks.evaluateAll((blocks) =>
    blocks.map((block) => ({
      language: block.getAttribute("data-code-language"),
      code: block.querySelector(":scope > code")?.textContent,
      nestedControlCount: block.querySelectorAll(":scope > code .code-language-control").length,
    })),
  );
  const matchingCodeBlocks = codeBlockSnapshots.filter(({ code }) => code === originalCode);
  expect(matchingCodeBlocks, JSON.stringify(codeBlockSnapshots, null, 2)).toEqual([
    { language: "html", code: originalCode, nestedControlCount: 0 },
    { language: "html", code: originalCode, nestedControlCount: 0 },
  ]);
});

test("pastes a bare pre element as plaintext without crashing", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);

  const editorRoot = page.locator(".ProseMirror");
  const codeBlocks = editorRoot.locator("pre.code-block");
  const originalCount = await codeBlocks.count();
  await editorRoot.click();
  await page.keyboard.press("Control+End");
  await editorRoot.evaluate((editorElement) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", "<pre>const b = 2;</pre>");
    clipboardData.setData("text/plain", "clipboard fallback must not win");
    editorElement.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  });

  await expect(codeBlocks).toHaveCount(originalCount + 1);
  const pastedBarePreBlocks = await codeBlocks.evaluateAll((blocks) =>
    blocks
      .map((block) => ({
        language: block.getAttribute("data-code-language"),
        code: block.querySelector(":scope > code")?.textContent,
      }))
      .filter(({ code }) => code === "const b = 2;"),
  );
  expect(pastedBarePreBlocks).toEqual([{ language: "plaintext", code: "const b = 2;" }]);
  expect(pageErrors).toEqual([]);
});
