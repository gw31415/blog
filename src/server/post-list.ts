import type { Post } from "./posts";

export type PostSummary = Pick<
  Post,
  | "id"
  | "title"
  | "subtitle"
  | "description"
  | "status"
  | "canonical_alias"
  | "published_at"
  | "created_at"
  | "tags"
>;
export interface PostPage {
  posts: PostSummary[];
  next: string | null;
}
export async function listPostPage(
  db: D1Database,
  includeDrafts: boolean,
  cursor?: string | null,
): Promise<PostPage> {
  let after: string[] | null = null;
  if (cursor) {
    try {
      const value = JSON.parse(cursor);
      if (!Array.isArray(value) || value.length !== 2 || value.some((v) => typeof v !== "string"))
        throw new Error();
      after = value;
    } catch {
      throw new Error("一覧の続き位置が不正です。");
    }
  }
  const conditions = [includeDrafts ? "1=1" : "status='published'"];
  if (after)
    conditions.push(
      "(COALESCE(published_at,created_at) < ? OR (COALESCE(published_at,created_at) = ? AND id < ?))",
    );
  const query = db.prepare(
    `SELECT id,title,subtitle,description,status,canonical_alias,published_at,created_at,tags FROM posts WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(published_at,created_at) DESC,id DESC LIMIT 13`,
  );
  const { results } = await (after ? query.bind(after[0], after[0], after[1]) : query).all<
    Omit<PostSummary, "tags"> & { tags: string }
  >();
  const posts = results.slice(0, 12).map((row) => {
    const tags: unknown = JSON.parse(row.tags);
    if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === "string"))
      throw new Error("記事のタグ形式が不正です。");
    return { ...row, tags };
  });
  const last = posts.at(-1);
  return {
    posts,
    next:
      results.length > 12 && last
        ? JSON.stringify([last.published_at ?? last.created_at, last.id])
        : null,
  };
}
