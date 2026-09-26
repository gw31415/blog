import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  storeImage as store,
  listOriginals,
  collectUnusedImages as collect,
  postImageIds,
  removeUnusedVariants,
} from "./images";
import { createDraft, deletePost as removePost } from "./posts";

const opened: DatabaseSync[] = [];
const buckets = new WeakMap<
  D1Database,
  {
    objects: Map<string, Buffer>;
    put(key: string, value: Blob): Promise<void>;
    delete(key: string): Promise<void>;
  }
>();
const storeImage = (db: D1Database, data: FormData) => store(db, data, buckets.get(db)!);
const deletePost = async (db: D1Database, id: string) => {
  const ids = await postImageIds(db, id);
  const result = await removePost(db, id);
  await removeUnusedVariants(db, buckets.get(db)!, ids);
  return result;
};
const collectUnusedImages = (db: D1Database) => collect(db, buckets.get(db)!);
afterEach(() => opened.splice(0).forEach((db) => db.close()));
function setup() {
  const sql = new DatabaseSync(":memory:");
  opened.push(sql);
  sql.exec("PRAGMA foreign_keys=ON");
  sql.exec(readFileSync("migrations/0001_posts.sql", "utf8"));
  {
    sql.exec(readFileSync("migrations/0002_image_library.sql", "utf8"));
    sql.exec(readFileSync("migrations/0003_image_reference_urls.sql", "utf8"));
    sql.exec(readFileSync("migrations/0004_original_image_objects.sql", "utf8"));
    sql.exec(readFileSync("migrations/0005_r2_image_families.sql", "utf8"));
    sql.exec(readFileSync("migrations/0006_content_addressed_images.sql", "utf8"));
    sql.exec(readFileSync("migrations/0007_simple_image_variants.sql", "utf8"));
    sql.exec(readFileSync("migrations/0008_image_url_matching.sql", "utf8"));
  }
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
      return execute(this);
    }
  }
  function execute(s: Statement) {
    return { meta: { changes: Number(sql.prepare(s.query).run(...s.args).changes) } };
  }
  // Minimal D1 adapter backed by real SQLite, including transactional rollback.
  const adapter = {
    prepare: (q: string) => new Statement(q),
    async batch(statements: Statement[]) {
      sql.exec("BEGIN");
      try {
        const results = statements.map(execute);
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const db = adapter as unknown as D1Database;
  const objects = new Map<string, Buffer>();
  buckets.set(db, {
    objects,
    async put(key, blob) {
      objects.set(key, Buffer.from(await blob.arrayBuffer()));
    },
    async delete(key) {
      objects.delete(key);
    },
  });
  return { db, sql, objects };
}
const avif = Uint8Array.from([
  0, 0, 0, 24, 102, 116, 121, 112, 97, 118, 105, 102, 0, 0, 0, 0, 97, 118, 105, 102, 109, 105, 102,
  49,
]);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(24).fill(0)]);
function form(postId: string, original: Uint8Array = png) {
  const data = new FormData();
  data.set("postId", postId);
  data.set("width", "12");
  data.set("height", "8");
  data.set(
    "original",
    new File([Uint8Array.from(original)], "original.png", { type: "image/png" }),
  );
  data.set("image", new File([avif], "delivery.avif", { type: "image/avif" }));
  return data;
}
function save(sql: DatabaseSync, postId: string, urls: string[]) {
  sql.prepare("UPDATE posts SET body_json=? WHERE id=?").run(
    JSON.stringify({
      type: "doc",
      content: urls.map((src) => ({
        type: "figure",
        attrs: { src, alt: "" },
        content: [{ type: "paragraph" }],
      })),
    }),
    postId,
  );
}

describe("two-table image lifecycle", () => {
  it("uses separate ULID filenames and keeps original and variant row after deletion", async () => {
    const { db, sql, objects } = setup();
    const post = await createDraft(db);
    const image = await storeImage(db, form(post));
    expect(image.url).toMatch(/^\/images\/variants\/[0-9A-Z]{26}\.avif$/);
    expect(image.originalId).toMatch(/^[0-9A-Z]{26}\.png$/);
    expect(objects.get(`images/originals/${image.originalId}`)).toEqual(Buffer.from(png));
    save(sql, post, [image.url]);
    await deletePost(db, post);
    expect(objects.size).toBe(1);
    expect(sql.prepare("SELECT count(*) n FROM image_variants").get()?.n).toBe(1);
    expect((await listOriginals(db, true)).items[0].articles).toEqual([]);
  });
  it("keeps shared delivery until its last article reference disappears", async () => {
    const { db, sql, objects } = setup();
    const a = await createDraft(db),
      b = await createDraft(db);
    const image = await storeImage(db, form(a));
    save(sql, a, [image.url]);
    save(sql, b, [`https://blog.example${image.url}`]);
    await deletePost(db, a);
    expect(objects.size).toBe(2);
    await deletePost(db, b);
    expect(objects.size).toBe(1);
  });
  it("removes detached files but retains metadata and originals", async () => {
    const { db, sql, objects } = setup();
    const post = await createDraft(db);
    const image = await storeImage(db, form(post));
    save(sql, post, [image.url]);
    const ids = await postImageIds(db, post);
    save(sql, post, []);
    await removeUnusedVariants(db, buckets.get(db)!, ids);
    expect(objects.size).toBe(1);
    expect((await listOriginals(db, true)).items).toHaveLength(1);
  });
  it("reuses originals but always allocates a new delivery ID", async () => {
    const { db, objects } = setup();
    const a = await createDraft(db),
      b = await createDraft(db);
    const first = await storeImage(db, form(a));
    const data = form(b);
    data.delete("original");
    data.set("originalId", first.originalId);
    const second = await storeImage(db, data);
    expect(second.url).not.toBe(first.url);
    expect(second.originalId).toBe(first.originalId);
    expect(objects.size).toBe(3);
  });
  it("explicit collection releases unsaved uploads without deleting original records", async () => {
    const { db, objects } = setup();
    const post = await createDraft(db);
    await storeImage(db, form(post));
    await collectUnusedImages(db);
    expect(objects.size).toBe(1);
    expect((await listOriginals(db, true)).items).toHaveLength(1);
  });
  it("keeps originals when the article disappears during upload", async () => {
    const { db, objects } = setup();
    const post = await createDraft(db);
    const bucket = buckets.get(db)!;
    const put = bucket.put;
    bucket.put = async (key, value) => {
      await put(key, value);
      if (key.startsWith("images/variants/")) await removePost(db, post);
    };
    await expect(storeImage(db, form(post))).rejects.toThrow("オリジナル");
    expect(objects.size).toBe(1);
    expect((await listOriginals(db, true)).items).toHaveLength(1);
  });
  it("retries failed R2 deletion through explicit collection", async () => {
    const { db, objects } = setup();
    const post = await createDraft(db);
    await storeImage(db, form(post));
    const bucket = buckets.get(db)!;
    const remove = bucket.delete;
    bucket.delete = async () => {
      throw new Error("offline");
    };
    await deletePost(db, post);
    expect(objects.size).toBe(2);
    bucket.delete = remove;
    await collectUnusedImages(db);
    expect(objects.size).toBe(1);
  });
  it("rejects invalid input before storing objects", async () => {
    const { db, objects } = setup();
    const post = await createDraft(db);
    const bad = form(post);
    bad.set("image", new File([png], "fake.avif"));
    await expect(storeImage(db, bad)).rejects.toThrow("AVIF");
    await expect(storeImage(db, form(post, new Uint8Array(25_000_001)))).rejects.toThrow("25MB");
    expect(objects.size).toBe(0);
  });
});
