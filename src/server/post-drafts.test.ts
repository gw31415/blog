import { afterEach, expect, it, vi } from "vite-plus/test";
import { testDatabase } from "../../tests/helpers/database";
import { createDraft, findPost, savePostContent, deletePost } from "./posts";
import { listPostPage } from "./post-list";
import { searchPosts } from "./webmcp";
import { collectMedia } from "./media";

const opened: ReturnType<typeof testDatabase>[] = [];
afterEach(() => {
  opened.splice(0).forEach(({ sql }) => sql.close());
  vi.useRealTimers();
});
function setup() {
  const test = testDatabase();
  opened.push(test);
  return test;
}
const content = (title: string) => ({
  title,
  subtitle: title,
  description: title,
  tags: [title],
  alias: title,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] },
  formatVersion: 2,
  bodyFormat: "tiptap-json",
  contentSchemaVersion: 1,
});

it("keeps public content, URL, dates, search and lists unchanged until explicit update", async () => {
  const { db } = setup();
  const id = await createDraft(db);
  let version = (await findPost(db, id))!.updated_at;
  version = (
    await savePostContent(db, id, {
      ...content("live"),
      expectedVersion: version,
      intent: "publish",
    })
  ).version;
  const before = await findPost(db, id, false);
  const saved = await savePostContent(db, id, {
    ...content("secret"),
    publishedAt: "2024-02-29",
    status: "published",
    expectedVersion: version,
  });
  expect(await findPost(db, id, false)).toEqual(before);
  expect(await findPost(db, "secret", false)).toBeNull();
  expect((await findPost(db, "live", false))?.title).toBe("live");
  expect((await findPost(db, id))?.title).toBe("secret");
  expect((await listPostPage(db, false)).posts[0].tags).toEqual(["live"]);
  expect((await listPostPage(db, true)).posts[0].title).toBe("secret");
  expect((await searchPosts(db, false, { query: "secret" })).items).toHaveLength(0);
  expect((await searchPosts(db, false, { tag: "secret" })).items).toHaveLength(0);
  expect((await searchPosts(db, true, { query: "secret" })).items).toHaveLength(1);
  await savePostContent(db, id, {
    ...content("secret"),
    publishedAt: "2024-02-29",
    expectedVersion: saved.version,
    intent: "publish",
  });
  expect((await findPost(db, id, false))?.title).toBe("secret");
  expect(await findPost(db, "live", false)).toBeNull();
  expect((await findPost(db, id))?.has_draft).toBe(0);
});

it("allows incomplete published edits to autosave but rejects invalid publication", async () => {
  const { db } = setup();
  const id = await createDraft(db);
  const live = await savePostContent(db, id, {
    ...content("live"),
    expectedVersion: (await findPost(db, id))!.updated_at,
    intent: "publish",
  });
  const saved = await savePostContent(db, id, {
    ...content("secret"),
    title: "",
    expectedVersion: live.version,
  });
  expect((await findPost(db, id))?.title).toBe("");
  expect((await findPost(db, id, false))?.title).toBe("live");
  await expect(
    savePostContent(db, id, {
      ...content("secret"),
      title: "",
      expectedVersion: saved.version,
      intent: "publish",
    }),
  ).rejects.toThrow("タイトル");
  expect((await findPost(db, id, false))?.title).toBe("live");
});

it("rejects stale/missing versions and concurrent publication without mutating the winner", async () => {
  const { db } = setup();
  const id = await createDraft(db);
  const version = (await findPost(db, id))!.updated_at;
  await expect(savePostContent(db, id, content("no-version"))).rejects.toThrow("CONFLICT");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01"));
  const results = await Promise.allSettled([
    savePostContent(db, id, { ...content("same"), expectedVersion: version }),
    savePostContent(db, id, { ...content("same"), expectedVersion: version, intent: "publish" }),
  ]);
  expect(results.map((x) => x.status)).toEqual(["fulfilled", "rejected"]);
  expect((await findPost(db, id, false))?.status).toBe("draft");
  expect((await findPost(db, id))?.title).toBe("same");
  await expect(
    savePostContent(db, id, { ...content("stale"), expectedVersion: version }),
  ).rejects.toThrow("CONFLICT");
});

it("keeps media referenced only by the public revision through draft saves and cleanup", async () => {
  const { db, sql } = setup();
  const id = await createDraft(db);
  sql.exec(`INSERT INTO image_originals(id,object_key) VALUES('original','original');
    INSERT INTO media_variants(id,kind,original_id,recipe,object_key,content_hash,mime,width,height,state,created_at) VALUES('image','raster','original','test','image','test','image/avif',10,10,'ready',0);`);
  const image = {
    type: "doc",
    content: [
      {
        type: "figure",
        attrs: { src: "/images/variants/image", alt: "" },
        content: [{ type: "paragraph" }],
      },
    ],
  };
  const live = await savePostContent(db, id, {
    ...content("live"),
    body: image,
    intent: "publish",
    expectedVersion: (await findPost(db, id))!.updated_at,
  });
  const saved = await savePostContent(db, id, {
    ...content("secret"),
    expectedVersion: live.version,
  });
  sql.exec("UPDATE media_variants SET unreferenced_at=0");
  const remove = vi.fn(async () => {});
  await collectMedia(db, { delete: remove });
  expect(remove).not.toHaveBeenCalled();
  expect(
    sql.prepare("SELECT variant_id FROM post_media_refs WHERE post_id=?").get(id)?.variant_id,
  ).toBe("image");
  await savePostContent(db, id, {
    ...content("secret"),
    expectedVersion: saved.version,
    intent: "publish",
  });
  expect(sql.prepare("SELECT COUNT(*) AS n FROM all_post_media_refs").get()?.n).toBe(0);
});

it("preserves drafts on failed media publication, enforces alias reservation and deletes both revisions", async () => {
  const { db, sql } = setup();
  const a = await createDraft(db),
    b = await createDraft(db);
  const saved = await savePostContent(db, a, {
    ...content("reserved"),
    expectedVersion: (await findPost(db, a))!.updated_at,
  });
  await expect(
    savePostContent(db, b, {
      ...content("reserved"),
      expectedVersion: (await findPost(db, b))!.updated_at,
    }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    savePostContent(db, a, {
      ...content("reserved"),
      expectedVersion: saved.version,
      intent: "publish",
      body: {
        type: "doc",
        content: [
          {
            type: "figure",
            attrs: { src: "/images/variants/missing", alt: "" },
            content: [{ type: "paragraph" }],
          },
        ],
      },
    }),
  ).rejects.toThrow("公開前");
  expect((await findPost(db, a))?.updated_at).toBe(saved.version);
  expect((await findPost(db, a, false))?.status).toBe("draft");
  expect(await deletePost(db, a, saved.version)).toBe(true);
  expect(sql.prepare("SELECT * FROM post_drafts WHERE id=?").get(a)).toBeUndefined();
});
