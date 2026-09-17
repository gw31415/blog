import { describe, expect, it } from "vite-plus/test";

import { INITIAL_ARTICLE } from "~/content/initial-article";
import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

import { canSwitchToView, createArticlePresentation } from "./article-shell";

describe("article shell", () => {
  it("derives visible date and footer text from the article date", () => {
    expect(createArticlePresentation(INITIAL_ARTICLE)).toEqual({
      dateLabel: "九月十七日　木曜日",
      footerRight: "令和八年 / 2026",
    });
  });

  it("keeps rendering while the date input is temporarily empty", () => {
    expect(createArticlePresentation({ publishedAt: "" })).toEqual({
      dateLabel: "公開日未設定",
      footerRight: "年未設定",
    });
  });

  it("does not switch to view while the first editor load is pending", () => {
    expect(canSwitchToView("loading")).toBe(false);
    expect(canSwitchToView("edit")).toBe(true);
  });

  it("keeps section numbers out of generated article content", () => {
    expect(INITIAL_ARTICLE_HTML).not.toContain('class="section-number"');
    expect(INITIAL_ARTICLE_HTML.match(/<h2(?:\s|>)/g)).toHaveLength(4);
  });
});
