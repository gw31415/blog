import { withDraftRequest } from "./webmcp-request";
import type { RequestEventCommon } from "@qwik.dev/router";
import { canManagePosts, requireManager } from "./access";
import { database, findPost, canonicalPath, deletePost } from "./posts";
import { exportArticle, type ExportTarget } from "../content/export-article";
import { formatShortDate } from "../content/article";
import { EMPTY_DOCUMENT } from "../content/document";
import {
  collectUnusedImages,
  imageIdPattern,
  listOriginals,
  postImageIds,
  removeUnusedVariants,
} from "./images";
import { catalog, ToolError, inputText, validateInput, type Input } from "../webmcp/catalog";
import type { JSONContent } from "@tiptap/core";

export async function visiblePost(event: RequestEventCommon, identifier: string) {
  const post = await findPost(database(event), identifier);
  if (!post || (post.status !== "published" && !(await canManagePosts(event))))
    throw new ToolError("NOT_FOUND", "記事が見つかりません");
  return post;
}
function nodeText(node: JSONContent): string {
  return node.text ?? node.content?.map(nodeText).join("") ?? "";
}
export function outline(body: JSONContent) {
  return (body.content ?? [])
    .flatMap((node, block) =>
      node.type === "heading"
        ? [{ block, level: Number(node.attrs?.level), text: nodeText(node) }]
        : [],
    )
    .map((heading, index) => ({ ...heading, section: index }));
}
export async function searchPosts(db: D1Database, manager: boolean, input: Input) {
  const conditions = [manager ? "1=1" : "p.status='published'"];
  const bindings: (string | number)[] = [];
  if (input.query) {
    const query = `%${inputText(input, "query").replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.subtitle LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_tree(p.body_json) WHERE key='text' AND value LIKE ? ESCAPE '\\'))",
    );
    bindings.push(query, query, query, query);
  }
  if (input.tag) {
    conditions.push("EXISTS(SELECT 1 FROM json_each(p.tags) WHERE value=?)");
    bindings.push(inputText(input, "tag"));
  }
  for (const key of ["from", "to"] as const) {
    if (!input[key]) continue;
    formatShortDate(inputText(input, key));
    conditions.push(`substr(p.published_at,1,10) ${key === "from" ? ">=" : "<="} ?`);
    bindings.push(inputText(input, key));
  }
  const filter = JSON.stringify([
    input.query ?? "",
    input.tag ?? "",
    input.from ?? "",
    input.to ?? "",
    manager,
  ]);
  if (input.cursor) {
    let cursor: unknown;
    try {
      cursor = JSON.parse(inputText(input, "cursor"));
    } catch {
      throw new ToolError("INVALID_INPUT", "検索カーソルが不正です");
    }
    if (
      !Array.isArray(cursor) ||
      cursor.length !== 3 ||
      cursor.some((v) => typeof v !== "string") ||
      cursor[2] !== filter
    )
      throw new ToolError("INVALID_INPUT", "検索条件とカーソルが一致しません");
    conditions.push(
      "(COALESCE(p.published_at,p.created_at) < ? OR (COALESCE(p.published_at,p.created_at)=? AND p.id<?))",
    );
    bindings.push(cursor[0], cursor[0], cursor[1]);
  }
  const { results } = await db
    .prepare(
      `SELECT p.id,p.title,p.subtitle,p.description,p.tags,p.status,p.canonical_alias,p.published_at,p.created_at,p.updated_at FROM posts p WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(p.published_at,p.created_at) DESC,p.id DESC LIMIT 21`,
    )
    .bind(...bindings)
    .all<{
      id: string;
      title: string;
      tags: string;
      canonical_alias: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
    }>();
  const items = results.slice(0, 20).map((row) => ({
    ...row,
    tags: JSON.parse(row.tags),
    url: canonicalPath(row),
    version: row.updated_at,
  }));
  const last = items.at(-1);
  return {
    items,
    next:
      results.length > 20 && last
        ? JSON.stringify([last.published_at ?? last.created_at, last.id, filter])
        : null,
  };
}
async function createDraftForRequest(db: D1Database, requestId: string) {
  return withDraftRequest(db, requestId, async (id) => {
    const now = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO posts(id,created_at,updated_at,body_json,title) SELECT ?,?,?,?,'無題' WHERE EXISTS(SELECT 1 FROM webmcp_requests WHERE request_id=? AND post_id=? AND expires_at>?)",
      )
      .bind(id, now, now, JSON.stringify(EMPTY_DOCUMENT), requestId, id, Date.now())
      .run();
    if (!result.meta.changes) throw new ToolError("EXPIRED", "作成要求の有効期限が切れました");
    return { id, url: `/blog/${id}?edit=1` };
  });
}
export async function executeServerTool(event: RequestEventCommon, name: string, raw: unknown) {
  const input = validateInput(name, raw);
  const definition = catalog.find((entry) => entry.name === name)!;
  if (definition.scope !== "public") await requireManager(event);
  const db = database(event);
  switch (name) {
    case "search_posts":
      return searchPosts(db, await canManagePosts(event), input);
    case "list_tags":
      return (
        await db
          .prepare(
            `SELECT value AS tag, COUNT(DISTINCT p.id) AS count FROM posts p, json_each(p.tags) WHERE ${(await canManagePosts(event)) ? "1=1" : "p.status='published'"} GROUP BY value ORDER BY count DESC,tag LIMIT 500`,
          )
          .all()
      ).results;
    case "get_post": {
      const post = await visiblePost(event, inputText(input, "identifier"));
      const { editing_state: _editing, ...publicPost } = post;
      return {
        ...publicPost,
        url: canonicalPath(post),
        version: post.updated_at,
        ...exportArticle(post, "canonical", event.url.origin),
      };
    }
    case "get_post_outline": {
      const post = await visiblePost(event, inputText(input, "identifier"));
      const headings = outline(post.body);
      if (input.section === undefined) return { url: canonicalPath(post), headings };
      const heading = headings[Number(input.section)];
      if (!heading) throw new ToolError("NOT_FOUND", "見出しがありません");
      const end =
        headings.find((h) => h.block > heading.block && h.level <= heading.level)?.block ??
        post.body.content?.length;
      return {
        url: `${canonicalPath(post)}#webmcp-section-${Number(input.section)}`,
        heading,
        body: { type: "doc", content: post.body.content?.slice(heading.block, end) },
      };
    }
    case "export_post": {
      const post = await visiblePost(event, inputText(input, "identifier"));
      return {
        url: canonicalPath(post),
        ...exportArticle(post, exportTarget(input.target), event.url.origin),
      };
    }
    case "create_draft":
      return createDraftForRequest(db, inputText(input, "requestId"));
    case "list_images": {
      const page = await listOriginals(db, input.unused === true, inputText(input, "cursor"));
      const items = await Promise.all(
        page.items.map(async (item) => ({
          ...item,
          originalUrl: `/api/images/originals/${item.id}`,
          variants: (
            await db
              .prepare("SELECT id,width,height FROM image_variants WHERE original_id=? ORDER BY id")
              .bind(item.id)
              .all()
          ).results,
        })),
      );
      return { items, next: page.next };
    }
    case "attach_image": {
      const id = inputText(input, "variantId");
      if (
        !imageIdPattern.test(id) ||
        !(await db.prepare("SELECT id FROM image_variants WHERE id=?").bind(id).first()) ||
        !(await event.platform.env.IMAGES.head(`images/variants/${id}`))
      )
        throw new ToolError("NOT_FOUND", "配信画像が見つかりません");
      return { url: `/images/variants/${id}` };
    }
    case "export_original_image": {
      const id = inputText(input, "originalId");
      if (
        !imageIdPattern.test(id) ||
        !(await event.platform.env.IMAGES.head(`images/originals/${id}`))
      )
        throw new ToolError("NOT_FOUND", "元画像が見つかりません");
      return { url: `/api/images/originals/${id}` };
    }
    case "delete_post": {
      const post = await visiblePost(event, inputText(input, "identifier"));
      if (post.updated_at !== input.expectedVersion)
        throw new ToolError("CONFLICT", "記事が変更されています。再取得してください");
      const images = await postImageIds(db, post.id);
      if (!(await deletePost(db, post.id, inputText(input, "expectedVersion"))))
        throw new ToolError("CONFLICT", "記事が変更または削除されています");
      await removeUnusedVariants(db, event.platform.env.IMAGES, images);
      return { deleted: post.id, originalsPreserved: true };
    }
    case "cleanup_unused_images":
      await collectUnusedImages(db, event.platform.env.IMAGES);
      return { originalsPreserved: true };
    default:
      throw new ToolError("WRONG_CONTEXT", "このツールは記事の編集画面で実行してください");
  }
}

function exportTarget(value: unknown): ExportTarget {
  if (value === "canonical" || value === "github" || value === "zenn" || value === "qiita")
    return value;
  throw new ToolError("INVALID_INPUT", "未対応の出力形式です");
}
