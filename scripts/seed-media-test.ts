/// <reference path="../worker-configuration.d.ts" />
import { getPlatformProxy } from "wrangler";
import { acceptMedia, mediaReferenceStatements } from "../src/server/media";
import { renderEntries } from "../src/content/render-contract";
import { validateLatex } from "../src/components/editor/mathjax-renderer";
import { mathArtifactFromHTML } from "../src/content/media-artifact";
const p = await getPlatformProxy<Env>({
  remoteBindings: false,
  persist: { path: ".cache/webmcp-test/v3" },
});
try {
  const id = "01K" + "0".repeat(21) + "99";
  const diagram = {
    type: "codeBlock",
    attrs: { language: "mermaid" },
    content: [{ type: "text", text: "flowchart LR\nA-->B" }],
  };
  const math = { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "x^2" } }] };
  const body = {
    type: "doc",
    content: [
      diagram,
      math,
      ...Array.from({ length: 45 }, () => ({
        type: "paragraph",
        content: [{ type: "text", text: "読み込み位置を確認するための本文です。".repeat(30) }],
      })),
      diagram,
      math,
    ],
  };
  const now = new Date().toISOString();
  await p.env.DB.prepare(
    "INSERT INTO posts(id,canonical_alias,title,status,created_at,updated_at,published_at,body_json) VALUES(?,'media-delivery-test','メディア配信検証','published',?,?,?,?) ON CONFLICT(id) DO UPDATE SET body_json=excluded.body_json,updated_at=excluded.updated_at",
  )
    .bind(id, now, now, now, JSON.stringify(body))
    .run();
  const entries = await renderEntries(body);
  const raw = validateLatex("x^2", false);
  if (!raw.ok) throw new Error(raw.message);
  const artifacts = [
    {
      ...entries[0],
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="#e7e5de"/><text x="20" y="50">A → B</text></svg>',
    },
    { ...entries[1], ...mathArtifactFromHTML(raw.html) },
  ];
  const accepted = await acceptMedia(p.env.DB, p.env.IMAGES, id, body, artifacts);
  await p.env.DB.batch(
    await mediaReferenceStatements(p.env.DB, id, body, now, accepted.lease, true),
  );
  console.log("Local media-delivery-test ready");
} finally {
  await p.dispose();
}
