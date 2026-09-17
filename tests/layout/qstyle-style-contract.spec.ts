import { expect, test } from "@playwright/test";

test("delivers application styles through qstyle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const boundary = page.locator("[data-qstyle-boundary]");
  await expect(boundary).toHaveClass(/(?:^|\s)q(?:d)?_[a-z0-9_]+(?:\s|$)/);

  const contract = await page.evaluate(() => {
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the browser context
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
    const codeBlock = style(".code-block");
    const horizontalRule = style(".article-content hr");

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
      codeBorderLeft: `${codeBlock.borderLeftWidth} ${codeBlock.borderLeftStyle}`,
      horizontalRuleTop: `${horizontalRule.borderTopWidth} ${horizontalRule.borderTopStyle}`,
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
    codeBorderLeft: "3px double",
    horizontalRuleTop: "1px dashed",
  });
});

test("preserves editor control styles while editing", async ({ page }) => {
  await page.goto("/");
  const editAction = page.getByRole("button", { name: "編集", exact: true });
  await expect(editAction).toHaveCSS("font-size", "10px");
  await expect(editAction).toHaveCSS("line-height", "13px");
  await editAction.click();
  await expect(page.locator('[data-editor-mode="edit"]')).toBeVisible();
  await expect(page.locator(".editor-dock")).toHaveCSS("border-top-width", "0px");
  await expect(page.getByRole("button", { name: "本文", exact: true })).toHaveCSS(
    "font-size",
    "11px",
  );
  await expect(page.locator(".editor-formatting")).toHaveCSS("overflow-x", "auto");
  await expect(page.locator(".editor-formatting")).toHaveCSS("overflow-y", "hidden");
  await expect(page.locator(".editor-panel")).toHaveCSS("border-left-width", "1px");

  await page.locator(".editor-panel > summary").click();
  await expect(page.locator(".editor-fields")).toHaveCSS("border-top-width", "0px");

  const control = page.locator(".code-language-control").first();
  const label = control.locator(".code-language-label");
  const select = control.locator(".code-language-select");

  await expect(select).toHaveCSS("position", "absolute");
  await expect(select).toHaveCSS("visibility", "visible");
  await expect(select).toHaveCSS("pointer-events", "auto");
  await expect(label).toHaveCSS("visibility", "hidden");
  await expect(label).toHaveCSS("pointer-events", "none");

  const boxes = await Promise.all([
    control.boundingBox(),
    label.boundingBox(),
    select.boundingBox(),
  ]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).toStrictEqual(boxes[0]);
  expect(boxes[2]).toStrictEqual(boxes[0]);
});
