import { writeFileSync } from "node:fs";
import { sampleDocument } from "../src/content/sample-document.ts";
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const now = "2026-09-24T00:00:00.000Z";
const id = "01K5D0C0MENT".padEnd(25, "0") + "1";
const values = [
  id,
  "document-showcase",
  "published",
  "文書のすべてを確かめる長い観察ノート",
  "文字・構造・数式・図を保存する",
  "文書仕様の全コンポーネントを収録した、編集と保存のための長文サンプル。",
  JSON.stringify(["文書仕様", "Tiptap", "検証"]),
  now,
  now,
  now,
  JSON.stringify(sampleDocument),
];
const { renderEntries } = await import("../src/content/render-contract.ts");
const entries = await renderEntries(sampleDocument);
const refs = [...new Map(entries.map((entry) => [entry.key, entry])).values()]
  .map(
    (entry) =>
      `INSERT INTO render_cache(key,kind,source,renderer) VALUES (${[entry.key, entry.kind, entry.source, entry.renderer].map(quote).join(",")}) ON CONFLICT(key) DO NOTHING;\nINSERT INTO post_render_refs(post_id,cache_key) VALUES (${quote(id)},${quote(entry.key)});`,
  )
  .join("\n");
writeFileSync(
  "scripts/seed-document.sql",
  `INSERT INTO posts(id,canonical_alias,status,title,subtitle,description,tags,created_at,updated_at,published_at,body_json) VALUES (${values.map(quote).join(",")});\n${refs}\n`,
);
console.log(`Generated sample: ${JSON.stringify(sampleDocument).length} JSON characters`);
