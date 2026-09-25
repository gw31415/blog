import { expect, test } from "@playwright/test";

test("site links and draft creation use SPA navigation", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("QWIK"))
      warnings.push(message.text());
  });
  await page.goto("/blog/document-showcase");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
  });
  await page.locator(".article-topbar .site-link").click();
  await expect(page).toHaveURL(/\/$/);
  const first = page.locator(".letter-title a").first();
  const href = await first.getAttribute("href");
  const title = await first.textContent();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator("[data-article-field=title]")).toHaveText(title!);
  await expect(page.locator(".paper")).toHaveCSS("position", "relative");
  await page.locator(".article-topbar .site-link").click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "新規記事", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9A-HJKMNP-TV-Z]{26}\?edit=1$/);
  const draftPath = new URL(page.url()).pathname;
  try {
    await expect(page.locator("article .ProseMirror")).toHaveAttribute("contenteditable", "true");
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    expect(documents).toEqual([]);
    expect(warnings).toEqual([]);
  } finally {
    await page.locator(".article-topbar .site-link").click();
    const card = page
      .locator(".dated-letter")
      .filter({ has: page.locator(`a[href="${draftPath}"]`) });
    await card.getByRole("button", { name: /を削除/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "削除する" }).click();
    await expect.poll(async () => (await page.request.get(draftPath)).status()).toBe(404);
  }
});
