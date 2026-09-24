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
  "DROP TRIGGER IF EXISTS delete_unreferenced_render_cache; DROP TABLE IF EXISTS post_render_refs; DROP TABLE IF EXISTS render_cache; DROP TABLE IF EXISTS post_aliases; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS images; DROP TABLE IF EXISTS d1_migrations;",
]);
run(["run", "db:migrate:local"]);
run(["run", "db:seed:local"]);
