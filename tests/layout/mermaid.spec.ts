import { test, expect } from "@playwright/test";

test("Mermaid is complete in server HTML with JavaScript disabled", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto("/blog/document-showcase");
  await expect(page.locator("article .mermaid-diagram img.mermaid-image")).toHaveCount(2);
  await expect(page.locator('article pre[data-code-language="mermaid"]')).toHaveCount(0);
  const style = await page
    .locator(".mermaid-diagram .figure-field")
    .first()
    .evaluate((el) => ({
      border: getComputedStyle(el).borderTopStyle,
      background: getComputedStyle(el).backgroundImage,
    }));
  expect(style.border).toBe("solid");
  expect(style.background).toContain("repeating-linear-gradient");
  await context.close();
});

for (const width of [1280, 390])
  test(`Mermaid popup previews, cancels and applies at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog/document-showcase");
    const diagram = page.locator("article .mermaid-diagram").first();
    const source = await diagram.getAttribute("data-mermaid-source");
    const img = diagram.locator("img.mermaid-image");
    await img.evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      if (image.getBoundingClientRect().width > Number(image.getAttribute("width")) + 1)
        throw new Error("Diagram exceeded its SVG width");
    });
    const before = await diagram.boundingBox();
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
    const after = await diagram.boundingBox();
    expect(after!.width).toBeCloseTo(before!.width, 0);
    expect(after!.height).toBeCloseTo(before!.height, 0);
    await diagram.click();
    const dialog = page.getByRole("dialog", { name: "Mermaid", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("textarea")).toHaveValue(source!);
    await dialog.locator("textarea").fill("flowchart LR\nA[Live preview] --> B[Updated]");
    await expect
      .poll(async () =>
        decodeURIComponent(
          (await dialog.locator(".mermaid-preview img").getAttribute("src")) ?? "",
        ),
      )
      .toContain("Live preview");
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(diagram).toHaveAttribute("data-mermaid-source", source!);
    await diagram.click();
    await dialog.locator("textarea").fill("flowchart LR\nA[Applied preview] --> B[Updated]");
    await expect
      .poll(async () =>
        decodeURIComponent(
          (await dialog.locator(".mermaid-preview img").getAttribute("src")) ?? "",
        ),
      )
      .toContain("Applied preview");
    await dialog.getByRole("button", { name: "適用", exact: true }).click();
    await expect
      .poll(async () =>
        decodeURIComponent((await diagram.locator("img.mermaid-image").getAttribute("src")) ?? ""),
      )
      .toContain("Applied preview");
    await expect(page.locator('article pre[data-code-language="mermaid"]')).toHaveCount(0);
    // Restore the original source without writing to the fixture database.
    await diagram.click();
    await dialog.locator("textarea").fill(source!);
    await dialog.getByRole("button", { name: "適用", exact: true }).click();
    await expect(diagram).toHaveAttribute("data-mermaid-source", source!);
  });

test("a saved Mermaid is server rendered after reload", async ({ page, browser }) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const pathname = new URL(page.url()).pathname;
  try {
    await page.locator("article .ProseMirror").click();
    await page.keyboard.type("```mermaid");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Mermaid", exact: true });
    await dialog.locator("textarea").fill("sequenceDiagram\nAlice->>Bob: Saved on server");
    await expect
      .poll(async () =>
        decodeURIComponent(
          (await dialog.locator(".mermaid-preview img").getAttribute("src")) ?? "",
        ),
      )
      .toContain("Saved on server");
    await dialog.getByRole("button", { name: "適用", exact: true }).click();
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-article-field=title]")).not.toHaveAttribute(
      "contenteditable",
      "true",
      { timeout: 45000 },
    );
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const reader = await context.newPage();
      await reader.goto(new URL(pathname, page.url()).href);
      await expect
        .poll(async () =>
          decodeURIComponent(
            (await reader.locator(".mermaid-diagram img.mermaid-image").getAttribute("src")) ?? "",
          ),
        )
        .toContain("Saved on server");
    } finally {
      await context.close();
    }
  } finally {
    await page.goto("/");
    const row = page.locator("li").filter({ has: page.locator(`a[href="${pathname}"]`) });
    await row.getByText("削除", { exact: true }).first().click();
    await row.getByRole("checkbox").check();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      row.getByRole("button", { name: "削除する" }).click(),
    ]);
  }
});
