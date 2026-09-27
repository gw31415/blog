import { expect, test } from "@playwright/test";

const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/document-showcase";

for (const width of [390, 1280]) {
  test(`article breadcrumbs keep the original scroll reveal behavior at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(article);
    const header = page.locator("[data-site-header]");
    const breadcrumbs = header.locator("nav[aria-label='パンくずリスト']");
    await expect(breadcrumbs.locator("li")).toHaveCount(2);
    const title = await page.locator('[data-article-field="title"]').textContent();
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(title!);
    await expect(header).toHaveAttribute("data-header-mode", "scroll-reveal");
    await expect(header).toHaveCSS("visibility", "hidden");
    await expect(page.locator(".article-topbar .site-breadcrumbs li")).toHaveCount(1);
    await expect(page.locator(".article-topbar .article-sticky-title")).toHaveCount(0);
    await expect(page.locator(".article-topbar .site-link")).not.toHaveAttribute("aria-current");
    for (const y of [1, 400]) {
      await page.evaluate((scroll) => window.scrollTo(0, scroll), y);
      await expect(header).toBeVisible();
      await expect(header).toHaveCSS("opacity", "1");
      await expect
        .poll(async () => Math.abs((await header.boundingBox())!.y))
        .toBeLessThanOrEqual(1);
    }
    const gaps = await breadcrumbs.evaluate((nav) => {
      const range = document.createRange();
      range.selectNodeContents(nav.querySelector(".site-link")!);
      const site = range.getBoundingClientRect();
      const separator = nav.querySelector(".article-sticky-separator")!.getBoundingClientRect();
      const title = nav.querySelector(".article-sticky-title")!.getBoundingClientRect();
      return [separator.left - site.right, title.left - separator.right];
    });
    for (const gap of gaps) expect(gap).toBeCloseTo(8, 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveCSS("visibility", "hidden");
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveCSS("visibility", "visible");
    await breadcrumbs.getByRole("link", { name: "amas.dev" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("navigation", { name: "パンくずリスト" }).getByRole("listitem"),
    ).toHaveCount(1);
  });

  test(`list and article use the same card header geometry at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const geometry = () =>
      page.locator("[data-site-header]").evaluate((header) => {
        const style = getComputedStyle(header);
        const rect = header.getBoundingClientRect();
        const nav = header.querySelector<HTMLElement>(".site-topbar")!.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          padding: style.padding,
          borderTop: style.borderTop,
          borderBottom: style.borderBottom,
          navigationWidth: nav.width,
          navigationHeight: nav.height,
        };
      });
    await page.goto("/");
    const home = await geometry();
    await page.goto(article);
    expect(await geometry()).toEqual(home);
    expect(home.height).toBe(52);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator("[data-site-header]")).toHaveAttribute(
      "data-header-surface",
      "paper",
    );
  });
}
