import { describe, expect, it, vi } from "vite-plus/test";
import type { PostPage, PostSummary } from "~/server/post-list";
import { restorePostList } from "./restore-post-list";

const post = (id: string): PostSummary => ({
  id,
  title: id,
  subtitle: null,
  description: null,
  status: "published",
  canonical_alias: null,
  published_at: "2026-09-27",
  created_at: "2026-09-27",
  tags: [],
});

describe("restoring archive depth from current server data", () => {
  it("starts with fresh summaries and follows only fresh cursors", async () => {
    const initial: PostPage = { posts: [post("updated")], next: "fresh-cursor" };
    const load = vi.fn().mockResolvedValue({ posts: [post("still-public")], next: null });
    const result = await restorePostList(initial, 3, load);
    expect(result.posts.map((p) => p.id)).toEqual(["updated", "still-public"]);
    expect(result.next).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith("fresh-cursor");
    expect(initial.posts).toHaveLength(1);
  });
  it("does not load more when the initial page already covers the saved depth", async () => {
    const initial = { posts: [post("current")], next: "next" };
    const load = vi.fn();
    expect(await restorePostList(initial, 1, load)).toEqual(initial);
    expect(load).not.toHaveBeenCalled();
  });
  it("leaves the fresh initial page intact when restoring deeper pages fails", async () => {
    const initial = { posts: [post("current")], next: "next" };
    await expect(
      restorePostList(initial, 24, async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(initial.posts).toEqual([post("current")]);
  });
});
