import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`paper slip opens an article at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options);
        if (typeof options === "object" && options?.duration === 390) animation.pause();
        return animation;
      };
    });
    await page.goto("/");
    const link = page.locator(".letter-link").first();
    const href = await link.getAttribute("href");
    await link.click();
    await expect(page).toHaveURL(new RegExp(href!));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
        ),
      )
      .toBe(3);
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => a.pause()),
    );
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => {
          a.currentTime = 170;
        }),
    );
    const layers = await page.evaluate(() => {
      const old = getComputedStyle(document.documentElement, "::view-transition-old(root)");
      const next = getComputedStyle(document.documentElement, "::view-transition-new(root)");
      return {
        oldTransform: old.transform,
        oldOpacity: old.opacity,
        newY: new DOMMatrix(next.transform).m42,
        newAboveOld: Number(next.zIndex) > Number(old.zIndex),
      };
    });
    expect(layers.oldTransform).toBe("none");
    expect(layers.oldOpacity).toBe("1");
    expect(layers.newY).toBeGreaterThan(0);
    expect(layers.newAboveOld).toBe(true);
    await page.screenshot({ path: `.cache/paper-slip-${width}.png` });
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => a.finish()),
    );
    await expect(page.locator("main.paper")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
        ),
      )
      .toBe(0);
    await page.goBack();
    await expect(page.locator(".letter-link").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
        ),
      )
      .toBe(3);
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => {
          a.pause();
          a.currentTime = 280;
        }),
    );
    const returning = await page.evaluate(() => {
      const old = getComputedStyle(document.documentElement, "::view-transition-old(root)");
      const next = getComputedStyle(document.documentElement, "::view-transition-new(root)");
      return {
        newTransform: next.transform,
        oldY: new DOMMatrix(old.transform).m42,
        above: Number(old.zIndex) > Number(next.zIndex),
      };
    });
    expect(returning.newTransform).toBe("none");
    expect(returning.oldY).toBeGreaterThan(0);
    expect(returning.above).toBe(true);
    await page.screenshot({ path: `.cache/paper-return-${width}.png` });
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => a.finish()),
    );
  });
}

test("reduced motion opens an article without slipping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".letter-link").first().click();
  await expect(page.locator("main.paper")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
    ),
  ).toBe(0);
});

test("Escape finishes the slip and leaves the article usable", async ({ page }) => {
  await page.goto("/");
  await page.locator(".letter-link").first().click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
      ),
    )
    .toBe(3);
  await page.keyboard.press("Escape");
  await expect(page.locator("main.paper")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
      ),
    )
    .toBe(0);
});

test("browsers without view transitions still open articles", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, "startViewTransition");
  });
  await page.goto("/");
  await page.locator(".letter-link").first().click();
  await expect(page.locator("main.paper")).toBeVisible();
});
