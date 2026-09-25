import { test, expect } from "@playwright/test";

for (const width of [1280, 467]) {
  test(`inline editing tools at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/blog/document-showcase");
    await page.locator(".article-header-edit").click();
    const body = page.locator("article .ProseMirror");
    await expect(body).toHaveAttribute("contenteditable", "true");
    const toolbar = page.getByRole("toolbar", { name: "本文の書式" });
    await expect(toolbar.getByRole("button")).toHaveCount(5);
    for (const name of ["元に戻す", "やり直す", "表を挿入", "画像をアップロード", "リンクを挿入"]) {
      const button = toolbar.getByRole("button", { name, exact: true });
      await expect(button).toHaveAttribute("title", name);
      await expect(button.locator("svg")).toHaveCount(1);
    }
    await expect(toolbar).not.toContainText("コマンド");
    const paragraph = body.locator("p").first();
    await paragraph.click({ position: { x: 2, y: 2 } });
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("/heading-3");
    const list = page.getByRole("listbox", { name: "本文コマンド" });
    await expect(list).toBeVisible();
    await expect(page.getByRole("dialog", { name: "本文コマンド" })).toHaveCount(0);
    expect(await body.evaluate((e) => e === document.activeElement)).toBe(true);
    expect((await list.boundingBox())!.width).toBeLessThan(230);
    await expect(list.getByRole("option")).toHaveCount(1);
    await page.screenshot({ path: `.cache/inline-completion-${width}.png` });
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(body.locator("h3").first()).not.toContainText("/heading");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(paragraph).toContainText("/heading-3");
    await paragraph.click({ position: { x: 2, y: 2 } });
    await page.keyboard.press("ArrowLeft");
    for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
    const selected = await page.evaluate(() => window.getSelection()?.toString());
    await toolbar.getByRole("button", { name: "リンクを挿入" }).click();
    const link = page.getByRole("dialog", { name: "リンクを挿入" });
    await expect(link.getByLabel("文章")).toHaveValue(selected!);
    await link.getByLabel("URL").fill("https://example.com/selected");
    expect((await link.boundingBox())!.width).toBeLessThanOrEqual(280);
    await link.getByRole("button", { name: "適用" }).click();
    await expect(body.locator('a[href="https://example.com/selected"]')).toHaveText(selected!);
    await page.keyboard.press("ArrowRight");
    await toolbar.getByRole("button", { name: "リンクを挿入" }).click();
    await link.getByLabel("文章").fill("新しいリンク");
    await link.getByLabel("URL").fill("https://example.com/new");
    await link.getByRole("button", { name: "適用" }).click();
    await expect(body.locator('a[href="https://example.com/new"]')).toHaveText("新しいリンク");
    const markers = page.locator(".editor-invisible-characters span");
    await expect(markers.first()).toBeVisible();
    const right = (await body.boundingBox())!.x + (await body.boundingBox())!.width;
    await expect
      .poll(async () => {
        const xs = await markers.evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().x),
        );
        return xs.length > 0 && xs.every((x) => x > right);
      })
      .toBe(true);
    const language = body.locator(".code-language-control").first();
    await expect(language).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.getByText("未確定のまま下書き保存", { exact: true })).toHaveCount(0);
  });
}
