import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`portrait image stays within 80% of viewport at ${viewport.width}x${viewport.height}`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    // Supply portrait dimensions at the SSR boundary, just as stored image metadata does.
    await page.route("**/blog/document-showcase", async (route) => {
      if (!route.request().isNavigationRequest()) return route.continue();
      const response = await route.fetch();
      const html = (await response.text()).replace(/<img\b[^>]*data-article-image[^>]*>/g, (tag) =>
        tag
          .replace('width="960"', 'width="600"')
          .replace('height="540"', 'height="2000"')
          .replaceAll("960 / 540", "600 / 2000"),
      );
      await route.fulfill({ response, body: html });
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/document-sample.svg", async (route) => {
      await gate;
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="2000"><rect width="600" height="2000" fill="#718373"/><circle cx="300" cy="300" r="180" fill="#e7e5de"/></svg>',
      });
    });
    await page.goto("/blog/document-showcase", { waitUntil: "domcontentloaded" });
    const images = page.locator("img[data-article-image]");
    const measure = () =>
      images.evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    await expect(images).toHaveCount(3);
    const before = await measure();
    for (const box of before) {
      expect(box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThanOrEqual(viewport.height * 0.8 + 1);
      expect(Math.abs(box.width / box.height - 0.3)).toBeLessThan(0.005);
    }
    await expect(images.first()).toHaveAttribute("data-image-state", "pending");
    release();
    await images.first().scrollIntoViewIfNeeded();
    await expect(images.first()).toHaveAttribute("data-image-state", "loaded");
    expect(await measure()).toEqual(before);
    await page.screenshot({ path: `.cache/image-height-${viewport.width}.png` });
    for (const position of ["top", "image"]) {
      if (position === "top") await page.evaluate(() => window.scrollTo(0, 0));
      else {
        await images.first().scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            page
              .locator(".article-sticky-header")
              .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
          )
          .toBeLessThan(0.5);
      }
      const button = page.locator(
        position === "top" ? ".article-header-edit" : ".article-sticky-edit",
      );
      for (let cycle = 0; cycle < 2; cycle++) {
        await button.click();
        await expect(page.locator('article[data-editor-mode="edit"]')).toBeVisible();
        expect(await measure()).toEqual(before);
        await expect(button).toHaveText("完了");
        await button.click();
        await expect(page.locator('article[data-editor-mode="view"]')).toBeVisible({
          timeout: 30_000,
        });
        await expect(button).toHaveText("編集");
        expect(await measure()).toEqual(before);
      }
    }
  });
}
