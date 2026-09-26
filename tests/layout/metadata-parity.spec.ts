import { test, expect } from "@playwright/test";
for (const width of [1280, 467, 390])
  test(`metadata geometry stays fixed at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/blog/document-showcase");
    const measure = () =>
      page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
        const scroll = root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY;
        return {
          scroll,
          rects: [
            "[data-layout-key=header]",
            "[data-article-field=title]",
            "[data-article-field=subtitle]",
            "[data-article-field=description]",
            "[data-article-field=tags]",
            "article",
          ].map((s) => {
            const r = document.querySelector(s)!.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        };
      });
    for (const offset of [0, 400]) {
      await page.evaluate((y) => window.scrollTo(0, y), offset);
      await page.waitForTimeout(300);
      const before = await measure();
      for (let cycle = 0; cycle < 2; cycle++) {
        for (const mode of ["edit", "view"]) {
          const button = offset
            ? page.locator(".article-sticky-edit")
            : page.locator(".article-header-edit");
          await button.click();
          await expect(page.locator("article")).toHaveAttribute("data-editor-mode", mode, {
            timeout: 30000,
          });
          await page.waitForTimeout(300);
          const after = await measure();
          expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(1);
          after.rects.forEach((r, i) =>
            r.forEach((v, j) =>
              expect(
                Math.abs(v - before.rects[i][j]),
                `${mode} rect ${i} axis ${j}`,
              ).toBeLessThanOrEqual(1),
            ),
          );
        }
      }
    }
  });
