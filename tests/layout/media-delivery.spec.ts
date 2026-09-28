import { test, expect, chromium, webkit, firefox } from "@playwright/test";
for (const engine of [chromium, webkit, firefox])
  for (const width of [390, 1280])
    test(`${engine.name()} media SVG delivery and editor parity at ${width}`, async ({
      baseURL,
    }) => {
      test.setTimeout(90_000);
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
        const response = await page.goto(baseURL + "/blog/media-delivery-test");
        expect(response?.status()).toBe(200);
        const diagrams = page.locator("img.mermaid-image");
        const math = page.locator("img.math-image");
        await expect(diagrams).toHaveCount(2);
        await expect(math).toHaveCount(2);
        for (const images of [diagrams, math]) {
          await expect(images.first()).toHaveAttribute("loading", "eager");
          await expect(images.first()).toHaveAttribute("src", /^data:image\/svg\+xml,/);
          await expect(images.last()).toHaveAttribute("loading", "lazy");
          await expect(images.last()).toHaveAttribute("src", /^\/media\/variants\//);
        }
        const boxes = () =>
          page.locator("img.mermaid-image,img.math-image").evaluateAll((xs) =>
            xs.map((x) => {
              const r = x.getBoundingClientRect();
              return { width: r.width, height: r.height, top: r.top + window.scrollY };
            }),
          );
        const before = await boxes();
        for (let i = 0; i < 2; i++) {
          await page.locator(".article-header-edit").click();
          await expect(page.locator(".article-header-edit")).toHaveText("完了");
          const editing = await boxes();
          editing.forEach((b, j) => {
            expect(Math.abs(b.width - before[j].width)).toBeLessThanOrEqual(1);
            expect(Math.abs(b.height - before[j].height)).toBeLessThanOrEqual(1);
            expect(Math.abs(b.top - before[j].top)).toBeLessThanOrEqual(1);
          });
          await page.locator(".article-header-edit").click();
          await expect(page.locator(".article-header-edit")).toHaveText("編集");
        }
        await diagrams.last().scrollIntoViewIfNeeded();
        await expect(diagrams.last()).toHaveAttribute("data-image-state", "loaded");
        await math.last().scrollIntoViewIfNeeded();
        await expect(math.last()).toHaveAttribute("data-image-state", "loaded");
        const url = await diagrams.last().getAttribute("src");
        const asset = await page.request.get(baseURL + url!);
        expect(asset.status()).toBe(200);
        expect(asset.headers()["content-type"]).toContain("image/svg+xml");
        await page.screenshot({ path: `.cache/media-${engine.name()}-${width}.png` });
      } finally {
        await browser.close();
      }
    });
