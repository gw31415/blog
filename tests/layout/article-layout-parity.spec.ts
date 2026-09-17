import { expect, test, type Page } from "@playwright/test";

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

interface CodeLanguageControlRects {
  control: LayoutRect;
  label: LayoutRect;
  select: LayoutRect;
}

const EXCLUDED_LAYOUT =
  ".mode-switch, .editor-dock, .editor-error, .math-dialog, [data-editor-overlay]";

export async function captureArticleLayout(page: Page): Promise<ArticleLayoutSnapshot> {
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate((excludedLayout) => {
    const elements: Record<string, LayoutRect> = {};
    const lines: Record<string, LayoutRect[]> = {};

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
}
