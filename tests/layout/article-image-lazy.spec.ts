import { expect, test } from "@playwright/test";
import {
  articleImageAttributes,
  observeArticleImages,
} from "../../src/components/editor/article-image";

for (const width of [390, 1280]) {
  test(`native lazy image preserves its box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    let requests = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("https://images.test/photo.svg", async (route) => {
      requests++;
      await gate;
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="red"/></svg>',
      });
    });
    await page.setContent(
      '<main style="padding-top:20000px"><img style="max-width:100%;height:auto"><p>after</p></main>',
    );
    await page.evaluate(
      (attrs) => {
        const image = document.querySelector("img")!;
        for (const [key, value] of Object.entries(attrs)) image.setAttribute(key, String(value));
        image.style.maxWidth = "100%";
        image.style.height = "auto";
        image.style.objectFit = "contain";
      },
      articleImageAttributes("https://images.test/photo.svg", "sample"),
    );
    await page.evaluate(`(${observeArticleImages.toString()})(document.querySelector('main'))`);
    const image = page.locator("img");
    const before = await image.boundingBox();
    await page.waitForTimeout(150);
    expect(requests).toBe(0);
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("src", "https://images.test/photo.svg");
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => requests).toBe(1);
    await expect(image).toHaveAttribute("data-image-state", "pending");
    release();
    await expect(image).toHaveAttribute("data-image-state", "loaded");
    const after = await image.boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  });
}

for (const width of [390, 1280]) {
  test(`article image boxes survive editing at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.goto("/blog/document-showcase", { waitUntil: "domcontentloaded" });
    const images = page.locator("img[data-article-image]");
    await expect(images.first()).toBeVisible();
    const measure = () =>
      images.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    for (const position of ["top", "image"]) {
      if (position === "image") {
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
      const before = await measure();
      for (let cycle = 0; cycle < 2; cycle++) {
        await button.click();
        await expect(page.locator('article[data-editor-mode="edit"]')).toBeVisible();
        expect(await measure()).toEqual(before);
        await expect(button).toHaveText("完了");
        await button.click();
        await expect(page.locator('article[data-editor-mode="view"]')).toBeVisible({
          timeout: 30_000,
        });
        expect(await measure()).toEqual(before);
      }
    }
  });
}

for (const outcome of ["loaded", "error"]) {
  test(`recognizes an image already ${outcome} before initialization`, async ({ page }) => {
    await page.route("https://images.test/settled.svg", (route) =>
      outcome === "error"
        ? route.abort()
        : route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
          }),
    );
    await page.setContent("<main><img></main>");
    await page.evaluate((attrs) => {
      const image = document.querySelector("img")!;
      for (const [key, value] of Object.entries(attrs)) image.setAttribute(key, String(value));
    }, articleImageAttributes("https://images.test/settled.svg"));
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              (image.naturalWidth > 0 ? "loaded" : "error"),
          ),
      )
      .toBe(outcome);
    await page.evaluate(`(${observeArticleImages.toString()})(document.querySelector('main'))`);
    await expect(page.locator("img")).toHaveAttribute("data-image-state", outcome);
  });
}
