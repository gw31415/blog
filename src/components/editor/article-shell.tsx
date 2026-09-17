import { component$ } from "@qwik.dev/core";

import { BlogFooter, BlogHeader, BlogPaper } from "~/components/blog/blog";
import { formatJapaneseDate, formatJapaneseEraYear, type ArticleDraft } from "~/content/article";
import { INITIAL_ARTICLE } from "~/content/initial-article";
import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

export function createArticlePresentation(article: Pick<ArticleDraft, "publishedAt">) {
  return {
    dateLabel: formatJapaneseDate(article.publishedAt),
    footerRight: formatJapaneseEraYear(article.publishedAt),
  };
}

export const ArticleShell = component$(() => {
  const presentation = createArticlePresentation(INITIAL_ARTICLE);

  return (
    <BlogPaper>
      <BlogHeader
        category={INITIAL_ARTICLE.category}
        dateTime={INITIAL_ARTICLE.publishedAt}
        dateLabel={presentation.dateLabel}
        title={INITIAL_ARTICLE.title}
        subtitle={INITIAL_ARTICLE.subtitle}
      />

      <article
        class="article-content"
        data-layout-key="article"
        data-editor-mount
        dangerouslySetInnerHTML={INITIAL_ARTICLE_HTML}
      ></article>

      <BlogFooter left="日々の記録" right={presentation.footerRight} />
    </BlogPaper>
  );
});
