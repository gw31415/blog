import { expect, test } from "@playwright/test";

test("maps one and two hashes to body headings only", async ({ page }) => {
  await page.goto("/sample");
  await page.getByRole("button", { name: "編集", exact: true }).click();

  const editor = page.locator('.ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.locator("p").first().click();
  await page.keyboard.press("End");

  for (const [hashes, heading] of [
    ["#", "h2"],
    ["##", "h3"],
  ] as const) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(`${hashes} `);
    await page.keyboard.type(`見出し${hashes.length}`);
    await expect(editor.locator(heading, { hasText: `見出し${hashes.length}` })).toHaveCount(1);
  }
});

test("leaves three hashes as plain text", async ({ page }) => {
  await page.goto("/sample");
  await page.getByRole("button", { name: "編集", exact: true }).click();

  const editor = page.locator('.ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.locator("p").first().click();
  await page.keyboard.press("Home");
  await page.keyboard.type("### ");

  await expect(editor.locator("p").first()).toContainText("### ");
  await expect(editor.locator("h4")).toHaveCount(0);
});
