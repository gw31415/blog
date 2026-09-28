import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`page navigation is immediate and preserves history scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.addInitScript(() => {
      let transitions = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) {
        Object.defineProperty(document, "startViewTransition", {
          value: (...args: unknown[]) => {
            transitions++;
            return Reflect.apply(start, document, args);
          },
        });
      }
      Object.defineProperty(window, "__testViewTransitions", { get: () => transitions });
    });
    await page.goto("/");
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    const stylesheets = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    const documents: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    const assertNavigation = async () => {
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
      expect(await page.evaluate(() => Reflect.get(window, "__testViewTransitions"))).toBe(0);
      expect(documents).toEqual([]);
      expect(
        await page
          .locator('link[rel="stylesheet"]')
          .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
      ).toEqual(expect.arrayContaining(stylesheets));
    };
    const link = page.locator(".letter-link").first();
    const href = await link.getAttribute("href");
    await link.scrollIntoViewIfNeeded();
    const homeScroll = await page.evaluate(() => window.scrollY);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("main.paper")).toHaveCSS("position", "relative");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await assertNavigation();

    await page.evaluate(() => window.scrollTo(0, 500));
    const articleScroll = await page.evaluate(() => window.scrollY);
    expect(articleScroll).toBeGreaterThan(100);
    await expect
      .poll(() => page.evaluate(() => history.state?.["_qRouterScroll"]?.y))
      .toBe(articleScroll);
    await page.goBack();
    await expect(page.locator("main.archive")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(homeScroll);
    await assertNavigation();
    await page.goForward();
    await expect(page.locator("main.paper")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(articleScroll);
    await assertNavigation();

    await page.locator(".article-sticky-header .site-link").click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("main.archive")).toBeVisible();
    await assertNavigation();
  });
}
