import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

for (const width of [1280, 467]) {
  test(`compact table and direct image insertion at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 641 });
    await page.goto("/blog/document-showcase");
    await page.locator(".article-header-edit").click();
    const body = page.locator("article .ProseMirror");
    await expect(body).toBeVisible({ timeout: 45000 });
    await body.locator("p").first().click();
    const tables = await body.locator("table").count();
    const trigger = page.getByRole("button", { name: "表を挿入", exact: true });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "表を挿入", exact: true });
    await expect(popup).toBeVisible();
    await popup.screenshot({ path: `.cache/table-popover-${width}.png` });
    const box = await popup.boundingBox();
    const anchor = await trigger.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(280);
    expect(box!.height).toBeLessThan(180);
    expect(Math.abs(box!.y + box!.height + 8 - anchor!.y)).toBeLessThan(2);
    const cols = popup.getByLabel("列数", { exact: true });
    const rows = popup.getByLabel("データ行数");
    expect((await cols.boundingBox())!.y).toBe((await rows.boundingBox())!.y);
    await cols.fill("3");
    await rows.fill("1");
    await popup.getByRole("button", { name: "適用", exact: true }).click();
    await expect(body.locator("table")).toHaveCount(tables + 1);
    await expect(page.getByText("未確定のまま下書き保存", { exact: true })).toHaveCount(0);
    await body.locator("p").first().click();
    await page.route("**/api/images", (route) =>
      route.fulfill({ json: { url: "/test-upload.png" } }),
    );
    await page.route("**/test-upload.png", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "画像をアップロード", exact: true }).click();
    const chooser = await chooserPromise;
    await expect(page.locator(".document-command-dialog")).toHaveCount(0);
    await chooser.setFiles({
      name: "image.png",
      mimeType: "image/png",
      buffer: Buffer.from("test"),
    });
    const figures = body
      .locator("figure")
      .filter({ has: page.locator('img[src="/test-upload.png"]') });
    await expect(figures).toHaveCount(1);
    await figures.first().locator("figcaption p").click();
    await page.keyboard.type("Direct caption");
    await expect(figures.first().locator("figcaption")).toHaveText("Direct caption");
    const data = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["test"], "dropped.png", { type: "image/png" }));
      return transfer;
    });
    const paragraph = body.locator("p").first();
    await paragraph.scrollIntoViewIfNeeded();
    const target = await paragraph.boundingBox();
    await paragraph.dispatchEvent("drop", {
      dataTransfer: data,
      clientX: target!.x + 10,
      clientY: target!.y + 10,
    });
    await expect(figures).toHaveCount(2);
    await page.route("**/api/images", (route) =>
      route.fulfill({ status: 400, json: { error: "画像の形式が不正です" } }),
    );
    await paragraph.dispatchEvent("drop", {
      dataTransfer: data,
      clientX: target!.x + 10,
      clientY: target!.y + 10,
    });
    await expect(page.getByRole("status")).toHaveText("Error: 画像の形式が不正です");
    await expect(figures).toHaveCount(2);
    await expect(page.locator(".document-command-dialog")).toHaveCount(0);
  });
}
