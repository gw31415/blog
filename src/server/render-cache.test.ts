import { createDraft, findPost, savePostContent } from "./posts";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { renderEntries, renderKey, RENDERERS, type RenderEntry } from "../content/render-contract";
import { insertRenderCache, syncRenderReferences, resolveRenderCache } from "./render-cache";
import { acceptRenderArtifacts } from "./accept-render-artifacts";
import { renderPost } from "./render-post";
import { generateMath, renderDocument } from "./render-document";

const opened: DatabaseSync[] = [];
afterEach(() => {
  opened.splice(0).forEach((db) => db.close());
});
function database() {
  const sqlite = new DatabaseSync(":memory:");
  opened.push(sqlite);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const queries: string[] = [];
  sqlite.exec(readFileSync("migrations/0001_posts.sql", "utf8"));
  class Statement {
    constructor(
      public sql: string,
      public args: (string | number | null)[] = [],
    ) {}
    bind(...args: (string | number | null)[]) {
      return new Statement(this.sql, args);
    }
    async all() {
      return execute(this);
    }
    async first() {
      queries.push(this.sql);
      return sqlite.prepare(this.sql).get(...this.args) ?? null;
    }
    async run() {
      return execute(this);
    }
  }
  function execute(statement: Statement) {
    queries.push(statement.sql);
    const query = sqlite.prepare(statement.sql);
    const results = query.columns().length ? query.all(...statement.args) : [];
    const info = query.columns().length ? undefined : query.run(...statement.args);
    return { results, success: true, meta: { changes: Number(info?.changes ?? results.length) } };
  }
  const db = {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map(execute);
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  return { db, sqlite, queries };
}
const body = (source = "flowchart LR\nA-->B") => ({
  type: "doc",
  content: [
    {
      type: "codeBlock",
      attrs: { language: "mermaid" },
      content: [{ type: "text", text: source }],
    },
    { type: "inlineMath", attrs: { latex: "x^2" } },
    { type: "blockMath", attrs: { latex: "x^2" } },
  ],
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><text>cached</text></svg>';
const output = { output: svg, diagnostic: null };
const putPost = (
  sqlite: DatabaseSync,
  id: string,
  document: Parameters<typeof renderEntries>[0] = body(),
) =>
  sqlite
    .prepare("INSERT INTO posts(id,created_at,updated_at,body_json) VALUES(?,?,?,?)")
    .run(id.padEnd(26, "0"), "", "", JSON.stringify(document));

describe("shared persistent rendering cache", () => {
  it("keys exact source, kind and renderer; ignores the rest of the article", async () => {
    const entries = await renderEntries(body());
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);
    expect((await renderEntries(body()))[0].key).toBe(entries[0].key);
    expect(await renderKey({ ...entries[0], source: entries[0].source + "\n" })).not.toBe(
      entries[0].key,
    );
    expect(await renderKey({ ...entries[0], renderer: "next" })).not.toBe(entries[0].key);
  });
  it("reuses persistent results without a TTL or process-local memory", async () => {
    const { db } = database();
    const entries = await renderEntries(body());
    const producer = vi.fn(async (entries: RenderEntry[]) => entries.map(() => output));
    await resolveRenderCache(db, entries, producer);
    await resolveRenderCache(db, [...entries, entries[0]], async () => {
      throw new Error("must not render");
    });
    expect(producer).toHaveBeenCalledTimes(1);
    expect(producer.mock.calls[0][0]).toHaveLength(3);
  });
  it("renders SSR entirely from persisted browser SVG and MathJax output without a browser binding", async () => {
    const { db } = database();
    const document = body();
    const entries = await renderEntries(document);
    await db.batch(
      entries.map((entry) =>
        insertRenderCache(db, entry, entry.kind === "mermaid" ? svg : generateMath(entry).output!),
      ),
    );
    const result = await renderDocument(document, { platform: { env: { DB: db } } } as Parameters<
      typeof renderDocument
    >[1]);
    expect(result.diagrams[0]).toContain("data:image/svg+xml,");
    expect(result.math).toHaveLength(2);
    expect(result.math.every((result) => result.output?.includes("mjx-container"))).toBe(true);
  });
  it("only one concurrent reader renders the missing source", async () => {
    const { db } = database();
    const [entry] = await renderEntries(body());
    const producer = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [output];
    });
    const [first, second] = await Promise.all([
      resolveRenderCache(db, [entry], producer),
      resolveRenderCache(db, [entry], producer),
    ]);
    expect(first.get(entry.key)).toEqual(second.get(entry.key));
    expect(producer).toHaveBeenCalledTimes(1);
  });
  it("retains diagnostics but releases a failed infrastructure lease for retry", async () => {
    const { db } = database();
    const [entry] = await renderEntries(body());
    await expect(
      resolveRenderCache(db, [entry], async () => {
        throw new Error("browser unavailable");
      }),
    ).rejects.toThrow("browser unavailable");
    await resolveRenderCache(db, [entry], async () => [
      { output: null, diagnostic: "invalid syntax" },
    ]);
    const result = await resolveRenderCache(db, [entry], async () => {
      throw new Error("must not retry invalid source");
    });
    expect(result.get(entry.key)?.diagnostic).toBe("invalid syntax");
  });
  it("adopts client SVG without rendering and rejects unrelated or obsolete artifacts", async () => {
    const { db, sqlite } = database();
    putPost(sqlite, "1");
    const [entry] = await renderEntries(body());
    const artifact = { source: entry.source, renderer: RENDERERS.mermaid, svg };
    await db.batch(await acceptRenderArtifacts(db, body(), [artifact]));
    const result = await resolveRenderCache(db, [entry], async () => {
      throw new Error("browser must not launch");
    });
    expect(result.get(entry.key)?.output).toBe(svg);
    await expect(
      acceptRenderArtifacts(db, body(), [{ ...artifact, source: "unrelated" }]),
    ).rejects.toThrow();
    await expect(
      acceptRenderArtifacts(db, body(), [{ ...artifact, renderer: "old" }]),
    ).rejects.toThrow();
    await expect(
      acceptRenderArtifacts(db, body(), [{ ...artifact, svg: "<!DOCTYPE svg>" + svg }]),
    ).rejects.toThrow();
  });
  it("commits browser SVG with the post so the first SSR needs no Browser Rendering", async () => {
    const { db } = database();
    const id = await createDraft(db);
    const document = {
      type: "doc",
      content: [body().content[0], { type: "paragraph", content: [body().content[1]] }],
    };
    await savePostContent(db, id, {
      title: "cached",
      status: "draft",
      alias: null,
      tags: [],
      body: document,
      formatVersion: 2,
      bodyFormat: "tiptap-json",
      contentSchemaVersion: 1,
      renderArtifacts: [
        { source: body().content[0].content![0].text, renderer: RENDERERS.mermaid, svg },
      ],
    });
    const saved = await findPost(db, id);
    const result = await renderDocument(saved!.body, {
      platform: { env: { DB: db } },
    } as Parameters<typeof renderDocument>[1]);
    expect(result.diagrams[0]).toContain("data:image/svg+xml,");
    expect(result.math[0].output).toContain("mjx-container");
  });
  it("cascades references and removes only the last shared output, even with raw SQL deletes", async () => {
    const { db, sqlite } = database();
    const document = body();
    putPost(sqlite, "1");
    putPost(sqlite, "2");
    const entries = await renderEntries(document);
    for (const id of ["1", "2"])
      await db.batch(
        syncRenderReferences(
          db,
          { id: id.padEnd(26, "0"), body: JSON.stringify(document) },
          entries,
        ),
      );
    await db.batch(entries.map((entry) => insertRenderCache(db, entry, svg)));
    sqlite.prepare("DELETE FROM posts WHERE id=?").run("1".padEnd(26, "0"));
    expect(sqlite.prepare("SELECT * FROM post_render_refs").all()).toHaveLength(3);
    expect(sqlite.prepare("SELECT * FROM render_cache").all()).toHaveLength(3);
    sqlite.exec("DELETE FROM posts");
    expect(sqlite.prepare("SELECT * FROM post_render_refs").all()).toHaveLength(0);
    expect(sqlite.prepare("SELECT * FROM render_cache").all()).toHaveLength(0);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("updates only changed references without evicting unchanged output", async () => {
    const { db, sqlite } = database();
    putPost(sqlite, "1");
    const post = { id: "1".padEnd(26, "0"), body: JSON.stringify(body()) };
    const entries = await renderEntries(body());
    await db.batch(syncRenderReferences(db, post, entries));
    await db.batch(entries.map((entry) => insertRenderCache(db, entry, svg)));
    await db.batch(syncRenderReferences(db, post, entries));
    expect(sqlite.prepare("SELECT output FROM render_cache").all()).toEqual(
      entries.map(() => ({ output: svg })),
    );
    const document = { type: "doc", content: [body().content[1]] };
    post.body = JSON.stringify(document);
    sqlite.prepare("UPDATE posts SET body_json=? WHERE id=?").run(post.body, post.id);
    await db.batch(syncRenderReferences(db, post, await renderEntries(document)));
    expect(sqlite.prepare("SELECT kind, output FROM render_cache").all()).toEqual([
      { kind: "inlineMath", output: svg },
    ]);
  });
  it("rejects orphan references and recreates references when a cache row is evicted", async () => {
    const { db, sqlite } = database();
    putPost(sqlite, "1");
    const post = { id: "1".padEnd(26, "0"), body: JSON.stringify(body()) };
    const entries = await renderEntries(body());
    await db.batch(syncRenderReferences(db, post, entries));
    expect(() =>
      sqlite.prepare("INSERT INTO post_render_refs VALUES(?,?)").run("missing", entries[0].key),
    ).toThrow();
    sqlite.prepare("DELETE FROM render_cache WHERE key=?").run(entries[0].key);
    expect(sqlite.prepare("SELECT * FROM post_render_refs").all()).toHaveLength(2);
    await resolveRenderCache(db, entries, async (inputs) => inputs.map(() => output), post);
    expect(sqlite.prepare("SELECT * FROM post_render_refs").all()).toHaveLength(3);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("fetches 150 distinct cached results with one SELECT, not 150 statements", async () => {
    const { db, sqlite, queries } = database();
    const document = {
      type: "doc",
      content: Array.from({ length: 150 }, (_, i) => ({
        type: "blockMath",
        attrs: { latex: `x_${i}` },
      })),
    };
    putPost(sqlite, "1", document);
    const post = { id: "1".padEnd(26, "0"), body: JSON.stringify(document) };
    const entries = await renderEntries(document);
    await db.batch(syncRenderReferences(db, post, entries));
    await db.batch(entries.map((entry) => insertRenderCache(db, entry, svg)));
    queries.length = 0;
    const result = await resolveRenderCache(
      db,
      entries,
      async () => {
        throw new Error("cache miss");
      },
      post,
    );
    expect(result.size).toBe(150);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("JOIN render_cache");
  });
  it("separates cached MathJax IDs for repeated formulas", async () => {
    const math = body().content[1];
    const document = {
      type: "doc",
      content: [{ type: "paragraph", content: [math, { type: "text", text: " + " }, math] }],
    };
    const entries = await renderEntries(document);
    const rendered = entries.map(generateMath);
    const html = renderPost(document, [], rendered).html;
    expect(html).toContain("mjx-assistive-mml");
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(reference[1]);
  });
});
