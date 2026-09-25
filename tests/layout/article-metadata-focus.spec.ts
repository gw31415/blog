import { expect, test } from "@playwright/test";

test("title and subtitle keep focus, caret, and text across edit mode changes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page).toHaveURL(/\/blog\/([0-9A-HJKMNP-TV-Z]{26})\?edit=1$/);
  const id = /\/blog\/([^?]+)/.exec(page.url())?.[1];
  if (!id) throw new Error("draft id was not available");

  try {
    const title = page.locator('[data-article-field="title"]');
    const tags = page.locator('[data-article-field="tags"]');
    const subtitle = page.locator('[data-article-field="subtitle"]');
    await expect(title).toHaveAttribute("contenteditable", "true");
    await expect(subtitle).toHaveAttribute("contenteditable", "true");

    await expect(tags).toHaveAttribute("contenteditable", "true");
    await tags.fill("検証タグ");
    await tags.press("Space");
    await title.click();
    await expect(title).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type("確認");
    await expect(title).toHaveText("無題確認");
    await page.keyboard.type("続");
    await expect(title).toHaveText("無題確認続");

    await subtitle.click();
    await expect(subtitle).toBeFocused();
    await page.keyboard.type("副題確認");
    await expect(subtitle).toHaveText("副題確認");
    await page.keyboard.type("続");
    await expect(subtitle).toHaveText("副題確認続");

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")?.scrollTo(0, 0);
    });
    await page.locator(".article-header-edit").click();
    await expect(page).toHaveURL(new RegExp(`/blog/${id}$`));
    await expect(title).toHaveText("無題確認続");
    await expect(subtitle).toHaveText("副題確認続");
    await expect(title).not.toHaveAttribute("contenteditable", "true");
    await expect(tags).not.toHaveAttribute("contenteditable", "true");
    await expect(tags).toContainText("検証タグ");

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".article-header-edit").click();
    await expect(title).toHaveAttribute("contenteditable", "true");
    await expect(tags).toHaveAttribute("contenteditable", "true");
    await expect(tags).toContainText("検証タグ");
    await title.click();
    await expect(title).toBeFocused();
  } finally {
    if (!page.isClosed()) {
      await page.goto("/");
      const item = page.locator("li").filter({ has: page.locator(`a[href="/blog/${id}"]`) });
      await item.getByRole("button", { name: /を削除/ }).click();
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" && response.url().includes("?qaction="),
        ),
        page.getByRole("dialog").getByRole("button", { name: "削除する" }).click(),
      ]);
      await page.reload();
      await expect(item).toHaveCount(0);
    }
  }
});
