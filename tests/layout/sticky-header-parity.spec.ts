import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`article reveals its compact header on document scroll at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/blog/document-showcase");
    const header = page.locator("[data-scroll-header]");
    await expect(header).toHaveCSS("visibility", "hidden");
    await page.evaluate(() => window.scrollTo(0, 1));
    await expect(header).toHaveCSS("opacity", "1");
    await expect(header).toHaveCSS("visibility", "visible");
    const rect = await header.boundingBox();
    expect(rect).not.toBeNull();
    expect(Math.abs(rect!.y)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveCSS("opacity", "1");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveCSS("visibility", "hidden");
  });

  test(`list and article use the same compact header geometry at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const sharedGeometry = () =>
      page.locator("[data-site-header]").evaluate((header) => {
        const outer = getComputedStyle(header);
        const outerRect = header.getBoundingClientRect();
        const navigation = header.querySelector<HTMLElement>(".site-topbar")!;
        const navigationStyle = getComputedStyle(navigation);
        const navigationRect = navigation.getBoundingClientRect();
        const action = header.querySelector<HTMLButtonElement>("button")!;
        const actionStyle = getComputedStyle(action);
        const actionRect = action.getBoundingClientRect();
        return {
          outer: {
            width: outerRect.width,
            height: outerRect.height,
            padding: outer.padding,
            borderBottom: outer.borderBottom,
            boxShadow: outer.boxShadow,
            fontFamily: outer.fontFamily,
            fontSize: outer.fontSize,
            lineHeight: outer.lineHeight,
            zIndex: outer.zIndex,
          },
          navigation: {
            width: navigationRect.width,
            height: navigationRect.height,
            gap: navigationStyle.gap,
            fontFamily: navigationStyle.fontFamily,
            fontSize: navigationStyle.fontSize,
            lineHeight: navigationStyle.lineHeight,
          },
          action: {
            height: actionRect.height,
            minHeight: actionStyle.minHeight,
            padding: actionStyle.padding,
            border: actionStyle.border,
            borderRadius: actionStyle.borderRadius,
            fontFamily: actionStyle.fontFamily,
            fontSize: actionStyle.fontSize,
            lineHeight: actionStyle.lineHeight,
            color: actionStyle.color,
          },
        };
      });

    await page.goto("/");
    const listHeader = await sharedGeometry();
    await expect(page.locator("[data-site-header]")).toHaveAttribute(
      "data-header-surface",
      "glass",
    );

    await page.goto("/blog/document-showcase");
    await page.evaluate(() => window.scrollTo(0, 1));
    await expect(page.locator("[data-scroll-header]")).toHaveCSS("visibility", "visible");
    expect(await sharedGeometry()).toEqual(listHeader);
    await expect(page.locator("[data-site-header]")).toHaveAttribute(
      "data-header-surface",
      "paper",
    );
  });
}
