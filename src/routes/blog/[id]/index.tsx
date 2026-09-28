import { postImageIds, removeUnusedVariants } from "~/server/images";
import { sendMarkdown } from "~/server/markdown-response";
import { $, component$, useSignal } from "@qwik.dev/core";
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
import { canManagePosts, requireManager } from "~/server/access";
import { canonicalPath } from "~/content/post-url";
import { SITE_DESCRIPTION } from "~/content/page-metadata";
import { database, findPost, redirectCanonical, savePostContent } from "~/server/posts";
import { renderDocument } from "~/server/render-document";
import { renderPost } from "~/server/render-post";

async function findRequestPost(event: RequestEventCommon) {
  const cached: unknown = event.sharedMap.get("blog.post");
  // Only this function writes blog.post; Qwik sharedMap erases its value type.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  let pending = cached as ReturnType<typeof findPost> | undefined;
  if (!pending) {
    pending = findPost(database(event), event.params.id).then(async (post) =>
      post && (post.status === "published" || (await canManagePosts(event))) ? post : null,
    );
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
  const canManage = await canManagePosts(event);
  const presentation = renderPost(post.body, rendered.diagrams, rendered.math);
  const { results: images } = await database(event)
    .prepare(
      "SELECT v.id, v.width, v.height FROM image_variants v JOIN post_images p ON p.variant_id=v.id WHERE p.post_id=?",
    )
    .bind(post.id)
    .all<{ id: string; width: number; height: number }>();
  const dimensions = new Map(images.map((image) => [image.id, image]));
  presentation.html = presentation.html.replace(/<img\b[^>]*>/g, (tag) => {
    const source = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    const id = source && /^(?:https?:\/\/[^/]+)?\/images\/variants\/([^/?#]+)$/.exec(source)?.[1];
    const image = id ? dimensions.get(id) : undefined;
    return image
      ? tag
          .replace('width="960"', `width="${image.width}"`)
          .replace('height="540"', `height="${image.height}"`)
          .replace("aspect-ratio: 960 / 540", `aspect-ratio: ${image.width} / ${image.height}`)
          .replace(
            "--article-image-ratio: 960 / 540",
            `--article-image-ratio: ${image.width} / ${image.height}`,
          )
      : tag;
  });
  return {
    // Share the normalized tree with the editor input so Qwik serializes it once.
    post: {
      ...post,
      body: presentation.content,
      editing_state: canManage ? post.editing_state : null,
    },
    canManage,
    ...presentation,
  };
});

export const useSavePost = routeAction$(
  async (values, event) => {
    await requireManager(event);
    const post = await findRequestPost(event);
    if (!post) throw event.error(404, "記事が見つかりません。");
    try {
      const imageIds = await postImageIds(database(event), post.id);
      await savePostContent(database(event), post.id, values);
      await removeUnusedVariants(database(event), event.platform.env.IMAGES, imageIds);
      event.sharedMap.delete("blog.post");
      return { ok: true, version: (await findPost(database(event), post.id))!.updated_at };
    } catch (error) {
      return event.fail(400, {
        message: error instanceof Error ? error.message : "保存できませんでした。",
      });
    }
  },
  {
    // strictLoaders defaults to true: refresh saved metadata without replacing the editor DOM.
    invalidate: [usePost],
  },
);

export default component$(() => {
  const data = usePost();
  const save = useSavePost();
  const navigate = useNavigate();
  const post = data.value.post;
  const version = useSignal(post.updated_at);
  return (
    <ArticleShell
      key={post.id}
      postId={post.id}
      version={version.value}
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
      canEdit={data.value.canManage}
      autoEditFromQuery
      onSave$={$(async (draft) => {
        const { validateMermaidDocument, prepareMermaidArtifacts } =
          await import("~/components/editor/mermaid-renderer");
        if (draft.status === "published") {
          await validateMermaidDocument(draft.body);
        }
        const result = await save.submit({
          expectedVersion: version.value,
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
        if ("version" in result.value && typeof result.value.version === "string")
          version.value = result.value.version;
        const savedPath = `/blog/${draft.alias || post.id}`;
        // Saving a new draft must also remove ?edit=1 from the router's URL state.
        if (window.location.pathname !== savedPath || window.location.search)
          await navigate(savedPath, { replaceState: true, scroll: false });
      })}
    />
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost).post;
  return {
    title: post.title.trim() || "無題",
    links: [{ rel: "canonical", href: canonicalPath(post) }],
    meta: [
      {
        name: "description",
        content: post.description?.trim() || post.subtitle?.trim() || SITE_DESCRIPTION,
      },
      { property: "og:type", content: "article" },
      ...(post.status === "draft" ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ...(post.status === "published" && post.published_at
        ? [{ property: "article:published_time", content: post.published_at }]
        : []),
      { property: "article:modified_time", content: post.updated_at },
      ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),
    ],
  };
};
