import { expect, test, type Page } from "@playwright/test";
import { getSchema, type Editor } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";
import { createEditorExtensions } from "../../src/components/editor/editor-extensions";

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

test("presents the mode switch as accessible paper-and-pencil symbols", async ({ page }) => {
  await page.goto("/");

  const viewButton = page.getByRole("button", { name: "閲覧モード", exact: true });
  const editButton = page.getByRole("button", { name: "編集モード", exact: true });

  await expect(viewButton).toHaveAttribute("title", "閲覧モード");
  await expect(editButton).toHaveAttribute("title", "編集モード");
  await expect(viewButton.locator('[data-mode-symbol="paper"]')).toBeVisible();
  await expect(editButton.locator('[data-mode-symbol="paper-pencil"]')).toBeVisible();
  await expect(viewButton).toHaveText("");
  await expect(editButton).toHaveText("");
});

test("shows a graphite loading mark while the editor starts", async ({ page }) => {
  let releaseEditor: (() => void) | undefined;
  await page.route(/editor-runtime/, async (route) => {
    await new Promise<void>((resolve) => {
      releaseEditor = resolve;
    });
    await route.continue();
  });
  await page.goto("/");

  const editButton = page.locator(".edit-toggle");
  const click = editButton.click();
  await expect(editButton).toHaveAttribute("aria-busy", "true");
  await expect(editButton.locator('[data-mode-symbol="graphite-loading"]')).toBeVisible();
  await expect(editButton).toHaveText("");

  releaseEditor?.();
  await click;
  await waitForEditShell(page);
});

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

  test(`preserves open details layout across the first editor mount on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    const details = page.locator("[data-editor-mount] details").first();
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await page.evaluate(() => window.scrollTo(0, 0));
    const initial = await captureArticleLayout(page);
    expect(detailBodyKeys(initial).length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    await expect(details).toHaveAttribute("open", "");
    expectLayoutEqual(initial, await captureArticleLayout(page));
    await page.getByRole("button", { name: "閲覧" }).click();
    await waitForViewShell(page);
    expectLayoutEqual(initial, await captureArticleLayout(page));

    await details.locator("summary").click();
    await expect(details).not.toHaveAttribute("open");
    await page.evaluate(() => window.scrollTo(0, 0));
    const closed = await captureArticleLayout(page);
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    expectLayoutEqual(closed, await captureArticleLayout(page));
  });

  test(`keeps header editing available after a math dialog and mode round-trip on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    const math = page.locator('[data-type="block-math"]').first();
    await math.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await page.getByRole("button", { name: "閲覧" }).click();
    await waitForViewShell(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const view = await captureArticleLayout(page);
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    expectLayoutEqual(view, await captureArticleLayout(page));
  });

  test(`returns keyboard focus to the nearest handle after deleting the last item on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    await page.locator(".ProseMirror table").first().scrollIntoViewIfNeeded();
    for (const axis of ["row", "column"] as const) {
      const handles = page.locator(`button[data-table-axis="${axis}"]`);
      const count = await handles.count();
      await handles.last().press("Enter");
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await expect(
        page.getByRole("menuitem", { name: axis === "row" ? "行を削除" : "列を削除", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(handles).toHaveCount(count - 1);
      await expect(handles.last()).toBeFocused();
      await handles.last().press("Enter");
      await expect(page.getByRole("menu")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(handles.last()).toBeFocused();
    }
  });
}

test("scrolls a wide mobile table to the last column and operates its visible handle without layout shifts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page
      .locator(".tableWrapper")
      .first()
      .evaluate((el) => getComputedStyle(el).overflowX),
  ).toBe("auto");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  const editor = page.locator(".ProseMirror");
  await editor.locator("p").first().click();
  await page.keyboard.press("Control+End");
  await editor.evaluate((element) => {
    const clipboardData = new DataTransfer();
    const headers = Array.from({ length: 12 }, (_, i) => `<th><p>Column${i + 1}</p></th>`).join("");
    const cells = Array.from({ length: 12 }, (_, i) => `<td><p>Value${i + 1}</p></td>`).join("");
    clipboardData.setData("text/html", `<table><tr>${headers}</tr><tr>${cells}</tr></table>`);
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
    );
  });
  const table = editor.locator("table").filter({ hasText: "Column12" });
  const wrapper = table.locator("..");
  await table.scrollIntoViewIfNeeded();
  expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await wrapper.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const last = page.getByRole("button", { name: "12列目の操作", exact: true });
  await expect(last).toBeHidden();
  const flow = await page
    .locator('[data-layout-key="paper"], [data-layout-key="footer"], .tableWrapper')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
  await wrapper.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(last).toBeVisible();
  const rect = (await last.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator('[data-layout-key="paper"], [data-layout-key="footer"], .tableWrapper')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      ),
  ).toEqual(flow);
  const before = await captureArticleLayout(page);
  await last.click();
  const menu = page.getByRole("menu", { name: "12列目の操作", exact: true });
  await expect(menu).toBeVisible();
  expectLayoutEqual(before, await captureArticleLayout(page));
  const cellBeforeScroll = (await table
    .locator("tr")
    .first()
    .locator("th,td")
    .last()
    .boundingBox())!;
  await wrapper.evaluate((el) => {
    el.scrollLeft -= 16;
  });
  await expect
    .poll(async () => {
      const cell = (await table.locator("tr").first().locator("th,td").last().boundingBox())!;
      const handle = (await last.boundingBox())!;
      return [handle.x - rect.x, cell.x - cellBeforeScroll.x];
    })
    .toEqual([16, 16]);
  const anchor = (await last.boundingBox())!;
  const menuRect = (await menu.boundingBox())!;
  expect(menuRect.x).toBe(Math.max(4, Math.min(anchor.x, 390 - menuRect.width - 4)));
  await page.getByRole("menuitem", { name: "列を複製", exact: true }).click();
  await expect(table.locator("tr").first().locator("th,td")).toHaveCount(13);
  await expect(table.locator("tr").first().locator("th,td").last()).toHaveText("Column12");
  await wrapper.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  const after = await captureArticleLayout(page);
  await page.getByRole("button", { name: "閲覧" }).click();
  await waitForViewShell(page);
  expectLayoutEqual(after, await captureArticleLayout(page));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

for (const direction of ["left", "right"] as const) {
  test(`reveals and focuses an offscreen column after moving ${direction} by keyboard on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).click();
    await waitForEditShell(page);
    const editor = page.locator(".ProseMirror");
    await editor.locator("p").first().click();
    await editor.evaluate((element) => {
      const clipboardData = new DataTransfer();
      const cells = Array.from({ length: 12 }, (_, i) => `<td><p>Column${i + 1}</p></td>`).join("");
      clipboardData.setData("text/html", `<table><tr>${cells}</tr></table>`);
      element.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
      );
    });
    const table = editor.locator("table").filter({ hasText: "Column12" });
    const wrapper = table.locator("..");
    await table.scrollIntoViewIfNeeded();
    await wrapper.evaluate((element, side) => {
      const cell = element.querySelectorAll("td")[5].getBoundingClientRect();
      const clip = element.getBoundingClientRect();
      element.scrollLeft +=
        side === "left" ? Math.ceil(cell.left - clip.left) : Math.floor(cell.right - clip.right);
    }, direction);
    const source = page.getByRole("button", { name: "6列目の操作", exact: true });
    const destinationIndex = direction === "left" ? 4 : 6;
    const destination = page.getByRole("button", {
      name: `${destinationIndex + 1}列目の操作`,
      exact: true,
    });
    await expect(source).toBeVisible();
    await expect(destination).toBeHidden();
    const initialScroll = await wrapper.evaluate((element) => element.scrollLeft);
    const before = await captureArticleLayout(page);
    await source.press("Enter");
    await page.keyboard.press("End");
    if (direction === "left") await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("menuitem", {
        name: direction === "left" ? "左へ移動" : "右へ移動",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(table.locator("td").nth(destinationIndex)).toHaveText("Column6");
    await expect(destination).toBeFocused();
    await expect(destination).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    const finalScroll = await wrapper.evaluate((element) => element.scrollLeft);
    expect(direction === "left" ? finalScroll < initialScroll : finalScroll > initialScroll).toBe(
      true,
    );
    const cell = (await table.locator("td").nth(destinationIndex).boundingBox())!;
    const clip = (await wrapper.boundingBox())!;
    expect(cell.x).toBeGreaterThanOrEqual(clip.x);
    expect(cell.x + cell.width).toBeLessThanOrEqual(clip.x + clip.width);
    const handle = (await destination.boundingBox())!;
    expect(handle.x).toBeGreaterThanOrEqual(0);
    expect(handle.x + handle.width).toBeLessThanOrEqual(390);
    const after = await captureArticleLayout(page);
    // Only the reordered/scrolled table internals intentionally change geometry.
    for (const kind of ["elements", "lines"] as const) {
      expect(
        Object.fromEntries(
          Object.entries(after[kind]).filter(([key]) => !key.includes(" > table:")),
        ),
      ).toEqual(
        Object.fromEntries(
          Object.entries(before[kind]).filter(([key]) => !key.includes(" > table:")),
        ),
      );
    }
    await destination.press("Enter");
    await expect(
      page.getByRole("menu", { name: `${destinationIndex + 1}列目の操作`, exact: true }),
    ).toBeVisible();
    expectLayoutEqual(after, await captureArticleLayout(page));
    await page.keyboard.press("Escape");
    await expect(destination).toBeFocused();
    await page.getByRole("button", { name: "閲覧" }).click();
    await waitForViewShell(page);
    expectLayoutEqual(after, await captureArticleLayout(page));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
}

test("keeps every structural menu action disabled for a valid merged table without document transactions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  const editor = page.locator(".ProseMirror");
  await editor.locator("p").first().click();
  await page.keyboard.press("Control+End");
  await editor.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData(
      "text/html",
      "<table><tr><td rowspan='2' colspan='2'>merged A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></table>",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
    );
  });
  const table = editor.locator("table").filter({ hasText: "merged A" });
  await table.scrollIntoViewIfNeeded();
  const original = await editor.evaluate((element: HTMLElement & { editor: Editor }) => {
    const instance = element.editor;
    element.dataset.testDocChanges = "0";
    instance.on("transaction", ({ transaction }) => {
      if (transaction.docChanged)
        element.dataset.testDocChanges = String(Number(element.dataset.testDocChanges) + 1);
    });
    return instance.getJSON();
  });
  const doc = getSchema(createEditorExtensions()).nodeFromJSON(original);
  let checked = false;
  doc.descendants((node) => {
    if (node.type.name === "table" && node.textContent.includes("merged A")) {
      expect(TableMap.get(node).problems).toBeNull();
      expect([TableMap.get(node).width, TableMap.get(node).height]).toEqual([3, 3]);
      checked = true;
      return false;
    }
    return true;
  });
  expect(checked).toBe(true);
  for (const axis of ["row", "column"] as const) {
    const handle = page
      .locator(`button[data-reorder-disabled="merged-cells"][data-table-axis="${axis}"]`)
      .first();
    await expect(handle).toHaveAttribute("aria-description", /結合セル/);
    await handle.press("Enter");
    await expect(page.getByRole("menuitem")).toHaveCount(6);
    for (const item of await page.getByRole("menuitem").all()) {
      await expect(item).toBeDisabled();
      await item.evaluate((element: HTMLButtonElement) => element.click());
    }
    await page.keyboard.press("Escape");
  }
  expect(
    await editor.evaluate((element: HTMLElement & { editor: Editor }) => element.editor.getJSON()),
  ).toEqual(original);
  await expect(editor).toHaveAttribute("data-test-doc-changes", "0");
});

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

