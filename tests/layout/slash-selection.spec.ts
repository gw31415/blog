import { test, expect } from "@playwright/test";

for (const command of ["table", "link", "image", "math-block", "code-block", "upload-image"]) {
  test(`slash ${command} is removed before opening its input`, async ({ page }) => {
    await page.setViewportSize({ width: 467, height: 800 });
    await page.goto("/blog/document-showcase");
    await page.locator(".article-header-edit").click();
    const body = page.locator("article .ProseMirror");
    await expect(body).toHaveAttribute("contenteditable", "true");
    await expect(page.locator(".editor-formatting")).toBeVisible();
    await body.fill("前");
    await page.keyboard.type(`/${command}`);
    await expect(body).toHaveText(`前/${command}`);
    const list = page.getByRole("listbox", { name: "本文コマンド" });
    await expect(list).toBeVisible();
    const name = list.getByText(`/${command}`, { exact: true });
    await expect(name).toHaveCSS("opacity", "0.55");
    expect((await list.boundingBox())!.width).toBeLessThan(230);
    const chooser = command === "upload-image" ? page.waitForEvent("filechooser") : null;
    await name.click();
    if (chooser) await chooser;
    else await expect(page.getByRole("dialog")).toBeVisible();
    await expect(body).toHaveText("前");
    if (!chooser) {
      await page.getByRole("button", { name: "キャンセル", exact: true }).click();
      await expect(body).toHaveText("前");
      await page.keyboard.press("ControlOrMeta+z");
      await expect(body).toHaveText(`前/${command}`);
    }
  });
}

test("slash allows fullwidth neighbours and keeps ASCII words and URLs literal", async ({
  page,
}) => {
  await page.goto("/blog/document-showcase");
  await page.locator(".article-header-edit").click();
  const body = page.locator("article .ProseMirror");
  await expect(body).toHaveAttribute("contenteditable", "true");
  const list = page.getByRole("listbox", { name: "本文コマンド" });
  for (const prefix of ["日本語", "かな", "カナ", "Ａ１", "。", "　"]) {
    await body.fill(prefix + "続");
    await expect(body).toHaveText(prefix + "続");
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const selection = window.getSelection();
          return selection?.anchorNode?.parentElement?.closest(".ProseMirror")
            ? selection.anchorOffset
            : -1;
        }),
      )
      .toBe(prefix.length);
    await page.keyboard.type("/");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(body).toHaveText(prefix + "/続");
  }
  for (const prefix of ["word", "123", "https:", "/path"]) {
    await body.fill(prefix);
    await page.keyboard.type("/");
    await expect(list).toHaveCount(0);
    await expect(body).toHaveText(prefix + "/");
  }
});
