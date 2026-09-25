import { test, expect } from "@playwright/test";

test("letter list is SSR rendered, fits mobile, and deletion can be cancelled", async ({
  page,
  request,
}) => {
  const imageRequests: string[] = [];
  page.on("request", (networkRequest) => {
    if (networkRequest.resourceType() === "image") imageRequests.push(networkRequest.url());
  });
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
  const archiveHeaderStyle = await page.locator(".archive-header").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundImage, style.backgroundColor, style.backdropFilter];
  });
  expect(archiveHeaderStyle[0]).toBe("none");
  expect(archiveHeaderStyle[1]).toBe("rgba(242, 234, 213, 0.62)");
  expect(archiveHeaderStyle[2]).toContain("blur(12px)");
  await expect(page.locator(".stream-footer")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("#articles-title")).toHaveCSS("position", "static");
  const cards = page.locator(".letter");
  expect(await cards.count()).toBeGreaterThan(0);
  await page.screenshot({ path: ".cache/post-list-desktop.png", fullPage: true });
  const deleteButton = cards.first().getByRole("button", { name: /を削除/ });
  const firstSheet = cards.first().locator(".letter-sheet");
  await expect(deleteButton.locator("..")).toHaveCSS("right", "0px");
  await expect(deleteButton.locator("..")).toHaveCSS("bottom", "0px");
  await expect(firstSheet).toHaveCSS("border-top-style", "solid");
  await expect(firstSheet).toHaveCSS("border-top-width", "1px");
  await expect(firstSheet).toHaveCSS("background-image", /data:image\/svg\+xml/);
  expect(imageRequests.filter((url) => url.includes("envelope-paper"))).toEqual([]);
  expect(
    await firstSheet.evaluate((element) => getComputedStyle(element).backgroundImage),
  ).not.toContain("repeating-linear-gradient");
  await expect(page.locator(".month-number").first()).toHaveText("09");
  await expect
    .poll(() =>
      deleteButton.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element, "::before").width),
      ),
    )
    .toBe(10);
  await expect
    .poll(() => firstSheet.evaluate((element) => getComputedStyle(element).clipPath))
    .toContain("10px");
  const cardLink = cards.first().locator(".letter-link");
  await expect(cardLink).toHaveAttribute("href", /\/.+/);
  const restingTransform = await cards
    .first()
    .evaluate((element) => getComputedStyle(element).transform);
  const closedMouthTransform = await cards
    .first()
    .locator(".letter-mouth")
    .evaluate((element) => getComputedStyle(element).transform);
  const mouth = cards.first().locator(".letter-mouth");
  const mouthFace = mouth.locator(".letter-mouth-face");
  const closedMouthBox = await mouthFace.boundingBox();
  expect(closedMouthBox).not.toBeNull();
  await expect(mouth).toHaveCSS("left", "0px");
  await expect(mouthFace).toHaveCSS("clip-path", /polygon/);
  expect(
    await mouthFace.evaluate((element) => [
      getComputedStyle(element, "::before").clipPath,
      getComputedStyle(element, "::after").clipPath,
    ]),
  ).toEqual(["none", "none"]);
  expect(
    await mouthFace.evaluate((element) => getComputedStyle(element, "::before").backfaceVisibility),
  ).toBe("hidden");
  expect(
    await mouthFace.evaluate((element) => getComputedStyle(element, "::after").backfaceVisibility),
  ).toBe("hidden");
  await cardLink.hover({ position: { x: 80, y: 80 } });
  await expect
    .poll(() => cards.first().evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(restingTransform);
  await expect
    .poll(() => mouth.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(closedMouthTransform);
  await expect
    .poll(async () => {
      const box = await mouthFace.boundingBox();
      return box ? closedMouthBox!.x - box.x : 0;
    })
    .toBeGreaterThan(20);
  const openMouthBox = await mouthFace.boundingBox();
  const sheetBox = await firstSheet.boundingBox();
  expect(openMouthBox).not.toBeNull();
  expect(sheetBox).not.toBeNull();
  const seamOverlap = openMouthBox!.x + openMouthBox!.width - sheetBox!.x;
  expect(seamOverlap).toBeGreaterThanOrEqual(0);
  expect(seamOverlap).toBeLessThanOrEqual(1);
  const openMouthAxisX = await mouth.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return matrix.m11;
  });
  expect(openMouthAxisX).toBeLessThan(0);
  const openMouthStyle = await cards
    .first()
    .locator(".letter-mouth")
    .evaluate((element) => ({
      transform: getComputedStyle(element).transform,
      filter: getComputedStyle(element).filter,
      back: getComputedStyle(element.querySelector(".letter-mouth-face")!, "::after")
        .backgroundImage,
    }));
  expect(openMouthStyle.transform).toContain("matrix3d");
  expect(openMouthStyle.back).toContain("data:image/svg+xml");
  expect(openMouthStyle.back).not.toContain("gradient");
  expect(openMouthStyle.filter).toBe("none");
  await expect(cards.first().locator(".letter-mouth-shadow")).toHaveCount(0);
  await expect
    .poll(() =>
      cards.first().evaluate((element) => Number(getComputedStyle(element, "::after").opacity)),
    )
    .toBeCloseTo(0.78, 2);
  const hingeShadow = await cards.first().evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return { width: style.width, boxShadow: style.boxShadow, opacity: style.opacity };
  });
  expect(hingeShadow.width).toBe("2px");
  expect(hingeShadow.boxShadow).not.toBe("none");
  expect(Number(hingeShadow.opacity)).toBeCloseTo(0.78, 2);
  const foldLayers = await deleteButton.evaluate((element) => [
    getComputedStyle(element, "::before").backgroundImage,
    getComputedStyle(element, "::after").backgroundImage,
  ]);
  expect(foldLayers.join(" ")).not.toContain("gradient");
  await page.screenshot({ path: ".cache/post-list-flap-open-desktop.png", fullPage: true });
  const pageViewport = page.viewportSize();
  expect(pageViewport).not.toBeNull();
  const closeupX = Math.max(0, openMouthBox!.x - 12);
  const closeupY = Math.max(0, sheetBox!.y - 8);
  await page.screenshot({
    path: ".cache/post-list-flap-open-closeup.png",
    clip: {
      x: closeupX,
      y: closeupY,
      width: Math.min(pageViewport!.width - closeupX, sheetBox!.x - closeupX + 96),
      height: Math.min(pageViewport!.height - closeupY, sheetBox!.height + 16),
    },
  });
  await expect(deleteButton.locator("span")).toHaveCSS("opacity", "0");
  await deleteButton.hover();
  await expect
    .poll(() =>
      deleteButton.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element, "::before").width),
      ),
    )
    .toBe(28);
  await expect
    .poll(() => firstSheet.evaluate((element) => getComputedStyle(element).clipPath))
    .toContain("28px");
  await expect(page.locator(".dated-letter").first()).toHaveCSS("z-index", "10");
  await expect(deleteButton.locator("span")).toHaveCSS("opacity", "1");
  await expect
    .poll(() => deleteButton.evaluate((element) => getComputedStyle(element, "::before").transform))
    .toBe("none");
  await deleteButton.click();
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
  const mobileLetter = await cards.first().boundingBox();
  expect(mobileLetter).not.toBeNull();
  expect(mobileLetter!.x).toBeLessThanOrEqual(36);
  expect(375 - (mobileLetter!.x + mobileLetter!.width)).toBeLessThanOrEqual(8);
  await expect(cards.first()).not.toHaveCSS("transform", "none");
  await expect(page.locator(".dated-letter").nth(1)).toHaveCSS("margin-top", "-10px");
  const monthMarker = await page.locator(".month-marker").first().boundingBox();
  const firstTitle = await cards.first().locator(".letter-title").boundingBox();
  expect(monthMarker).not.toBeNull();
  expect(firstTitle).not.toBeNull();
  expect(monthMarker!.width).toBeCloseTo(32, 0);
  expect(monthMarker!.x + monthMarker!.width).toBeLessThan(firstTitle!.x);
  const leftEdges = await page.evaluate(() =>
    [".month-year", ".month-number", ".letter-day"].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().left,
    ),
  );
  expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: ".cache/post-list-mobile.png", fullPage: true });
  await cardLink.hover({ position: { x: 80, y: 80 } });
  await expect(mouth).toHaveCSS("filter", "none");
  await page.screenshot({ path: ".cache/post-list-flap-open-mobile.png", fullPage: true });
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
    .locator(".letter-link")
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
  const target = cards.nth(firstCount).locator(".letter-link");
  await target.scrollIntoViewIfNeeded();
  const href = await target.getAttribute("href");
  const count = await cards.count();
  const y = await page.locator(".post-stream").evaluate((element) => element.scrollTop);
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
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeCloseTo(y, 0);
  await page.locator(`.letter-link[href="${href}"]`).click();
  await page.waitForURL((url) => url.pathname !== "/");
  await page.goBack();
  await expect(cards).toHaveCount(count);
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeCloseTo(y, 0);
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
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBe(50000);
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
  const card = page
    .locator(".letter")
    .filter({ has: page.locator(`.letter-link[href="${path}"]`) });
  await card.getByRole("button", { name: /を削除/ }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator(`.letter-link[href="${path}"]`)).toHaveCount(0);
});

