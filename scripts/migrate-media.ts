/// <reference path="../worker-configuration.d.ts" />
import { getPlatformProxy } from "wrangler";
import { mkdir, writeFile } from "node:fs/promises";
import { renderEntries } from "../src/content/render-contract";
import { acceptMedia, mediaReferenceStatements, mediaHash } from "../src/server/media";
import { mathArtifactFromHTML } from "../src/content/media-artifact";
const args = process.argv.slice(2);
const target = args[args.indexOf("--env") + 1];
if (!["local", "production"].includes(target) || !args.includes("--env"))
  throw new Error("Specify --env local|production");
const apply = args.includes("--apply");
const audit = args.includes("--audit");
const platform = await getPlatformProxy<Env>({
  remoteBindings: target === "production",
  persist: { path: ".cache/webmcp-test/v3" },
});
try {
  const { DB: db, IMAGES: bucket } = platform.env;
  const posts = (
    await db
      .prepare("SELECT id,title,body_json,updated_at,status FROM posts ORDER BY id")
      .all<{ id: string; title: string; body_json: string; updated_at: string; status: string }>()
  ).results;
  await mkdir(".cache/media-migration", { recursive: true });
  if (apply)
    await writeFile(
      `.cache/media-migration/${target}-posts-${Date.now()}.json`,
      JSON.stringify(posts),
    );
  let cursor: string | undefined;
  let originals = 0;
  do {
    const page = await bucket.list({ prefix: "images/originals/", cursor });
    for (const object of page.objects) {
      originals++;
      if (apply)
        await db
          .prepare(
            "INSERT INTO image_originals(id,object_key,mime,byte_length,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(
            object.key.split("/").at(-1)!,
            object.key,
            object.httpMetadata?.contentType ?? null,
            object.size,
            Math.floor(object.uploaded.getTime() / 1000),
          )
          .run();
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  let complete = 0;
  const failures: string[] = [];
  for (const post of posts) {
    try {
      const body = JSON.parse(post.body_json);
      const entries = await renderEntries(body);
      const artifacts = [];
      for (const entry of new Map(entries.map((e) => [e.key, e])).values()) {
        const row = await db
          .prepare("SELECT output FROM render_cache WHERE key=?")
          .bind(entry.key)
          .first<{ output: string | null }>();
        if (row?.output)
          artifacts.push({
            ...entry,
            ...(entry.kind === "mermaid" ? { svg: row.output } : mathArtifactFromHTML(row.output)),
          });
        else if (
          !(await db
            .prepare("SELECT id FROM media_variants WHERE render_key=? AND state='ready'")
            .bind(entry.key)
            .first())
        )
          throw new Error("Missing source artifact: " + entry.key);
      }
      if (apply) {
        const accepted = await acceptMedia(db, bucket, post.id, body, artifacts);
        await db.batch(
          await mediaReferenceStatements(
            db,
            post.id,
            body,
            post.updated_at,
            accepted.lease,
            post.status === "published",
          ),
        );
      }
      if (apply || audit) {
        const refs = (
          await db
            .prepare(
              "SELECT r.body_hash,r.variant_id,v.object_key FROM post_media_refs r LEFT JOIN media_variants v ON v.id=r.variant_id WHERE r.post_id=?",
            )
            .bind(post.id)
            .all<{ body_hash: string; variant_id: string | null; object_key: string | null }>()
        ).results;
        if (entries.length > refs.length) throw new Error("Missing references");
        const hash = await mediaHash(post.body_json);
        for (const ref of refs) {
          if (ref.body_hash !== hash) throw new Error("Stale references");
          if (ref.variant_id && (!ref.object_key || !(await bucket.head(ref.object_key))))
            throw new Error("Missing object");
        }
      }
      complete++;
    } catch (error) {
      failures.push(`${post.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const report = { target, apply, audit, posts: posts.length, originals, complete, failures };
  console.log(JSON.stringify(report, null, 2));
  await writeFile(`.cache/media-migration/${target}-report.json`, JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await platform.dispose();
}
