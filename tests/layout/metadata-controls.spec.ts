import { test, expect } from "@playwright/test";

test("mobile metadata stays single-line and native controls remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/blog/document-showcase");
  await page.locator(".article-header-edit").click();
  const title = page.locator("[data-article-field=title]");
  await expect(title).toHaveAttribute("contenteditable", "true", {timeout: 30000});
  for (const field of ["title", "subtitle", "tags"]) {
    const input = page.locator(`[data-article-field=${field}]`);
    await input.fill("確認");
    await input.press("End");
    await input.press("Enter");
    await input.press("Shift+Enter");
    await expect(input.locator("br,div,p")).toHaveCount(0);
    await input.fill("");
    await expect.poll(() => input.evaluate(el => ({ content: getComputedStyle(el, '::before').content, visibility: getComputedStyle(el, '::before').visibility }))).toEqual({content: `"${field === 'title' ? 'タイトルを入力' : field === 'subtitle' ? 'サブタイトルを入力' : 'タグを入力'}"`, visibility: 'visible'});
    await expect(input.locator("br,div,p")).toHaveCount(0);
    await input.evaluate((el) =>
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: (() => {
            const d = new DataTransfer();
            d.setData("text/plain", "第一行\n第二行");
            return d;
          })(),
        }),
      ),
    );
    await expect(input.locator("br,div,p")).toHaveCount(0);
  }
  const date = page.locator("input[type=date]");
  await date.evaluate((el) => {
    (el as HTMLInputElement).showPicker = () => {
      el.setAttribute("data-picker-called", "true");
    };
  });
  await date.click();
  await expect(date).toHaveAttribute("data-picker-called", "true");
  const option = page.locator(".code-language-select option").first();
  expect(await option.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(53, 47, 37)");
  const sticky = page.locator(".article-sticky-title");
  expect(await sticky.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  await page.getByRole('button', { name: '1行目の操作', exact: true }).first().click();
  const checkbox = page.getByRole('checkbox', {name: '先頭行を見出しにする'});
  await expect(checkbox).toBeVisible();
  expect(await checkbox.evaluate(el => getComputedStyle(el).appearance)).toBe('none');
  for (const [kind, symbol] of [['note', 'i'], ['warning', '!']]) {
    expect(await page.locator(`.aside[data-kind="${kind}"] .aside-label`).first().evaluate(el => getComputedStyle(el, '::before').content)).toBe(`"${symbol}"`);
  }
  // Leave the fixture unsaved.
});
