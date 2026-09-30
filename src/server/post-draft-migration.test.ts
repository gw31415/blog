import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vite-plus/test";

it("adds working drafts without changing an existing public post or its media references", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("migrations")
      .filter((f) => f.endsWith(".sql") && f < "0008")
      .toSorted())
      db.exec(readFileSync(`migrations/${file}`, "utf8"));
    db.exec(`INSERT INTO posts(id,canonical_alias,status,title,created_at,updated_at,published_at) VALUES('01ARZ3NDEKTSV4RRFFQ69G5FAV','existing','published','Existing','2020-01-01','2024-01-01','2021-01-01');
      INSERT INTO image_originals(id,object_key) VALUES('original','original');
      INSERT INTO media_variants(id,kind,original_id,recipe,object_key,content_hash,mime,width,height,state,created_at) VALUES('image','raster','original','test','image','test','image/avif',10,10,'ready',0);
      INSERT INTO post_media_refs VALUES('01ARZ3NDEKTSV4RRFFQ69G5FAV','0','hash','image',NULL,0,'test',NULL);`);
    const before = db.prepare("SELECT * FROM posts").get();
    const refs = db.prepare("SELECT * FROM post_media_refs").all();
    db.exec(readFileSync("migrations/0008_post_drafts.sql", "utf8"));
    expect(db.prepare("SELECT * FROM posts").get()).toEqual(before);
    expect(db.prepare("SELECT * FROM post_media_refs").all()).toEqual(refs);
    expect(db.prepare("SELECT * FROM all_post_media_refs").all()).toEqual(refs);
    expect(db.prepare("SELECT * FROM post_drafts").all()).toHaveLength(0);
    expect(db.prepare("SELECT title,has_draft FROM editable_posts").get()).toEqual({
      title: "Existing",
      has_draft: 0,
    });
  } finally {
    db.close();
  }
});
