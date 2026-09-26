import { normalizeSingleLine, formatShortDate } from "../content/article";
import { renderEntries } from "../content/render-contract";
import { acceptRenderArtifacts } from "./accept-render-artifacts";
import { syncRenderReferences } from "./render-cache";
import { validatePublication } from "./validate-publication";
import type { RequestEventBase, RequestEventCommon } from "@qwik.dev/router";

import { canonicalPath } from "~/content/post-url";

import { normalizeDocument, EMPTY_DOCUMENT, CONTENT_SCHEMA_VERSION } from "../content/document";
import type { JSONContent } from "@tiptap/core";
export interface Post {
  id: string;
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
    row.format_version !== 2 ||
    row.content_schema_version !== CONTENT_SCHEMA_VERSION ||
    row.body_format !== "tiptap-json"
  )
    throw new Error("未対応の文書形式です。元データを保持しています。");
  return {
    ...row,
    title: normalizeSingleLine(row.title),
    subtitle: row.subtitle === null ? null : normalizeSingleLine(row.subtitle),
    tags: normalizeTags(JSON.parse(row.tags)),
    body: normalizeDocument(JSON.parse(row.body_json)),
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
    .prepare("SELECT * FROM posts ORDER BY created_at DESC, id DESC")
    .all<PostRow>();
  return results.map(decodePost);
}

export async function findPost(db: D1Database, identifier: string): Promise<Post | null> {
  const row = isUlid(identifier)
    ? await db
        .prepare("SELECT * FROM posts WHERE id = ?")
        .bind(identifier.toUpperCase())
        .first<PostRow>()
    : await db
        .prepare("SELECT * FROM posts WHERE canonical_alias = ?")
        .bind(identifier)
        .first<PostRow>();
  return row ? decodePost(row) : null;
}
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
): Promise<void> {
  const old = await findPost(db, id);
  if (!old) throw new Error("記事が見つかりません");
  const input = parsePostInput(values);
  if (
    values.editingState &&
    typeof values.editingState === "object" &&
    "pending" in values.editingState &&
    values.editingState.pending
  )
    throw new Error("入力中のフォームを適用するかキャンセルしてください");
  if (input.status === "published") await validatePublication(input.body);
  const alias = normalizeAlias(values.alias);
  const now = new Date().toISOString();
  const previous = {
    title: old.title,
    subtitle: old.subtitle,
    description: old.description,
    tags: old.tags,
    body: old.body,
    status: old.status,
  };
  let publishedAt = old.published_at ?? (input.status === "published" ? now : null);
  if (values.publishedAt != null && values.publishedAt !== "") {
    if (typeof values.publishedAt !== "string") throw new Error("公開日を確認してください");
    formatShortDate(values.publishedAt); // Strict calendar validation, including leap days.
    if (values.publishedAt !== old.published_at?.slice(0, 10))
      publishedAt = values.publishedAt + "T00:00:00.000Z";
  }
  const changed =
    JSON.stringify(previous) !== JSON.stringify(input) ||
    alias !== old.canonical_alias ||
    publishedAt !== old.published_at;
  const statements: D1PreparedStatement[] = [];
  statements.push(
    db
      .prepare(
        `UPDATE posts SET title=?,subtitle=?,description=?,tags=?,body_json=?,status=?,canonical_alias=?,published_at=?,updated_at=?,editing_state=? WHERE id=? AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM posts WHERE canonical_alias=? AND id<>?))`,
      )
      .bind(
        input.title,
        input.subtitle,
        input.description,
        JSON.stringify(input.tags),
        JSON.stringify(input.body),
        input.status,
        alias,
        publishedAt,
        changed ? now : old.updated_at,
        null,
        id,
        alias,
        alias,
        id,
      ),
  );
  const postStatementIndex = statements.length - 1;
  const artifacts = await acceptRenderArtifacts(db, input.body, values.renderArtifacts, id);
  statements.push(
    ...artifacts,
    ...syncRenderReferences(
      db,
      { id, body: JSON.stringify(input.body) },
      await renderEntries(input.body),
    ),
  );
  const result = await db.batch(statements);
  if (!result[postStatementIndex]?.meta.changes)
    throw new Error("エイリアスが他の記事で使用されています");
}

export async function deletePost(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export function redirectCanonical(event: RequestEventCommon, path: string): never {
  event.headers.set("Cache-Control", "no-cache");
  throw event.redirect(308, path);
}
