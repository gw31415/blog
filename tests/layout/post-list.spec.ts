import { test, expect } from "@playwright/test";

test("letter archive is SSR rendered and its corner peel opens deletion controls", async ({
  page,
  request,
  browserName,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("ブログ名（仮）");
  expect(html).not.toContain("body_json");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const card = page.locator(".letter").first();
  await card.scrollIntoViewIfNeeded();
  const link = card.locator(".letter-link");
  await expect(link).toHaveAttribute("href", /\/blog\/.+/);
  const titleInk = await link.locator(".letter-title").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fill: style.webkitTextFillColor,
      clip: style.backgroundClip,
      texture: style.backgroundImage.includes("data:image/svg+xml"),
    };
  });
  expect(titleInk.fill).toBe("rgba(0, 0, 0, 0)");
  expect(titleInk.clip).toContain("text");
  expect(titleInk.texture).toBe(true);
  const remove = card.getByRole("button", { name: /を削除/ });
  const peelSize = () =>
    remove
      .locator(".delete-peel")
      .evaluate((element) => parseFloat(getComputedStyle(element).width));
  const rightFlapCut = () =>
    card.locator(".letter-right-flap").evaluate((element) => getComputedStyle(element).clipPath);
  await expect(remove).toHaveCSS("width", "44px");
  await expect(remove).toHaveCSS("height", "44px");
  await expect.poll(peelSize).toBe(10);
  await expect(remove.locator(".delete-peel")).toHaveCSS("clip-path", "none");
  await expect(remove.locator(".delete-peel")).not.toHaveCSS("filter", /drop-shadow/);
  expect(
    await remove
      .locator(".delete-peel")
      .evaluate((element) => getComputedStyle(element, "::before").content),
  ).toBe('""');
  await expect.poll(rightFlapCut).toContain("10px");
  const rightFlap = card.locator(".letter-right-flap");
  await expect(rightFlap).toHaveCSS("background-image", "none");
  await expect(rightFlap).toHaveCSS("filter", "none");
  expect(
    await rightFlap.evaluate((element) => getComputedStyle(element, "::before").backgroundImage),
  ).toBe("none");
  expect(
    await card.evaluate((element) => {
      const seam = getComputedStyle(element.querySelector(".letter-details")!, "::after");
      const flap = getComputedStyle(element.querySelector(".letter-right-flap")!, "::before");
      return seam.clipPath === `inset(0px ${flap.width} 0px 0px)`;
    }),
  ).toBe(true);
  expect(
    await rightFlap.evaluate((element) => getComputedStyle(element, "::before").clipPath),
  ).toBe("polygon(100% 0px, 0px 13%, 0px 87%, 100% 100%)");
  await expect(remove.locator(".delete-label")).toHaveCSS("opacity", "0");
  const paperCut = () =>
    card.evaluate((element) => ({
      shadow: getComputedStyle(element.querySelector(".letter-shadow-shape")!).clipPath,
      stock: getComputedStyle(element.querySelector(".letter-stock")!).clipPath,
      filter: getComputedStyle(element.querySelector(".letter-shadow-near")!).filter,
    }));
  const restingCut = await paperCut();
  expect(restingCut.shadow).toBe(restingCut.stock);
  expect(restingCut.filter).toBe("none");
  const resting = await card.evaluate((el) => getComputedStyle(el).transform);
  await link.focus();
  await page.keyboard.press(browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab");
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).not.toBe(resting);
  await expect(link).toHaveCSS("outline-style", "solid");
  await expect(card.locator(".letter-shadow-near")).toHaveCSS("filter", "none");
  // Focus and hover may scroll a control into view; the peel must preserve its list coordinates.
  const footprint = () =>
    page
      .locator(".dated-letter")
      .first()
      .evaluate((element) => {
        const stream = element.closest<HTMLElement>(".post-stream")!;
        const box = element.getBoundingClientRect();
        const viewport = stream.getBoundingClientRect();
        return {
          x: box.x - viewport.x + stream.scrollLeft,
          y: box.y - viewport.y + stream.scrollTop,
          width: box.width,
          height: box.height,
        };
      });
  const beforePeel = await footprint();
  await remove.hover();
  await expect.poll(peelSize).toBe(28);
  await expect.poll(rightFlapCut).toContain("28px");
  await expect
    .poll(() => link.evaluate((element) => getComputedStyle(element, "::after").clipPath))
    .toContain("28px");
  await expect.poll(async () => (await paperCut()).shadow).toContain("28px");
  expect((await paperCut()).shadow).toBe((await paperCut()).stock);
  expect(await rightFlapCut()).toBe((await paperCut()).stock);
  // The fold is in front of the sheet's 3D plane, including its right seam.
  expect(
    await card.evaluate((element) => {
      const depth = (selector: string) =>
        new DOMMatrixReadOnly(getComputedStyle(element.querySelector(selector)!).transform).m43;
      return depth(".management") - depth(".letter-sheet");
    }),
  ).toBeGreaterThan(0);
  await expect(remove.locator(".delete-label")).toHaveCSS("opacity", "1");
  expect(await footprint()).toEqual(beforePeel);
  await remove.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(link).toBeVisible();
});

