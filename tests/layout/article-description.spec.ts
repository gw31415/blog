import { expect, test, type Page } from "@playwright/test";
import { deleteCreatedPost } from "./delete-created-post";

async function geometry(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!;
    const description = document.querySelector("[data-article-field=description]")!;
    const range = document.createRange();
    range.selectNodeContents(description);
    return {
      scroll: root.hasAttribute("data-internal-scroll") ? root.scrollTop : window.scrollY,
      boxes: [
        "[data-layout-key=header]",
        "[data-article-field=title]",
        "[data-article-field=subtitle]",
        "[data-article-field=description]",
        "header .meta",
        "article",
        "article .ProseMirror > :first-child",
      ].map((selector) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return [x, y, width, height];
      }),
      lines: [...range.getClientRects()].map(({ x, y, width, height }) => [x, y, width, height]),
    };
  });
}

function sameGeometry(before: Awaited<ReturnType<typeof geometry>>, after: typeof before) {
  expect(Math.abs(after.scroll - before.scroll), "scroll").toBeLessThanOrEqual(1);
  for (const key of ["boxes", "lines"] as const) {
    expect(after[key]).toHaveLength(before[key].length);
    after[key].forEach((rect, i) =>
      rect.forEach((value, j) =>
        expect(Math.abs(value - before[key][i][j]), `${key} ${i}, axis ${j}`).toBeLessThanOrEqual(
          1,
        ),
      ),
    );
  }
}

for (const width of [1280, 390]) {
  test(`description saves, keeps caret and preserves empty/wrapped geometry at ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "新規記事" }).click();
    await expect(page).toHaveURL(/\/blog\/[0-9A-HJKMNP-TV-Z]{26}\?edit=1$/);
    const path = new URL(page.url()).pathname;
    const description = page.locator("[data-article-field=description]");
    const toggle = async (mode: "view" | "edit") => {
      // Input and explicit scrolling can start the sticky header's 240ms transition.
      await page.waitForTimeout(300);
      await page
        .locator(".article-header-edit:visible, .article-sticky-edit:visible")
        .last()
        .click();
      await expect(page.locator("article")).toHaveAttribute("data-editor-mode", mode, {
        timeout: 30_000,
      });
      await page.waitForTimeout(250);
    };
    try {
      await expect(description).toHaveAttribute("contenteditable", "true");
      await page
        .locator("[data-article-field=title]")
        .fill("長いタイトルの折り返しと説明欄の位置を確認する記事です。".repeat(2));
      await page.locator("[data-article-field=tags]").fill("説明 レイアウト 検証");
      await page.locator("[data-article-field=tags]").press("Space");
      await page
        .locator("article .ProseMirror")
        .fill("本文の位置とスクロールを確認します。".repeat(100));
      await page.evaluate(() =>
        document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!.scrollTo(0, 0),
      );
      await toggle("view");
      await page.reload();
      await page.evaluate(() => document.fonts.ready);

      for (const value of [
        "",
        "記事の説明です。副題とは別に、一覧や共有に使う内容をここで編集できます。".repeat(4),
      ]) {
        if (value) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await toggle("edit");
          await description.fill(value);
          await description.press("End");
          await page.keyboard.type("追記");
          await expect(description).toBeFocused();
          await expect(description).toHaveText(value + "追記");
          await description.press("Enter");
          await description.press("Shift+Enter");
          await expect(description.locator("br, div, p")).toHaveCount(0);
          await description.fill(value);
          // Return from the browser's caret scrolling before saving the new fixture.
          // The unchanged-content geometry comparisons below never correct scroll.
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelector<HTMLElement>("[data-virtual-keyboard-viewport]")!.scrollTo(0, 0);
          });
          await toggle("view");
          await page.reload();
          await expect(description).toHaveText(value);
          await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", value);
        }
        for (const offset of [0, 400]) {
          await page.evaluate((y) => window.scrollTo(0, y), offset);
          await page.waitForTimeout(300);
          const before = await geometry(page);
          for (let cycle = 0; cycle < 2; cycle++) {
            await toggle("edit");
            sameGeometry(before, await geometry(page));
            if (!offset) {
              await description.focus();
              sameGeometry(before, await geometry(page));
              if (!value) {
                expect(
                  await description.evaluate((el) => getComputedStyle(el, "::before").visibility),
                ).toBe("visible");
              }
            }
            if (value && !offset && !cycle) {
              await page.screenshot({ path: testInfo.outputPath("description-edit.png") });
            }
            await toggle("view");
            sameGeometry(before, await geometry(page));
            if (!value) {
              expect(
                await description.evaluate((el) => getComputedStyle(el, "::before").visibility),
              ).toBe("hidden");
            }
          }
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await toggle("edit");
      await description.fill("");
      await toggle("view");
      await page.reload();
      await expect(description).toBeEmpty();
    } finally {
      await deleteCreatedPost(page, path);
    }
  });
}
