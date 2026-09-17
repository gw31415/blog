import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const component = readFileSync(new URL("./blog.tsx", import.meta.url), "utf8");

describe("paper visual texture", () => {
  it("uses thinner, darker dashed grid strokes while leaving solid scuffs unchanged", () => {
    const grid = component.match(/export const GridLayer[\s\S]*?<\/svg>/)?.[0] ?? "";
    const dashedPaths = [...grid.matchAll(/<path[\s\S]*?stroke-dasharray[\s\S]*?\/>/g)].map(
      ([path]) => ({
        opacity: path.match(/stroke="rgb\([^/]+\/ ([^)]+)\)"/)?.[1],
        width: path.match(/stroke-width="([^"]+)"/)?.[1],
      }),
    );

    expect(dashedPaths).toEqual([
      { opacity: "20%", width: ".6" },
      { opacity: "16%", width: ".62" },
      { opacity: "18%", width: ".58" },
      { opacity: "20%", width: ".6" },
      { opacity: "16%", width: ".62" },
      { opacity: "18%", width: ".58" },
      { opacity: "32%", width: ".78" },
      { opacity: "32%", width: ".78" },
      { opacity: "10%", width: ".7" },
    ]);
    expect(grid).toContain('stroke-dasharray="14 .8 8 1.3 12 .9"');
    expect(grid).toContain('stroke-dasharray="9 .7 15 1.1 11 .8"');
    expect(grid.match(/stroke-width="1\.8"/g)).toHaveLength(2);
  });
});
