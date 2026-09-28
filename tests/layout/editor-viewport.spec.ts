import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });
const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/document-showcase";

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!process.env.BLOG_EDIT_PARITY, "Requires local development test data");
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
});

test("keyboard viewport does not leave an outer document scroller", async ({ page }) => {
  await page.goto(article);
  await page.locator(".article-header-edit").tap();
  await expect(page.locator("[data-internal-scroll]")).toBeVisible();
  const fullHeight = await page.evaluate(() => window.visualViewport!.height);
  // Exercise the existing iOS VisualViewport handler. This checks its layout
  // contract, not acceptance of the native iPhone software keyboard.
  for (const [height, offsetTop] of [
    [500, 0],
    [500, 44],
    [460, 88],
    [500, 0],
    [fullHeight, 0],
  ]) {
    await page.evaluate(
      ([viewportHeight, viewportOffsetTop]) => {
        Object.defineProperties(window.visualViewport!, {
          height: { configurable: true, get: () => viewportHeight },
          offsetTop: { configurable: true, get: () => viewportOffsetTop },
        });
        window.visualViewport!.dispatchEvent(new Event("resize"));
      },
      [height, offsetTop],
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const root = document.querySelector<HTMLElement>("[data-internal-scroll]")!;
          const rect = root.getBoundingClientRect();
          const dock = document.querySelector(".editor-dock")!.getBoundingClientRect();
          return {
            top: rect.top,
            height: rect.height,
            bottom: dock.bottom,
            outerOverflow:
              document.documentElement.scrollHeight - document.documentElement.clientHeight,
          };
        }),
      )
      .toEqual({ top: offsetTop, height, bottom: height + offsetTop, outerOverflow: 0 });
  }
  await expect(page.locator("[data-virtual-keyboard-open]")).toHaveCount(0);
});

test("touch editing preserves the reading position at the top, middle and end", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(article);
  const capture = () =>
    page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
      return {
        scroll: root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY,
        paperTop: document.querySelector("main.paper")!.getBoundingClientRect().top,
        documentScroll: window.scrollY,
      };
    });
  for (const target of [0, 800, Number.MAX_SAFE_INTEGER]) {
    await page.evaluate((y) => window.scrollTo(0, y), target);
    await page.waitForTimeout(300);
    for (let cycle = 0; cycle < 2; cycle++) {
      const before = await capture();
      const button = page.locator(target ? ".article-sticky-edit" : ".article-header-edit");
      const tap = async () => {
        await expect
          .poll(() =>
            button.evaluate((element) => {
              const r = element.getBoundingClientRect();
              return element.contains(
                document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
              );
            }),
          )
          .toBe(true);
        const rect = (await button.boundingBox())!;
        await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
      };
      await tap();
      await expect(button).toHaveText("完了");
      await expect(page.locator("[data-internal-scroll]")).toBeVisible();
      await expect.poll(capture).toEqual({ ...before, documentScroll: 0 });
      await tap();
      await expect(button).toHaveText("編集");
      await expect(page.locator("[data-internal-scroll]")).toHaveCount(0);
      await expect.poll(capture).toEqual(before);
    }
  }
});
