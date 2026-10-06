import { expect, test, type Page } from "@playwright/test";

const contentSelector = [
  ".article-sticky-header",
  ".article-sticky-edit",
  "main.paper",
  "main.paper header hgroup",
  "main.paper header .article-description",
  "main.paper header .meta",
  "main.paper header .meta-tags",
  "main.paper header .meta-controls",
  "article.article-content",
  "article .ProseMirror",
  "article .ProseMirror :is(p, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code, table, caption, thead, tbody, tr, th, td, figure, figcaption, details, summary, hr, img:not(.ProseMirror-separator), mjx-container, [data-blog-surface], [data-article-node])",
  ".page-footer",
].join(", ");

const componentSelectors = [
  "p",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "table",
  "figure",
  "details",
  "hr",
  "[data-blog-surface='math']",
  "[data-article-node='callout']",
  ".mermaid-diagram",
  "img",
];

type Rect = { x: number; y: number; width: number; height: number };
type Layout = { scroll: number; maxScroll: number; items: { key: string; rect: Rect }[] };

async function captureLayout(page: Page): Promise<Layout> {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
    const internal = root.hasAttribute("data-internal-scroll");
    const semanticItems = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        if (element.matches("caption:empty")) return false;
        const closedDetails = element.closest("details:not([open])");
        return !closedDetails || element === closedDetails || !!element.closest("summary");
      })
      .map((element, index) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return {
          key: `semantic ${index}: ${element.tagName.toLowerCase()}`,
          rect: { x, y, width, height },
        };
      });
    const blocks = [...document.querySelector<HTMLElement>("article .ProseMirror")!.children].map(
      (element, index) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { key: `block ${index}`, rect: { x, y, width, height } };
      },
    );
    return {
      scroll: internal ? root.scrollTop : window.scrollY,
      maxScroll: internal
        ? root.scrollHeight - root.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight,
      items: [...semanticItems, ...blocks],
    };
  }, contentSelector);
}

async function waitForStickyHeader(page: Page) {
  await expect
    .poll(() =>
      page
        .locator(".article-sticky-header")
        .evaluate((header) => Math.abs(header.getBoundingClientRect().top)),
    )
    .toBeLessThan(0.5);
}

function expectSameLayout(before: Layout, after: Layout, compareExtent = true) {
  expect(Math.abs(after.scroll - before.scroll), "scroll position").toBeLessThanOrEqual(1);
  if (compareExtent) {
    expect(Math.abs(after.maxScroll - before.maxScroll), "scrollable extent").toBeLessThanOrEqual(
      1,
    );
  }
  expect(
    after.items.map(({ key }) => key),
    "semantic article components",
  ).toEqual(before.items.map(({ key }) => key));
  const moved = before.items.flatMap(({ key, rect }, index) => {
    const next = after.items[index]?.rect;
    if (!next) return [key];
    const differences = (["x", "y", "width", "height"] as const)
      .filter((axis) => Math.abs(next[axis] - rect[axis]) > 1)
      .map((axis) => `${axis}: ${rect[axis].toFixed(1)} → ${next[axis].toFixed(1)}`);
    return differences.length ? [`${key}: ${differences.join(", ")}`] : [];
  });
  expect(moved, "component bounds while switching reading and editing").toEqual([]);
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 630, height: 641 },
  { width: 390, height: 844 },
]) {
  test(`bottom of article remains fixed through editing at ${viewport.width}×${viewport.height}`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.goto("/blog/document-showcase");
    await expect(page.locator("article .ProseMirror")).toBeVisible();
    await expect(page.locator("article .mermaid-preview img.mermaid-image").first()).toBeVisible();
    for (const selector of componentSelectors) {
      expect(
        await page.locator(`article .ProseMirror ${selector}`).count(),
        selector,
      ).toBeGreaterThan(0);
    }

    const documentTimeOrigin = await page.evaluate(() => performance.timeOrigin);
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await waitForStickyHeader(page);
      const reading = await captureLayout(page);
      expect(reading.maxScroll - reading.scroll).toBeLessThanOrEqual(1);

      const button = await page.locator(".article-sticky-edit").boundingBox();
      await page.mouse.click(button!.x + button!.width / 2, button!.y + button!.height / 2);
      await expect(
        page.locator("article[data-editor-mode='edit'] .ProseMirror[contenteditable='true']"),
      ).toBeVisible();
      await expect(
        page.locator("[data-virtual-keyboard-viewport][data-internal-scroll]"),
      ).toBeVisible();
      const editing = await captureLayout(page);
      expectSameLayout(reading, editing, false);

      const dock = await page.locator(".editor-dock").boundingBox();
      expect(dock).not.toBeNull();
      expect(
        Math.abs(editing.maxScroll - reading.maxScroll - dock!.height),
        "existing editor dock scroll space",
      ).toBeLessThanOrEqual(1);

      await expect(page.locator(".article-sticky-edit")).toHaveText("完了");
      await page.mouse.click(button!.x + button!.width / 2, button!.y + button!.height / 2);
      await expect(page.locator(".article-sticky-edit")).toHaveText("編集", { timeout: 30_000 });
      await expect(
        page.locator("[data-virtual-keyboard-viewport][data-internal-scroll]"),
      ).toHaveCount(0);
      await waitForStickyHeader(page);
      expectSameLayout(reading, await captureLayout(page));
      expect(
        await page.evaluate(() => performance.timeOrigin),
        "saving the same article must not reload the document",
      ).toBe(documentTimeOrigin);
    }
  });
}
