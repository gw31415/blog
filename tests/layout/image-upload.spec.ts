import { test, expect, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });
async function toggleEditor(page: Page) {
  await page.evaluate(() => {
    document.querySelector("[data-virtual-keyboard-viewport]")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  });
  await page.locator(".article-header-edit").click();
}
async function makeJpeg(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 3200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#bb3322";
    ctx.fillRect(0, 0, 1600, 1600);
    ctx.fillStyle = "#2255aa";
    ctx.fillRect(1600, 0, 1600, 1600);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  const jpeg = Buffer.from(encoded, "base64");
  // TIFF orientation 6 plus a unique marker inside APP1; neither may be copied to AVIF.
  const exif = Buffer.concat([
    Buffer.from("Exif\0\0", "binary"),
    Buffer.from("49492a0008000000010012010300010000000600000000000000", "hex"),
    Buffer.from("PRIVATE-EXIF-MARKER"),
  ]);
  const header = Buffer.alloc(4);
  header[0] = 255;
  header[1] = 225;
  header.writeUInt16BE(exif.length + 2, 2);
  const source = Buffer.concat([jpeg.subarray(0, 2), header, exif, jpeg.subarray(2)]);
  // Exercise real object storage and streaming download beyond a single D1 row's limit.
  return page.viewportSize()!.width > 1000
    ? Buffer.concat([source, Buffer.alloc(24_900_000)])
    : source;
}
async function pasteImage(page: Page, bytes: Buffer) {
  await page.locator("article .ProseMirror").evaluate((body, base64) => {
    const data = new DataTransfer();
    data.items.add(
      new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], "clipboard.jpg", {
        type: "image/jpeg",
      }),
    );
    body.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    );
  }, bytes.toString("base64"));
}
for (const width of [1280, 390]) {
  test(`real AVIF upload, replacement, original retention and library at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "新規記事", exact: true }).click();
    await expect(page.locator("article .ProseMirror[contenteditable=true]")).toBeVisible({
      timeout: 45_000,
    });
    await page.evaluate(() => {
      const nativeFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        if (args[0] === "/api/images" && response.ok)
          document.documentElement.dataset.uploadResult = JSON.stringify(
            await response.clone().json(),
          );
        return response;
      };
    });
    const postPath = new URL(page.url()).pathname;
    const name = `画像検証-${width}-${Date.now()}`;
    await page.locator('[data-article-field="title"]').fill(name);
    const source = await makeJpeg(page);
    const body = page.locator("article .ProseMirror");
    await body.locator("p").first().click();
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/images") && r.request().method() === "POST",
    );
    await pasteImage(page, source);
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.uploadResult))
      .toBeTruthy();
    const uploaded = JSON.parse(
      await page.evaluate(() => document.documentElement.dataset.uploadResult!),
    );
    const img = body.locator(`img[src="${uploaded.url}"]`);
    await expect(img).toBeVisible();
    await expect
      .poll(() =>
        img.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]),
      )
      .toEqual([1280, 2560]);
    const delivery = await request.get(uploaded.url);
    expect(delivery.headers()["content-type"]).toBe("image/avif");
    const delivered = await delivery.body();
    expect(delivered.length).toBeLessThan(source.length);
    expect(delivered.includes(Buffer.from("Exif"))).toBe(false);
    expect(delivered.includes(Buffer.from("PRIVATE-EXIF-MARKER"))).toBe(false);
    const original = await request.get(`/api/images/originals/${uploaded.originalId}`);
    expect((await original.body()).equals(source)).toBe(true);
    const caption = body.locator("figure figcaption p").first();
    await caption.click();
    await page.keyboard.type("Keep this caption");
    // Open the contextual element editor and replace only the source image.
    await page.keyboard.press("ControlOrMeta+/");
    const search = page.getByPlaceholder("コマンドを検索");
    await search.fill("edit-element");
    await page.getByRole("option").first().click();
    await expect(page.getByRole("button", { name: "画像ファイルを差し替え" })).toBeVisible();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "画像ファイルを差し替え" }).click();
    const chooser = await chooserPromise;
    const replacementResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/images") && r.request().method() === "POST",
    );
    await chooser.setFiles({ name: "replacement.jpg", mimeType: "image/jpeg", buffer: source });
    expect((await replacementResponse).status()).toBe(201);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.uploadResult))
      .not.toBe(JSON.stringify(uploaded));
    const replacement = JSON.parse(
      await page.evaluate(() => document.documentElement.dataset.uploadResult!),
    );
    await expect(body.locator(`img[src="${replacement.url}"]`)).toBeVisible();
    await expect(caption).toHaveText("Keep this caption");
    await toggleEditor(page);
    await expect(page.locator(".article-header-edit")).toHaveText("編集", { timeout: 30_000 });
    await page.reload();
    await expect(page.locator(`article img[src="${replacement.url}"]`)).toBeVisible();
    for (let cycle = 0; cycle < 2; cycle++) {
      const before = await page.locator("article figure").boundingBox();
      await toggleEditor(page);
      await expect(page.locator("article .ProseMirror")).toHaveAttribute("contenteditable", "true");
      await toggleEditor(page);
      await expect(page.locator(".article-header-edit")).toHaveText("編集");
      const after = await page.locator("article figure").boundingBox();
      expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
    }
    await page.goto("/manage/images?filter=unused");
    const first = page
      .locator("main > ul > li")
      .filter({ has: page.locator(`a[href="/api/images/originals/${uploaded.originalId}"]`) });
    await expect(first).toContainText("現在の記事への紐付けなし");
    expect((await request.get(uploaded.url)).status()).toBe(404);
    await expect(first).not.toContainText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.cache/image-library-${width}.png`, fullPage: true });
    // Delete the test article through its real action; originals survive.
    await page.goto("/");
    await page.getByRole("button", { name: `「${name}」を削除`, exact: true }).click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.locator(`a.letter-link[href="${postPath}"]`)).toHaveCount(0);
    expect((await request.get(replacement.url)).status()).toBe(404);
    expect((await request.get(`/api/images/originals/${replacement.originalId}`)).status()).toBe(
      200,
    );
    await page.goto("/manage/images?filter=unused");
    await expect(
      page
        .locator("main > ul > li")
        .filter({ has: page.locator(`a[href="/api/images/originals/${replacement.originalId}"]`) }),
    ).toContainText("現在の記事への紐付けなし");
  });
}
