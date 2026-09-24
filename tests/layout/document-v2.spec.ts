import { test, expect } from "@playwright/test";
test("sample renders all nodes and keeps metadata/body through edit and save", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/blog/document-showcase");
  await expect(page.locator("h1")).toHaveCount(1);
  for (const level of [2, 3, 4, 5, 6])
    await expect(page.locator(`article h${level}`).first()).toBeVisible();
  await expect(page.locator("article mjx-container").first()).toBeVisible();
  await expect(page.locator("article .mermaid-preview img.mermaid-image").first()).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator("article details")).not.toHaveAttribute("open");
  await page
    .locator(
      (await page.locator(".article-sticky-edit").isVisible())
        ? ".article-sticky-edit"
        : ".article-header-edit",
    )
    .click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const toolbar = page.locator(".editor-formatting");
  await expect(toolbar.getByRole("button", { name: "表を挿入", exact: true })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "太字", exact: true })).toHaveCount(0);
  await toolbar.getByRole("button", { name: "コマンド", exact: true }).click();
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("warning");
  await expect(page.getByRole("dialog").getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Escape");
  const savedNavigation = page.waitForNavigation();
  await page
    .locator(
      (await page.locator(".article-sticky-edit").isVisible())
        ? ".article-sticky-edit"
        : ".article-header-edit",
    )
    .click();
  await expect(page.locator("[data-article-field=title]")).not.toHaveAttribute(
    "contenteditable",
    "true",
    { timeout: 30000 },
  );
  await savedNavigation;
  await page.reload();
  await expect(page.locator("article figure:not(.mermaid-diagram)")).toHaveCount(1);
  await expect(page.locator("article a img")).toHaveCount(1);
});
test("slash creates a heading and cancel preserves slash input", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const editor = page.locator("article .ProseMirror");
  await editor.click();
  await page.keyboard.type("/");
  await expect(page.getByRole("dialog", { name: "本文コマンド" })).toBeVisible();
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("heading-6");
  await page.keyboard.press("Enter");
  await page.keyboard.type("見出し六");
  await expect(editor.locator("h6")).toHaveText("見出し六");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await page.keyboard.press("Escape");
  await expect(editor.locator("p").last()).toHaveText("/");
  await page
    .locator(
      (await page.locator(".article-sticky-edit").isVisible())
        ? ".article-sticky-edit"
        : ".article-header-edit",
    )
    .click();
  await expect(page.locator("[data-article-field=title]")).not.toHaveAttribute(
    "contenteditable",
    "true",
    { timeout: 30000 },
  );
  await page.reload();
  await expect(page.locator("article h6")).toHaveText("見出し六");
});
test("unfinished form survives draft save and resumes with its original source", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "コマンド", exact: true }).click();
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("math-block");
  await page.keyboard.press("Enter");
  const source = page.getByRole("textbox", { name: "LaTeX" });
  await source.fill("\\frac{unfinished");
  await page.evaluate(() => window.dispatchEvent(new Event("document-save-draft")));
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  await page
    .locator(
      (await page.locator(".article-sticky-edit").isVisible())
        ? ".article-sticky-edit"
        : ".article-header-edit",
    )
    .click();
  await expect(page.getByRole("textbox", { name: "LaTeX" })).toHaveValue("\\frac{unfinished", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
});
test("mobile selected text formatting and table context remain reachable", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const editor = page.locator("article .ProseMirror");
  await editor.click();
  await page.keyboard.type("selected text");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+/");
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("bold");
  await page.keyboard.press("Enter");
  await expect(editor.locator("strong")).toHaveText("selected text");
  await page.getByRole("button", { name: "表を挿入", exact: true }).click();
  await page.getByRole("button", { name: "適用", exact: true }).click();
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator("th")).toHaveCount(2);
  await expect(editor.locator("td")).toHaveCount(4);
  await editor.locator("td").first().click();
  await page.keyboard.type("first");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second");
  await expect(editor.locator("td").first().locator("p")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+/");
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("math-block");
  await expect(page.getByRole("dialog").getByRole("option")).toBeDisabled();
  await expect(page.getByRole("dialog").getByRole("option")).toContainText("表セル内");
  await page.keyboard.press("Escape");
});
test("one undo restores slash and source paste stays literal", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const editor = page.locator("article .ProseMirror");
  await editor.click();
  await page.keyboard.type("/");
  await page.getByRole("textbox", { name: "コマンド検索" }).fill("heading-3");
  await page.keyboard.press("Enter");
  await expect(editor.locator("h3")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.locator("h3")).toHaveCount(0);
  await expect(editor.locator("p")).toHaveText("/");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("```text");
  await page.keyboard.press("Enter");
  await expect(editor.locator("pre")).toHaveCount(1);
  await editor.locator("code").evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "# literal\n  second");
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(editor.locator("code")).toHaveText("# literal\n  second");
  await expect(editor.locator("h2")).toHaveCount(0);
});
test("Markdown URLs accept aliases, IDs and explicit site types", async ({ request }) => {
  for (const id of ["document-showcase", "01K5D0C0MENT".padEnd(25, "0") + "1"]) {
    for (const type of ["", "github", "zenn", "qiita"]) {
      const response = await request.get(`/blog/${id}.md${type ? "?type=" + type : ""}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/markdown");
      const source = await response.text();
      expect(source.length).toBeGreaterThan(3000);
      expect(source).not.toContain("<!DOCTYPE html>");
      if (type === "zenn") expect(source).toMatch(/^---\ntitle:/);
      if (type === "github") expect(source).toMatch(/^# /);
    }
  }
  expect((await request.get("/blog/document-showcase.md?type=unknown")).status()).toBe(400);
  expect((await request.get("/blog/missing-article.md")).status()).toBe(404);
});
test("editing preserves article position and uses inline tags without extra UI", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/blog/document-showcase");
  const article = page.locator("article");
  await expect(article.locator(".mermaid-preview img.mermaid-image")).toHaveCount(2, {
    timeout: 45000,
  });
  await article.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        if (!(image instanceof HTMLImageElement)) return;
        image.loading = "eager";
        await image.decode();
      }),
    );
  });
  const before = await article.boundingBox();
  const tags = page.locator("[data-article-field=category]");
  const tagPosition = await tags.boundingBox();
  const sources = await article.locator("pre code").allTextContents();
  await page.locator(".article-header-edit").click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  await expect(article.locator(".mermaid-preview img.mermaid-image")).toHaveCount(2, {
    timeout: 45000,
  });
  expect(await article.boundingBox()).toMatchObject({
    x: before!.x,
    y: before!.y,
    width: before!.width,
  });
  await expect(tags).toHaveAttribute("contenteditable", "true");
  await expect.poll(() => tags.boundingBox()).toEqual(tagPosition);
  expect(await article.locator("pre code").allTextContents()).toEqual(sources);
  await expect(
    page.locator(".article-settings,.article-toc,.article-export,.article-document-actions"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "記事URL", exact: true })).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("inline tag edits survive save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const tags = page.locator("[data-article-field=category]");
  await tags.fill("日本語、TypeScript");
  await page.locator(".article-header-edit").click();
  await expect(tags).not.toHaveAttribute("contenteditable", "true", { timeout: 30000 });
  await page.reload();
  await expect(tags).toHaveText("日本語、TypeScript");
  await page.goto("/");
  const row = page.locator("li").filter({ has: page.locator(`a[href="/blog/${id}"]`) });
  await row.getByText("削除", { exact: true }).first().click();
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "削除する" }).click();
});
