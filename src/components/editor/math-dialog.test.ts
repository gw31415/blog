import { describe, expect, it } from "vite-plus/test";

import { validateLatex } from "./math-dialog";

describe("validateLatex", () => {
  it("accepts valid TeX and returns MathJax display HTML", () => {
    const result = validateLatex("x^2 + y^2", true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toMatch(/<mjx-container[^>]*jax="SVG"[^>]*display="true"/);
      expect(result.html).toContain('<mjx-assistive-mml unselectable="on" display="block">');
    }
  });

  it("returns a readable error for invalid TeX", () => {
    const result = validateLatex("\\frac{", false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("removes executable URLs while retaining safe HTTPS links", () => {
    const unsafe = validateLatex(String.raw`\href{javascript:alert(1)}{x}`, false);
    const safe = validateLatex(String.raw`\href{https://example.com}{x}`, false);

    expect(unsafe.ok).toBe(true);
    if (unsafe.ok) {
      expect(unsafe.html).not.toMatch(/(?:href|src)="javascript:/i);
      expect(unsafe.html).not.toContain("<a ");
    }
    expect(safe.ok).toBe(true);
    if (safe.ok) expect(safe.html).toContain('<a href="https://example.com">');
  });
});

it('supports current MathJax chemistry, physics and aligned equations',()=>{
 for(const source of [String.raw`\ce{H2O}`,String.raw`\dv{f}{x}`,String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`])expect(validateLatex(source,true).ok).toBe(true);
});
