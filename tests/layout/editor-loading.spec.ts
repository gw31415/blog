import { isRecord } from "../../src/content/record";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/document-showcase";
const manifest: unknown = JSON.parse(readFileSync("dist/q-manifest.json", "utf8"));
if (!isRecord(manifest) || !isRecord(manifest.bundles)) throw new Error("Invalid build manifest");
const editorBundles = Object.entries(manifest.bundles)
  .filter(
    ([, bundle]) =>
      isRecord(bundle) &&
      Array.isArray(bundle.origins) &&
      bundle.origins.some(
        (origin: unknown) => typeof origin === "string" && origin.endsWith("/editor-runtime.ts"),
      ),
  )
  .map(([name]) => name);
const isEditorRequest = (url: string) =>
  url.includes("/editor-runtime") || editorBundles.some((name) => url.includes(name));

for (const query of ["", "?edit=1"]) {
  test(`readers do not download the editor runtime${query}`, async ({ page }) => {
    expect(editorBundles.length).toBeGreaterThan(0);
    const editorRequests: string[] = [];
    page.on("request", (request) => {
      if (isEditorRequest(request.url())) editorRequests.push(request.url());
    });
    await page.goto(article + query);
    await expect(page.locator("article .ProseMirror")).toBeVisible();
    // Exercise document-ready tasks and scrolling, including the ?edit entry path.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(page.locator("[data-scrolled]")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".article-header-edit")).toHaveCount(0);
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
    expect(editorRequests).toEqual([]);
  });
}

test("managers still preload the editor and can enter edit mode", async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(!process.env.BLOG_EDIT_PARITY, "Requires the local dev manager cookie");
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
  const editorLoaded = page.waitForResponse((response) => isEditorRequest(response.url()));
  await page.goto(article);
  expect((await editorLoaded).ok()).toBe(true);
  await page.locator(".article-header-edit").click();
  await expect(page.locator('article .ProseMirror[contenteditable="true"]')).toBeVisible();
  await expect(page.locator("[data-internal-scroll]")).toBeVisible();
  // Closing without saving keeps this network/initialization test read-only.
});
