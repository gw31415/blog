import { expect, test } from "@playwright/test";

for (const width of [1280, 611, 390]) {
  test(`linked code keeps its DOM and decoration across editing at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/blog/document-showcase");
    const code = page.locator("article code", { hasText: "公式コード" });
    const measure = () =>
      code.evaluate((element) => {
        const style = getComputedStyle(element);
        const link = element.querySelector("a")!;
        const linkStyle = getComputedStyle(link);
        return {
          html: element.outerHTML,
          color: style.color,
          fill: style.webkitTextFillColor,
          decoration: linkStyle.textDecoration,
          offset: linkStyle.textUnderlineOffset,
          fontSize: style.fontSize,
          verticalAlign: style.verticalAlign,
        };
      });
    await expect(code).toBeVisible();
    await expect(code.locator(":scope > a")).toHaveText("公式コード");
    await expect(page.locator("article a > code", { hasText: "公式コード" })).toHaveCount(0);
    const before = await measure();
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const mode of ["edit", "view"]) {
        await page.locator(".article-header-edit").click();
        await expect(page.locator("article")).toHaveAttribute("data-editor-mode", mode);
        expect(await measure()).toEqual(before);
      }
    }
  });
}
