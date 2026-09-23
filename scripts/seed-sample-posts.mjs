import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const posts = [
  {
    id: "01M368BXF5DF1XZRFP5Y06FKE7",
    alias: "morning-notes",
    category: "日記",
    date: "2026-09-23",
    title: "朝のノート",
    subtitle: "窓辺で書き始めた短い記録。",
    file: "morning-notes.md",
    previousBody: `朝の光で机が明るくなった。

## 今日の覚え書き

新しい記事一覧の流れを試すためのサンプルです。`,
  },
  {
    id: "01M368BXFC6Q0BWDG5QX8MSKPC",
    alias: null,
    category: "制作",
    date: "2026-09-21",
    title: "小さな実験",
    subtitle: "作って、動かして、確かめる。",
    file: "small-experiment.md",
    previousBody: `記事はまず **ULID** で公開できます。

- 一覧から開く
- 編集する
- 必要ならエイリアスを付ける`,
  },
  {
    id: "01M368BXFE3WQNWT373F1MW4MT",
    alias: "reading-margin",
    category: "読書",
    date: "2026-09-19",
    title: "読書の余白",
    subtitle: "読み終えたあとに残るもの。",
    file: "reading-margin.md",
    previousBody: `本を閉じてから、気になった一文をノートに書き留めた。

> 余白は考える場所にもなる。`,
  },
  {
    id: "01M368BXFFVRZEZ81804K5R9HV",
    alias: null,
    category: "週末",
    date: "2026-09-17",
    title: "週末の記録",
    subtitle: "少し遠回りした日の話。",
    file: "weekend-walk.md",
    previousBody: `駅から一本裏の道を歩いた。

同じ町でも、道を変えるだけで新しい景色が見つかる。`,
  },
];

function sql(value) {
  return value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

const statements = posts.flatMap((post) => {
  const body = readFileSync(new URL(`../seeds/posts/${post.file}`, import.meta.url), "utf8");
  return [
    `INSERT OR IGNORE INTO posts (id, status, canonical_alias, category, published_at, title, subtitle, body_markdown)
VALUES (${sql(post.id)}, 'published', ${sql(post.alias)}, ${sql(post.category)}, ${sql(post.date)}, ${sql(post.title)}, ${sql(post.subtitle)}, ${sql(body)});`,
    `UPDATE posts SET body_markdown = ${sql(body)}
WHERE id = ${sql(post.id)} AND body_markdown = ${sql(post.previousBody)};`,
    ...(post.alias
      ? [
          `INSERT OR IGNORE INTO post_aliases (alias, post_id) VALUES (${sql(post.alias)}, ${sql(post.id)});`,
        ]
      : []),
  ];
});

const temporaryDirectory = mkdtempSync(join(tmpdir(), "blog-samples-"));
const sqlFile = join(temporaryDirectory, "sample-posts.sql");
try {
  writeFileSync(sqlFile, `-- Local preview content only.\n${statements.join("\n\n")}\n`);
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "blog-posts", "--local", `--file=${sqlFile}`],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
