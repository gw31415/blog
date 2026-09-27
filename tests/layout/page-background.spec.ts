import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`paper grain continues beyond the body at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // A short error page exposes the same document canvas used past the page
    // edges, without relying on a native trackpad rubber-band gesture.
    const response = await page.goto("/__background-canvas-check", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).toHaveCSS("background-size", "14px 14px, 32px 32px");
    expect((await page.request.get("/assets/materials/fiber-paper-9142573283.avif")).ok()).toBe(
      true,
    );
    const body = (await page.locator("body").boundingBox())!;
    expect(body.height).toBeGreaterThan(28);
    expect(body.height).toBeLessThan(448);

    // 448px is a multiple of both the 14px dot grid and the 32px paper tile.
    // Matching tile phases must produce the same pixels inside/outside body.
    const inside = await page.screenshot({ clip: { x: 0, y: 0, width: 28, height: 28 } });
    const outside = await page.screenshot({ clip: { x: 0, y: 448, width: 28, height: 28 } });
    expect(outside.equals(inside)).toBe(true);
  });
}
