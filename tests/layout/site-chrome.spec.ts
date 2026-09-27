import { expect, test, type Page } from "@playwright/test";

const article = process.env.BLOG_CHROME_ARTICLE ?? "/blog/document-showcase";
const measure = (page: Page) =>
  page.evaluate(() => {
    const paper = document.querySelector("main")!.getBoundingClientRect();
    return Object.fromEntries(
      [".site-topbar", ".page-footer"].map((selector) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return [selector, { left: box.left - paper.left, right: paper.right - box.right }];
      }),
    );
  });

for (const width of [927, 390]) {
  test(`shared site chrome at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 717 });
    await page.goto("/");
    const home = await measure(page);
    await expect(page.locator("#articles-title")).toHaveCSS("background-image", "none");
    await expect(page.locator(".more p").last()).toHaveText("記事は以上です");
    await page.goto(article);
    expect(await measure(page)).toEqual(home);
    expect(home[".site-topbar"]).toEqual({ left: 0, right: 0 });
    expect(home[".page-footer"]).toEqual({ left: 16, right: 16 });
    await page.locator(".page-footer").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-site-header]")).toBeVisible();
    await page.screenshot({ path: `.cache/site-chrome-${width}.png` });
  });

  test(`site chrome stays fixed through editing at ${width}px`, async ({ page, baseURL }) => {
    test.skip(!process.env.BLOG_EDIT_PARITY, "Requires a development server with local test data");
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 717 });
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.goto(article);
    const controls = await page.evaluate(() => {
      const content = document.querySelector(".article-content")!.getBoundingClientRect();
      const bar = document.querySelector(".article-topbar")!.getBoundingClientRect();
      const link = document.querySelector(".article-topbar .site-link")!;
      const button = document.querySelector(".article-topbar .article-header-edit")!;
      const range = document.createRange();
      range.selectNodeContents(link);
      const linkText = range.getBoundingClientRect();
      range.selectNodeContents(button.querySelector(".article-edit-line > span")!);
      const buttonText = range.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      return {
        left: linkText.left - content.left,
        right: content.right - buttonText.right,
        centerY: buttonBox.y + buttonBox.height / 2 - (bar.y + bar.height / 2),
        textBottom: buttonText.bottom - linkText.bottom,
      };
    });
    for (const gap of Object.values(controls)) expect(Math.abs(gap)).toBeLessThanOrEqual(1);
    const edit = page.locator(".article-header-edit");
    await edit.hover();
    await expect(edit).toHaveCSS("padding-right", "6px");
    await page.screenshot({ path: `.cache/edit-highlight-${width}.png` });
    await expect(page.locator(".meta .article-header-edit")).toHaveCount(0);
    const capture = () =>
      page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
        return {
          scroll: root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY,
          rects: [
            ".content",
            ".article-topbar",
            ".article-header-edit",
            "[data-layout-key='header']",
            ".article-content",
            ".page-footer",
          ].map((selector) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        };
      });
    for (const scroll of [0, 800]) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      await page.waitForTimeout(300);
      for (let cycle = 0; cycle < 2; cycle++) {
        const before = await capture();
        const button = page.locator(scroll ? ".article-sticky-edit" : ".article-header-edit");
        const clickButton = async () => {
          // Mode changes transfer the scroll owner and update the reveal header.
          // Wait for the visible control, rather than clicking through its fade.
          await expect
            .poll(() =>
              button.evaluate((element) => {
                const r = element.getBoundingClientRect();
                return element.contains(
                  document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
                );
              }),
            )
            .toBe(true);
          const box = (await button.boundingBox())!;
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        };
        await clickButton();
        await expect(page.locator("article[data-editor-mode='edit']")).toBeVisible();
        await expect(button).toHaveText("完了");
        await expect(page.locator("[data-internal-scroll]")).toBeVisible();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        const editing = await capture();
        before.rects.forEach((rect, i) =>
          rect.forEach((value, j) => {
            expect(
              Math.abs(editing.rects[i][j] - value),
              JSON.stringify({ scroll, cycle, i, j, before, editing }),
            ).toBeLessThanOrEqual(1);
          }),
        );
        await clickButton();
        await expect(button).toHaveText("編集");
        await expect(page.locator("[data-internal-scroll]")).toHaveCount(0);
        const after = await capture();
        expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(1);
        before.rects.forEach((rect, i) =>
          rect.forEach((value, j) => {
            expect(Math.abs(after.rects[i][j] - value)).toBeLessThanOrEqual(1);
          }),
        );
      }
    }
  });

  test(`image management shares archive texture and breadcrumbs at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    test.skip(
      !process.env.BLOG_EDIT_PARITY,
      "Requires development manager access to local test data",
    );
    await page.context().addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
    await page.setViewportSize({ width, height: 717 });
    const texture = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        return [
          style.backgroundColor,
          style.backgroundImage,
          style.backgroundSize,
          style.backgroundPosition,
        ];
      });
    await page.goto("/");
    const homeTexture = await texture(".post-stream");
    await page.getByRole("link", { name: "画像", exact: true }).click();
    await expect(page).toHaveURL("/manage/images");
    const breadcrumb = page.getByRole("navigation", { name: "パンくずリスト" });
    await expect(breadcrumb.locator("li")).toHaveCount(2);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("画像の管理");
    await expect(page.locator(".site-topbar-actions")).toBeHidden();
    expect(await texture("main.archive")).toEqual(homeTexture);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(page).toHaveTitle("画像の管理 - amas.dev");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `.cache/image-management-${width}.png` });
  });
}
