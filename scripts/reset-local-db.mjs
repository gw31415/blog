import { spawnSync } from "node:child_process";
const run = (args) => {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (!process.argv.includes("--discard-test-data"))
  throw new Error("テストデータ破棄には --discard-test-data を指定してください");
run([
  "exec",
  "wrangler",
  "d1",
  "execute",
  "blog-posts",
  "--local",
  "--command",
  "DROP TRIGGER IF EXISTS delete_unreferenced_render_cache; DROP TABLE IF EXISTS post_render_refs; DROP TABLE IF EXISTS render_cache; DROP TRIGGER IF EXISTS queue_image_object_deletion; DROP TABLE IF EXISTS image_deletions; DROP TRIGGER IF EXISTS post_images_saved; DROP TRIGGER IF EXISTS post_images_created; DROP TABLE IF EXISTS post_images; DROP TABLE IF EXISTS image_variants; DROP TABLE IF EXISTS image_post_history; DROP TABLE IF EXISTS image_original_chunks; DROP TABLE IF EXISTS post_aliases; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS images; DROP TABLE IF EXISTS image_originals; DROP TABLE IF EXISTS d1_migrations;",
]);
run(["run", "db:migrate:local"]);
run(["run", "db:seed:local"]);
