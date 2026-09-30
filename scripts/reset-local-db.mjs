import { spawnSync } from "node:child_process";
const run = (args) => {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: { ...process.env, ...(persist[1] ? { BLOG_LOCAL_STATE: persist[1] } : {}) },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (!process.argv.includes("--discard-test-data"))
  throw new Error("テストデータ破棄には --discard-test-data を指定してください");
const persistIndex = process.argv.indexOf("--persist-to");
const persist = persistIndex < 0 ? [] : ["--persist-to", process.argv[persistIndex + 1]];
if (persistIndex >= 0 && (!persist[1] || persist[1].startsWith("--")))
  throw new Error("--persist-to requires a path");
run([
  "exec",
  "cf",
  "d1",
  "raw",
  "74e71308-26ca-42d5-b319-6100b7823b4f",
  "--local",
  "--persist-to",
  persist[1] ?? process.env.BLOG_LOCAL_STATE ?? ".cache/webmcp-test",
  "--sql",
  "DROP VIEW IF EXISTS all_post_media_refs; DROP VIEW IF EXISTS editable_posts; DROP TABLE IF EXISTS post_draft_media_refs; DROP TABLE IF EXISTS post_drafts; DROP TABLE IF EXISTS post_media_refs; DROP TABLE IF EXISTS media_upload_leases; DROP TABLE IF EXISTS image_article_history; DROP TABLE IF EXISTS media_variants; DROP TABLE IF EXISTS webmcp_requests; DROP TRIGGER IF EXISTS delete_unreferenced_render_cache; DROP TABLE IF EXISTS post_render_refs; DROP TABLE IF EXISTS render_cache; DROP TRIGGER IF EXISTS queue_image_object_deletion; DROP TABLE IF EXISTS image_deletions; DROP TRIGGER IF EXISTS post_images_saved; DROP TRIGGER IF EXISTS post_images_created; DROP TABLE IF EXISTS post_images; DROP TABLE IF EXISTS image_variants; DROP TABLE IF EXISTS image_post_history; DROP TABLE IF EXISTS image_original_chunks; DROP TABLE IF EXISTS post_aliases; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS images; DROP TABLE IF EXISTS image_originals; DROP TABLE IF EXISTS d1_migrations;",
]);
run(["run", "db:migrate:local"]);
run(["run", "db:seed:local"]);
