import { expect, test } from "@playwright/test";

const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/chrome-layout-test";

test("saving article metadata refreshes the head while retaining page styles", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !process.env.BLOG_EDIT_PARITY,
    "Requires local development fixtures and manager access",
  );
  await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
  await page.goto(article);
  const titleField = page.locator('[data-article-field="title"]');
  const descriptionField = page.locator('[data-article-field="description"]');
  const originalTitle = await titleField.textContent();
  const originalDescription = await descriptionField.textContent();
  const appearance = () =>
    page.locator("main.paper").evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.position, style.backgroundColor, style.fontFamily, style.fontSize];
    });
  const before = await appearance();
  const edit = page.locator(".article-header-edit");
  const save = async (title: string, description: string) => {
    await edit.click();
    await expect(edit).toHaveText("完了");
    await titleField.fill(title);
    await descriptionField.fill(description);
    await edit.click();
    await expect(edit).toHaveText("編集");
  };
  try {
    await save("共有情報の更新確認", "保存後の共有カードの説明です。");
    const savedHtml = await (await page.request.get(article)).text();
    expect(savedHtml.match(/<title\b[^>]*>(.*?)<\/title>/)?.[1]).toBe(
      "共有情報の更新確認 - amas.dev",
    );
    await expect(page).toHaveTitle("共有情報の更新確認 - amas.dev");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "共有情報の更新確認",
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "保存後の共有カードの説明です。",
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      "保存後の共有カードの説明です。",
    );
    expect(await appearance()).toEqual(before);
  } finally {
    await save(originalTitle!, originalDescription!);
  }
});

test("metadata follows SPA routes without duplicate tags or losing styles", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("記事一覧 - amas.dev");
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.locator(`a[href="${article}"]`).click();
  const title = await page.locator('[data-article-field="title"]').textContent();
  await expect(page).toHaveTitle(`${title} - amas.dev`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title!);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(1);
  await expect(page.locator('meta[property="article:modified_time"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title!);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", page.url());
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  const image = await page.request.get(imageUrl!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const png = await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);

  const markdown = await page.request.get(`${article}.md`);
  expect(markdown.status()).toBe(200);
  expect(markdown.headers()["content-type"]).toContain("text/markdown");
  expect(await markdown.text()).toMatch(new RegExp(`^# ${title}\\n\\n`));
  await page.locator(".article-topbar .site-link").click();
  await expect(page).toHaveTitle("記事一覧 - amas.dev");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  await expect(page.locator('meta[property^="article:"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  expect(
    await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(expect.arrayContaining(stylesheets));
  await expect(page.locator("[data-site-header]")).toHaveCSS("height", "52px");
});

test.describe("server-rendered metadata", () => {
  test.use({ javaScriptEnabled: false });
  test("article metadata and canonical URL are present without JavaScript", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${article}?edit=1`);
    const title = await page.locator('[data-article-field="title"]').textContent();
    await expect(page).toHaveTitle(`${title} - amas.dev`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      `${baseURL}${article}`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${baseURL}${article}`,
    );
    for (const property of [
      "og:title",
      "og:type",
      "og:description",
      "og:image",
      "og:image:type",
      "og:image:width",
      "og:image:height",
      "og:image:alt",
      "og:site_name",
      "og:locale",
    ]) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveCount(1);
      await expect(page.locator(`meta[property="${property}"]`)).not.toHaveAttribute("content", "");
    }
  });
});
