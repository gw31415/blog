import { test, expect } from "@playwright/test";

test("letter list is SSR rendered, fits mobile, and deletion can be cancelled", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("記事一覧");
  expect(html).not.toContain("body_json");
  await page.goto("/");
  const viewport = page.locator("[data-virtual-keyboard-viewport]");
  await expect(viewport.locator('[data-virtual-keyboard-region="top"] .site-topbar')).toHaveCount(
    1,
  );
  await expect(
    viewport.locator('[data-virtual-keyboard-region="content"] .page-footer'),
  ).toHaveCount(1);
  await expect(viewport).not.toHaveAttribute("data-internal-scroll");
  const cards = page.locator(".letter");
  expect(await cards.count()).toBeGreaterThan(0);
  await page.screenshot({ path: ".cache/post-list-desktop.png", fullPage: true });
  await cards
    .first()
    .getByRole("button", { name: /を削除/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(() =>
      page.locator("main.archive").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return [rect.left, rect.width];
      }),
    )
    .toEqual([0, 375]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: ".cache/post-list-mobile.png", fullPage: true });
  await cards
    .first()
    .getByRole("button", { name: /を削除/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("loads the next page on scroll without duplicating cards", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".letter");
  const count = await cards.count();
  const next = page.getByRole("link", { name: "続きを読み込む" });
  if (!(await next.count())) return;
  await next.scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(count);
  const urls = await cards
    .locator("h3 a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(urls).size).toBe(urls.length);
});

test("restores the loaded list without randomUUID on reload and back", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  });
  await page.goto("/");
  const cards = page.locator(".letter");
  const historyLength = await page.evaluate(() => history.length);
  const firstCount = await cards.count();
  const next = page.getByRole("link", { name: "続きを読み込む" });
  expect(await next.count(), "fixture must include more than one page").toBe(1);
  await next.scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(firstCount);
  const target = cards.nth(firstCount).locator("h3 a");
  await target.scrollIntoViewIfNeeded();
  const href = await target.getAttribute("href");
  const count = await cards.count();
  const y = await page.evaluate(() => scrollY);
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  // SSR remains a fixed page even if an old count URL is requested.
  const html = await (await page.request.get("/?count=1000")).text();
  expect(html).not.toContain(`href="${href}"`);
  const additionalRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") additionalRequests.push(request.url());
  });
  await page.reload();
  await expect(cards).toHaveCount(count);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await page.locator(`h3 a[href="${href}"]`).click();
  await page.waitForURL((url) => url.pathname !== "/");
  await page.goBack();
  await expect(cards).toHaveCount(count);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  expect(additionalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("restores a thousand cached summaries without fetching a thousand rows", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => history.state?.postListEntry)).toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = `blog:post-list:v1:${history.state.postListEntry}:true`;
        return sessionStorage.getItem(key) !== null;
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const key = `blog:post-list:v1:${history.state.postListEntry}:true`;
    const cached = JSON.parse(sessionStorage.getItem(key)!);
    cached.posts = Array.from({ length: 1000 }, (_, i) => ({
      ...cached.posts[0],
      id: `cached-${i}`,
      canonical_alias: `cached-${i}`,
    }));
    sessionStorage.setItem(key, JSON.stringify(cached));
  });
  // Seed the saved position after the old document has saved its own pagehide position.
  await page.addInitScript(() => {
    const key = `blog:post-list:v1:${history.state.postListEntry}:true`;
    sessionStorage.setItem(`${key}:y`, "50000");
    history.replaceState({ ...history.state, postListY: 50000 }, "");
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  await page.reload();
  await expect(page.locator(".letter")).toHaveCount(1000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(50000);
  expect(requests).toEqual([]);
  await expect(page).toHaveURL(/\/$/);
});

test("deletes only a newly created test draft after confirmation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事", exact: true }).click();
  await page.waitForURL(/\/blog\/[^?]+\?edit=1/);
  const path = new URL(page.url()).pathname;
  const tags = page.locator('[data-article-field="tags"]');
  await expect(tags).toHaveAttribute("contenteditable", "true");
  await tags.fill("共通部品、TypeScript");
  await page.locator(".article-header-edit").click();
  await expect(tags).not.toHaveAttribute("contenteditable", "true");
  await page.reload();
  await expect(page.locator(".meta-tag")).toHaveText(["共通部品", "TypeScript"]);
  await page.goto("/");
  const card = page.locator(".letter").filter({ has: page.locator(`h3 a[href="${path}"]`) });
  await card.getByRole("button", { name: /を削除/ }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator(`h3 a[href="${path}"]`)).toHaveCount(0);
});

