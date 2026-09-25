import { expect, test } from "@playwright/test";

test.describe("the home page works before JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, width] of [
    ["/", 1280],
    ["/blog/document-showcase", 1280],
    ["/", 390],
    ["/blog/document-showcase", 390],
  ] as const) {
    test(`paper material never delays readable content or moves it on ${path} at ${width}px`, async ({
      page,
      browserName,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      let releaseMaterial!: () => void;
      const materialReady = new Promise<void>((resolve) => {
        releaseMaterial = resolve;
      });
      const requests: string[] = [];
      await page.route("**/assets/materials/**", async (route) => {
        requests.push(route.request().url());
        await materialReady;
        await route.continue();
      });
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const heading = page.getByRole("heading", { level: 1 });
        const surface = page.locator(path === "/" ? ".letter-sheet" : "main.paper").first();
        await expect(heading).toBeVisible();
        await expect(surface).toBeVisible();
        await expect.poll(() => requests.length).toBe(1);
        expect(new URL(requests[0]).pathname).toMatch(/\.avif$/);
        const fallback = path === "/" ? surface.locator(".letter-stock") : surface;
        expect(
          await fallback.evaluate((element) => getComputedStyle(element).backgroundColor),
        ).not.toMatch(/transparent|rgba\([^)]*,\s*0\)/);
        if (browserName === "chromium") {
          await expect
            .poll(() =>
              page.evaluate(() => performance.getEntriesByName("first-contentful-paint").length),
            )
            .toBe(1);
        }
        // WebKit's global fonts.ready also waits for pending SVG images.
        // Load the displayed fonts explicitly while keeping the texture held.
        await page.evaluate(() =>
          Promise.all(
            [...document.querySelectorAll("h1, .letter-title, main.paper")].map((element) => {
              const style = getComputedStyle(element);
              return document.fonts.load(
                `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
              );
            }),
          ).then(() => undefined),
        );
        const bounds = (await surface.boundingBox())!;
        const clip = {
          x: bounds.x + bounds.width / 2,
          y: Math.max(0, bounds.y) + 20,
          width: 64,
          height: 32,
        };
        // WebKit's screenshot API waits on fonts.ready internally too. Compare
        // it with a fully settled failed-image page instead of a pending image.
        let beforeMaterial = browserName === "webkit" ? undefined : await page.screenshot({ clip });
        releaseMaterial();
        await page.waitForLoadState("networkidle");
        expect(await surface.boundingBox()).toEqual(bounds);
        // Also catches SVG paint-server failures: downloading the asset is not
        // enough if a browser leaves the actual paper surface untextured.
        const paintedMaterial = await page.screenshot({ clip });
        await test.info().attach("paper-color", {
          body: paintedMaterial,
          contentType: "image/png",
        });
        // A downloaded, visible pattern can still lose its tint in Safari.
        // Check rendered pixels rather than the declared filter/blend styles.
        const color = await page.evaluate(async (png) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, image.width, image.height);
          const mean = [0, 0, 0];
          for (let i = 0; i < data.length; i += 4) {
            for (let channel = 0; channel < 3; channel++) mean[channel] += data[i + channel];
          }
          return mean.map((total) => total / (image.width * image.height));
        }, paintedMaterial.toString("base64"));
        expect(color[0] - color[2], `paper RGB: ${color.join(", ")}`).toBeGreaterThan(
          path === "/" ? 14 : 25,
        );
        expect(color[1] - color[2]).toBeGreaterThan(path === "/" ? 7 : 14);
        if (browserName === "webkit") {
          const withoutImage = await page.context().newPage();
          try {
            await withoutImage.setViewportSize({ width, height: 900 });
            await withoutImage.route("**/assets/materials/**", (route) => route.abort());
            await withoutImage.goto(path, { waitUntil: "networkidle" });
            beforeMaterial = await withoutImage.screenshot({ clip });
          } finally {
            await withoutImage.close();
          }
        }
        expect(paintedMaterial.equals(beforeMaterial!)).toBe(false);
        expect(requests).toHaveLength(1);
      } finally {
        releaseMaterial();
      }
    });
  }

  for (const width of [320, 390, 1280]) {
    test(`SSR content and native links remain usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.locator(".letter-link").count()).toBeGreaterThan(0);

      const geometry = await page.evaluate(() => {
        const nav = document.querySelector(".site-topbar")!.getBoundingClientRect();
        const scroller = document.querySelector<HTMLElement>(".post-stream")!;
        return {
          pageFits: document.documentElement.scrollWidth <= innerWidth,
          contentFits: scroller.scrollWidth <= scroller.clientWidth,
          navFits: nav.left >= 0 && nav.right <= innerWidth,
        };
      });
      expect(geometry).toEqual({ pageFits: true, contentFits: true, navFits: true });

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("記事");
      await expect(page.locator("#articles-title")).toBeInViewport();
      const first = page.locator(".letter-link").first();
      const href = await first.getAttribute("href");
      const title = await first.locator(".letter-title").textContent();
      await first.click();
      await expect(page).toHaveURL((url) => url.pathname === href);
      await expect(page.locator('[data-article-field="title"]')).toHaveText(title!);
    });
  }
});

test("keyboard skip link moves focus and the archive scroll to the journal", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  // macOS WebKit uses Option-Tab for link traversal with its default keyboard preferences.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  const skip = page.getByRole("link", { name: "記事一覧へ移動" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#journal")).toBeFocused();
  await expect(page.locator("#articles-title")).toBeInViewport();
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(page.locator(".letter-link").first()).toBeFocused();
});

test("reduced motion leaves the paper and article interaction still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".letter-link").first().focus();
  expect(
    await page
      .locator(".archive")
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
  ).toBe(0);
  await expect(page.locator(".letter").first()).toHaveCSS("transform", "none");
  await expect(page.locator(".letter-mouth").first()).toHaveCSS("transition-duration", "0s");
  await page.locator(".dated-letter").first().hover();
  await expect(page.locator(".letter-mouth").first()).toHaveCSS("transform", "none");
});

