import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, it, expect } from "vite-plus/test";
import { createDraft } from "./posts";
import { acceptMedia, mediaReferenceStatements, collectMedia } from "./media";
import { renderEntries } from "../content/render-contract";
import { classifyMedia } from "../content/media-fold";
import { parseSvgArtifact, mathArtifactFromHTML } from "../content/media-artifact";
import { validateLatex } from "../components/editor/mathjax-renderer";
const opened: DatabaseSync[] = [];
afterEach(() => {
  opened.splice(0).forEach((db) => db.close());
});
function database() {
  const sqlite = new DatabaseSync(":memory:");
  opened.push(sqlite);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const queries: string[] = [];
  for (const file of [
    "0001_initial.sql",
    "0004_media_delivery.sql",
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

const body = {
  type: "doc",
  content: [
    {
      type: "codeBlock",
      attrs: { language: "mermaid" },
      content: [{ type: "text", text: "flowchart LR\nA-->B" }],
    },
  ],
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0"/></svg>';
function bucket() {
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key: string, value: Blob) {
      objects.set(key, await value.text());
    },
    async get(key: string) {
      return objects.has(key) ? { text: async () => objects.get(key)! } : null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}
it("shares client artifacts, preserves current references, and collects only after grace", async () => {
  const { db, sqlite } = database();
  const id = await createDraft(db);
  const objects = bucket();
  const entry = (await renderEntries(body))[0];
  const first = await acceptMedia(db, objects, id, body, [{ ...entry, svg }]);
  const version = sqlite.prepare("SELECT updated_at FROM posts WHERE id=?").get(id)!.updated_at;
  if (typeof version !== "string") throw new Error("Missing post version");
  sqlite.prepare("UPDATE posts SET body_json=? WHERE id=?").run(JSON.stringify(body), id);
  await db.batch(await mediaReferenceStatements(db, id, body, version, first.lease));
  await acceptMedia(db, objects, id, body, [{ ...entry, svg }]);
  await acceptMedia(db, objects, id, body, [{ key: entry.key, renderer: entry.renderer }]);
  expect(objects.objects.size).toBe(1);
  expect(await collectMedia(db, objects)).toBe(0);
  sqlite.prepare("DELETE FROM media_upload_leases").run();
  sqlite.prepare("DELETE FROM posts WHERE id=?").run(id);
  expect(await collectMedia(db, objects)).toBe(0);
  sqlite.prepare("UPDATE media_variants SET unreferenced_at=unixepoch()-86401").run();
  expect(await collectMedia(db, objects)).toBe(1);
  expect(objects.objects.size).toBe(0);
});
it("DB rejects references and leases to deletion-claimed artifacts", async () => {
  const { db, sqlite } = database();
  const id = await createDraft(db);
  const entry = (await renderEntries(body))[0];
  await acceptMedia(db, bucket(), id, body, [{ ...entry, svg }]);
  const v = sqlite.prepare("SELECT id FROM media_variants").get()!.id;
  sqlite.prepare("UPDATE media_variants SET state='deleting'").run();
  expect(() =>
    sqlite
      .prepare("INSERT INTO media_upload_leases VALUES(?,?,?,?)")
      .run("other", v, id, 9999999999),
  ).toThrow();
  expect(() =>
    sqlite
      .prepare("INSERT INTO post_media_refs VALUES(?,?,?,?,?,?,?,?)")
      .run(id, "0", "hash", v, entry.key, 1, "v1", null),
  ).toThrow();
});
it("has deterministic fold decisions with late diagrams lazy and unknown heights safe", () => {
  const long = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "文".repeat(15000) }] },
      ...body.content,
    ],
  };
  expect(classifyMedia(long)[0].embed).toBe(false);
  expect(classifyMedia(body)[0].embed).toBe(true);
  expect(classifyMedia(long)).toEqual(classifyMedia(JSON.parse(JSON.stringify(long))));
});
it("validates SVG and real MathJax output without accepting active markup", () => {
  expect(() => parseSvgArtifact(svg.replace("<path", "<script"), "mermaid")).toThrow();
  expect(() =>
    parseSvgArtifact(svg.replace("<path", '<path onclick="alert(1)"'), "mermaid"),
  ).toThrow();
  const result = validateLatex("x^2+\\frac{a}{b}", false);
  expect(result.ok).toBe(true);
  if (result.ok) {
    const parts = mathArtifactFromHTML(result.html);
    const a = parseSvgArtifact(parts.svg, "inlineMath", parts.mathml);
    expect(a.layout.widthEm).toBeGreaterThan(0);
    expect(a.layout.mathml).toContain("<math");
  }
});
