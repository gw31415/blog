import { sendMarkdown } from "~/server/markdown-response";
import { $, component$ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  type DocumentHead,
  type RequestHandler,
  type RequestEventCommon,
} from "@qwik.dev/router";

import { ArticleShell } from "~/components/editor/article-shell";
import { BLOG_NAME } from "~/content/article";
import { canManagePosts } from "~/content/permissions";
import { canonicalPath } from "~/content/post-url";
import { database, findPost, redirectCanonical, savePostContent } from "~/server/posts";
import { renderDocument } from "~/server/render-document";
import { renderPost } from "~/server/render-post";

async function findRequestPost(event: RequestEventCommon) {
  let pending = event.sharedMap.get("blog.post") as ReturnType<typeof findPost> | undefined;
  if (!pending) {
    pending = findPost(database(event), event.params.id);
    event.sharedMap.set("blog.post", pending);
  }
  return pending;
}

export const onRequest: RequestHandler = async (event) => {
  if (event.params.id.endsWith(".md")) {
    await sendMarkdown(event);
    return;
  }
  const post = await findRequestPost(event);
  if (!post) throw event.error(404, "記事が見つかりません。");
  if (!event.internalRequest && event.originalUrl.pathname !== canonicalPath(post)) {
    redirectCanonical(event, `${canonicalPath(post)}${event.originalUrl.search}`);
  }
};

export const usePost = routeLoader$(async (event) => {
  const post = await findRequestPost(event);
  if (!post) throw event.error(404, "記事が見つかりません。");
  const rendered = await renderDocument(post.body, event, post.id);
  return { post, ...renderPost(post.body, rendered.diagrams, rendered.math) };
});

export const useSavePost = routeAction$(async (values, event) => {
  if (!canManagePosts()) throw event.error(403, "保存できません。");
  const post = await findRequestPost(event);
  if (!post) throw event.error(404, "記事が見つかりません。");
  try {
    await savePostContent(database(event), post.id, values);
    event.sharedMap.delete("blog.post");
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
        category: post.tags.join("、"),
        publishedAt: post.published_at?.slice(0, 10) ?? "",
        title: post.title,
        subtitle: post.subtitle ?? "",
        body: post.body,
        editingState: post.editing_state,
        description: post.description ?? "",
        tags: post.tags,
      }}
      initialHtml={data.value.html}
      initialContent={data.value.content}
      publicationStatus={post.status}
      canonicalAlias={post.canonical_alias}
      canEdit={canManagePosts()}
      autoEditFromQuery
      onSave$={$(async (draft) => {
        const { validateMermaidDocument, prepareMermaidArtifacts } =
          await import("~/components/editor/mermaid-renderer");
        if (draft.status === "published") {
          await validateMermaidDocument(draft.body);
        }
        const result = await save.submit({
          category: draft.category,
          publishedAt: draft.publishedAt,
          title: draft.title,
          subtitle: draft.subtitle === (post.subtitle ?? "") ? post.subtitle : draft.subtitle,
          body: JSON.stringify(draft.body),
          renderArtifacts: JSON.stringify(await prepareMermaidArtifacts(draft.body)),
          editingState: draft.editingState,
          tags: JSON.stringify(draft.tags),
          description:
            draft.description === (post.description ?? "") ? post.description : draft.description,
          formatVersion: 2,
          bodyFormat: "tiptap-json",
          contentSchemaVersion: 1,
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
          {BLOG_NAME}
        </a>
      </div>
    </ArticleShell>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost).post;
  return {
    title: post.title,
    meta: [{ name: "description", content: post.description ?? post.subtitle ?? "" }],
  };
};
