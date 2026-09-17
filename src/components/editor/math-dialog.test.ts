import { describe, expect, it } from "vite-plus/test";

import { validateLatex } from "./math-dialog";

describe("validateLatex", () => {
  it("accepts valid KaTeX and returns display HTML", () => {
    const result = validateLatex("x^2 + y^2", true);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.html).toContain("katex-display");
  });

  it("returns a readable error for invalid KaTeX", () => {
    const result = validateLatex("\\frac{", false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});
