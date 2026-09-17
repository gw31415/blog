import { describe, expect, it } from "vitest";

import { formatJapaneseDate, formatJapaneseEraYear } from "./article";

describe("article presentation", () => {
  it("derives the localized date from the ISO publication date", () => {
    expect(formatJapaneseDate("2026-09-17")).toBe("九月十七日　木曜日");
  });

  it("derives the Japanese era and western year for the footer", () => {
    expect(formatJapaneseEraYear("2026-09-17")).toBe("令和八年 / 2026");
  });

  it("rejects a non-calendar date", () => {
    expect(() => formatJapaneseDate("2026-02-30")).toThrow("Invalid ISO date");
  });
});
