import { expect, test } from "@playwright/test";

for (const storage of ["session", "persistent"] as const) {
  test(`reload does not resurrect withdrawn articles from ${storage} storage`, async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => history.state?.postListEntry)).toBeTruthy();
    await page.addInitScript(async (storageKind) => {
      const key = `blog:post-list:v2:${history.state.postListEntry}:false`;
      const stale = {
        posts: [
          {
            id: "withdrawn-article",
            title: "Withdrawn cached article",
            subtitle: null,
            description: null,
            status: "published",
            canonical_alias: "withdrawn-article",
            tags: [],
            published_at: "2026-09-27",
            created_at: "2026-09-27",
          },
        ],
        next: null,
      };
      if (storageKind === "session") {
        sessionStorage.setItem(key, JSON.stringify(stale));
      } else {
        sessionStorage.removeItem(key);
        const db = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open("blog-post-list", 2);
          request.onsuccess = () => resolve(request.result);
        });
        await new Promise<void>((resolve) => {
          const tx = db.transaction("entries", "readwrite");
          tx.objectStore("entries").put(stale, key);
          tx.oncomplete = () => resolve();
        });
        db.close();
      }
    }, storage);
    await page.reload();
    // Wait for restoration to finish and persist its replacement snapshot.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const key = `blog:post-list:v2:${history.state.postListEntry}:false`;
          const value = sessionStorage.getItem(key);
          return value !== null && !value.includes("withdrawn-article");
        }),
      )
      .toBe(true);
    await expect(page.locator('.letter-link[href="/blog/withdrawn-article"]')).toHaveCount(0);
  });
}
