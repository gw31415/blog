import { describe, expect, it } from "vite-plus/test";
import { listPostPage } from "./post-list";

function fakeDatabase(rows: unknown[]) {
  let sql = "";
  let bindings: unknown[] = [];
  const statement = {
    bind: (...args: unknown[]) => {
      bindings = args;
      return statement;
    },
    all: async () => ({ results: rows }),
  };
  // This test emulates only the D1 operations exercised by this module.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const db = {
    prepare: (query: string) => {
      sql = query;
      return statement;
    },
  } as unknown as D1Database;
  return { db, sql: () => sql, bindings: () => bindings };
}
describe("summary pagination", () => {
  it("fetches one lookahead row without bodies and excludes drafts for readers", async () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      id: String(index),
      created_at: "2026-08-01",
      published_at: "2026-09-25",
      tags: '["開発"]',
    }));
    const fake = fakeDatabase(rows);
    const page = await listPostPage(fake.db, false);
    expect(page.posts).toHaveLength(12);
    expect(page.next).toBe(JSON.stringify(["2026-09-25", "11"]));
    expect(fake.sql()).toContain("LIMIT 13");
    expect(fake.sql()).toContain("status='published'");
    expect(fake.sql()).not.toContain("SELECT *");
    expect(page.posts[0].tags).toEqual(["開発"]);
  });
  it("uses a stable date and id cursor, including after deletion of the boundary row", async () => {
    const fake = fakeDatabase([]);
    const page = await listPostPage(fake.db, true, JSON.stringify(["2026-09-25", "boundary"]));
    expect(fake.bindings()).toEqual(["2026-09-25", "2026-09-25", "boundary"]);
    expect(fake.sql()).toContain("id < ?");
    expect(page.next).toBeNull();
  });
  it("rejects malformed cursors", async () => {
    await expect(listPostPage(fakeDatabase([]).db, false, "[1,2]")).rejects.toThrow();
  });
});