for (const touch of [false, true]) {
  test(`reorders rows and columns by ${touch ? "touch hold on mobile" : "mouse drag on desktop"} and keyboard without overlay layout shifts`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      hasTouch: touch,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "編集" }).click();
      await waitForEditShell(page);
      const table = page.locator(".ProseMirror table").first();
      await table.scrollIntoViewIfNeeded();
      for (const axis of ["row", "column"] as const) {
        const from = axis === "row" ? 1 : 0;
        const to = from + 1;
        const handles = page.locator(`button[data-table-axis="${axis}"]`);
        const cells =
          axis === "row" ? table.locator("tr") : table.locator("tr").first().locator("th,td");
        const original = await cells.allTextContents();
        const handle = handles.nth(from);
        const start = (await handle.boundingBox())!;
        const target = (await cells.nth(to).boundingBox())!;
        const x = start.x + start.width / 2;
        const y = start.y + start.height / 2;
        const endX = axis === "column" ? target.x + target.width * 0.8 : x;
        const endY = axis === "row" ? target.y + target.height * 0.8 : y;
        const before = await captureArticleLayout(page);
        if (touch) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 4, y);
        }
        const ghost = page.locator('[data-editor-overlay="table-drag-ghost"]');
        await expect(ghost).toBeVisible();
        if (touch) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: endX, y: endY }],
          });
        } else {
          await page.mouse.move(endX, endY);
        }
        await expect(page.locator('[data-editor-overlay="table-drop-line"]')).toBeVisible();
        expect(await cells.allTextContents()).toEqual(original);
        expectLayoutEqual(before, await captureArticleLayout(page));
        const ghostRect = (await ghost.boundingBox())!;
        expect(ghostRect.x).toBeGreaterThanOrEqual(0);
        expect(ghostRect.x + ghostRect.width).toBeLessThanOrEqual(touch ? 390 : 1280);
        if (touch) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await page.mouse.up();
        }
        await expect(cells.nth(to)).toHaveText(original[from]);
        await expect(cells.nth(from)).toHaveText(original[to]);
        await expect(ghost).toHaveCount(0);
        await expect(page.getByRole("menu")).toHaveCount(0);
        await expect(handles.nth(to)).toBeFocused();
        const moved = await captureArticleLayout(page);
        await handles.nth(to).press("Enter");
        expectLayoutEqual(moved, await captureArticleLayout(page));
        await page.keyboard.press("End");
        await page.keyboard.press("ArrowUp");
        await expect(
          page.getByRole("menuitem", {
            name: axis === "row" ? "上へ移動" : "左へ移動",
            exact: true,
          }),
        ).toBeFocused();
        await page.keyboard.press("Enter");
        expect(await cells.allTextContents()).toEqual(original);
        await expect(handles.nth(from)).toBeFocused();
        await handles.first().press("Enter");
        await expect(
          page.getByRole("menuitem", {
            name: axis === "row" ? "上へ移動" : "左へ移動",
            exact: true,
          }),
        ).toBeDisabled();
        await page.keyboard.press("Escape");
        await handles.last().press("Enter");
        await expect(
          page.getByRole("menuitem", {
            name: axis === "row" ? "下へ移動" : "右へ移動",
            exact: true,
          }),
        ).toBeDisabled();
        await page.keyboard.press("Escape");
      }
    } finally {
      await context.close();
    }
  });
}

