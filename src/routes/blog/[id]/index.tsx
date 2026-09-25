import { BlogTopbar } from "~/components/molecules/topbar";
import { sendMarkdown } from "~/server/markdown-response";
import { $, component$ } from "@qwik.dev/core";
import {
  useNavigate,
  routeAction$,
  routeLoader$,
  type DocumentHead,
  type RequestHandler,
  type RequestEventCommon,
} from "@qwik.dev/router";

import { ArticleShell } from "~/components/templates/article-shell";
import { CONTENT_SCHEMA_VERSION } from "~/content/document";
import { canManagePosts } from "~/content/permissions";
import { canonicalPath } from "~/content/post-url";
import { database, findPost, redirectCanonical, savePostContent } from "~/server/posts";
import { renderDocument } from "~/server/render-document";
import { renderPost } from "~/server/render-post";

async function findRequestPost(event: RequestEventCommon) {
  const cached: unknown = event.sharedMap.get("blog.post");
  // Only this function writes blog.post; Qwik sharedMap erases its value type.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  let pending = cached as ReturnType<typeof findPost> | undefined;
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
  const navigate = useNavigate();
  const post = data.value.post;
  return (
    <ArticleShell
      key={post.id}
      article={{
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
          contentSchemaVersion: CONTENT_SCHEMA_VERSION,
          status: draft.status,
          alias: draft.alias,
        });
        if (result.status && result.status >= 400)
          throw new Error(
            "message" in result.value ? String(result.value.message) : "保存できませんでした。",
          );
        const savedPath = `/blog/${draft.alias || post.id}`;
        // Saving a new draft must also remove ?edit=1 from the router's URL state.
        if (window.location.pathname !== savedPath || window.location.search)
          await navigate(savedPath, { replaceState: true, scroll: false });
      })}
    >
      <BlogTopbar class="article-topbar" />
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
