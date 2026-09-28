import { acceptMedia } from "./media";
import { mathArtifactFromHTML } from "../content/media-artifact";
import { validateLatex } from "../components/editor/mathjax-renderer";
function generateMath(entry: RenderEntry) {
  const result = validateLatex(entry.source, entry.kind === "blockMath");
  return result.ok
    ? { output: result.html, diagnostic: null }
    : { output: null, diagnostic: result.message };
}
import { createDraft, findPost, savePostContent } from "./posts";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { renderEntries, renderKey, type RenderEntry } from "../content/render-contract";
import { renderPost } from "./render-post";
import { renderDocument } from "./render-document";

const opened: DatabaseSync[] = [];
afterEach(() => {
  opened.splice(0).forEach((db) => db.close());
});
function database() {
  const sqlite = new DatabaseSync(":memory:");
  opened.push(sqlite);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const queries: string[] = [];
  sqlite.exec(readFileSync("migrations/0001_initial.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0004_media_delivery.sql", "utf8"));
  for (const file of [
    "0005_media_history.sql",
    "0006_media_lease_grace.sql",
    "0007_retire_legacy_media.sql",
  ])
    sqlite.exec(readFileSync("migrations/" + file, "utf8"));
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
    // This test emulates only the D1 operations exercised by this module.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
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
describe("persisted media rendering", () => {
  it("keys exact source, kind and renderer; ignores the rest of the article", async () => {
    const entries = await renderEntries(body());
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);
    expect((await renderEntries(body()))[0].key).toBe(entries[0].key);
    expect(await renderKey({ ...entries[0], source: entries[0].source + "\n" })).not.toBe(
      entries[0].key,
    );
    expect(await renderKey({ ...entries[0], renderer: "next" })).not.toBe(entries[0].key);
  });
  it("renders SSR entirely from persisted browser SVG and MathJax output without a browser binding", async () => {
    const { db } = database();
    const document = body();
    const entries = await renderEntries(document);
    const objects = new Map<string, string>();
    const bucket = {
      put: async (k: string, b: Blob) => {
        objects.set(k, await b.text());
      },
      get: async (k: string) => ({ text: async () => objects.get(k)! }),
      delete: async (k: string) => {
        objects.delete(k);
      },
    };
    const id = await createDraft(db);
    await acceptMedia(
      db,
      bucket,
      id,
      document,
      entries.map((e) => ({
        ...e,
        ...(e.kind === "mermaid" ? { svg } : mathArtifactFromHTML(generateMath(e).output!)),
      })),
    );
    const result = await renderDocument(document, {
      platform: { env: { DB: db, IMAGES: bucket } },
    });
    expect(result.diagrams[0]).toContain("data:image/svg+xml,");
    expect(result.math).toHaveLength(2);
    expect(result.math.every((item) => item.output?.includes("mjx-container"))).toBe(true);
  });
  it("commits browser SVG and math with a post without server rendering", async () => {
    const { db } = database();
    const id = await createDraft(db);
    const document = {
      type: "doc",
      content: [body().content[0], { type: "paragraph", content: [body().content[1]] }],
    };
    const entries = await renderEntries(document);
    const objects = new Map<string, string>();
    const bucket = {
      put: async (k: string, b: Blob) => {
        objects.set(k, await b.text());
      },
      get: async (k: string) => ({ text: async () => objects.get(k)! }),
      delete: async (k: string) => {
        objects.delete(k);
      },
    };
    await savePostContent(
      db,
      id,
      {
        title: "cached",
        status: "draft",
        alias: null,
        tags: [],
        body: document,
        formatVersion: 2,
        bodyFormat: "tiptap-json",
        contentSchemaVersion: 1,
        renderArtifacts: entries.map((e) => ({
          ...e,
          ...(e.kind === "mermaid" ? { svg } : mathArtifactFromHTML(generateMath(e).output!)),
        })),
      },
      bucket,
    );
    const result = await renderDocument(
      (await findPost(db, id))!.body,
      { platform: { env: { DB: db, IMAGES: bucket } } },
      id,
    );
    expect(result.diagrams[0]).toContain("data:image/svg+xml,");
    expect(result.math[0].output).toContain("mjx-container");
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

it("saves single-line metadata and explicit publication date corrections", async () => {
  const { db } = database();
  const id = await createDraft(db);
  const values = {
    title: "題\r\n名",
    subtitle: "副\u2028題",
    tags: ["長\n名"],
    status: "draft",
    alias: null,
    body: { type: "doc", content: [{ type: "paragraph" }] },
    formatVersion: 2,
    bodyFormat: "tiptap-json",
    contentSchemaVersion: 1,
    publishedAt: "2024-02-29",
  };
  await savePostContent(db, id, values);
  const post = await findPost(db, id);
  expect(post).toMatchObject({
    title: "題 名",
    subtitle: "副 題",
    tags: ["長 名"],
    published_at: "2024-02-29T00:00:00.000Z",
  });
  await expect(savePostContent(db, id, { ...values, publishedAt: "2025-02-29" })).rejects.toThrow();
  expect((await findPost(db, id))!.published_at).toBe(post!.published_at);
});

it("rejects unfinished saves regardless of publication status and does not persist working copies", async () => {
  const { db } = database();
  const id = await createDraft(db);
  const document = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "confirmed" }] }],
  };
  const values = {
    title: "confirmed",
    status: "draft",
    alias: null,
    tags: [],
    body: document,
    formatVersion: 2,
    bodyFormat: "tiptap-json",
    contentSchemaVersion: 1,
  };
  await savePostContent(db, id, values);
  for (const status of ["draft", "published"]) {
    await expect(
      savePostContent(db, id, {
        ...values,
        status,
        editingState: { pending: { command: "link", values: { href: "unfinished" } } },
      }),
    ).rejects.toThrow("適用するかキャンセル");
    await expect(
      savePostContent(db, id, {
        ...values,
        status,
        body: { type: "doc", content: [{ type: "blockMath", attrs: { latex: "" } }] },
      }),
    ).rejects.toThrow();
  }
  await savePostContent(db, id, { ...values, editingState: { document } });
  expect((await findPost(db, id))!.editing_state).toBeNull();
  expect((await findPost(db, id))!.body).toEqual(document);
});

const input = (alias: string) => ({
  alias,
  title: "Article",
  body: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
  tags: "[]",
  formatVersion: 2,
  bodyFormat: "tiptap-json",
  contentSchemaVersion: 1,
  status: "draft",
});

describe("current article alias", () => {
  it("resolves only the current alias and permits reuse of released aliases", async () => {
    const { db, sqlite } = database();
    const a = await createDraft(db),
      b = await createDraft(db);
    await savePostContent(db, a, input("old-name"));
    expect((await findPost(db, "old-name"))?.id).toBe(a);
    await savePostContent(db, a, input("new-name"));
    expect(await findPost(db, "old-name")).toBeNull();
    expect((await findPost(db, "new-name"))?.id).toBe(a);
    expect((await findPost(db, a))?.id).toBe(a);
    await savePostContent(db, b, input("old-name"));
    expect((await findPost(db, "old-name"))?.id).toBe(b);
    await expect(savePostContent(db, b, input("new-name"))).rejects.toThrow("CONFLICT");
    expect((await findPost(db, "new-name"))?.id).toBe(a);
    await savePostContent(db, a, input(""));
    expect(await findPost(db, "new-name")).toBeNull();
    expect((await findPost(db, a))?.canonical_alias).toBeNull();
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name='post_aliases'").get(),
    ).toBeUndefined();
  });
});
