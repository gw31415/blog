import { describe, expect, it } from "vite-plus/test";

import { canSwitchToView, createArticlePresentation } from "./article-shell";

describe("article shell", () => {
  it("derives visible date and footer text from the article date", () => {
    expect(createArticlePresentation({ publishedAt: "2026-09-17" })).toEqual({
      dateLabel: "令和八年　九月十七日　木曜日",
      shortDate: "2026.9.17",
      footerRight: "令和八年 / 2026",
    });
  });

  it("keeps rendering while the date input is temporarily empty", () => {
    expect(createArticlePresentation({ publishedAt: "" })).toEqual({
      dateLabel: "公開日未設定",
      shortDate: "日付未設定",
      footerRight: "年未設定",
    });
  });

  it("does not switch to view while the first editor load is pending", () => {
    expect(canSwitchToView("loading")).toBe(false);
    expect(canSwitchToView("edit")).toBe(true);
  });
});
