import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`autosaves drafts and only explicitly updates public content at ${width}px`, async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    const call = async (name: string, input: object) => {
      const response = await page.request.post(`${baseURL}/api/webmcp`, {
        headers: { Origin: baseURL! },
        data: { name, input },
      });
      const payload = await response.json();
      expect(payload.ok, JSON.stringify(payload)).toBe(true);
      return payload.data;
    };
    const created = await call("create_draft", { requestId: `autosave-${width}-${Date.now()}` });
    const id = created.id;
    const reader = await browser.newContext({ baseURL });
    const publicPage = await reader.newPage();
    try {
      await page.goto(`/blog/${id}?edit=1`);
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
      const title = page.locator('[data-article-field="title"]');
      await expect(title).toHaveAttribute("contenteditable", "true");
      await title.fill(`live-${id}`);
      await page.locator("article .ProseMirror").fill("public body");
      await expect
        .poll(async () => (await call("get_post", { identifier: id })).title)
        .toBe(`live-${id}`);
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
      expect((await publicPage.goto(`/blog/${id}`))?.status()).toBe(404);
      await page.locator(".article-topbar [data-publish-post]").click();
      await expect
        .poll(async () => (await call("get_post", { identifier: id })).status)
        .toBe("published");
      await publicPage.goto(`/blog/${id}`);
      await expect(publicPage.locator("h1")).toHaveText(`live-${id}`);
      await title.fill(`secret-${id}`);
      await page.locator("article .ProseMirror").fill("private working body");
      await expect
        .poll(async () => (await call("get_post", { identifier: id })).title)
        .toBe(`secret-${id}`);
      await expect(page.locator(".article-topbar [data-save-status]")).toHaveText("下書き保存済み");
      await publicPage.reload();
      await expect(publicPage.locator("h1")).toHaveText(`live-${id}`);
      await expect(publicPage.locator("article")).toContainText("public body");
      expect(await (await publicPage.request.get(`/blog/${id}.md`)).text()).not.toContain(
        "private working body",
      );
      const search = await publicPage.request.post("/api/webmcp", {
        headers: { Origin: baseURL! },
        data: { name: "search_posts", input: { query: `secret-${id}` } },
      });
      expect((await search.json()).data.items).toHaveLength(0);
      await page.locator(".article-header-edit").click();
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "view");
      await expect(page).toHaveURL(new RegExp(`/blog/${id}$`));
      await page.reload();
      await expect(page.locator(".article-header-edit")).toHaveText("編集");
      await expect(page.locator("h1")).toHaveText(`secret-${id}`);
      await expect(page.locator(".article-topbar [data-publish-post]")).toHaveText("更新");
      await publicPage.reload();
      await expect(publicPage.locator("h1")).toHaveText(`live-${id}`);
      await page.locator(".article-topbar [data-publish-post]").click();
      await expect(page.locator(".editor-error")).toHaveCount(0);
      await expect.poll(async () => (await call("get_post", { identifier: id })).has_draft).toBe(0);
      await expect(page.locator(".article-topbar [data-publish-post]")).toHaveCount(0);
      await publicPage.reload();
      await expect(publicPage.locator("h1")).toHaveText(`secret-${id}`);
      await expect(publicPage.locator("article")).toContainText("private working body");
      // Repeated edit/done cycles retain layout and do not create a dirty revision.
      const before = await page.locator("article").boundingBox();
      for (let i = 0; i < 2; i++) {
        await page.locator(".article-header-edit").click();
        await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
        await page.locator(".article-header-edit").click();
        await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "view");
      }
      const after = await page.locator("article").boundingBox();
      expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `.cache/autosave-${width}.png`, fullPage: true });
    } finally {
      await reader.close();
      const post = await call("get_post", { identifier: id });
      await call("delete_post", { identifier: id, expectedVersion: post.version });
    }
  });
}

test("keeps failed saves in place and retries; stale tab cannot overwrite", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
  const call = async (name: string, input: object) =>
    (
      await (
        await page.request.post(`${baseURL}/api/webmcp`, {
          headers: { Origin: baseURL! },
          data: { name, input },
        })
      ).json()
    ).data;
  const { id } = await call("create_draft", { requestId: `error-${Date.now()}` });
  try {
    await page.goto(`/blog/${id}?edit=1`);
    await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
    await page.route(`**/api/posts/${id}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "test offline" }),
      }),
    );
    await expect(page.locator('[data-article-field="title"]')).toHaveAttribute(
      "contenteditable",
      "true",
    );
    await page.locator('[data-article-field="title"]').fill("retained offline");
    await expect(page.locator(".editor-error")).toContainText("test offline");
    await expect(page.locator('[data-article-field="title"]')).toHaveText("retained offline");
    await page.unroute(`**/api/posts/${id}`);
    await page.locator(".article-topbar").getByRole("button", { name: "再試行" }).click();
    await expect
      .poll(async () => (await call("get_post", { identifier: id })).title)
      .toBe("retained offline");
    const other = await context.newPage();
    await other.goto(`/blog/${id}?edit=1`);
    await expect(other.locator("article")).toHaveAttribute("data-editor-mode", "edit");
    await expect(other.locator('[data-article-field="title"]')).toHaveAttribute(
      "contenteditable",
      "true",
    );
    await other.locator('[data-article-field="title"]').fill("other tab winner");
    await expect
      .poll(async () => (await call("get_post", { identifier: id })).title)
      .toBe("other tab winner");
    await page.locator('[data-article-field="title"]').fill("stale retained input");
    await expect(page.locator(".editor-error")).toContainText("CONFLICT");
    expect((await call("get_post", { identifier: id })).title).toBe("other tab winner");
    await expect(page.locator('[data-article-field="title"]')).toHaveText("stale retained input");
    await other.close();
  } finally {
    const post = await call("get_post", { identifier: id });
    await call("delete_post", { identifier: id, expectedVersion: post.version });
  }
});
