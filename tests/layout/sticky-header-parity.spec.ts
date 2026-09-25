import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`archive and article share scroll header behavior at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let height: number | undefined;
    for (const route of ["/", "/blog/document-showcase"]) {
      await page.goto(route);
      const header = page.locator("[data-scroll-header]");
      await expect(header).toHaveCSS("visibility", "hidden");
      await page.evaluate(() => window.scrollTo(0, 1));
      await expect(header).toHaveCSS("opacity", "1");
      await expect(header).toHaveCSS("visibility", "visible");
      const rect = await header.boundingBox();
      expect(rect).not.toBeNull();
      expect(Math.abs(rect!.y)).toBeLessThanOrEqual(1);
      if (height === undefined) height = rect!.height;
      else expect(rect!.height).toBe(height);
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect(header).toHaveCSS("opacity", "1");
      if (route === "/") {
        const month = page.locator(".month-marker").first();
        const monthRect = await month.boundingBox();
        expect(monthRect!.y).toBeGreaterThanOrEqual(height);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(header).toHaveCSS("visibility", "hidden");
    }
  });
}