test("mobile envelopes keep desktop spacing while year, month and day share the left column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const cards = page.locator(".letter");
  const first = page.locator(".letters").first().locator(".dated-letter").first();
  const second = page.locator(".letters").first().locator(".dated-letter").nth(1);
  await expect(page.locator(".letters").first()).toHaveCSS("gap", "8px");
  await expect(second).toHaveCSS("margin-top", "0px");
  const firstBox = (await cards.first().boundingBox())!;
  const firstItemBox = (await first.boundingBox())!;
  const secondItemBox = (await second.boundingBox())!;
  expect(secondItemBox.y - (firstItemBox.y + firstItemBox.height)).toBeCloseTo(20, 0);
  expect(firstBox.x).toBeGreaterThanOrEqual(46);
  expect(firstBox.x).toBeLessThanOrEqual(56);
  expect(375 - (firstBox.x + firstBox.width)).toBeLessThanOrEqual(8);
  await expect(cards.first()).not.toHaveCSS("transform", "none");
  const marker = (await page.locator(".month-marker").first().boundingBox())!;
  const title = (await cards.first().locator(".letter-title").boundingBox())!;
  expect(marker.width).toBeCloseTo(52, 0);
  expect(marker.x + marker.width).toBeLessThan(title.x);
  const leftEdges = await page.evaluate(() =>
    [".month-year", ".month-number", ".post-day > .letter-day"].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().left,
    ),
  );
  expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  const draftWithoutTags = page
    .locator('.dated-letter[data-status="draft"]')
    .filter({ hasNot: page.locator(".post-tags") })
    .first();
  await expect(draftWithoutTags).toBeVisible();
  expect(
    await draftWithoutTags.evaluate((element) => {
      const row = element.querySelector(".letter-bottom")!.getBoundingClientRect();
      const draft = element.querySelector(".draft")!.getBoundingClientRect();
      return Math.abs(row.right - draft.right);
    }),
  ).toBeLessThan(1);
});

test("the desk texture and inset edges are painted behind the envelopes", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const desk = page.locator(".post-stream");
    await expect(desk).toHaveCSS("background-image", /radial-gradient/);
    await expect(desk).toHaveCSS("background-attachment", "fixed, fixed");
    await expect(desk).toHaveCSS("box-shadow", /inset/);
  }
});

test("heading starts at the upper third and envelopes accelerate below and decelerate above", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const cards = page.locator(".dated-letter");
    const heading = (await page.locator("#articles-title").boundingBox())!;
    const first = (await cards.first().locator(".letter").boundingBox())!;
    const second = (await cards.nth(1).locator(".letter").boundingBox())!;
    expect(heading.y).toBeGreaterThan(900 * 0.31);
    expect(heading.y).toBeLessThan(900 * 0.35);
    expect(first.y).toBeGreaterThan(900 * 0.36);
    expect(first.y).toBeLessThan(900 * 0.43);
    expect(first.y - heading.y - heading.height).toBeGreaterThan(20);
    expect(second.y - first.y - first.height).toBeGreaterThan(4);
    await expect(cards.nth(4).locator(".letter")).toHaveCSS(
      "animation-timeline",
      "--envelope-view",
    );
  }

  const cards = page.locator(".dated-letter");
  const card = cards.nth(4);
  const initialTop = (await card.boundingBox())!.y;
  const sampleAt = async (layoutTop: number) => {
    await page.evaluate((y) => scrollTo(0, y), initialTop - layoutTop);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    return card.evaluate((item) => ({
      layout: item.getBoundingClientRect().top,
      visual: item.querySelector(".letter")!.getBoundingClientRect().top,
    }));
  };
  const bottomStart = await sampleAt(850);
  const bottomEnd = await sampleAt(800);
  expect(bottomStart.visual - bottomEnd.visual).toBeGreaterThan(65);
  const middleStart = await sampleAt(500);
  const middleEnd = await sampleAt(400);
  expect(middleStart.visual - middleEnd.visual).toBeCloseTo(100, 0);
  const upper: { layout: number; visual: number }[] = [];
  for (const top of [300, 250, 200, 150, 100]) upper.push(await sampleAt(top));
  const upperSteps = upper.slice(1).map((position, index) => upper[index].visual - position.visual);
  expect(upperSteps.every((step) => step > 25 && step < 50)).toBe(true);
  expect(upperSteps.at(-1)!).toBeLessThan(upperSteps[0] - 5);
  await sampleAt(200);
  const previous = (await cards.nth(3).locator(".letter").boundingBox())!;
  const current = (await card.locator(".letter").boundingBox())!;
  expect(current.y).toBeLessThan(previous.y + previous.height - 20);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card.locator(".letter")).toHaveCSS("translate", "none");
});

