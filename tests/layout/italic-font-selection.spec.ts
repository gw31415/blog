import { expect, test } from "@playwright/test";

test("native italic is not sheared again and Japanese retains the 10 degree fallback", async ({
  page,
}) => {
  await page.goto("/blog/document-showcase");
  const italic = page.locator("article i").first();
  await expect(italic).toBeVisible();
  // Isolated rendering probe; no editor commands or document writes.
  await italic.evaluate((el) => {
    el.innerHTML =
      "<span data-native-probe>Italic text</span> <span data-cjk-probe>日本語の斜体</span>";
  });
  await page.evaluate(() => document.fonts.ready);
  const latin = page.locator("[data-native-probe]");
  const cjk = page.locator("[data-cjk-probe]");
  await expect(italic).toHaveCSS("font-style", "oblique 10deg");
  const nativeBefore = await latin.screenshot();
  const cjkBefore = await cjk.screenshot();
  // True italic with synthesis forbidden is the reference, not another synthetic slant.
  await latin.evaluate((el) => {
    el.style.fontStyle = "italic";
    el.style.fontSynthesis = "none";
  });
  expect(await latin.screenshot()).toEqual(nativeBefore);
  await cjk.evaluate((el) => {
    el.style.fontSynthesis = "none";
  });
  expect((await cjk.screenshot()).equals(cjkBefore)).toBe(false);
});
