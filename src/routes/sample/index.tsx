import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";

import { ArticleShell } from "~/components/editor/article-shell";
import { INITIAL_ARTICLE } from "~/content/initial-article";

export default component$(() => <ArticleShell />);

export const head: DocumentHead = { title: `${INITIAL_ARTICLE.title}（デザイン試作）` };
