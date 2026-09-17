import { describe, expect, it } from "vite-plus/test";

import { replaceCodeLanguage } from "./code-language";

describe("replaceCodeLanguage", () => {
  it("changes the language without discarding the fence caption", () => {
    expect(replaceCodeLanguage("css 和文本文", "typescript")).toBe("typescript 和文本文");
  });

  it("keeps the caption distinguishable when plaintext is selected", () => {
    expect(replaceCodeLanguage("html 文章の構造", "plaintext")).toBe("plaintext 文章の構造");
  });
});
