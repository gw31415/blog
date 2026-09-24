import { expect, test } from "@playwright/test";

for (const width of [1280, 390])
  test(`toggle stays open while editing at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/blog/document-showcase");
    const details = page.locator("article details");
    const summary = details.locator("summary");

    await summary.click();
    await expect(details).toHaveAttribute("open");
    const viewSize = await summary.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));

    const edit = page.locator(".article-sticky-edit");
    await edit.waitFor({ state: "visible" });
    await edit.click();
    await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
    await expect(details).toHaveAttribute("open");
    const editSize = await summary.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
    expect(Math.abs(editSize.width - viewSize.width)).toBeLessThan(1);
    expect(Math.abs(editSize.height - viewSize.height)).toBeLessThan(1);

    await summary.click();
    await expect(details).not.toHaveAttribute("open");
    await summary.click();
    await expect(details).toHaveAttribute("open");
    await expect(details.locator(".details-body")).toBeVisible();

    const body = details.locator(".details-body p").first();
    await body.click();
    await page.keyboard.type("追記");
    await expect(body).toContainText("追記");
    await expect(details).toHaveAttribute("open");

    const title = summary.locator('[data-article-role="details-title"]');
    await title.click();
    await expect(details).toHaveAttribute("open");
    await expect(title).toHaveAttribute("contenteditable", "plaintext-only");
    expect(
      await title.evaluate((element) => ({
        outline: getComputedStyle(element).outlineStyle,
        underline: getComputedStyle(element).textDecorationStyle,
      })),
    ).toEqual({ outline: "none", underline: "solid" });
    await title.press("ControlOrMeta+A");
    await page.keyboard.type("変更した題名");
    await expect(title).toHaveText("変更した題名");
    await expect(details).toHaveAttribute("open");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await title.press("ControlOrMeta+A");
    await title.press("Backspace");
    await body.click();
    await expect(title).toHaveText("変更した題名");
  });

test("inline toggle title is saved as plain text", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const editor = page.locator("article .ProseMirror");
  await editor.click();
  await page.keyboard.type("/");
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("dropdown");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "トグル" });
  await dialog.locator('input[name="title"]').fill("最初の題名");
  await dialog.getByRole("button", { name: "適用" }).click();
  const details = page.locator("article details");
  await expect(details).toHaveCount(1);
  const title = details.locator('[data-article-role="details-title"]');
  await title.click();
  await title.press("ControlOrMeta+A");
  await page.keyboard.type("& <変更した題名>");
  await expect(title).toHaveText("& <変更した題名>");
  await title.press("Enter");
  await expect(title).toHaveText("& <変更した題名>");

  await page.locator(".article-header-edit").click();
  await page.waitForURL((url) => url.pathname === `/blog/${id}` && !url.searchParams.has("edit"));
  await expect(page.locator('article [data-article-role="details-title"]')).toHaveText(
    "& <変更した題名>",
  );

  await page.goto("/");
  const row = page.locator("li").filter({ has: page.locator(`a[href="/blog/${id}"]`) });
  await row.getByText("削除", { exact: true }).first().click();
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "削除する" }).click();
});
