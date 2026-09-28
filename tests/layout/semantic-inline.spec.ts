import { expect, test } from "@playwright/test";
import { deleteCreatedPost } from "./delete-created-post";

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!process.env.BLOG_EDIT_PARITY, "Requires local development test data");
  if (!baseURL) throw new Error("Missing local test URL");
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL }]);
});

for (const width of [1280, 390]) {
  test(`semantic inline input and layout at ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await page.getByRole("button", { name: "新規記事" }).click();
    const editor = page.locator("article .ProseMirror");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    const path = new URL(page.url()).pathname;
    try {
      await editor.click();
      for (const [source, tag, value] of [
        ["**重要**", "strong", "重要"],
        ["*太字*", "b", "太字"],
        ["_日本語の斜体 italic_", "i", "日本語の斜体 italic"],
        ["__下線__", "u", "下線"],
        ["==注目==", "mark", "注目"],
      ]) {
        await page.keyboard.type(source);
        await expect(editor.locator(tag).last()).toHaveText(value);
        await page.keyboard.press("Enter");
      }
      for (const [id, tag, value] of [
        ["em", "em", "傍点"],
        ["sub", "sub", "下付き"],
        ["sup", "sup", "上付き"],
      ]) {
        await page.keyboard.type("/" + id);
        const list = page.getByRole("listbox", { name: "本文コマンド" });
        await expect(list).toBeVisible();
        await list
          .getByRole("option")
          .filter({
            has: page.locator(".document-command-name", { hasText: new RegExp("^/" + id + "$") }),
          })
          .click();
        await page.keyboard.type(value);
        await expect(editor.locator(tag).last()).toHaveText(value);
        await page.keyboard.press("ControlOrMeta+/");
        await page.getByRole("textbox", { name: "コマンド検索" }).fill(id);
        await page
          .getByRole("listbox", { name: "本文コマンド" })
          .getByRole("option")
          .filter({
            has: page.locator(".document-command-name", { hasText: new RegExp("^/" + id + "$") }),
          })
          .click();
        await page.keyboard.press("Enter");
      }
      for (const [shortcut, tag] of [
        ["ControlOrMeta+b", "b"],
        ["ControlOrMeta+i", "i"],
        ["ControlOrMeta+u", "u"],
        ["ControlOrMeta+Alt+s", "strong"],
      ]) {
        await page.keyboard.press(shortcut);
        await page.keyboard.type("key" + tag);
        await page.keyboard.press(shortcut);
        await expect(editor.locator(tag).last()).toHaveText("key" + tag);
        await page.keyboard.press("Enter");
      }
      await page.keyboard.press("ControlOrMeta+Shift+h");
      await page.keyboard.type("keyHighlight");
      await page.keyboard.press("ControlOrMeta+Shift+h");
      await expect(editor.locator("mark").last()).toHaveText("keyHighlight");
      await page.keyboard.press("Enter");
      await page.keyboard.type("next paragraph");
      const strong = editor.locator("strong").first();
      await expect(strong).toHaveCSS("color", "rgb(112, 28, 40)");
      await expect(editor.locator("b").first()).toHaveCSS("font-weight", "700");
      await expect(editor.locator("i").first()).toHaveCSS("font-style", "oblique 10deg");
      const title = page.locator("[data-article-field=title]");
      await title.fill("書式確認");
      const measure = async () => {
        await expect(editor.locator("i").first()).toHaveCSS("font-style", "oblique 10deg");
        await expect(editor.locator("i").first()).toHaveCSS("font-synthesis", "style");
        return page.evaluate(() => {
          const items = [
            document.querySelector("[data-article-field=title]"),
            ...document.querySelectorAll("article .ProseMirror > p"),
          ];
          return items.map((el) => {
            const r = el!.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          });
        });
      };
      const button = () => page.locator(".article-header-edit");
      await button().click();
      await expect(editor).not.toHaveAttribute("contenteditable", "true");
      await page.reload();
      await expect(page.locator("article strong").first()).toHaveText("重要");
      for (let i = 0; i < 2; i++) {
        const before = await measure();
        await button().click();
        await expect(editor).toHaveAttribute("contenteditable", "true");
        const editing = await measure();
        await button().click();
        await expect(editor).not.toHaveAttribute("contenteditable", "true");
        const after = await measure();
        for (const candidate of [editing, after]) {
          expect(candidate).toHaveLength(before.length);
          candidate.forEach((rect, j) => {
            for (const key of ["x", "y", "w", "h"] as const)
              expect(Math.abs(rect[key] - before[j][key])).toBeLessThanOrEqual(1);
          });
        }
      }
      await page.screenshot({ path: `.cache/semantic-inline-${width}.png`, fullPage: true });
    } finally {
      await deleteCreatedPost(page, path);
    }
  });
}
