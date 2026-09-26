import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  require.resolve("wrangler/package.json"),
)("miniflare");
const issuer = "https://runtime-test.cloudflareaccess.com",
  audience = "runtime-test-aud";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "runtime", alg: "RS256" }] };
const jwt = await new SignJWT({ email: "editor@example.test", type: "app" })
  .setProtectedHeader({ alg: "RS256", kid: "runtime" })
  .setIssuer(issuer)
  .setAudience(audience)
  .setSubject("editor")
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(privateKey);
const auth = { Cookie: `CF_Authorization=${jwt}` };
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: ".cache/access-bundle/_worker.js",
    compatibilityDate: "2026-09-04",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: audience },
    d1Databases: ["DB"],
    r2Buckets: ["IMAGES"],
    serviceBindings: { ASSETS: () => new Response("not found", { status: 404 }) },
    outboundService: (request) => {
      assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`);
      return Response.json(jwks);
    },
  }),
);
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = (await readFile(`migrations/${file}`, "utf8"))
      .replace(/^--.*$/gm, "")
      .replace(/\n/g, " ");
    await db.exec(sql);
  }
  const published = "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    draft = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
  for (const [id, status, title] of [
    [published, "published", "PUBLIC ARTICLE"],
    [draft, "draft", "PRIVATE DRAFT"],
  ])
    await db
      .prepare(
        "INSERT INTO posts(id,status,title,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, status, title, "2026-01-01", "2026-01-01", "2026-01-01")
      .run();
  const get = (path, headers = {}) =>
    mf.dispatchFetch(`https://blog.example${path}`, { headers, redirect: "manual" });
  // Only the login path is protected by Access; ordinary requests have a cookie.
  assert.equal((await get("/auth/login")).status, 403);
  const login = await get("/auth/login?returnTo=https://evil.example", {
    "Cf-Access-Jwt-Assertion": jwt,
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/");
  assert.match(login.headers.get("cache-control"), /no-store/);
  assert.equal((await get("/auth/login", auth)).status, 303);
  const anon = await get("/");
  const anonHtml = await anon.text();
  assert.equal(anon.status, 200);
  assert(!anonHtml.includes("PRIVATE DRAFT"));
  assert(!anonHtml.includes("新規記事"));
  assert.match(anon.headers.get("cache-control"), /no-store/);
  const admin = await get("/", auth);
  const adminHtml = await admin.text();
  assert(adminHtml.includes("PRIVATE DRAFT"));
  assert(adminHtml.includes("新規記事"));
  assert(adminHtml.includes("を削除"));
  assert.equal((await get(`/blog/${draft}`)).status, 404);
  assert.equal((await get(`/blog/${draft}.md`)).status, 404);
  assert.equal((await get(`/blog/${draft}`, auth)).status, 200);
  assert.equal((await get(`/blog/${draft}.md`, auth)).status, 200);
  const article = await get(`/blog/${published}?edit=1`);
  const articleHtml = await article.text();
  assert.equal(article.status, 200);
  assert(!articleHtml.includes("article-header-edit"));
  assert.equal((await get("/manage/images")).status, 403);
  assert.equal((await get("/manage/images", auth)).status, 200);
  assert.equal((await get("/api/images/originals/01ARZ3NDEKTSV4RRFFQ69G5FAV.jpg")).status, 403);
  for (const headers of [
    {},
    { "Cf-Access-Authenticated-User-Email": "editor@example.test" },
    { "Cf-Access-Jwt-Assertion": "forged" },
    { Cookie: "CF_Authorization=forged" },
  ])
    assert.equal(
      (
        await mf.dispatchFetch("https://blog.example/api/images", {
          method: "POST",
          headers: { ...headers, Origin: "https://blog.example" },
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await mf.dispatchFetch("https://blog.example/api/images", {
        method: "POST",
        headers: { ...auth, Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await mf.dispatchFetch("https://blog.example/api/images", {
        method: "POST",
        headers: { ...auth, Origin: "https://blog.example" },
      })
    ).status,
    400,
  );
  // Extract real Qwik action URLs from authorized SSR and call them anonymously.
  const actions = [...adminHtml.matchAll(/action="([^"<>]*qaction[^"<>]*)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&"),
  );
  assert(actions.length > 0, "SSR must contain mutation forms");
  for (const action of new Set(actions)) {
    const url = new URL(action, "https://blog.example/");
    const result = await mf.dispatchFetch(url, {
      method: "POST",
      headers: {
        Origin: "https://blog.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `id=${published}&confirm=yes`,
    });
    assert.equal(result.status, 403);
  }
  assert.equal((await db.prepare("SELECT count(*) AS n FROM posts").first()).n, 2);
  const create = await mf.dispatchFetch(new URL(actions[0], "https://blog.example/"), {
    method: "POST",
    redirect: "manual",
    headers: {
      ...auth,
      Origin: "https://blog.example",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });
  assert.equal(create.status, 303);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM posts").first()).n, 3);
  console.log(
    "Access runtime checks passed: SSR, private reads, forged tokens, CSRF, image API and Qwik mutations",
  );
} finally {
  await mf.dispose();
}
