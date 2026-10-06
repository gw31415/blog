import { test, expect } from "@playwright/test";

test("completion keyboard selection", async ({ page }) => {
  await page.setViewportSize({ width: 467, height: 800 });
  await page.goto("/blog/document-showcase");
  await page.locator(".article-header-edit").click();
  const body = page.locator("article .ProseMirror");
  await expect(body).toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".editor-formatting")).toBeVisible();
  const list = page.getByRole("listbox", { name: "本文コマンド" });
  const selected = list.locator('[aria-selected="true"]');
  const resetParagraph = async () => {
    await body.fill("本文");
    await page.keyboard.press("ControlOrMeta+Alt+0");
    await expect(body.locator("p")).toHaveCount(1);
  };
  await resetParagraph();
  await page.keyboard.type("/");
  await expect(list).toBeVisible();
  await expect(selected).toHaveCount(0);
  await expect(body).not.toHaveAttribute("aria-activedescendant");
  await page.keyboard.press("Control+n");
  await expect(selected).toContainText("/paragraph");
  await page.keyboard.press("Control+n");
  await expect(selected).toContainText("/heading-2");
  await page.keyboard.press("Control+p");
  await expect(selected).toContainText("/paragraph");
  await page.keyboard.press("ArrowDown");
  await expect(selected).toContainText("/heading-2");
  await page.keyboard.press("Enter");
  await expect(body.locator("h2")).toHaveText("本文");
  await expect(list).toHaveCount(0);

  await resetParagraph();
  await page.keyboard.type("/heading");
  await expect(selected).toHaveCount(0);
  await page.keyboard.press("Control+p");
  await expect(selected).toContainText("/heading-4");
  await page.keyboard.press("Tab");
  await expect(body.locator("h4")).toHaveText("本文");

  await resetParagraph();
  await page.keyboard.type("/table");
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText("/table");
  await page.keyboard.press("Tab");
  const popup = page.getByRole("dialog", { name: "表を挿入" });
  await expect(popup).toBeVisible();
  await expect(body).toHaveText("本文");
  await popup.getByRole("button", { name: "キャンセル" }).click();

  await resetParagraph();
  await page.keyboard.type("/");
  await page.keyboard.press("Enter");
  await expect(list).toHaveCount(0);
  await expect(body.locator("p")).toHaveCount(2);
  await expect(body.locator("p").first()).toHaveText("本文/");

  await resetParagraph();
  await page.keyboard.press("ControlOrMeta+/");
  await expect(selected).toHaveCount(0);
  const search = page.getByRole("textbox", { name: "コマンド検索" });
  await search.fill("heading");
  await page.keyboard.press("Control+n");
  await expect(selected).toContainText("/heading-2");
  await search.fill("heading-3");
  await expect(selected).toContainText("/heading-3");
  await search.fill("heading");
  await expect(selected).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(list).toHaveCount(0);
  await expect(body.locator("h2,h3,h4")).toHaveCount(0);
});
