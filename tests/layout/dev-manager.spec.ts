import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`development manager switch controls server permissions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const toggle = page.getByRole("checkbox", { name: "管理者目線 開発用" });
    await expect(toggle).not.toBeChecked();
    expect(
      (
        await page.request.post("/api/images", {
          headers: { Origin: new URL(page.url()).origin },
          multipart: {},
        })
      ).status(),
    ).toBe(403);
    const label = toggle.locator("..");
    await expect(label).toHaveCSS("position", "fixed");
    await expect(label).toBeInViewport();
    await Promise.all([page.waitForEvent("load"), toggle.check()]);
    await expect(toggle).toBeChecked();
    expect(
      (
        await page.request.post("/api/images", {
          headers: { Origin: new URL(page.url()).origin },
          multipart: {},
        })
      ).status(),
    ).toBe(400);
    await page.reload();
    await expect(toggle).toBeChecked();
    await Promise.all([page.waitForEvent("load"), toggle.uncheck()]);
    await expect(toggle).not.toBeChecked();
    expect(
      (
        await page.request.post("/api/images", {
          headers: { Origin: new URL(page.url()).origin },
          multipart: {},
        })
      ).status(),
    ).toBe(403);
  });
}
