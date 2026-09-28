import { test, expect, type Locator } from "@playwright/test";
import { deleteCreatedPost } from "./delete-created-post";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
});

async function imageText(image: Locator) {
  return image.evaluate((element) => {
    const url = element.getAttribute("src") ?? "";
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    doc.querySelectorAll("style").forEach((style) => style.remove());
    return doc.documentElement.textContent;
  });
}

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
      background: getComputedStyle(el).backgroundColor,
    }));
  expect(style.border).toBe("solid");
  expect(style.background).toBe("rgba(255, 253, 247, 0.12)");
  const scoped = await page.evaluate(() => {
    const boundary = document.querySelector<HTMLElement>("[data-article-surface-boundary]")!;
    const actual = document.querySelector<HTMLElement>(
      "article .mermaid-diagram [data-blog-surface='figure']",
    )!;
    const collision = document.createElement("div");
    collision.className = "figure-field code-block math-block";
    boundary.appendChild(collision);
    const computed = getComputedStyle(collision);
    const result = {
      qstyleClass: boundary.className,
      containsActual: boundary.contains(actual),
      border: computed.borderTopStyle,
      background: computed.backgroundImage,
    };
    collision.remove();
    return result;
  });
  expect(scoped.qstyleClass).not.toBe("");
  expect(scoped.containsActual).toBe(true);
  expect(scoped.border).toBe("none");
  expect(scoped.background).toBe("none");
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
      if (!(element instanceof HTMLImageElement)) throw new Error("Expected diagram image");
      const image = element;
      await image.decode();
      const field = image.parentElement!;
      if (field.scrollWidth > field.clientWidth + 1)
        throw new Error("Mermaid unnecessarily scrolls horizontally");
    });
    const before = await diagram.boundingBox();
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
    const after = await diagram.boundingBox();
    expect(
      await diagram.locator(".figure-field").evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(after!.width).toBeCloseTo(before!.width, 0);
    expect(after!.height).toBeCloseTo(before!.height, 0);
    const caption = diagram.locator("figcaption");
    const description = "ソースを変更しても残る図の説明";
    await caption.fill(description);
    await caption.press("Tab");
    await diagram.locator("img.mermaid-image").click();
    const dialog = page.getByRole("dialog", { name: "Mermaid", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("textarea")).toHaveValue(source!);
    await dialog.locator("textarea").fill("flowchart LR\nA[Live preview] --> B[Updated]");
    await expect
      .poll(async () => imageText(dialog.locator(".mermaid-preview img")))
      .toContain("Live preview");
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).press("Enter");
    await expect(diagram).toHaveAttribute("data-mermaid-source", source!);
    await expect(caption).toHaveText(description);
    await diagram.locator("img.mermaid-image").click();
    await dialog.locator("textarea").fill("flowchart LR\nA[Applied preview] --> B[Updated]");
    await expect
      .poll(async () => imageText(dialog.locator(".mermaid-preview img")))
      .toContain("Applied preview");
    await dialog.getByRole("button", { name: "適用", exact: true }).press("Enter");
    await expect(caption).toHaveText(description);
    await expect
      .poll(async () => imageText(diagram.locator("img.mermaid-image")))
      .toContain("Applied preview");
    await expect(page.locator('article pre[data-code-language="mermaid"]')).toHaveCount(0);
    // Restore the original source without writing to the fixture database.
    await diagram.locator("img.mermaid-image").click();
    await dialog.locator("textarea").fill(source!);
    await dialog.getByRole("button", { name: "適用", exact: true }).press("Enter");
    await expect(diagram).toHaveAttribute("data-mermaid-source", source!);
    await expect(caption).toHaveText(description);
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
      .poll(async () => imageText(dialog.locator(".mermaid-preview img")))
      .toContain("Saved on server");
    await dialog.getByRole("button", { name: "適用", exact: true }).press("Enter");
    const diagram = page.locator("article .mermaid-diagram");
    const description = "保存後も残る図の説明";
    await diagram.locator("figcaption").fill(description);
    await diagram.locator("figcaption").press("Tab");
    await diagram.locator("img.mermaid-image").click();
    await dialog.locator("textarea").fill("sequenceDiagram\nAlice->>Bob: Updated and saved");
    await dialog.getByRole("button", { name: "適用", exact: true }).press("Enter");
    await expect(diagram.locator("figcaption")).toHaveText(description);
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-article-field=title]")).not.toHaveAttribute(
      "contenteditable",
      "true",
      { timeout: 45000 },
    );
    const context = await browser.newContext({
      javaScriptEnabled: false,
      storageState: await page.context().storageState(),
    });
    try {
      const reader = await context.newPage();
      await reader.goto(new URL(pathname, page.url()).href);
      await expect
        .poll(async () => imageText(reader.locator(".mermaid-diagram img.mermaid-image")))
        .toContain("Updated and saved");
      await expect(reader.locator(".mermaid-diagram figcaption")).toHaveText(description);
    } finally {
      await context.close();
    }
  } finally {
    await deleteCreatedPost(page, pathname);
  }
});