test("envelope hover is paused during scrolling and restored afterward", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const stream = page.locator(".post-stream");
  const card = page.locator(".dated-letter").first();
  const titleInk = () =>
    card
      .locator(".letter-title")
      .evaluate((title) => getComputedStyle(title).getPropertyValue("--ink-color"));
  const normalInk = await titleInk();
  await card.locator(".letter-link").hover();
  await expect.poll(titleInk).not.toBe(normalInk);
  await expect
    .poll(() =>
      page.evaluate(() => {
        dispatchEvent(new Event("scroll"));
        return document.querySelector(".post-stream")!.hasAttribute("data-scrolling");
      }),
    )
    .toBe(true);
  const scrollingInk = await page.evaluate(() => {
    dispatchEvent(new Event("scroll"));
    return getComputedStyle(
      document.querySelector(".dated-letter .letter-title")!,
    ).getPropertyValue("--ink-color");
  });
  expect(scrollingInk).toBe(normalInk);
  await expect(stream).not.toHaveAttribute("data-scrolling", "");
  await expect.poll(titleInk).not.toBe(normalInk);
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
  const y = await page.evaluate(() => window.scrollY);
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
  await page.locator(`.letter-link[href="${href}"]`).click();
  await page.waitForURL((url) => url.pathname !== "/");
  await page.goBack();
  await expect(cards).toHaveCount(count);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
  expect(additionalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("restores the latest session position while history is still debounced", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = `blog:post-list:v1:${history.state?.postListEntry}:true`;
        return sessionStorage.getItem(key) !== null;
      }),
    )
    .toBe(true);
  // Reproduce a reload inside the history debounce window after the old document
  // has flushed on pagehide, without depending on timer or navigation timing.
  await page.addInitScript(() => {
    const key = `blog:post-list:v1:${history.state.postListEntry}:true`;
    sessionStorage.setItem(`${key}:y`, "320");
    history.replaceState({ ...history.state, postListY: 0 }, "");
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
  await expect.poll(() => page.evaluate(() => history.state.postListY)).toBe(320);
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(50000);
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
  await expect(card.locator(".post-tags .meta-tag")).toHaveCount(2);
  expect(
    await card.locator(".post-tags .meta-tag .ink").evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        return (
          style.backgroundClip.includes("text") && style.webkitTextFillColor === "rgba(0, 0, 0, 0)"
        );
      }),
    ),
  ).toBe(true);
  const draftStyle = await card.evaluate((element) => {
    const row = element.querySelector(".letter-bottom")!.getBoundingClientRect();
    const draft = element.querySelector(".draft")!.getBoundingClientRect();
    const item = element.closest(".dated-letter")!;
    const archive = element.closest(".post-stream")!;
    return {
      rightGap: Math.abs(row.right - draft.right),
      envelope: getComputedStyle(item).getPropertyValue("--envelope"),
      archiveEnvelope: getComputedStyle(archive).getPropertyValue("--envelope"),
    };
  });
  expect(draftStyle.rightGap).toBeLessThan(1);
  expect(draftStyle.envelope).not.toBe(draftStyle.archiveEnvelope);
  await card.getByRole("button", { name: /を削除/ }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator(`.letter-link[href="${path}"]`)).toHaveCount(0);
});