for (const width of [1280, 390]) {
  test(`calendar sticks below chrome while the surface scrolls at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const measure = () =>
      page.evaluate(() => {
        const marker = document.querySelector(".month-marker")!.getBoundingClientRect();
        const header = document.querySelector(".archive-header")!.getBoundingClientRect();
        const scrollHeader = document
          .querySelector("[data-scroll-header]")!
          .getBoundingClientRect();
        const desk = document.querySelector(".post-desk")!.getBoundingClientRect();
        return {
          marker: marker.top,
          header: header.bottom,
          scrollHeader: scrollHeader.bottom,
          desk: desk.top,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect
      .poll(async () => {
        const position = await measure();
        return Math.abs(position.marker - position.scrollHeader);
      })
      .toBeLessThanOrEqual(1);
    const a = await measure();
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(async () => (await measure()).desk).toBeLessThan(a.desk - 250);
    const b = await measure();
    expect(b.marker).toBe(a.marker);
    expect(b.marker).toBeGreaterThanOrEqual(b.header);
    expect(b.overflow).toBe(false);
  });
}

test("article and list share tag styling and long titles fit the mobile envelope", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tagStyle = () =>
    page
      .locator(".meta-tag")
      .first()
      .evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.fontFamily, c.fontSize, c.backgroundColor, c.borderRadius, c.padding];
      });
  await page.goto("/blog/document-showcase");
  const articleTags = await tagStyle();
  const date = await page.locator("time").last().getAttribute("datetime");
  expect(date).toBeTruthy();
  const day = date!.slice(0, 10);
  await page.goto("/?after=" + encodeURIComponent(JSON.stringify([day + "T23:59:59.999Z", "ZZZ"])));
  // Locate the existing sample through the actual continuation rather than seeding content.
  for (
    let i = 0;
    i < 10 && !(await page.locator('a[href="/blog/document-showcase"]').count());
    i++
  ) {
    const next = page.getByRole("link", { name: "続きを読み込む" });
    if (!(await next.count())) break;
    const href = await next.getAttribute("href");
    await page.goto(href!);
  }
  await expect(page.locator('a[href="/blog/document-showcase"]')).toBeVisible();
  expect(await tagStyle()).toEqual(articleTags);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('a[href="/blog/document-showcase"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".cache/post-list-preview-mobile.png" });
});

test("shared chrome and typography have identical computed styles across routes", async ({
  page,
}) => {
  const style = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const css = getComputedStyle(el);
        return [
          css.fontFamily,
          css.fontSize,
          css.fontWeight,
          css.lineHeight,
          css.letterSpacing,
          css.color,
          css.webkitTextFillColor,
          css.backgroundImage,
          css.textDecoration,
          css.textUnderlineOffset,
        ];
      });
  await page.goto("/blog/document-showcase");
  const header = await style(".article-topbar .site-link");
  const footer = await style(".page-footer");
  const heading = await style("article h2");
  await page.goto("/");
  expect(await style(".site-link")).toEqual(header);
  expect(await style(".page-footer")).toEqual(footer);
  // Ink is decorative; heading metrics themselves come from the same rule.
  expect((await style(".letter-title")).slice(0, 5)).toEqual(heading.slice(0, 5));
});

for (const width of [1280, 390]) {
  test(`footer edges match the article content at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const edges = () =>
      page.locator(".page-footer").evaluate((footer) => {
        const rect = footer.getBoundingClientRect();
        const left = footer.firstElementChild!.getBoundingClientRect();
        const right = footer.lastElementChild!.getBoundingClientRect();
        return [rect.left, rect.right, left.left, right.right];
      });
    await page.goto("/blog/document-showcase");
    const article = await edges();
    const content = await page.locator(".content").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return [rect.left, rect.right];
    });
    expect(article).toEqual([...content, ...content]);
    await page.goto("/");
    expect(await edges()).toEqual(article);
    await page.locator(".page-footer").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.cache/footer-alignment-${width}.png` });
  });
}

test("restores from persistent cache after suspension and loss of session storage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const cards = page.locator(".letter");
  const firstCount = await cards.count();
  await page.getByRole("link", { name: "続きを読み込む" }).scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(firstCount);
  await cards.nth(firstCount).scrollIntoViewIfNeeded();
  const count = await cards.count();
  const y = await page.evaluate(() => scrollY);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const key = `blog:post-list:v1:${history.state.postListEntry}:true`;
        const db = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open("blog-post-list", 1);
          request.onsuccess = () => resolve(request.result);
        });
        const value = await new Promise<{ posts: unknown[] } | undefined>((resolve) => {
          const request = db.transaction("entries").objectStore("entries").get(key);
          request.onsuccess = () => resolve(request.result);
        });
        db.close();
        return value?.posts.length;
      }),
    )
    .toBe(count);
  // A hidden document's scroll reset must not replace its saved position.
  await page.evaluate(() => {
    scrollTo(0, 0);
    dispatchEvent(new Event("scroll"));
    dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  expect(await page.evaluate(() => history.state.postListY)).toBe(y);
  await page.addInitScript(() => sessionStorage.clear());
  const additionalRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") additionalRequests.push(request.url());
  });
  await page.reload();
  await expect(cards).toHaveCount(count);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  expect(additionalRequests).toEqual([]);
  await expect(page).toHaveURL(/\/$/);
});

test("does not save intermediate scroll positions during delayed restoration", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".letter");
  const firstCount = await cards.count();
  await page.getByRole("link", { name: "続きを読み込む" }).scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(firstCount);
  await cards.nth(firstCount).scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await expect.poll(() => page.evaluate(() => history.state.postListY)).toBe(y);
  await page.addInitScript(() => {
    const nativeScroll = window.scrollTo.bind(window);
    let pending = false;

    function delayedScroll(options?: ScrollToOptions): void;
    function delayedScroll(x: number, top: number): void;
    function delayedScroll(xOrOptions?: number | ScrollToOptions, top?: number) {
      const restore = () => {
        if (typeof xOrOptions === "number") nativeScroll(xOrOptions, top ?? 0);
        else nativeScroll(xOrOptions);
      };
      if (!pending) {
        pending = true;
        // Simulate restoration not taking effect until a later rendering turn.
        nativeScroll(0, 0);
        dispatchEvent(new Event("scroll"));
        setTimeout(restore, 300);
        return;
      }
      restore();
    }
    window.scrollTo = delayedScroll;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  // A second late browser/router scroll must not become the saved position.
  await page.evaluate(() => {
    scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  expect(await page.evaluate(() => history.state.postListY)).toBe(y);
  expect(
    await page.evaluate(() => {
      const key = `blog:post-list:v1:${history.state.postListEntry}:true:y`;
      return Number(sessionStorage.getItem(key));
    }),
  ).toBe(y);
  // Let the deliberately delayed native restoration above complete.
  await page.waitForTimeout(350);
  // Once the user scrolls, the new position must be saved normally.
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(y - 50);
  await expect.poll(() => page.evaluate(() => history.state.postListY)).toBeLessThan(y - 50);
});
