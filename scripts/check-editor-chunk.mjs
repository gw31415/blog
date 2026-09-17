import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("dist/q-manifest.json", "utf8"));
const html = readFileSync("dist/index.html", "utf8");
const bundles = Object.entries(manifest.bundles);
const initialBundles = bundles.filter(([name]) => html.includes(name)).map(([name]) => name);

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
