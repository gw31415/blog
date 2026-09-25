import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`emphasis stays visible without increasing line spacing at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await page.getByRole("button", { name: "新規記事" }).click();
    const editor = page.locator("article .ProseMirror");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.click();
    await page.keyboard.type("/em");
    await page
      .getByRole("listbox", { name: "本文コマンド" })
      .getByRole("option")
      .filter({ has: page.locator(".document-command-name", { hasText: /^\/em$/ }) })
      .click();
    await page.keyboard.insertText("傍点を付けても本文の行間を保ちます。".repeat(8));
    await page.keyboard.press("Enter");
    await page.keyboard.type("後続の段落");
    await page.locator("[data-article-field=title]").fill("傍点の表示確認");
    const measure = () =>
      editor.locator("p").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { y: r.y, h: r.height, w: r.width };
        }),
      );
    const check = async () => {
      const em = editor.locator("em").first();
      await expect(em).toHaveCSS("text-emphasis-color", "rgb(53, 47, 37)");
      await expect(em).toHaveCSS("text-emphasis-style", "dot");
      const withDots = await measure();
      const style = await page.addStyleTag({
        content: "article em {text-emphasis-style:none!important}",
      });
      const withoutDots = await measure();
      await style.evaluate((el) => el.parentNode?.removeChild(el));
      for (let i = 0; i < withDots.length; i++)
        for (const key of ["y", "h", "w"] as const)
          expect(Math.abs(withDots[i][key] - withoutDots[i][key])).toBeLessThanOrEqual(1);
      return withDots;
    };
    await check();
    await page.locator(".article-header-edit").click();
    await expect(editor).not.toHaveAttribute("contenteditable", "true");
    await page.reload();
    for (let cycle = 0; cycle < 2; cycle++) {
      const before = await check();
      await page.locator(".article-header-edit").click();
      await expect(editor).toHaveAttribute("contenteditable", "true");
      const editing = await check();
      await page.locator(".article-header-edit").click();
      await expect(editor).not.toHaveAttribute("contenteditable", "true");
      const after = await check();
      for (const actual of [editing, after])
        for (let i = 0; i < before.length; i++)
          for (const key of ["y", "h", "w"] as const)
            expect(Math.abs(actual[i][key] - before[i][key])).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: `.cache/emphasis-visible-${width}.png`, fullPage: true });
  });
}
