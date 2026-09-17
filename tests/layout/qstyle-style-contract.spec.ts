import { expect, test } from "@playwright/test";

test("delivers application styles through qstyle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const boundary = page.locator("[data-qstyle-boundary]");
  await expect(boundary).toHaveClass(/(?:^|\s)q_[a-z0-9]+(?:\s|$)/);

  const contract = await page.evaluate(() => {
    const style = (selector: string, pseudo?: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element, pseudo);
    };

    const paper = style('[data-layout-key="paper"]');
    const article = style('[data-layout-key="article"]');
    const table = style(".article-content table");
    const sectionNumber = style(".article-content > .tiptap > h2", "::before");
    const selection = getComputedStyle(document.body, "::selection");
    const ink = style(".ink");
    const texture = style(".paper-texture");

    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      paperBackground: paper.backgroundColor,
      articleFontSize: article.fontSize,
      articleLineHeight: article.lineHeight,
      tableBorderTopWidth: table.borderTopWidth,
      tableBorderBottomWidth: table.borderBottomWidth,
      sectionNumberContent: sectionNumber.content,
      selectionColor: selection.color,
      selectionBackground: selection.backgroundColor,
      inkTileCount: (ink.backgroundImage.match(/url\(/g) ?? []).length,
      textureHasEmbeddedSvg: texture.backgroundImage.includes("data:image/svg+xml"),
    };
  });

  expect(contract).toEqual({
    bodyBackground: "rgb(222, 216, 202)",
    paperBackground: "rgb(242, 234, 213)",
    articleFontSize: "15px",
    articleLineHeight: "19.5px",
    tableBorderTopWidth: "1px",
    tableBorderBottomWidth: "1px",
    sectionNumberContent: '"第" counter(section, cjk-ideographic) "節"',
    selectionColor: "rgb(53, 47, 37)",
    selectionBackground: "rgba(135, 89, 79, 0.28)",
    inkTileCount: 2,
    textureHasEmbeddedSvg: true,
  });
});

test("keeps code-language controls measurable while editing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await expect(page.locator('[data-editor-mode="edit"]')).toBeVisible();

  const control = page.locator(".code-language-control").first();
  const label = control.locator(".code-language-label");
  const select = control.locator(".code-language-select");

  await expect(select).toHaveCSS("position", "absolute");
  await expect(select).toHaveCSS("visibility", "visible");
  await expect(select).toHaveCSS("pointer-events", "auto");
  await expect(label).toHaveCSS("visibility", "hidden");
  await expect(label).toHaveCSS("pointer-events", "none");

  const boxes = await Promise.all([control.boundingBox(), label.boundingBox(), select.boundingBox()]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).toStrictEqual(boxes[0]);
  expect(boxes[2]).toStrictEqual(boxes[0]);
});
