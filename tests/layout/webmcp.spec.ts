import { isRecord } from "../../src/content/record";
import type { RegisteredTool } from "../../src/webmcp/browser";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    webMcpTestTools: Map<string, RegisteredTool>;
  }
}
declare module "../../src/webmcp/browser" {
  interface ModelContext {
    getTools?(): Promise<{ name: string }[]>;
    executeTool?(tool: { name: string }, input: string): Promise<string>;
  }
}
function toolResult(value: unknown) {
  if (!isRecord(value) || typeof value.ok !== "boolean") throw new Error("Invalid tool response");
  if (value.ok && !isRecord(value.data)) throw new Error("Missing tool data");
  const error = isRecord(value.error) ? value.error : undefined;
  return { ok: value.ok, data: isRecord(value.data) ? value.data : {}, error };
}
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error("Expected object array");
  return value;
}
async function call(page: Page, toolName: string, argumentsObject: object = {}) {
  await page.waitForFunction((name) => window.webMcpTestTools?.has(name), toolName, {
    timeout: 15000,
  });
  return toolResult(
    await page.evaluate(
      async ({ name, input }) => window.webMcpTestTools.get(name)!.execute(input),
      { name: toolName, input: argumentsObject },
    ),
  );
}
async function install(page: Page, legacyApi = false) {
  await page.addInitScript((legacy) => {
    const tools = new Map<string, RegisteredTool>();
    window.webMcpTestTools = tools;
    const context = {
      registerTool(tool: RegisteredTool, options?: { signal?: AbortSignal }) {
        if (tools.has(tool.name)) throw new Error(`duplicate ${tool.name}`);
        tools.set(tool.name, tool);
        if (!legacy) options?.signal?.addEventListener("abort", () => tools.delete(tool.name));
      },
      ...(legacy
        ? {
            unregisterTool(name: string) {
              tools.delete(name);
            },
          }
        : {}),
    };
    Object.defineProperty(legacy ? navigator : document, "modelContext", {
      value: context,
      configurable: true,
    });
  }, legacyApi);
}
async function manager(page: Page) {
  await page.context().addCookies([
    {
      name: "blog_dev_manager",
      value: "1",
      url: process.env.BLOG_TEST_URL ?? "http://127.0.0.1:4173",
    },
  ]);
}
for (const width of [1280, 390]) {
  test(`WebMCP edit/save/publish/read workflow ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await install(page, width === 390);
    await manager(page);
    await page.goto("/");
    const requestId = `webmcp-${width}-${Date.now()}`;
    let id = "";
    try {
      const created = await call(page, "create_draft", { requestId });
      expect(created.ok, JSON.stringify(created)).toBe(true);
      id = String(created.data.id);
      await expect(page).toHaveURL(new RegExp(`/blog/${id}`));
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
      let state = await call(page, "get_editor_state");
      const changed = await call(page, "update_draft", {
        expectedState: state.data.stateToken,
        title: `WebMCPテスト ${width}`,
        description: "APIと編集状態の検証",
        tags: ["WebMCP"],
        body: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "検証の節" }] },
            { type: "paragraph", content: [{ type: "text", text: "検索対象の本文" }] },
          ],
        },
      });
      expect(changed.ok, JSON.stringify(changed)).toBe(true);
      await expect(page.locator("[data-article-field=title]")).toHaveText(`WebMCPテスト ${width}`);
      await expect(page.locator("article h2")).toHaveText("検証の節");
      expect(
        (await call(page, "update_draft", { expectedState: state.data.stateToken, title: "stale" }))
          .error?.code,
      ).toBe("CONFLICT");
      expect((await call(page, "open_post", { identifier: id })).error?.code).toBe(
        "UNSAVED_CHANGES",
      );
      state = await call(page, "get_editor_state");
      expect(state.data.dirty).toBe(true);
      const saved = await call(page, "save_post", { expectedState: state.data.stateToken });
      expect(saved.ok, JSON.stringify(saved)).toBe(true);
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "view");
      expect((await call(page, "get_editor_state")).data.dirty).toBe(false);
      const before = await page.locator("article").boundingBox();
      for (let cycle = 0; cycle < 2; cycle++) {
        await page.locator(".article-header-edit").click();
        await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit");
        await page.locator(".article-header-edit").click();
        await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "view");
      }
      const after = await page.locator("article").boundingBox();
      expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
      state = await call(page, "get_editor_state");
      page.once("dialog", (dialog) => dialog.dismiss());
      expect(
        (await call(page, "publish_post", { expectedState: state.data.stateToken })).error?.code,
      ).toBe("CANCELLED");
      page.once("dialog", (dialog) => dialog.accept());
      const published = await call(page, "publish_post", { expectedState: state.data.stateToken });
      expect(published.ok, JSON.stringify(published)).toBe(true);
      const search = await call(page, "search_posts", { query: "検索対象", tag: "WebMCP" });
      expect(records(search.data.items).some((item) => item.id === id)).toBe(true);
      await page.reload();
      await expect(page.locator("#webmcp-section-0")).toHaveText("検証の節");
      const outline = await call(page, "get_post_outline", { identifier: id, section: 0 });
      expect(outline.data.url).toContain("#webmcp-section-0");
      expect(
        (await call(page, "export_post", { identifier: id, target: "github" })).data.markdown,
      ).toContain("検索対象");
      await call(page, "open_post", { identifier: id, section: 0 });
      await expect(page).toHaveURL(/#webmcp-section-0$/);
      // A different tab changes the saved version; stale saves must preserve local input.
      const other = await page.context().newPage();
      await install(other);
      await other.goto(`/blog/${id}`);
      const otherState = await call(other, "get_editor_state");
      await call(other, "update_draft", {
        expectedState: otherState.data.stateToken,
        title: "別タブの更新",
      });
      const updated = await call(other, "get_editor_state");
      other.once("dialog", (dialog) => dialog.accept());
      expect((await call(other, "save_post", { expectedState: updated.data.stateToken })).ok).toBe(
        true,
      );
      await other.close();
      const old = await call(page, "get_editor_state");
      await call(page, "update_draft", {
        expectedState: old.data.stateToken,
        title: "保持される入力",
      });
      const stale = await call(page, "get_editor_state");
      page.once("dialog", (dialog) => dialog.accept());
      expect(
        (await call(page, "save_post", { expectedState: stale.data.stateToken })).error?.code,
      ).toBe("CONFLICT");
      await expect(page.locator("[data-article-field=title]")).toHaveText("保持される入力");
      await page.reload();
      await expect(page.locator("[data-article-field=title]")).toHaveText("別タブの更新");
      state = await call(page, "get_editor_state");
      page.once("dialog", (dialog) => dialog.accept());
      expect(
        (await call(page, "unpublish_post", { expectedState: state.data.stateToken })).ok,
      ).toBe(true);
      const reader = await page.context().browser()!.newContext();
      const anonymous = await reader.newPage();
      await install(anonymous);
      await anonymous.goto(new URL("/", page.url()).href);
      await call(anonymous, "search_posts");
      expect(await anonymous.evaluate(() => window.webMcpTestTools.has("create_draft"))).toBe(
        false,
      );
      expect((await call(anonymous, "get_post", { identifier: id })).error?.code).toBe("NOT_FOUND");
      const forbidden = await anonymous.request.post(new URL("/api/webmcp", page.url()).href, {
        headers: { Origin: new URL(page.url()).origin },
        data: { name: "create_draft", input: { requestId: "anonymous" } },
      });
      expect(forbidden.status()).toBe(403);
      await reader.close();
    } finally {
      if (id) {
        await page.goto(`/blog/${id}`);
        const post = await call(page, "get_post", { identifier: id });
        page.once("dialog", (dialog) => dialog.accept());
        const removed = await call(page, "delete_post", {
          identifier: id,
          expectedVersion: post.data.version,
        });
        expect(removed.ok, JSON.stringify(removed)).toBe(true);
        await page.waitForFunction(() => !window.webMcpTestTools.has("get_editor_state"));
      }
    }
  });
}

test("native Chromium WebMCP registration, execution and navigation", async ({ browser }) => {
  test.setTimeout(60000);
  const { chromium } = await import("@playwright/test");
  const nativeBrowser = await chromium.launch({
    args: ["--enable-experimental-web-platform-features"],
  });
  const context = await nativeBrowser.newContext({
    baseURL: process.env.BLOG_TEST_URL ?? "http://127.0.0.1:4173",
  });
  const page = await context.newPage();
  await manager(page);
  const nativeCall = async (name: string, input: object = {}) =>
    toolResult(
      await page.evaluate(
        async (args) => {
          const mc = document.modelContext;
          if (!mc?.getTools || !mc.executeTool) throw new Error("Native WebMCP is unavailable");
          for (let attempt = 0; attempt < 100; attempt++) {
            const tools = await mc.getTools();
            const tool = tools.find((entry) => entry.name === args.name);
            if (tool) {
              // Chromium 153's invocation API takes serialized input; the page execute
              // callback still receives an object as specified by WebMCP.
              return JSON.parse(await mc.executeTool(tool, JSON.stringify(args.input)));
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw new Error(`Native tool missing: ${args.name}`);
        },
        { name, input },
      ),
    );
  let id = "";
  try {
    await page.goto("/");
    const created = await nativeCall("create_draft", { requestId: `native-${Date.now()}` });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    id = String(created.data.id);
    await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit", {
      timeout: 20000,
    });
    const state = await nativeCall("get_editor_state");
    const changed = await nativeCall("update_draft", {
      expectedState: state.data.stateToken,
      title: "Native WebMCP",
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "ブラウザネイティブAPI" }] },
        ],
      },
    });
    expect(changed.ok, JSON.stringify(changed)).toBe(true);
    const current = await nativeCall("get_editor_state");
    expect((await nativeCall("save_post", { expectedState: current.data.stateToken })).ok).toBe(
      true,
    );
    expect((await nativeCall("get_post", { identifier: id })).data.title).toBe("Native WebMCP");
  } finally {
    if (id) {
      await page.goto(`/blog/${id}`);
      const post = await nativeCall("get_post", { identifier: id });
      page.once("dialog", (dialog) => dialog.accept());
      expect(
        (await nativeCall("delete_post", { identifier: id, expectedVersion: post.data.version }))
          .ok,
      ).toBe(true);
      expect(
        await page.evaluate(async () => {
          if (!document.modelContext?.getTools) throw new Error("Native WebMCP is unavailable");
          return (await document.modelContext.getTools()).some(
            (tool) => tool.name === "get_editor_state",
          );
        }),
      ).toBe(false);
    }
    await nativeBrowser.close();
  }
  expect(browser.isConnected()).toBe(true);
});

test("image reuse, original download and cleanup preserve originals", async ({ page }) => {
  test.setTimeout(90000);
  await install(page);
  await manager(page);
  await page.goto("/");
  const created = await call(page, "create_draft", { requestId: `image-${Date.now()}` });
  const id = String(created.data.id);
  let originalId = "";
  try {
    await expect(page.locator("article")).toHaveAttribute("data-editor-mode", "edit", {
      timeout: 20000,
    });
    const body = page.locator("article .ProseMirror");
    const bytes = readFileSync("public/assets/materials/fiber-paper-9142573283.avif");
    const dimensions = await page.evaluate(async () => {
      const response = await fetch("/assets/materials/fiber-paper-9142573283.avif");
      const image = await createImageBitmap(await response.blob());
      const size = { width: String(image.width), height: String(image.height) };
      image.close();
      return size;
    });
    const uploaded = await page.request.post("/api/images", {
      headers: { Origin: new URL(page.url()).origin },
      multipart: {
        postId: id,
        ...dimensions,
        image: { name: "delivery.avif", mimeType: "image/avif", buffer: bytes },
        original: { name: "original.avif", mimeType: "image/avif", buffer: bytes },
      },
    });
    expect(uploaded.status()).toBe(201);
    const result = await uploaded.json();
    originalId = result.originalId;
    const images = await call(page, "list_images");
    expect(
      records(images.data.items).some(
        (item) =>
          item.id === originalId &&
          records(item.variants).some((variant) => result.url.endsWith(String(variant.id))),
      ),
    ).toBe(true);
    const original = await call(page, "export_original_image", { originalId });
    expect((await page.request.get(String(original.data.url))).status()).toBe(200);
    await expect
      .poll(async () => {
        const state = (await call(page, "get_editor_state")).data.workingState;
        return isRecord(state) ? state.uploading : undefined;
      })
      .toBe(false);
    const state = await call(page, "get_editor_state");
    const attached = await call(page, "attach_image", {
      expectedState: state.data.stateToken,
      variantId: result.url.split("/").at(-1),
      alt: "再利用画像",
    });
    expect(attached.ok, JSON.stringify(attached)).toBe(true);
    await expect(body.locator('img[alt="再利用画像"]')).toHaveCount(1);
    expect((await call(page, "cleanup_unused_images")).error?.code).toBe("BUSY");
    const ready = await call(page, "get_editor_state");
    expect((await call(page, "save_post", { expectedState: ready.data.stateToken })).ok).toBe(true);
    const post = await call(page, "get_post", { identifier: id });
    expect(JSON.stringify(post.data.body)).toContain("再利用画像");
  } finally {
    await page.goto(`/blog/${id}`);
    const post = await call(page, "get_post", { identifier: id });
    page.once("dialog", (dialog) => dialog.accept());
    await call(page, "delete_post", { identifier: id, expectedVersion: post.data.version });
  }
  page.once("dialog", (dialog) => dialog.accept());
  expect((await call(page, "cleanup_unused_images")).ok).toBe(true);
  expect((await page.request.get(`/api/images/originals/${originalId}`)).status()).toBe(200);
});