test("cancels an active table drag with Escape without mutation or a click menu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  const table = page.locator(".ProseMirror table").first();
  await table.scrollIntoViewIfNeeded();
  const original = await table.textContent();
  const handle = page.locator('button[data-table-axis="row"]').nth(1);
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 12, rect.y + 12);
  await page.mouse.down();
  await page.mouse.move(rect.x + 12, rect.y + 100);
  await expect(page.locator('[data-editor-overlay="table-drag-ghost"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator('[data-editor-overlay="table-drag-ghost"]')).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(handle).toBeFocused();
  expect(await table.textContent()).toBe(original);
});

test("touch movement before hold and native cancellation leave the table unchanged", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "編集" }).tap();
    await waitForEditShell(page);
    const table = page.locator(".ProseMirror table").first();
    await table.scrollIntoViewIfNeeded();
    const original = await table.textContent();
    const handle = page.locator('button[data-table-axis="row"]').nth(1);
    const rect = (await handle.boundingBox())!;
    const x = rect.x + 12;
    const y = rect.y + 12;
    const ghost = page.locator('[data-editor-overlay="table-drag-ghost"]');
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + 20 }],
    });
    // Wait past the actual hold threshold: a cancelled timer must not resurrect the drag.
    await page.waitForTimeout(360);
    await expect(ghost).toHaveCount(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("menu")).toHaveCount(0);
    expect(await table.textContent()).toBe(original);

    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await expect(ghost).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect(ghost).toHaveCount(0);
    expect(await table.textContent()).toBe(original);
    await handle.tap();
    await expect(page.getByRole("menu")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("merged-cell table handles explain disabled drag and keyboard movement", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集" }).click();
  await waitForEditShell(page);
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await editor.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData(
      "text/html",
      "<table><tr><td colspan='2'>A</td><td>B</td></tr><tr><td colspan='2'>C</td><td>D</td></tr><tr><td colspan='2'>E</td><td>F</td></tr></table>",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
    );
  });
  const table = editor.locator("table").filter({ has: page.locator('td[colspan="2"]') });
  await table.scrollIntoViewIfNeeded();
  await expect(table.locator("[colspan='2']")).toHaveCount(3);
  const original = await table.textContent();
  const handle = page
    .locator('button[data-reorder-disabled="merged-cells"][data-table-axis="row"]')
    .nth(1);
  await expect(handle).toHaveAttribute("aria-description", /結合セル/);
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 12, rect.y + 12);
  await page.mouse.down();
  await page.mouse.move(rect.x + 12, rect.y + 60);
  await expect(page.locator('[data-editor-overlay="table-drag-ghost"]')).toHaveCount(0);
  await page.mouse.up();
  expect(await table.textContent()).toBe(original);
  await handle.press("Enter");
  await expect(page.getByRole("menuitem", { name: "上へ移動", exact: true })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "下へ移動", exact: true })).toBeDisabled();
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
