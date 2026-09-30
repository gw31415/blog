import { expect, test, type Page } from "@playwright/test";
import type { RegisteredTool } from "../../src/webmcp/browser";
import { isRecord } from "../../src/content/record";

declare global {
  interface Window {
    webMcpTestTools: Map<string, RegisteredTool>;
  }
}

async function editorState(page: Page) {
  await page.waitForFunction(() => window.webMcpTestTools?.has("get_editor_state"));
  const result = await page.evaluate(async () =>
    window.webMcpTestTools.get("get_editor_state")!.execute({}),
  );
  if (!isRecord(result) || !result.ok || !isRecord(result.data))
    throw new Error(`Invalid editor state: ${JSON.stringify(result)}`);
  return result.data;
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
    return {
      scroll: root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY,
      rects: [
        ".article-topbar",
        ".article-header-edit",
        ".article-sticky-edit",
        "main.paper header",
        "article",
        "article .ProseMirror > :first-child",
        ".page-footer",
      ].map((selector) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height];
      }),
    };
  });
}

function sameLayout(before: Awaited<ReturnType<typeof layout>>, after: typeof before) {
  expect(Math.abs(after.scroll - before.scroll), "scroll").toBeLessThanOrEqual(1);
  before.rects.forEach((rect, i) =>
    rect.forEach((value, j) =>
      expect(Math.abs(after.rects[i][j] - value), `element ${i}, axis ${j}`).toBeLessThanOrEqual(1),
    ),
  );
}

for (const width of [1280, 390]) {
  test(`fresh editor keeps saved state and original control geometry at ${width}px`, async ({
    page,
    baseURL,
    browserName,
  }) => {
    test.setTimeout(90000);
    page.setDefaultNavigationTimeout(15000);
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.addInitScript(() => {
      window.webMcpTestTools = new Map<string, RegisteredTool>();
      Object.defineProperty(document, "modelContext", {
        configurable: true,
        value: {
          registerTool(tool: RegisteredTool, options?: { signal?: AbortSignal }) {
            window.webMcpTestTools.set(tool.name, tool);
            options?.signal?.addEventListener("abort", () =>
              window.webMcpTestTools.delete(tool.name),
            );
          },
        },
      });
    });
    const remote = async (name: string, input: object) => {
      const response = await page.request.post("/api/webmcp", {
        headers: { Origin: baseURL! },
        data: { name, input },
      });
      const result = await response.json();
      expect(result.ok, JSON.stringify(result)).toBe(true);
      return result.data;
    };
    const { id } = await remote("create_draft", { requestId: `clean-${width}-${Date.now()}` });
    const original = await remote("get_post", { identifier: id });
    const response = await page.request.post(`/api/posts/${id}`, {
      headers: { Origin: baseURL! },
      data: {
        expectedVersion: original.version,
        intent: "publish",
        title: "折り返しを含む長い記事タイトルでDraft更新と編集ボタンの位置を確認する",
        subtitle: "",
        description: "",
        tags: ["検証", "下書き", "編集"],
        publishedAt: "2026-09-30",
        alias: "",
        editingState: null,
        body: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "保存状態" }] },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "リンクと太字の本文",
                  marks: [
                    { type: "bold" },
                    { type: "link", attrs: { href: "https://example.com" } },
                  ],
                },
              ],
            },
            ...Array.from({ length: 32 }, (_, i) => ({
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `段落${i + 1}。変更のない編集切替とスクロール位置を確認する。`,
                },
              ],
            })),
          ],
        },
        formatVersion: 2,
        bodyFormat: "tiptap-json",
        contentSchemaVersion: 1,
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const saved = await remote("get_post", { identifier: id });
    const requests: unknown[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith(`/api/posts/${id}`))
        requests.push(request.postDataJSON());
    });
    try {
      await page.goto(`/blog/${id}`);
      await page.evaluate(() => document.fonts.ready);
      expect((await editorState(page)).dirty).toBe(false);
      const alignment = await page.evaluate(() => {
        const button = document.querySelector(".article-header-edit")!;
        const range = document.createRange();
        range.selectNodeContents(button.querySelector(".article-edit-line > span")!);
        const text = range.getBoundingClientRect();
        range.selectNodeContents(document.querySelector(".article-topbar .site-link")!);
        const site = range.getBoundingClientRect();
        return {
          right: text.right - document.querySelector("article")!.getBoundingClientRect().right,
          bottom: text.bottom - site.bottom,
          padding: getComputedStyle(button).paddingRight,
          color: getComputedStyle(button).color,
          muted: getComputedStyle(button.parentElement!).color,
        };
      });
      expect(Math.abs(alignment.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(alignment.bottom)).toBeLessThanOrEqual(1);
      expect(alignment.padding).toBe("6px");
      expect(alignment.color).toBe(alignment.muted);
      await page.screenshot({ path: `.cache/draft-fixed-${browserName}-${width}-view.png` });
      for (const scroll of [0, 400]) {
        await page.evaluate((y) => window.scrollTo(0, y), scroll);
        const button = page.locator(scroll ? ".article-sticky-edit" : ".article-header-edit");
        if (scroll) await expect(page.locator("[data-site-header]")).toHaveCSS("opacity", "1");
        for (let cycle = 0; cycle < 2; cycle++) {
          const before = await layout(page);
          await button.click();
          await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
          await expect(page.locator('[data-article-field="title"]')).toHaveAttribute(
            "contenteditable",
            "true",
          );
          await expect(page.locator(".article-topbar [data-save-status]")).toHaveText(
            "下書き保存済み",
          );
          if (!scroll)
            await page.locator('[data-article-field="subtitle"]').evaluate((element) => {
              if (element instanceof HTMLElement) element.focus({ preventScroll: true });
            });
          expect((await editorState(page)).dirty).toBe(false);
          sameLayout(before, await layout(page));
          if (cycle === 0)
            await page.screenshot({
              path: `.cache/draft-fixed-${browserName}-${width}-edit-${scroll}.png`,
            });
          await button.click();
          await expect(button).toHaveText("編集");
          await expect(page.locator("[data-internal-scroll]")).toHaveCount(0);
          sameLayout(before, await layout(page));
          expect((await editorState(page)).dirty).toBe(false);
        }
      }
      expect(requests).toHaveLength(0);
      const unchanged = await remote("get_post", { identifier: id });
      expect(unchanged.version).toBe(saved.version);
      expect(unchanged.has_draft).toBe(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator(".article-header-edit").click();
      await expect(page.locator('[data-article-field="title"]')).toHaveAttribute(
        "contenteditable",
        "true",
      );
      await page.route(`**/api/posts/${id}`, (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "test retry" }),
        }),
      );
      await page.locator('[data-article-field="title"]').fill("実際の変更");
      await expect.poll(async () => (await editorState(page)).dirty).toBe(true);
      await expect(page.locator(".article-topbar [data-save-status]")).toHaveText("保存失敗");
      await page.unroute(`**/api/posts/${id}`);
      await page.locator(".article-topbar").getByRole("button", { name: "再試行" }).click();
      await expect(page.locator(".article-topbar [data-save-status]")).toHaveText("下書き保存済み");
      expect((await editorState(page)).dirty).toBe(false);
      expect((await remote("get_post", { identifier: id })).title).toBe("実際の変更");
    } finally {
      const post = await remote("get_post", { identifier: id });
      await remote("delete_post", { identifier: id, expectedVersion: post.version });
    }
  });
}
