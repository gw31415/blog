import { test, expect } from "@playwright/test";
import { MERMAID_CONFIG } from "../../src/components/editor/mermaid-theme";
import { mermaidImageHTML } from "../../src/components/editor/mermaid-contract";
import { finalizeMermaidSVG } from "../../src/components/editor/mermaid-svg";

test("paper theme measures bold labels and masks relationships in both rendering paths", async ({
  page,
}) => {
  await page.setContent('<!doctype html><body style="font-size:16px"></body>');
  await page.addScriptTag({ path: "public/mermaid/mermaid.min.js" });
  const sources = [
    'flowchart LR\nA["`**記事**を読む`"] -->|確認| B[公開]',
    "sequenceDiagram\nactor Reader\nReader->>Article: 記事を読む",
    'C4Dynamic\nContainer(a,"記事","HTML")\nContainer(b,"記事庫","DB")\nRel(a,b,"記事を要求")',
    'gitGraph\ncommit id: "初稿"\ncommit tag: "公開版"',
    "stateDiagram-v2\nstate 執筆 {\n[*] --> 下書き\n下書き --> 推敲\n}",
  ];
  for (const [index, source] of sources.entries()) {
    const raw = await page.evaluate(
      async ({ config, source, index }) => {
        const m = (window as any).mermaid;
        m.initialize(config);
        return (await m.render(`theme-${index}`, source)).svg;
      },
      { config: MERMAID_CONFIG, source, index },
    );
    const svg = await page.evaluate(finalizeMermaidSVG, raw);
    await page.evaluate((svg) => {
      document.body.innerHTML = svg;
    }, svg);
    const geometry = await page.locator("svg").evaluate((el: SVGSVGElement) => ({
      width: el.getBoundingClientRect().width,
      natural: el.viewBox.baseVal.width,
    }));
    expect(geometry.width).toBeCloseTo(geometry.natural, 0);
    if (index === 0) {
      const bold = await page
        .locator('[font-weight="bold"]')
        .first()
        .evaluate((el) => ({
          family: getComputedStyle(el).fontFamily,
          weight: getComputedStyle(el).fontWeight,
        }));
      expect(bold.family).toContain("Hiragino Sans");
      expect(bold.weight).toBe("600");
    }
    if (index === 1) await expect(page.locator(".paper-message-background")).toHaveCount(1);
    if (index === 2) await expect(page.locator(".paper-relation-background")).toHaveCount(1);
    await page.evaluate((html) => {
      document.body.innerHTML = html;
    }, mermaidImageHTML(svg));
    await page.locator("img").evaluate(async (el: HTMLImageElement) => {
      await el.decode();
    });
    await page.locator("body").evaluate((el) => {
      el.style.fontSize = "20px";
    });
    expect(
      await page.locator("img").evaluate((el) => el.getBoundingClientRect().width),
    ).toBeCloseTo(geometry.natural * 1.25, 0);
    await page.locator("body").evaluate((el) => { el.style.width = "180px"; });
    expect(await page.locator("img").evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(180);
    await page.locator("body").evaluate((el) => {
      el.style.fontSize = "16px";
      el.style.width = "";
    });
  }
});
