import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`only the content slips while chrome stays fixed at ${width}px`, async ({ page }) => {
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
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.viewTransitionName))
      .toBe("none");
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
      const old = getComputedStyle(
        document.documentElement,
        "::view-transition-old(paper-content)",
      );
      const next = getComputedStyle(
        document.documentElement,
        "::view-transition-new(paper-content)",
      );
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
    const surface = await page.evaluate(() => {
      const root = document.documentElement;
      const group = getComputedStyle(root, "::view-transition-group(paper-content)");
      const box = document.querySelector("main.paper")!.getBoundingClientRect();
      const header = document.querySelector("[data-site-header]")!;
      const headerBottom =
        getComputedStyle(header).visibility === "hidden"
          ? 0
          : header.getBoundingClientRect().bottom;
      const matrix = new DOMMatrix(group.transform);
      return {
        rootName: getComputedStyle(root).viewTransitionName,
        headerName: getComputedStyle(document.querySelector("[data-site-header]")!)
          .viewTransitionName,
        contentName: getComputedStyle(document.querySelector("main.paper")!).viewTransitionName,
        left: matrix.m41,
        top: matrix.m42,
        width: parseFloat(group.width),
        height: parseFloat(group.height),
        overflow: group.overflow,
        expected: {
          left: box.left,
          top: headerBottom,
          width: box.width,
          height: innerHeight - headerBottom,
        },
      };
    });
    expect(surface.rootName).toBe("none");
    expect(surface.headerName).toBe("none");
    expect(surface.contentName).toBe("paper-content");
    expect(surface.overflow).toBe("clip");
    for (const key of ["left", "top", "width", "height"] as const)
      expect(surface[key]).toBeCloseTo(surface.expected[key], 1);
    await page.screenshot({ path: `.cache/paper-slip-${width}.png` });
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().duration === 390)
        .forEach((a) => {
          a.currentTime = 300;
        }),
    );
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
      const old = getComputedStyle(
        document.documentElement,
        "::view-transition-old(paper-content)",
      );
      const next = getComputedStyle(
        document.documentElement,
        "::view-transition-new(paper-content)",
      );
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

  test(`scrolled article returns using only its visible slice at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options);
        if (typeof options === "object" && options?.duration === 390) animation.pause();
        return animation;
      };
    });
    const finish = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().duration === 390)
          .forEach((a) => a.finish()),
      );
    const waitForSlip = () =>
      expect
        .poll(() =>
          page.evaluate(
            () =>
              document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
          ),
        )
        .toBe(3);
    await page.goto("/");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.viewTransitionName))
      .toBe("none");
    await page.evaluate(() => window.scrollTo(0, 30));
    const homeScroll = await page.evaluate(() => window.scrollY);
    await page.locator(".letter-link").first().click();
    await waitForSlip();
    const landingTop = await page.evaluate(() => {
      const snapshot = getComputedStyle(
        document.documentElement,
        "::view-transition-new(paper-content)",
      );
      return {
        top: parseFloat(snapshot.top),
        liveTop: document.querySelector("main.paper")!.getBoundingClientRect().top,
      };
    });
    expect(landingTop.top).toBeCloseTo(landingTop.liveTop, 1);
    await finish();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.effect?.getTiming().duration === 390).length,
        ),
      )
      .toBe(0);
    await page.evaluate(() => window.scrollTo(0, 500));
    const scroll = await page.evaluate(() => window.scrollY);
    expect(scroll).toBeGreaterThan(100);
    const sourceTop = (await page.locator("main.paper").boundingBox())!.y;
    await expect.poll(() => page.evaluate(() => history.state?._qRouterScroll?.y)).toBe(scroll);
    await page.goBack();
    await expect(page.locator("main.archive")).toBeVisible();
    await waitForSlip();
    const crop = await page.evaluate(() => {
      const old = getComputedStyle(
        document.documentElement,
        "::view-transition-old(paper-content)",
      );
      return {
        top: parseFloat(old.top),
        clipTop: parseFloat(old.clipPath.slice(6)),
        scroll: window.scrollY,
        groupTop: new DOMMatrix(
          getComputedStyle(document.documentElement, "::view-transition-group(paper-content)")
            .transform,
        ).m42,
      };
    });
    expect(crop.top + crop.groupTop).toBeCloseTo(sourceTop, 1);
    expect(crop.clipTop).toBeCloseTo(Math.max(0, crop.groupTop - sourceTop), 1);
    expect(crop.scroll).toBeCloseTo(homeScroll, 1);
    await page.screenshot({ path: `.cache/paper-scrolled-return-${width}.png` });
    await finish();
    await page.goForward();
    await expect(page.locator("main.paper")).toBeVisible();
    await waitForSlip();
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 1);
    await finish();
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
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (typeof options === "object" && options?.duration === 390) animation.pause();
      return animation;
    };
  });
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
