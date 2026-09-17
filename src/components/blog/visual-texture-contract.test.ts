import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(new URL("./blog.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./blog.tsx", import.meta.url), "utf8");

describe("paper visual texture", () => {
  it("doubles every graph-paper and scuff stroke without changing dash patterns", () => {
    const grid = component.match(/export const GridLayer[\s\S]*?<\/svg>/)?.[0] ?? "";

    for (const width of [
      'stroke-width="1.2"',
      'stroke-width="1.24"',
      'stroke-width="1.16"',
      'stroke-width="1.56"',
      'stroke-width="1.4"',
      'stroke-width="1.8"',
    ]) {
      expect(grid).toContain(width);
    }
    expect(grid).toContain('stroke-dasharray="14 .8 8 1.3 12 .9"');
    expect(grid).toContain('stroke-dasharray="9 .7 15 1.1 11 .8"');
  });

  it("uses two varied ink-distress tiles instead of four repeated pixel masks", () => {
    const inkRule = css.match(/\.ink\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
    expect(inkRule.match(/url\(/g)).toHaveLength(2);
    expect(inkRule).toContain("shape-rendering='geometricPrecision'");
  });

  it("adds dark embedded dirt and fibers to the single paper texture tile", () => {
    const paperRule = css.match(/\.paper-texture\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
    expect(paperRule).toContain("%23382f26");
    expect(paperRule).toContain("stroke-linecap='round'");
  });

  it("prefixes automatic kanji section numbers so 一 cannot read as a rule", () => {
    expect(css).toContain('content: "第" counter(section, cjk-ideographic);');
  });
});
