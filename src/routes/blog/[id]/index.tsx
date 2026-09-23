import { $, component$ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  type DocumentHead,
  type RequestHandler,
} from "@qwik.dev/router";

import { ArticleShell } from "~/components/editor/article-shell";
import { canManagePosts } from "~/content/permissions";
import { canonicalPath } from "~/content/post-url";
import { database, findPost, redirectCanonical, savePostContent } from "~/server/posts";
import { renderPost } from "~/server/render-post";

export const onRequest: RequestHandler = async (event) => {
  const post = await findPost(database(event), event.params.id);
  if (!post) throw event.error(404, "記事が見つかりません。");
  if (!event.internalRequest && event.originalUrl.pathname !== canonicalPath(post)) {
    redirectCanonical(event, `${canonicalPath(post)}${event.originalUrl.search}`);
  }
};

export const usePost = routeLoader$(async (event) => {
  const post = await findPost(database(event), event.params.id);
  if (!post) throw event.error(404, "記事が見つかりません。");
  return { post, ...renderPost(post.body_markdown) };
});

export const useSavePost = routeAction$(async (values, event) => {
  if (!canManagePosts()) throw event.error(403, "保存できません。");
  const post = await findPost(database(event), event.params.id);
  if (!post) throw event.error(404, "記事が見つかりません。");
  try {
    await savePostContent(database(event), post.id, values);
    return { ok: true };
  } catch (error) {
    return event.fail(400, {
      message: error instanceof Error ? error.message : "保存できませんでした。",
    });
  }
});

export default component$(() => {
  const data = usePost();
  const save = useSavePost();
  const post = data.value.post;
  return (
    <ArticleShell
      key={post.id}
      article={{
        category: post.category,
        publishedAt: post.published_at,
        title: post.title,
        subtitle: post.subtitle,
        bodyMarkdown: post.body_markdown,
      }}
      initialHtml={data.value.html}
      initialContent={data.value.content}
      publicationStatus={post.status}
      canonicalAlias={post.canonical_alias}
      canEdit={canManagePosts()}
      autoEditFromQuery
      onSave$={$(async (draft) => {
        const result = await save.submit({
          category: draft.category,
          publishedAt: draft.publishedAt,
          title: draft.title,
          subtitle: draft.subtitle,
          bodyMarkdown: draft.bodyMarkdown,
          status: draft.status,
          alias: draft.alias,
        });
        if (result.status && result.status >= 400)
          throw new Error(
            "message" in result.value ? String(result.value.message) : "保存できませんでした。",
          );
        window.location.replace(`/blog/${draft.alias || post.id}`);
      })}
    >
      <div class="article-topbar">
        <a class="article-site-title" href="/">
          ブログ名（仮）
        </a>
      </div>
    </ArticleShell>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost).post;
  return { title: post.title, meta: [{ name: "description", content: post.subtitle }] };
};
