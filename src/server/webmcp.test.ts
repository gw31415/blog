import { withDraftRequest, REQUEST_SAFETY_TTL_MS } from "./webmcp-request";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { searchPosts, outline } from "./webmcp";
import { savePostContent, findPost } from "./posts";
import { CONTENT_SCHEMA_VERSION, EMPTY_DOCUMENT } from "../content/document";
const opened: DatabaseSync[] = [];
afterEach(() => opened.splice(0).forEach((db) => db.close()));
function setup() {
  const sql = new DatabaseSync(":memory:");
  opened.push(sql);
  sql.exec(readFileSync("migrations/0001_initial.sql", "utf8"));
  sql.exec(readFileSync("migrations/0002_webmcp_requests.sql", "utf8"));
  sql.exec(readFileSync("migrations/0003_webmcp_request_lifecycle.sql", "utf8"));
  sql.exec(readFileSync("migrations/0004_media_delivery.sql", "utf8"));
  for(const file of ["0005_media_history.sql","0006_media_lease_grace.sql","0007_retire_legacy_media.sql"]) sql.exec(readFileSync("migrations/"+file,"utf8"));
  class Statement {
    constructor(
      public query: string,
      public args: SQLInputValue[] = [],
    ) {}
    bind(...args: SQLInputValue[]) {
      return new Statement(this.query, args);
    }
    async first() {
      return sql.prepare(this.query).get(...this.args) ?? null;
    }
    async all() {
      return { results: sql.prepare(this.query).all(...this.args) };
    }
    async run() {
      return { meta: { changes: Number(sql.prepare(this.query).run(...this.args).changes) } };
    }
  }
  const adapter = {
    prepare: (query: string) => new Statement(query),
    async batch(statements: Statement[]) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // Minimal D1 adapter backed by real transactional SQLite.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const db = adapter as unknown as D1Database;
  const insert = (id: string, status: string, title: string) =>
    sql
      .prepare(
        "INSERT INTO posts(id,status,title,tags,created_at,updated_at,published_at,body_json) VALUES(?,?,?,'[\"日本語\"]','2026-09-01','2026-09-01','2026-09-01',?)",
      )
      .run(
        id,
        status,
        title,
        JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "本文だけの検索語 100%" }] },
          ],
        }),
      );
  return { db, sql, insert };
}
it("searches body text, scopes tags/dates/cursors and excludes drafts", async () => {
  const { db, insert } = setup();
  for (let index = 0; index < 23; index++)
    insert(`01ARZ3NDEKTSV4RRFFQ69G5${String(index).padStart(3, "0")}`, "published", `記事${index}`);
  insert("01ARZ3NDEKTSV4RRFFQ69G5ZZZ", "draft", "秘密");
  const first = await searchPosts(db, false, {
    query: "検索語",
    tag: "日本語",
    from: "2026-09-01",
  });
  expect(first.items).toHaveLength(20);
  expect(first.next).toBeTruthy();
  const second = await searchPosts(db, false, {
    query: "検索語",
    tag: "日本語",
    from: "2026-09-01",
    cursor: first.next,
  });
  expect(second.items).toHaveLength(3);
  expect(new Set([...first.items, ...second.items].map((post) => post.id)).size).toBe(23);
  await expect(searchPosts(db, true, { cursor: first.next })).rejects.toThrow();
  expect((await searchPosts(db, false, { query: "秘密" })).items).toHaveLength(0);
  expect((await searchPosts(db, true, { query: "秘密" })).items).toHaveLength(1);
  expect((await searchPosts(db, false, { query: "100%" })).items).toHaveLength(20);
  expect((await searchPosts(db, false, { query: "100_" })).items).toHaveLength(0);
  expect((await searchPosts(db, false, { from: "2026-09-02" })).items).toHaveLength(0);
});
it("rejects stale saves without overwriting the saved document", async () => {
  const { db, insert } = setup(),
    id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  insert(id, "draft", "old");
  const input = {
    formatVersion: 2,
    bodyFormat: "tiptap-json",
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    body: EMPTY_DOCUMENT,
    title: "new",
    status: "draft",
    tags: [],
    expectedVersion: "2026-09-01",
  };
  await savePostContent(db, id, input);
  await expect(savePostContent(db, id, { ...input, title: "stale" })).rejects.toThrow("CONFLICT");
  expect((await findPost(db, id))?.title).toBe("new");
});
it("outlines top-level sections without confusing nested headings", () => {
  expect(
    outline({
      type: "doc",
      content: [
        { type: "blockquote", content: [{ type: "heading", attrs: { level: 2 } }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "節" }] },
      ],
    }),
  ).toEqual([{ block: 1, section: 0, level: 3, text: "節" }]);
});

it("removes the guard on success and treats a completed request ID as a new request", async () => {
  const { db, sql } = setup();
  const first = await withDraftRequest(db, "request", async (id) => {
    expect(sql.prepare("SELECT post_id FROM webmcp_requests").get()?.post_id).toBe(id);
    return id;
  });
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
  const second = await withDraftRequest(db, "request", async (id) => id);
  expect(second).not.toBe(first);
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
});

it("removes the guard when creation fails", async () => {
  const { db, sql } = setup();
  await expect(
    withDraftRequest(db, "failed", async () => {
      throw new Error("creation failed");
    }),
  ).rejects.toThrow("creation failed");
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
});

it("rejects overlapping requests without releasing the active owner's guard", async () => {
  const { db, sql } = setup();
  await withDraftRequest(db, "overlap", async (id) => {
    const work = vi.fn();
    await expect(withDraftRequest(db, "overlap", work)).rejects.toMatchObject({ code: "BUSY" });
    expect(work).not.toHaveBeenCalled();
    expect(sql.prepare("SELECT post_id FROM webmcp_requests").get()?.post_id).toBe(id);
  });
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
});

it("uses expiry only when cleanup fails and reclaims leftovers at the next creation", async () => {
  const { db, sql } = setup();
  const originalPrepare = db.prepare.bind(db);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const prepare = vi.spyOn(db, "prepare").mockImplementation((query) => {
    if (query.startsWith("DELETE FROM webmcp_requests WHERE request_id="))
      throw new Error("cleanup unavailable");
    return originalPrepare(query);
  });
  try {
    expect(await withDraftRequest(db, "leftover", async () => "created")).toBe("created");
    expect(warning).toHaveBeenCalledOnce();
    const row = sql.prepare("SELECT expires_at FROM webmcp_requests").get()!;
    expect(Number(row.expires_at)).toBeGreaterThan(Date.now());
    expect(Number(row.expires_at)).toBeLessThanOrEqual(Date.now() + REQUEST_SAFETY_TTL_MS);
  } finally {
    prepare.mockRestore();
    warning.mockRestore();
  }
  sql.prepare("UPDATE webmcp_requests SET expires_at=0").run();
  await withDraftRequest(db, "next", async () => {
    expect(
      sql.prepare("SELECT 1 FROM webmcp_requests WHERE request_id='leftover'").get(),
    ).toBeUndefined();
  });
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
});

it("an old finally cannot remove a newer owner after safety expiry", async () => {
  const { db, sql } = setup();
  let newer: Promise<string> | undefined;
  let release!: () => void;
  await withDraftRequest(db, "replace", async () => {
    sql.prepare("UPDATE webmcp_requests SET expires_at=0").run();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    newer = withDraftRequest(db, "replace", async (id) => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return id;
    });
    await ready;
  });
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(1);
  release();
  await newer;
  expect(sql.prepare("SELECT count(*) AS n FROM webmcp_requests").get()?.n).toBe(0);
});
