import { describe, expect, it } from "vite-plus/test";
import { groupPostsByDay, groupPostsByMonth } from "./post-groups";
import type { PostSummary } from "~/server/post-list";

const post = (
  id: string,
  published: string | null,
  created = "2026-09-25T00:00:00Z",
): PostSummary => ({
  id,
  published_at: published,
  created_at: created,
  title: id,
  subtitle: null,
  description: null,
  status: published ? "published" : "draft",
  canonical_alias: null,
  tags: [],
});
describe("calendar groups", () => {
  it("merges an appended page into its month and separates month/year boundaries", () => {
    const first = [post("a", "2026-01-20")];
    const next = [post("b", "2026-01-02"), post("c", "2025-12-31")];
    expect(
      groupPostsByMonth([...first, ...next]).map((g) => [g.month, g.posts.map((p) => p.id)]),
    ).toEqual([
      ["2026-01", ["a", "b"]],
      ["2025-12", ["c"]],
    ]);
  });
  it("uses creation date for unpublished entries without inventing a publication date", () => {
    expect(groupPostsByMonth([post("draft", null)])[0].month).toBe("2026-09");
    expect(groupPostsByMonth([])).toEqual([]);
  });
  it("keeps consecutive posts under one day label", () => {
    expect(
      groupPostsByDay([
        post("a", "2026-09-25T12:00:00Z"),
        post("b", "2026-09-25T08:00:00Z"),
        post("c", "2026-09-24T23:00:00Z"),
      ]).map((group) => [group.date, group.posts.map((item) => item.id)]),
    ).toEqual([
      ["2026-09-25", ["a", "b"]],
      ["2026-09-24", ["c"]],
    ]);
  });
});
