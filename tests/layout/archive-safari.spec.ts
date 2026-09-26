import { expect, test } from "@playwright/test";

for (const width of [964, 390]) {
  test(`archive heading and end marker at ${width}px`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height: 717 });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(page.locator("#articles-title")).toHaveText("最近の記事");
    const marker = page.locator(".more p").last();
    await marker.scrollIntoViewIfNeeded();
    const delta = await marker.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const desk = element.closest(".post-desk")!.getBoundingClientRect();
      return Math.abs(text.x + text.width / 2 - (desk.x + desk.width / 2));
    });
    expect(delta).toBeLessThanOrEqual(1);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    if (browserName === "webkit") expect(viewport).not.toContain("interactive-widget");
    else expect(viewport).toContain("interactive-widget=resizes-content");
    expect(errors.filter((error) => error.includes("interactive-widget"))).toEqual([]);
    await page.screenshot({ path: `.cache/archive-${browserName}-${width}.png` });
  });
}