for (const width of [1280, 390]) {
  test(`calendar and date stay pinned while only envelopes scroll at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const measure = () =>
      page.evaluate(() => {
        const marker = document.querySelector(".month-marker")!.getBoundingClientRect();
        const day = document.querySelector(".letter-day")!.getBoundingClientRect();
        const header = document.querySelector(".archive-header")!.getBoundingClientRect();
        const stream = document.querySelector<HTMLElement>(".post-stream")!;
        const letter = document.querySelector(".letter")!.getBoundingClientRect();
        const heading = document.querySelector("#articles-title")!.getBoundingClientRect();
        return {
          marker: marker.top,
          day: day.top,
          header: header.bottom,
          stream: stream.getBoundingClientRect().top,
          streamY: stream.scrollTop,
          letter: letter.top,
          heading: heading.top,
          windowY: scrollY,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
    const start = await measure();
    await page.locator(".post-stream").evaluate((element) => element.scrollTo(0, 400));
    await expect.poll(async () => (await measure()).streamY).toBe(400);
    const a = await measure();
    await page.locator(".post-stream").evaluate((element) => element.scrollTo(0, 700));
    await expect.poll(async () => (await measure()).letter).toBeLessThan(a.letter - 250);
    const b = await measure();
    expect(b.heading).toBeLessThan(start.heading - 250);
    expect(b.marker).toBe(a.marker);
    expect(b.day).toBe(a.day);
    expect(b.marker).toBeGreaterThanOrEqual(b.header);
    expect(b.day).toBeGreaterThanOrEqual(b.marker);
    expect(b.windowY).toBe(0);
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
        const labels = footer.querySelectorAll("span");
        const left = labels[0].getBoundingClientRect();
        const right = labels[labels.length - 1].getBoundingClientRect();
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
  const y = await page.locator(".post-stream").evaluate((element) => element.scrollTop);
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
    const stream = document.querySelector<HTMLElement>(".post-stream")!;
    stream.scrollTo(0, 0);
    stream.dispatchEvent(new Event("scroll"));
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
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeCloseTo(y, 0);
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
  const stream = page.locator(".post-stream");
  await stream.dispatchEvent("pointerdown");
  await stream.evaluate((element) => {
    element.scrollTop += 1;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const y = history.state.postListY;
        const key = `blog:post-list:v1:${history.state.postListEntry}:true:y`;
        return (
          y > 0 &&
          document.querySelector<HTMLElement>(".post-stream")!.scrollTop === y &&
          Number(sessionStorage.getItem(key)) === y
        );
      }),
    )
    .toBe(true);
  const y = await page.evaluate(() => history.state.postListY);
  await page.addInitScript(() => {
    addEventListener(
      "DOMContentLoaded",
      () => {
        const restoredStream = document.querySelector<HTMLElement>(".post-stream")!;
        const nativeScroll = restoredStream.scrollTo.bind(restoredStream);
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
            restoredStream.dispatchEvent(new Event("scroll"));
            setTimeout(restore, 300);
            return;
          }
          restore();
        }
        restoredStream.scrollTo = delayedScroll;
      },
      { once: true },
    );
  });
  await page.reload();
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeCloseTo(y, 0);
  // A second late browser/router scroll must not become the saved position.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>(".post-stream")!.scrollTo(0, 0);
  });
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeCloseTo(y, 0);
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
  await page.locator(".post-stream").hover();
  await page.mouse.wheel(0, -200);
  await expect
    .poll(() => page.locator(".post-stream").evaluate((element) => element.scrollTop))
    .toBeLessThan(y - 50);
  await expect.poll(() => page.evaluate(() => history.state.postListY)).toBeLessThan(y - 50);
});
