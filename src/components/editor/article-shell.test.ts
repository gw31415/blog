import { describe, expect, it } from "vite-plus/test";

import { INITIAL_ARTICLE } from "~/content/initial-article";
import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

import { createArticlePresentation } from "./article-shell";

describe("article shell", () => {
  it("derives visible date and footer text from the article date", () => {
    expect(createArticlePresentation(INITIAL_ARTICLE)).toEqual({
      dateLabel: "九月十七日　木曜日",
      footerRight: "令和八年 / 2026",
    });
  });

  it("keeps section numbers out of generated article content", () => {
    expect(INITIAL_ARTICLE_HTML).not.toContain('class="section-number"');
    expect(INITIAL_ARTICLE_HTML.match(/<h2(?:\s|>)/g)).toHaveLength(4);
  });
});
