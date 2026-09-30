import { validatePublication } from "./validate-publication";
import { acceptMedia, mediaReferenceStatements, type MediaStore } from "./media";
import { normalizeSingleLine, formatShortDate } from "../content/article";
import type { RequestEventBase, RequestEventCommon } from "@qwik.dev/router";

import { canonicalPath } from "~/content/post-url";

import {
  normalizeDocument,
  EMPTY_DOCUMENT,
  CONTENT_SCHEMA_VERSION,
  FORMAT_VERSION,
} from "../content/document";
import type { JSONContent } from "@tiptap/core";
export interface Post {
  id: string;
  has_draft?: boolean | number;
  status: "draft" | "published";
  canonical_alias: string | null;
  format_version: number;
  body_format: string;
  content_schema_version: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  body: JSONContent;
  editing_state: Record<string, unknown> | null;
}
type PostRow = Omit<Post, "tags" | "body" | "editing_state"> & {
  tags: string;
  body_json: string;
  editing_state: string | null;
};
function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((tag): tag is string => typeof tag === "string"))
    throw new Error("タグは文字列配列です");
  return [...new Set(value.map((tag) => normalizeSingleLine(tag).trim()).filter(Boolean))];
}
function decodePost(row: PostRow): Post {
  if (
    row.format_version !== FORMAT_VERSION ||
    row.content_schema_version !== CONTENT_SCHEMA_VERSION ||
    row.body_format !== "tiptap-json"
  )
    throw new Error("未対応の文書形式です。元データを保持しています。");
  // The database string is not part of Post. Keeping it here would also ship
  // a second copy of the document in route-loader responses and SSR state.
  const { body_json, ...metadata } = row;
  return {
    ...metadata,
    title: normalizeSingleLine(row.title),
    subtitle: row.subtitle === null ? null : normalizeSingleLine(row.subtitle),
    tags: normalizeTags(JSON.parse(row.tags)),
    body: normalizeDocument(JSON.parse(body_json)),
    editing_state: row.editing_state ? JSON.parse(row.editing_state) : null,
  };
}
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function formText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function isUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}

export { canonicalPath };

export function normalizeAlias(value: unknown): string | null {
  const alias = formText(value).trim();
  if (!alias) return null;
  if (alias.length > 80 || !ALIAS_PATTERN.test(alias) || isUlid(alias)) {
    throw new Error(
      "エイリアスは80文字以内の小文字英数字とハイフンで指定してください。ULID形式は使えません。",
    );
  }
  return alias;
}