for (const width of [1280, 390]) {
  test(`calendar and date stay pinned while the page scrolls at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const measure = () =>
      page.evaluate(() => {
        const markerElement = document.querySelector(".month-marker")!;
        const dayElement = document.querySelector(".post-day > .letter-day")!;
        const marker = markerElement.getBoundingClientRect();
        const day = dayElement.getBoundingClientRect();
        const year = markerElement.querySelector(".month-year")!.getBoundingClientRect();
        const monthNumber = markerElement.querySelector(".month-number")!.getBoundingClientRect();
        const header = document.querySelector(".archive-header")!.getBoundingClientRect();
        const stream = document.querySelector<HTMLElement>(".post-stream")!;
        const letter = document.querySelector(".dated-letter")!.getBoundingClientRect();
        const heading = document.querySelector("#articles-title")!.getBoundingClientRect();
        return {
          marker: marker.top,
          markerBottom: marker.bottom,
          day: day.top,
          dayBottom: day.bottom,
          yearTop: year.top,
          yearLeft: year.left,
          monthNumberBottom: monthNumber.bottom,
          streamLeft: stream.getBoundingClientRect().left,
          header: header.bottom,
          streamY: stream.scrollTop,
          streamOverflow: getComputedStyle(stream).overflowY,
          maxScroll: document.documentElement.scrollHeight - innerHeight,
          stickyAfter: Math.max(
            marker.top - parseFloat(getComputedStyle(markerElement).top),
            day.top - parseFloat(getComputedStyle(dayElement).top),
          ),
          letter: letter.top,
          heading: heading.top,
          windowY: scrollY,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
    const start = await measure();
    expect(start.streamOverflow).toBe("visible");
    expect(start.streamY).toBe(0);
    if (width > 600) {
      expect(Math.abs(start.dayBottom - start.monthNumberBottom)).toBeLessThan(1);
    }
    // Exercise both sticky labels after their pinning threshold, within the actual scroll range.
    const firstY = Math.max(
      Math.ceil(start.stickyAfter) + 16,
      Math.min(200, Math.floor(start.maxScroll / 3)),
    );
    const secondY = Math.min(firstY + 200, start.maxScroll);
    expect(
      secondY - firstY,
      "the fixture must allow a substantial pinned scroll",
    ).toBeGreaterThanOrEqual(100);
    await page.evaluate((y) => window.scrollTo(0, y), firstY);
    await expect.poll(async () => (await measure()).windowY).toBe(firstY);
    const a = await measure();
    await page.evaluate((y) => window.scrollTo(0, y), secondY);
    await expect.poll(async () => (await measure()).windowY).toBe(secondY);
    const b = await measure();
    const distance = b.windowY - a.windowY;
    expect(distance).toBeGreaterThanOrEqual(100);
    expect(Math.abs(a.letter - b.letter - distance)).toBeLessThan(0.5);
    expect(Math.abs(start.heading - b.heading - (b.windowY - start.windowY))).toBeLessThan(0.5);
    expect(b.marker).toBe(a.marker);
    expect(b.day).toBe(a.day);
    expect(b.header).toBe(start.header);
    expect(b.marker).toBeGreaterThanOrEqual(b.header);
    expect(b.day).toBeGreaterThanOrEqual(b.marker);
    if (width > 600) {
      expect(Math.abs(b.yearTop - b.header - (b.yearLeft - b.streamLeft))).toBeLessThan(1);
      expect(Math.abs(b.dayBottom - b.monthNumberBottom)).toBeLessThan(1);
    } else {
      expect(Math.abs(b.yearTop - b.header - (b.yearLeft - b.streamLeft))).toBeLessThan(1);
      expect(Math.abs(b.day - b.markerBottom)).toBeLessThan(1);
    }
    expect(b.streamY).toBe(0);
    expect(b.overflow).toBe(false);
    const columns = await page
      .locator(".letters")
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(1);
  });
}

test("desk texture stays still while the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/");
  const stream = page.locator(".post-stream");
  const bounds = (await stream.boundingBox())!;
  const clip = { x: bounds.x + 50, y: 300, width: 10, height: 10 };
  const before = await page.screenshot({ clip });
  await page.evaluate(() => window.scrollTo(0, 1));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1);
  expect((await page.screenshot({ clip })).equals(before)).toBe(true);
});

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
  const y = await page.evaluate(() => window.scrollY);
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
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("scroll"));
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
  expect(additionalRequests).toEqual([]);
  await expect(page).toHaveURL(/\/$/);
});

test("does not save intermediate scroll positions during delayed restoration", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".letter");
  const firstCount = await cards.count();
  await page.getByRole("link", { name: "続きを読み込む" }).scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(firstCount);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
  ).toBeGreaterThan(600);
  await page.evaluate(() => window.scrollTo(0, 500));
  const stream = page.locator(".post-stream");
  await stream.dispatchEvent("pointerdown");
  await page.evaluate(() => {
    window.scrollBy(0, 1);
    window.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const y = history.state.postListY;
        const key = `blog:post-list:v1:${history.state.postListEntry}:true:y`;
        return y > 0 && window.scrollY === y && Number(sessionStorage.getItem(key)) === y;
      }),
    )
    .toBe(true);
  const y = await page.evaluate(() => history.state.postListY);
  await page.addInitScript(() => {
    addEventListener(
      "DOMContentLoaded",
      () => {
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
            window.dispatchEvent(new Event("scroll"));
            setTimeout(restore, 300);
            return;
          }
          restore();
        }
        window.scrollTo = delayedScroll;
      },
      { once: true },
    );
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
  // A second late browser/router scroll must not become the saved position.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y, 0);
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(y - 50);
  await expect.poll(() => page.evaluate(() => history.state.postListY)).toBeLessThan(y - 50);
});

for (const width of [1280, 390]) {
  test(`active envelope covers the sticky bar and casts shadows from the peeled shape at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const card = page.locator(".letter").first();
    const original = (await card.boundingBox())!;
    await page.mouse.move(1, 800);
    await page.evaluate((y) => window.scrollTo(0, y), original.y + 55);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    // The papers overlap now; hover the exposed title instead of the covered lower edge.
    const title = (await card.locator(".letter-title").boundingBox())!;
    await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
    await expect.poll(() => card.evaluate((element) => element.matches(":hover"))).toBe(true);
    await expect
      .poll(() =>
        card.evaluate((element) => {
          const cardBox = element.getBoundingClientRect();
          const header = document.querySelector(".archive-header")!.getBoundingClientRect();
          return element.contains(
            document.elementFromPoint(cardBox.x + cardBox.width / 2, header.y + header.height / 2),
          );
        }),
      )
      .toBe(true);

    await page.mouse.move(1, 800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await card.locator(".management button").hover();
    await expect(card.locator(".delete-peel")).toHaveCSS("width", "28px");
    await page.waitForTimeout(200);
    const shadows = await card.evaluate((element) => ({
      stock: getComputedStyle(element.querySelector(".letter-stock")!).clipPath,
      outerClip: getComputedStyle(element.querySelector(".letter-shadow")!).clipPath,
      layers: [".letter-shadow-near", ".letter-shadow-far"].map((selector) => {
        const layer = element.querySelector(selector)!;
        return {
          clip: getComputedStyle(layer).clipPath,
          filter: getComputedStyle(layer).filter,
          sourceClip: getComputedStyle(layer.firstElementChild!).clipPath,
        };
      }),
    }));
    // Both shadows follow the paper cut. Only the far shadow is blurred;
    // the close contact shadow must stay unfiltered in Safari.
    expect(shadows.outerClip).toBe("none");
    for (const layer of shadows.layers) {
      expect(layer.clip).toBe("none");
      expect(layer.sourceClip).toBe(shadows.stock);
    }
    expect(shadows.layers[0].filter).toBe("none");
    expect(shadows.layers[1].filter).toMatch(/^blur\([\d.]+px\)$/);
    const corner = await card.evaluate((element) => {
      const el = element as HTMLElement;
      const box = el.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const x = el.offsetWidth / 2 - 8;
      const y = el.offsetHeight / 2 - 8;
      return {
        x: box.x + box.width / 2 + matrix.a * x + matrix.c * y - 2,
        y: box.y + box.height / 2 + matrix.b * x + matrix.d * y - 2,
        width: 4,
        height: 4,
      };
    });
    const cutShadow = await page.screenshot({ clip: corner });
    // The fold must not cast a second, rectangular shadow into the exposed
    // lower-right corner. Hiding it leaves the envelope's diffused shadow intact.
    await card.locator(".delete-peel").evaluate((element) => {
      (element as HTMLElement).style.visibility = "hidden";
    });
    expect((await page.screenshot({ clip: corner })).equals(cutShadow)).toBe(true);
    await card.locator(".delete-peel").evaluate((element) => {
      (element as HTMLElement).style.removeProperty("visibility");
    });
    // Verify rendered pixels, not just computed clip-path: restoring a square
    // shadow source must darken the exposed corner. Diffusion remains allowed.
    await card.locator(".letter-shadow-shape").evaluateAll((elements) => {
      for (const element of elements) {
        const style = (element as HTMLElement).style;
        style.transition = "none";
        style.clipPath = "none";
      }
    });
    expect((await page.screenshot({ clip: corner })).equals(cutShadow)).toBe(false);
    await card.locator(".letter-link").hover();
    await expect(card.locator(".letter-shadow-near")).toHaveCSS("filter", "none");
    await page.evaluate(() => {
      document.body.style.zoom = "1.5";
    });
    await expect(card.locator(".letter-shadow-near")).toHaveCSS("filter", "none");
  });
}
