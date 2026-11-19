import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("dist/q-manifest.json", "utf8"));
const previewUrl = process.env.BLOG_PREVIEW_URL;
if (!existsSync("dist/index.html") && !previewUrl) {
  throw new Error("Set BLOG_PREVIEW_URL to a running SSR preview to check the initial HTML.");
}
const fetchPage = async (path) => {
  const response = await fetch(new URL(path, previewUrl));
  if (!response.ok) throw new Error(`Preview ${path} returned ${response.status}`);
  return response.text();
};
const html = existsSync("dist/index.html")
  ? readFileSync("dist/index.html", "utf8")
  : await fetchPage("/");
// Optional: a published article on the preview, e.g. BLOG_PREVIEW_ARTICLE=/blog/document-showcase
const articlePath = previewUrl ? process.env.BLOG_PREVIEW_ARTICLE : undefined;
const articleHtml = articlePath ? await fetchPage(articlePath) : "";
const bundles = Object.entries(manifest.bundles);
const initialBundles = bundles
  .filter(([name]) => html.includes(name) || articleHtml.includes(name))
  .map(([name]) => name);

const staticallyReachable = new Set(initialBundles);
const queue = [...initialBundles];
while (queue.length > 0) {
  const name = queue.pop();
  for (const imported of manifest.bundles[name]?.imports ?? []) {
    if (staticallyReachable.has(imported)) continue;
    staticallyReachable.add(imported);
    queue.push(imported);
  }
}
const editorBundles = bundles.filter(([, bundle]) =>
  (bundle.origins ?? []).some((origin) =>
    origin.includes("src/components/editor/editor-runtime.ts"),
  ),
);

if (editorBundles.length === 0) {
  throw new Error("TipTap editor runtime bundle was not found in the production manifest.");
}

for (const [name] of editorBundles) {
  if (html.includes(name)) {
    throw new Error(`Editor runtime ${name} is referenced by the initial HTML.`);
  }

  const dynamicImporters = bundles.filter(([, bundle]) =>
    (bundle.dynamicImports ?? []).includes(name),
  );
  if (staticallyReachable.has(name) || dynamicImporters.length === 0) {
    throw new Error(
      `Editor runtime ${name} must be absent from the initial static graph and reachable through a dynamic import.`,
    );
  }

  console.log(
    `editor runtime: ${name} (${manifest.bundles[name].size} bytes), dynamically imported by ${dynamicImporters.map(([importer]) => importer).join(", ")}`,
  );
}

// Readers must not statically load authoring libraries, on the home page or an article.
const authoring = /node_modules\/(?:\.pnpm\/)?(?:@tiptap|mermaid|@mathjax|lowlight|@xmldom)[+@/]/;
for (const name of staticallyReachable) {
  const origin = (manifest.bundles[name]?.origins ?? []).find((value) => authoring.test(value));
  if (origin) throw new Error(`Reader bundle ${name} statically includes ${origin}.`);
}
console.log(`reader static graph: ${staticallyReachable.size} bundles, no authoring libraries`);

if (articleHtml) {
  // The rendered article must reach readers once: as markup, not again as resumable state.
  const state = /<script type="qwik\/state"[^>]*>([\s\S]*?)<\/script>/.exec(articleHtml)?.[1] ?? "";
  if (state.includes("tiptap ProseMirror") || /"type",\d+,"doc"/.test(state))
    throw new Error(`${articlePath} serializes the article body into Qwik state.`);
  console.log(`article state: ${state.length} bytes of ${articleHtml.length} bytes HTML`);
}
