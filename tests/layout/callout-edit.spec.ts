import { expect, test } from "@playwright/test";

for (const width of [1280, 390])
  test(`INFO and titled callouts can be edited at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/blog/document-showcase");
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });

    const callouts = page.locator('article [data-article-node="callout"]');
    const info = callouts.first();
    const label = info.locator('[data-article-role="callout-label"]');
    expect(await label.evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");
    await label.click();
    const dialog = page.getByRole("dialog", { name: "補足", exact: true });
    await expect(dialog.locator('input[name="title"]')).toHaveValue("");
    await expect(dialog.locator('select[name="kind"]')).toHaveValue("note");
    await dialog.locator('input[name="title"]').fill("編集した補足");
    await dialog.locator('select[name="kind"]').selectOption("warning");
    await dialog.getByRole("button", { name: "適用" }).click();
    await expect(info.locator('[data-article-role="callout-label"]')).toHaveText("編集した補足");
    await expect(info).toHaveAttribute("data-kind", "warning");

    const body = info.locator(".callout-content p").first();
    await body.click();
    await page.keyboard.type("追記");
    await expect(body).toContainText("追記");

    const warning = callouts.nth(1);
    await warning.locator('[data-article-role="callout-label"]').click();
    await expect(dialog.locator('input[name="title"]')).toHaveValue("消さずに確認する *重要*");
    await expect(dialog.locator('select[name="kind"]')).toHaveValue("warning");
    await dialog.getByRole("button", { name: "キャンセル" }).click();
  });
