import { test, expect } from "@playwright/test";

for (const width of [1280, 390])
  test(`shared render source editor at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/blog/document-showcase");
    await page.locator(".article-header-edit").click();
    await expect(page.locator("[data-editor-mode=edit]")).toBeVisible({ timeout: 45000 });
    const toolbarLayout = await page.locator(".editor-formatting").evaluate((toolbar) => {
      const bar = toolbar.getBoundingClientRect();
      const buttons = [...toolbar.querySelectorAll("button")].map((button) =>
        button.getBoundingClientRect(),
      );
      return {
        barWidth: bar.width,
        articleWidth: document.querySelector("article .ProseMirror")!.getBoundingClientRect().width,
        gaps: buttons.slice(1).map((button, index) => button.left - buttons[index].right),
      };
    });
    expect(Math.abs(toolbarLayout.barWidth - toolbarLayout.articleWidth)).toBeLessThan(2);
    expect(Math.max(...toolbarLayout.gaps) - Math.min(...toolbarLayout.gaps)).toBeLessThan(2);
    const math = page.locator('article [data-type="block-math"]').first();
    await math.click();
    const dialog = page.getByRole("dialog", { name: "数式", exact: true });
    const input = dialog.getByRole("textbox", { name: "LaTeX" });
    await input.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveCount(0);
    await expect(dialog.locator(".code-language-label")).toHaveText("latex");
    const sourceLayout = await dialog.evaluate((element) => {
      const source = element.querySelector(".render-source-code")!;
      const article = document.querySelector("article .ProseMirror")!;
      const articleCodeFrame = document.querySelector("article pre.code-block")!;
      const articleCode = articleCodeFrame.querySelector("code")!;
      const textarea = element.querySelector("textarea")!;
      return {
        width: source.getBoundingClientRect().width,
        articleWidth: article.getBoundingClientRect().width,
        lineHeight: getComputedStyle(textarea).lineHeight,
        articleLineHeight: getComputedStyle(articleCode).lineHeight,
        border: getComputedStyle(source).borderLeft,
        articleBorder: getComputedStyle(articleCodeFrame).borderLeft,
        background: getComputedStyle(source).backgroundColor,
        articleBackground: getComputedStyle(articleCodeFrame).backgroundColor,
        articleMargin: getComputedStyle(articleCodeFrame).marginTop,
        bodyLineHeight: getComputedStyle(article).lineHeight,
      };
    });
    expect(Math.abs(sourceLayout.width - sourceLayout.articleWidth)).toBeLessThan(2);
    expect(sourceLayout.lineHeight).toBe(sourceLayout.articleLineHeight);
    expect(sourceLayout.border).toBe(sourceLayout.articleBorder);
    expect(sourceLayout.background).toBe(sourceLayout.articleBackground);
    // Code spacing follows one body line, including user-adjusted type sizes.
    expect(parseFloat(sourceLayout.articleMargin)).toBeCloseTo(parseFloat(sourceLayout.bodyLineHeight), 1);
    await expect(page.locator(".editor-dock .render-source-dialog")).toHaveCount(1);
    await expect(page.locator(".editor-formatting")).toBeHidden();
    await expect(dialog).not.toHaveAttribute("aria-modal", "true");
    const source = String.raw`\begin{aligned}a&=b\\c&<d\end{aligned}`;
    await input.fill(source);
    await expect(dialog.locator("mjx-container")).toBeVisible();
    await expect(
      dialog.locator("code .hljs-tag, code .hljs-name, code .hljs-keyword"),
    ).not.toHaveCount(0);
    await expect(dialog.getByRole("button")).toHaveCount(2);
    await dialog.getByRole("button", { name: "適用", exact: true }).click();
    await math.click();
    await expect(input).toHaveValue(source);
    await input.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page.locator(".editor-formatting")).toBeVisible();
    const figure = page.locator("article .mermaid-diagram").first();
    await figure.click();
    const mermaid = page.getByRole("dialog", { name: "Mermaid", exact: true });
    await expect(mermaid.locator(".code-language-label")).toHaveText("mermaid");
    await mermaid
      .locator("textarea")
      .fill(
        "flowchart TB\n" + Array.from({ length: 30 }, (_, i) => `A${i} --> A${i + 1}`).join("\n"),
      );
    await expect(mermaid.locator("img.mermaid-image")).toBeVisible();
    const frameStyles = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll("article .mermaid-diagram .figure-field"),
        document.querySelector(".render-source-preview .figure-field"),
      ];
      return fields.map((field) => {
        const style = getComputedStyle(field!);
        return {
          background: style.backgroundImage,
          border: style.borderTop,
          padding: style.padding,
        };
      });
    });
    expect(frameStyles).toHaveLength(3);
    expect(frameStyles[1]).toEqual(frameStyles[0]);
    expect(frameStyles[2]).toEqual(frameStyles[0]);
    const geometry = await mermaid.evaluate((el) => {
      const preview = el.querySelector(".render-source-preview")!;
      const panel = el.querySelector(".render-source-panel")!;
      const p = preview.getBoundingClientRect(),
        f = panel.getBoundingClientRect();
      return {
        backgroundColor: getComputedStyle(preview).backgroundColor,
        top: p.top,
        bottom: f.bottom,
        previewBottom: p.bottom,
        panelTop: f.top,
        scrolls:
          el.querySelector(".figure-field")!.scrollHeight >
          el.querySelector(".figure-field")!.clientHeight,
        border: getComputedStyle(el.querySelector(".figure-field")!).borderTopStyle,
        background: getComputedStyle(el.querySelector(".figure-field")!).backgroundImage,
      };
    });
    expect(geometry.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    const buttons = await mermaid.locator(".render-source-actions button").evaluateAll((elements) =>
      elements.map((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    );
    expect(buttons.every((button) => button.width <= 90 && button.height <= 36)).toBe(true);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(844);
    expect(geometry.previewBottom).toBeLessThan(geometry.panelTop);
    expect(geometry.scrolls).toBe(true);
    expect(geometry.border).toBe("solid");
    expect(geometry.background).toBe(frameStyles[0].background);
    await page.screenshot({ path: `.cache/render-source-${width}.png` });
    await mermaid.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page.locator(".editor-formatting")).toBeVisible();
  });
