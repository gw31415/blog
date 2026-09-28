import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "blog_dev_manager", value: "1", url: baseURL! }]);
});

for (const width of [1280, 390]) {
  test(`emphasis stays visible without increasing line spacing at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await page.getByRole("button", { name: "新規記事" }).click();
    const editor = page.locator("article .ProseMirror");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.click();
    await page.keyboard.type("/em");
    await page
      .getByRole("listbox", { name: "本文コマンド" })
      .getByRole("option")
      .filter({ has: page.locator(".document-command-name", { hasText: /^\/em$/ }) })
      .click();
    await page.keyboard.insertText("傍点を付けても本文の行間を保ちます。".repeat(8));
    await page.keyboard.press("Enter");
    await page.keyboard.type("後続の段落");
    await page.locator("[data-article-field=title]").fill("傍点の表示確認");
    const measure = () =>
      editor.locator("p").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { y: r.y, h: r.height, w: r.width };
        }),
      );
    const check = async () => {
      const em = editor.locator("em").first();
      await expect(em).toHaveCSS("text-emphasis-style", "none");
      const layer = page.locator(".article-emphasis-layer");
      await expect(layer).toHaveAttribute("aria-hidden", "true");
      await expect.poll(() => layer.locator("circle").count()).toBeGreaterThan(100);
      await expect(em.locator("span")).toHaveCount(0);
      const withDots = await measure();
      const style = await page.addStyleTag({
        content: ".article-emphasis-layer {display:none!important}",
      });
      const withoutDots = await measure();
      await style.evaluate((el) => el.parentNode?.removeChild(el));
      for (let i = 0; i < withDots.length; i++)
        for (const key of ["y", "h", "w"] as const)
          expect(Math.abs(withDots[i][key] - withoutDots[i][key])).toBeLessThanOrEqual(1);
      return withDots;
    };
    await check();
    await page.locator(".article-header-edit").click();
    await expect(editor).not.toHaveAttribute("contenteditable", "true");
    await page.reload();
    for (let cycle = 0; cycle < 2; cycle++) {
      const before = await check();
      await page.locator(".article-header-edit").click();
      await expect(editor).toHaveAttribute("contenteditable", "true");
      const editing = await check();
      await page.locator(".article-header-edit").click();
      await expect(editor).not.toHaveAttribute("contenteditable", "true");
      const after = await check();
      for (const actual of [editing, after])
        for (let i = 0; i < before.length; i++)
          for (const key of ["y", "h", "w"] as const)
            expect(Math.abs(actual[i][key] - before[i][key])).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: `.cache/emphasis-visible-${width}.png`, fullPage: true });
  });
}

// Exercise the shared renderer in the real article surface. Ruby input/storage
// is intentionally not part of this fixture or of the current document schema.
test("annotation geometry, ruby priority, and user text spacing", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await expect(page.locator("article .ProseMirror")).toHaveAttribute("contenteditable", "true");
  const article = page.locator("article.article-content");
  await expect(article).toHaveAttribute("data-annotations-ready", "");
  await article.evaluate((root) => {
    // No save follows: replace only this page's DOM for the presentation fixture.
    root.innerHTML = `<p id="annotation-lines"><span>基準の本文</span><br><ruby><span data-ruby-base>漢字</span><rt>かんじ</rt></ruby><span>隣の本文</span><br><em>傍点、。「」ABC</em><span>最後の本文</span></p><p id="annotation-wrap"><em>${"日本語、句読点。「強調」office ABC123。".repeat(12)}</em></p><p><em><ruby><span data-ruby-base>紫陽花</span><rt>あじさい</rt></ruby></em></p><p>前後の本文と<ruby><span data-ruby-base>一</span><rt>とてもながいよみがな</rt></ruby>を確認。</p>`;
  });
  await article.evaluate((root) => {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    for (const rt of root.querySelectorAll("rt")) {
      const letters = [...segmenter.segment(rt.textContent ?? "")].map(({ segment }) => {
        const span = root.ownerDocument.createElement("span");
        span.textContent = segment;
        return span;
      });
      rt.replaceChildren(...letters);
    }
  });
  const layer = page.locator(".article-emphasis-layer");
  const expectedDots = await article.evaluate((root) => {
    const s = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return [...root.querySelectorAll("em")]
      .filter((em) => !em.querySelector("ruby"))
      .reduce(
        (n, em) =>
          n +
          [...s.segment(em.textContent ?? "")].filter(
            ({ segment }) => !/^[\p{P}\p{Z}\p{C}]+$/u.test(segment),
          ).length,
        0,
      );
  });
  await expect.poll(() => layer.locator("circle").count()).toBe(expectedDots);
  // Geometry alone is insufficient: Chromium can report circles for an SVG
  // with a zero-height viewport without painting any of them.
  const dotBox = await layer
    .locator("circle")
    .first()
    .evaluate((circle) => {
      const { x, y, width, height } = circle.getBoundingClientRect();
      return { x, y, width, height };
    });
  const clip = {
    x: Math.floor(dotBox.x) - 2,
    y: Math.floor(dotBox.y) - 2,
    width: Math.ceil(dotBox.width) + 4,
    height: Math.ceil(dotBox.height) + 4,
  };
  const paintedDot = await page.screenshot({ clip, animations: "disabled" });
  const hideDots = await page.addStyleTag({
    content: ".article-emphasis-layer {visibility:hidden!important}",
  });
  const hiddenDot = await page.screenshot({ clip, animations: "disabled" });
  await hideDots.evaluate((style) => style.parentNode?.removeChild(style));
  expect(paintedDot.equals(hiddenDot)).toBe(false);
  await expect(article.locator("em span:not([data-ruby-base]):not(rt span)")).toHaveCount(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 850 });
    for (const size of [16, 24]) {
      await article.evaluate((root, fontSize) => {
        root.style.fontSize = fontSize + "px";
      }, size);
      await expect
        .poll(() =>
          article.evaluate((root) => {
            const ruby = root.querySelector("ruby")!;
            const rt = ruby.querySelector("rt")!;
            const range = root.ownerDocument.createRange();
            range.selectNodeContents(ruby.querySelector("[data-ruby-base]")!);
            const baseRect = range.getBoundingClientRect();
            const style = getComputedStyle(ruby.querySelector("[data-ruby-base]")!);
            const fontSize = parseFloat(style.fontSize);
            const emTop = baseRect.top + (baseRect.height - fontSize) / 2;
            const gap = parseFloat(style.lineHeight) - fontSize;
            range.selectNodeContents(rt);
            const reading = range.getBoundingClientRect();
            const center = reading.top + reading.height / 2;
            return Math.abs((center - (emTop - gap)) / gap - 0.6);
          }),
        )
        .toBeLessThan(0.01);
      await expect(article.locator("rt").first()).toHaveCSS("font-size", `${size * 0.4375}px`);
      await expect
        .poll(() =>
          article.evaluate((root) => {
            const rt = root.querySelectorAll("rt")[1];
            const box = rt.getBoundingClientRect();
            const letters = [...rt.children].map((letter) => letter.getBoundingClientRect());
            const gaps = [
              letters[0].left - box.left,
              box.right - letters.at(-1)!.right,
              ...letters.slice(1).map((letter, i) => letter.left - letters[i].right),
            ];
            return Math.max(...gaps) - Math.min(...gaps);
          }),
        )
        .toBeLessThan(0.1);
      await expect
        .poll(() =>
          article.evaluate((root) => {
            const textRect = (element: Element) => {
              const range = root.ownerDocument.createRange();
              range.selectNodeContents(element);
              return range.getBoundingClientRect();
            };
            return Math.max(
              ...[...root.querySelectorAll("ruby")].map((ruby) => {
                const base = textRect(ruby.querySelector("[data-ruby-base]")!);
                const reading = textRect(ruby.querySelector("rt")!);
                return Math.abs(base.x + base.width / 2 - reading.x - reading.width / 2);
              }),
            );
          }),
        )
        .toBeLessThan(0.1);
      await expect
        .poll(() =>
          article.evaluate((root) => {
            const rect = (el: Element) => {
              const r = root.ownerDocument.createRange();
              r.selectNodeContents(el);
              return r.getBoundingClientRect();
            };
            const refs = [...root.querySelectorAll("#annotation-lines > span")].map(rect);
            const base = rect(root.querySelector("[data-ruby-base]")!);
            const leading = parseFloat(getComputedStyle(root).lineHeight);
            return Math.max(
              Math.abs(refs[1].y - refs[0].y - leading),
              Math.abs(refs[2].y - refs[1].y - leading),
              Math.abs(base.y - refs[1].y),
            );
          }),
        )
        .toBeLessThan(0.1);
      await expect
        .poll(() =>
          article.evaluate((root) => {
            const em = root.querySelector("#annotation-lines em")!;
            const r = document.createRange();
            r.setStart(em.firstChild!, 0);
            r.setEnd(em.firstChild!, 1);
            const text = r.getBoundingClientRect();
            const dot = root
              .parentElement!.querySelector(".article-emphasis-layer circle")!
              .getBoundingClientRect();
            return Math.abs(dot.x + dot.width / 2 - text.x - text.width / 2);
          }),
        )
        .toBeLessThan(0.1);
    }
  }
  // A reader's spacing preferences must trigger repaint and a natural ruby fallback.
  const preferences = await page.addStyleTag({
    content: `article.article-content * {line-height:1.8!important;letter-spacing:.12em!important;word-spacing:.16em!important} article.article-content {font-family:sans-serif!important}`,
  });
  await expect(article.locator("ruby").first()).toHaveAttribute("data-ruby-natural", "");
  await expect(article.locator("ruby").first()).toHaveCSS("display", "ruby");
  await preferences.evaluate((style) => style.parentNode?.removeChild(style));
  await expect(article.locator("ruby").first()).not.toHaveAttribute("data-ruby-natural", "");
  await expect(article.locator("ruby").first()).toHaveCSS("display", "inline-grid");
  await page.screenshot({
    path: `.cache/annotations-${testInfo.project.name}.png`,
    fullPage: true,
  });
  // Decorative marks never enter the accessibility tree or copyable text.
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  await expect(layer).toHaveAttribute("focusable", "false");
  await expect(article.locator("rt").first()).toHaveText("かんじ");
  await page.emulateMedia({ media: "print" });
  await expect(layer).toHaveCSS("display", "none");
  await expect(article.locator("em").first()).toHaveCSS("text-emphasis-style", "dot");
});