test("the tilted envelope opens on hover without moving the list layout", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const footprint = page.locator(".dated-letter").first();
  const letter = footprint.locator(".letter");
  const next = page.locator(".dated-letter").nth(1);
  const resting = await letter.evaluate((element) => getComputedStyle(element).transform);
  expect(resting).not.toBe("none");
  const bounds = (await footprint.boundingBox())!;
  const nextBounds = await next.boundingBox();
  await letter.locator(".letter-link").hover({ position: { x: 80, y: 30 } });
  await expect
    .poll(() =>
      footprint.evaluate((element) => {
        const fold = element.querySelector(".letter-mouth")!;
        return (
          new DOMMatrixReadOnly(getComputedStyle(fold).transform).m11 < -0.5 &&
          element
            .getAnimations({ subtree: true })
            .every((animation) => animation.playState !== "running")
        );
      }),
    )
    .toBe(true);
  expect(await letter.evaluate((element) => getComputedStyle(element).transform)).not.toBe(resting);
  expect(await footprint.boundingBox()).toEqual(bounds);
  expect(await next.boundingBox()).toEqual(nextBounds);
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      footprint
        .locator(".letter-mouth")
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11),
    )
    .toBeGreaterThan(0.9);
  await expect
    .poll(() => letter.evaluate((element) => getComputedStyle(element).transform))
    .toBe(resting);
  expect(await footprint.boundingBox()).toEqual(bounds);
  expect(await next.boundingBox()).toEqual(nextBounds);
});

test("forced colors preserve readable headings, links and article summaries", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".letter-link").first()).toBeInViewport();
  const textStyles = await page
    .locator(".archive-header .site-link, #articles-title, .letter-title, .letter-description")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, fill: style.webkitTextFillColor, opacity: style.opacity };
      }),
    );
  for (const style of textStyles) {
    expect(style.opacity).not.toBe("0");
    expect(style.color).not.toMatch(/transparent|rgba\([^)]*,\s*0\)/);
    expect(style.fill).not.toMatch(/transparent|rgba\([^)]*,\s*0\)/);
  }
  await expect(page.locator(".letter-stock").first()).toBeHidden();
  await page.goto("/blog/document-showcase");
  await expect(page.locator(".article-stock")).toBeHidden();
});

test("article data waits for navigation intent even after envelopes become visible", async ({
  page,
}) => {
  const articleRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^\/blog\/.+\/(?:q-loader[^/]*|q-data)\.json$/.test(url.pathname)) {
      articleRequests.push(url.pathname);
    }
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".letter-link").first()).toBeInViewport();
  await page.waitForLoadState("networkidle");
  expect(articleRequests).toEqual([]);

  const first = page.locator(".letter-link").first();
  const href = await first.getAttribute("href");
  await first.focus();
  // Qwik deliberately disables prefetching in its development build.
  if ((await page.locator("html").getAttribute("q:render")) !== "ssr-dev") {
    await expect.poll(() => articleRequests.some((url) => url.startsWith(`${href}/`))).toBe(true);
  }
});
