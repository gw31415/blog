import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("dist/q-manifest.json", "utf8"));
const html = readFileSync("dist/index.html", "utf8");
const bundles = Object.entries(manifest.bundles);
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

  const staticImporters = bundles.filter(([, bundle]) => (bundle.imports ?? []).includes(name));
  const dynamicImporters = bundles.filter(([, bundle]) =>
    (bundle.dynamicImports ?? []).includes(name),
  );
  if (staticImporters.length > 0 || dynamicImporters.length === 0) {
    throw new Error(
      `Editor runtime ${name} must be reachable only through a dynamic import (static=${staticImporters.length}, dynamic=${dynamicImporters.length}).`,
    );
  }

  console.log(
    `editor runtime: ${name} (${manifest.bundles[name].size} bytes), dynamically imported by ${dynamicImporters.map(([importer]) => importer).join(", ")}`,
  );
}
