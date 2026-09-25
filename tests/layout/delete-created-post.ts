import { expect, type Page } from "@playwright/test";

/** Use fresh tab storage so editor cleanup reads the current server list. */
export async function deleteCreatedPost(page: Page, pathname: string) {
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser is unavailable for test cleanup");
  const context = await browser.newContext({ storageState: await page.context().storageState() });
  const cleanup = await context.newPage();
  try {
    await cleanup.goto(new URL("/", page.url()).href);
    const row = cleanup.locator("li").filter({ has: cleanup.locator(`a[href="${pathname}"]`) });
    const confirm = cleanup.getByRole("dialog").getByRole("button", { name: "削除する" });
    for (let attempt = 0; attempt < 3; attempt++) {
      await row.getByRole("button", { name: /を削除/ }).click();
      try {
        await confirm.click({ timeout: 5000 });
        await expect.poll(async () => (await cleanup.request.get(pathname)).status()).toBe(404);
        return;
      } catch (error) {
        if ((await cleanup.request.get(pathname)).status() === 404) return;
        if (attempt === 2) throw error;
      }
    }
  } finally {
    await context.close();
  }
}
