import { expect, it } from "vite-plus/test";
import { testDatabase } from "../../tests/helpers/database";
import { listPostPage } from "./post-list";

const postId = (index: number) => String(index).padStart(26, "0");

it("paginates tied dates without leaking drafts or losing rows after the boundary is deleted", async () => {
  const { db, sql } = testDatabase();
  try {
    const draftId = "Z".repeat(26);
    const insert = sql.prepare(
      "INSERT INTO posts(id,title,status,published_at,created_at,updated_at,tags) VALUES(?,?,?,'2026-09-25','2026-09-25','2026-09-25','[\"開発\"]')",
    );
    for (let index = 1; index <= 13; index++) {
      const id = postId(index);
      insert.run(id, id, "published");
    }
    insert.run(draftId, "Private draft", "draft");

    const first = await listPostPage(db, false);
    expect(first.posts).toHaveLength(12);
    expect(first.posts[0].id).toBe(postId(13));
    expect(first.posts.at(-1)?.id).toBe(postId(2));
    expect(first.posts.some((post) => post.id === draftId)).toBe(false);
    expect(first.posts[0].tags).toEqual(["開発"]);
    expect(first.posts[0]).not.toHaveProperty("body_json");
    expect(first.next).not.toBeNull();

    sql.prepare("DELETE FROM posts WHERE id=?").run(postId(2));
    const next = await listPostPage(db, false, first.next);
    expect(next.posts.map((post) => post.id)).toEqual([postId(1)]);
    expect(next.next).toBeNull();
    await expect(listPostPage(db, false, "[1,2]")).rejects.toThrow();
  } finally {
    sql.close();
  }
});
