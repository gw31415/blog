import { sendMarkdown } from "~/server/markdown-response";
import { $, component$, useSignal } from "@qwik.dev/core";
import {
  routeLoader$,
  type DocumentHead,
  type RequestHandler,
  type RequestEventCommon,
} from "@qwik.dev/router";

import { ArticleShell } from "~/components/templates/article-shell";
import { isRecord } from "~/content/record";
import { CONTENT_SCHEMA_VERSION } from "~/content/document";
import { canManagePosts } from "~/server/access";
import { canonicalPath } from "~/content/post-url";
import { SITE_DESCRIPTION } from "~/content/page-metadata";
import { database, findPost, redirectCanonical } from "~/server/posts";
import { renderDocument } from "~/server/render-document";
import { renderPost } from "~/server/render-post";

const requestPosts = new WeakMap<object, ReturnType<typeof findPost>>();

async function findRequestPost(event: RequestEventCommon) {
  let pending = requestPosts.get(event.sharedMap);
  if (!pending) {
    pending = canManagePosts(event).then(async (manager) => {
      const post = await findPost(database(event), event.params.id, manager);
      return post && (post.status === "published" || manager) ? post : null;
    });
    requestPosts.set(event.sharedMap, pending);
  }
  return pending;
}

/** Wall time spent waiting on D1/R2, visible in the browser's network timing panel. */
function timing(event: RequestEventCommon, name: string, started: number) {
  event.headers.append("Server-Timing", `${name};dur=${(performance.now() - started).toFixed(1)}`);
}

export const onRequest: RequestHandler = async (event) => {
  if (event.params.id.endsWith(".md")) {
    await sendMarkdown(event);
    return;
  }
  const started = performance.now();
  const post = await findRequestPost(event);
  timing(event, "post", started);
  if (!post) throw event.error(404, "記事が見つかりません。");
  if (!event.internalRequest && event.originalUrl.pathname !== canonicalPath(post)) {
    redirectCanonical(event, `${canonicalPath(post)}${event.originalUrl.search}`);
  }
};

export const usePost = routeLoader$(async (event) => {
  const post = await findRequestPost(event);
  if (!post) throw event.error(404, "記事が見つかりません。");
  const started = performance.now();
  const rendered = await renderDocument(post.body, event, post.id, !!post.has_draft);
  timing(event, "media", started);
  const canManage = await canManagePosts(event);
  const presentation = renderPost(post.body, rendered.diagrams, rendered.math);
  const dimensions = new Map(rendered.images.map((image) => [image.id, image]));
  // The stored fold result decides which rasters may start loading at once; the first
  // of them is the likely largest paint and is fetched ahead of other images.
  let prioritized = false;
  presentation.html = presentation.html.replace(/<img\b[^>]*>/g, (tag) => {
    const source = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    const id = source && /^(?:https?:\/\/[^/]+)?\/images\/variants\/([^/?#]+)$/.exec(source)?.[1];
    const image = id ? dimensions.get(id) : undefined;
    if (image?.upper && tag.includes('loading="lazy"')) {
      tag = tag.replace(
        'loading="lazy"',
        prioritized ? 'loading="eager"' : 'loading="eager" fetchpriority="high"',
      );
      prioritized = true;
    }
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
  const { body: _body, ...summary } = post;
  return {
    post: { ...summary, editing_state: canManage ? post.editing_state : null },
    canManage,
    html: presentation.html,
    // Readers already have the rendered HTML; only the editor needs the document tree.
    content: canManage ? presentation.content : null,
  };
});

export default component$(() => {
  const data = usePost();
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
        editingState: post.editing_state,
        description: post.description ?? "",
        tags: post.tags,
      }}
      initialHtml={data.value.html}
      initialContent={data.value.content ?? undefined}
      publicationStatus={post.status}
      hasDraft={!!post.has_draft}
      canonicalAlias={post.canonical_alias}
      canEdit={data.value.canManage}
      autoEditFromQuery
      onSave$={$(async (draft, intent, keepalive = false) => {
        let renderArtifacts: unknown[] = [];
        if (!keepalive) {
          const { prepareMediaArtifacts } = await import("~/components/editor/prepare-media");
          if (intent === "publish") {
            const { validateMermaidDocument } =
              await import("~/components/editor/mermaid-renderer");
            await validateMermaidDocument(draft.body);
            renderArtifacts = await prepareMediaArtifacts(draft.body);
          } else {
            // Invalid in-progress diagrams must not prevent the text draft from being saved.
            renderArtifacts = await prepareMediaArtifacts(draft.body).catch(() => []);
          }
        }
        const response = await fetch(`/api/posts/${post.id}`, {
          method: "POST",
          credentials: "same-origin",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            intent,
            expectedVersion: version.value,
            renderArtifacts,
            formatVersion: 2,
            bodyFormat: "tiptap-json",
            contentSchemaVersion: CONTENT_SCHEMA_VERSION,
          }),
        });
        const result = await response.json();
        if (!isRecord(result)) throw new Error("保存結果を確認できませんでした。");
        if (!response.ok)
          throw new Error(
            typeof result.message === "string" ? result.message : "保存できませんでした。",
          );
        if (
          typeof result.version !== "string" ||
          (result.status !== "draft" && result.status !== "published") ||
          typeof result.hasDraft !== "boolean"
        )
          throw new Error("保存結果を確認できませんでした。");
        version.value = result.version;
        return {
          version: result.version,
          status: result.status,
          hasDraft: result.hasDraft,
          publishedAt: typeof result.publishedAt === "string" ? result.publishedAt : null,
        };
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
