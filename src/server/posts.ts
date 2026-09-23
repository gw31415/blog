import type { RequestEventBase, RequestEventCommon } from "@qwik.dev/router";

import { canonicalPath } from "~/content/post-url";

export interface Post {
  id: string;
  status: "draft" | "published";
  canonical_alias: string | null;
  category: string;
  published_at: string;
  title: string;
  subtitle: string;
  body_markdown: string;
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
    .prepare(
      "SELECT id, status, canonical_alias, category, published_at, title, subtitle, body_markdown FROM posts ORDER BY created_at DESC, id DESC",
    )
    .all<Post>();
  return results;
}

export async function findPost(db: D1Database, identifier: string): Promise<Post | null> {
  const columns =
    "p.id, p.status, p.canonical_alias, p.category, p.published_at, p.title, p.subtitle, p.body_markdown";
  if (isUlid(identifier)) {
    return db
      .prepare(`SELECT ${columns} FROM posts p WHERE p.id = ?`)
      .bind(identifier.toUpperCase())
      .first<Post>();
  }
  return db
    .prepare(
      `SELECT ${columns} FROM post_aliases a JOIN posts p ON p.id = a.post_id WHERE a.alias = ?`,
    )
    .bind(identifier)
    .first<Post>();
}

export interface PostInput {
  category: string;
  publishedAt: string;
  title: string;
  subtitle: string;
  bodyMarkdown: string;
}

export function parsePostInput(values: Record<string, unknown>): PostInput {
  const title = formText(values.title).trim();
  const publishedAt = formText(values.publishedAt).trim();
  const bodyMarkdown = formText(values.bodyMarkdown);
  if (!title || title.length > 200) throw new Error("タイトルは1〜200文字で入力してください。");
  const date = new Date(`${publishedAt}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== publishedAt
  ) {
    throw new Error("公開日を入力してください。");
  }
  if (bodyMarkdown.length > 500_000) throw new Error("本文が長すぎます。");
  return {
    category: formText(values.category).trim().slice(0, 100),
    publishedAt,
    title,
    subtitle: formText(values.subtitle).trim().slice(0, 500),
    bodyMarkdown,
  };
}

export async function createDraft(db: D1Database): Promise<string> {
  const id = newUlid();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  await db
    .prepare("INSERT INTO posts (id, status, published_at, title) VALUES (?, 'draft', ?, '無題')")
    .bind(id, today)
    .run();
  return id;
}

export async function savePostContent(
  db: D1Database,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const input = parsePostInput(values);
  const status = values.status;
  if (status !== "draft" && status !== "published") {
    throw new Error("公開状態を選択してください。");
  }
  const alias = normalizeAlias(values.alias);
  const statements: D1PreparedStatement[] = [];
  if (alias) {
    statements.push(
      db
        .prepare("INSERT OR IGNORE INTO post_aliases (alias, post_id) VALUES (?, ?)")
        .bind(alias, id),
    );
  }
  statements.push(
    db
      .prepare(`UPDATE posts
        SET category = ?, published_at = ?, title = ?, subtitle = ?, body_markdown = ?,
            status = ?, canonical_alias = ?
        WHERE id = ? AND (? IS NULL OR EXISTS
          (SELECT 1 FROM post_aliases WHERE alias = ? AND post_id = ?))`)
      .bind(
        input.category,
        input.publishedAt,
        input.title,
        input.subtitle,
        input.bodyMarkdown,
        status,
        alias,
        id,
        alias,
        alias,
        id,
      ),
  );
  const results = await db.batch(statements);
  if (!results.at(-1)?.meta.changes) {
    throw new Error(alias ? "エイリアスが他の記事で使用されています。" : "記事が見つかりません。");
  }
}

export async function deletePost(db: D1Database, id: string): Promise<boolean> {
  const results = await db.batch([
    db.prepare("DELETE FROM post_aliases WHERE post_id = ?").bind(id),
    db.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  return (results[1].meta.changes ?? 0) > 0;
}

export function redirectCanonical(event: RequestEventCommon, path: string): never {
  event.headers.set("Cache-Control", "no-cache");
  throw event.redirect(308, path);
}
