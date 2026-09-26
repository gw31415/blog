import { expect, test, type Page } from "@playwright/test";

const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/document-showcase";
const measure = (page: Page) =>
  page.evaluate(() => {
    const paper = document.querySelector("main")!.getBoundingClientRect();
    return Object.fromEntries(
      [".site-topbar", ".page-footer"].map((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return [selector, { left: box.left - paper.left, right: paper.right - box.right }];
      }),
    );
  });

for (const width of [927, 390]) {
  test(`shared site chrome at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 717 });
    await page.goto("/");
    const home = await measure(page);
    await expect(page.locator("#articles-title")).toHaveCSS("background-image", "none");
    await expect(page.locator(".more p").last()).toHaveText("一先ずここまで");
    await page.goto(article);
    expect(await measure(page)).toEqual(home);
    for (const box of Object.values(home)) {
      expect(box.left).toBe(16);
      expect(box.right).toBe(16);
    }
    await page.locator(".page-footer").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-scroll-header]")).toBeVisible();
    await page.screenshot({ path: `.cache/site-chrome-${width}.png` });
  });

  test(`site chrome stays fixed through editing at ${width}px`, async ({ page, baseURL }) => {
    test.skip(!process.env.BLOG_EDIT_PARITY, "Requires a development server with local test data");
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 717 });
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.goto(article);
    const capture = () =>
      page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
        return {
          scroll: root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY,
          rects: [".content", ".article-content", ".page-footer"].map((selector) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        };
      });
    for (const scroll of [0, 800]) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      await page.waitForTimeout(300);
      for (let cycle = 0; cycle < 2; cycle++) {
        const before = await capture();
        const button = page.locator(scroll ? ".article-sticky-edit" : ".article-header-edit");
        const clickButton = async () => {
          const box = (await button.boundingBox())!;
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        };
        await clickButton();
        await expect(page.locator("article[data-editor-mode='edit']")).toBeVisible();
        await expect(button).toHaveText("完了");
        await expect(page.locator("[data-internal-scroll]")).toBeVisible();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        const editing = await capture();
        before.rects.forEach((rect, i) =>
          rect.forEach((value, j) => {
            expect(
              Math.abs(editing.rects[i][j] - value),
              JSON.stringify({ scroll, cycle, i, j, before, editing }),
            ).toBeLessThanOrEqual(1);
          }),
        );
        await clickButton();
        await expect(button).toHaveText("編集");
        await expect(page.locator("[data-internal-scroll]")).toHaveCount(0);
        const after = await capture();
        expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(1);
        before.rects.forEach((rect, i) =>
          rect.forEach((value, j) => {
            expect(Math.abs(after.rects[i][j] - value)).toBeLessThanOrEqual(1);
          }),
        );
      }
    }
  });
}