export function newUlid(now = Date.now()): string {
  let time = now;
  let id = "";
  for (let i = 0; i < 10; i++) {
    id = CROCKFORD[time % 32] + id;
    time = Math.floor(time / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (const byte of bytes) id += CROCKFORD[byte & 31];
  return id;
}

export function database(event: RequestEventBase): D1Database {
  const db = event.platform.env?.DB ?? event.env.get("DB");
  if (!db) throw new Error("D1 binding DB is missing");
  return db;
}

export async function listPosts(db: D1Database): Promise<Post[]> {
  const { results } = await db
    .prepare("SELECT * FROM editable_posts ORDER BY created_at DESC, id DESC")
    .all<PostRow>();
  return results.map(decodePost);
}

export async function findPost(
  db: D1Database,
  identifier: string,
  includeDraft = true,
): Promise<Post | null> {
  const table = includeDraft ? "editable_posts" : "posts";
  const row = isUlid(identifier)
    ? await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(identifier.toUpperCase())
        .first<PostRow>()
    : await db
        .prepare(
          `SELECT * FROM ${table} WHERE canonical_alias = ?${includeDraft ? " OR id IN (SELECT id FROM posts WHERE canonical_alias=?)" : ""}`,
        )
        .bind(...(includeDraft ? [identifier, identifier] : [identifier]))
        .first<PostRow>();
  return row ? decodePost(row) : null;
}
export type SaveIntent = "save" | "publish" | "unpublish";
export function parsePostInput(values: Record<string, unknown>) {
  if (
    Number(values.formatVersion) !== 2 ||
    Number(values.contentSchemaVersion) !== CONTENT_SCHEMA_VERSION ||
    values.bodyFormat !== "tiptap-json"
  )
    throw new Error("未対応の文書形式です");
  const status = values.status;
  if (status !== "draft" && status !== "published") throw new Error("公開状態を選択してください");
  if (typeof values.title !== "string") throw new Error("タイトルは文字列です");
  for (const key of ["subtitle", "description"])
    if (values[key] != null && typeof values[key] !== "string")
      throw new Error(`${key}は文字列またはnullです`);
  const title = normalizeSingleLine(values.title);
  if (title.length > 200 || (status === "published" && !title.trim()))
    throw new Error("公開時はタイトルが必要です（200文字以内）");
  const raw = typeof values.body === "string" ? JSON.parse(values.body) : values.body;
  if (JSON.stringify(raw).length > 500_000) throw new Error("本文が長すぎます");
  const tags = normalizeTags(
    typeof values.tags === "string" ? JSON.parse(values.tags) : (values.tags ?? []),
  );
  return {
    title,
    subtitle: values.subtitle == null ? null : normalizeSingleLine(formText(values.subtitle)),
    description: values.description == null ? null : formText(values.description),
    tags,
    body: normalizeDocument(raw),
    status,
  };
}
export async function createDraft(db: D1Database): Promise<string> {
  const id = newUlid();
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO posts (id,created_at,updated_at,body_json,title) VALUES (?,?,?,?,'無題')")
    .bind(id, now, now, JSON.stringify(EMPTY_DOCUMENT))
    .run();
  return id;
}
export async function savePostContent(
  db: D1Database,
  id: string,
  values: Record<string, unknown>,
  objects?: MediaStore,
): Promise<{
  version: string;
  status: "draft" | "published";
  hasDraft: boolean;
  publishedAt: string | null;
}> {
  const old = await findPost(db, id);
  if (!old) throw new Error("記事が見つかりません");
  if (typeof values.expectedVersion !== "string" || values.expectedVersion !== old.updated_at)
    throw new Error("CONFLICT: 記事が変更されています。入力を保持したまま再読込してください");
  const intent = values.intent ?? "save";
  if (intent !== "save" && intent !== "publish" && intent !== "unpublish")
    throw new Error("保存操作が不正です");
  const input = parsePostInput({ ...values, status: intent === "publish" ? "published" : "draft" });
  if (
    values.editingState &&
    typeof values.editingState === "object" &&
    (("pending" in values.editingState && values.editingState.pending) ||
      ("uploading" in values.editingState && values.editingState.uploading))
  )
    throw new Error("入力中のフォームや画像処理を完了してください");
  if (intent === "publish") await validatePublication(input.body);
  const alias = normalizeAlias(values.alias);
  const now = new Date(Math.max(Date.now(), Date.parse(old.updated_at) + 1)).toISOString();
  let publishedAt = old.published_at ?? (intent === "publish" ? now : null);
  if (values.publishedAt != null && values.publishedAt !== "") {
    if (typeof values.publishedAt !== "string") throw new Error("公開日を確認してください");
    formatShortDate(values.publishedAt);
    if (values.publishedAt !== old.published_at?.slice(0, 10))
      publishedAt = values.publishedAt + "T00:00:00.000Z";
  }
  const body = JSON.stringify(input.body);
  const token = crypto.randomUUID();
  const accepted = objects
    ? await acceptMedia(db, objects, id, input.body, values.renderArtifacts)
    : undefined;
  // One conditional write arbitrates all concurrent saves and publication requests.
  const statements = [
    db
      .prepare(`
    INSERT INTO post_drafts(id,title,subtitle,description,tags,body_json,canonical_alias,published_at,updated_at,save_token)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM editable_posts WHERE id=? AND updated_at=?)
      AND (? IS NULL OR (NOT EXISTS(SELECT 1 FROM posts WHERE canonical_alias=? AND id<>?)
        AND NOT EXISTS(SELECT 1 FROM post_drafts WHERE canonical_alias=? AND id<>?)))
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle,
      description=excluded.description,tags=excluded.tags,body_json=excluded.body_json,
      canonical_alias=excluded.canonical_alias,published_at=excluded.published_at,updated_at=excluded.updated_at,save_token=excluded.save_token
  `)
      .bind(
        id,
        input.title,
        input.subtitle,
        input.description,
        JSON.stringify(input.tags),
        body,
        alias,
        publishedAt,
        now,
        token,
        id,
        old.updated_at,
        alias,
        alias,
        id,
        alias,
        id,
      ),
  ];
  if (intent === "save") {
    statements.push(
      ...(await mediaReferenceStatements(
        db,
        id,
        input.body,
        now,
        accepted?.lease ?? "",
        false,
        "draft",
        token,
      )),
    );
  } else {
    statements.push(
      db
        .prepare(`UPDATE posts SET title=?,subtitle=?,description=?,tags=?,body_json=?,status=?,canonical_alias=?,published_at=?,updated_at=?,editing_state=NULL
      WHERE id=? AND EXISTS(SELECT 1 FROM post_drafts WHERE id=? AND updated_at=? AND body_json=? AND save_token=?)`)
        .bind(
          input.title,
          input.subtitle,
          input.description,
          JSON.stringify(input.tags),
          body,
          intent === "publish" ? "published" : "draft",
          alias,
          publishedAt,
          now,
          id,
          id,
          now,
          body,
          token,
        ),
    );
    statements.push(
      ...(await mediaReferenceStatements(
        db,
        id,
        input.body,
        now,
        accepted?.lease ?? "",
        intent === "publish",
        "published",
        token,
      )),
    );
    statements.push(
      db
        .prepare(
          "DELETE FROM post_drafts WHERE id=? AND updated_at=? AND save_token=? AND EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)",
        )
        .bind(id, now, token, id, now),
    );
  }
  const result = await db.batch(statements);
  if (!result[0]?.meta.changes)
    throw new Error(
      "CONFLICT: 記事の変更またはエイリアスの重複があります。入力を保持して再取得してください",
    );
  return {
    version: now,
    status: intent === "save" ? old.status : intent === "publish" ? "published" : "draft",
    hasDraft: intent === "save",
    publishedAt,
  };
}

export async function deletePost(
  db: D1Database,
  id: string,
  expectedVersion?: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "DELETE FROM posts WHERE id=? AND (? IS NULL OR EXISTS(SELECT 1 FROM editable_posts e WHERE e.id=posts.id AND e.updated_at=?))",
    )
    .bind(id, expectedVersion ?? null, expectedVersion ?? null)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export function redirectCanonical(event: RequestEventCommon, path: string): never {
  event.headers.set("Cache-Control", "no-cache");
  throw event.redirect(308, path);
}
