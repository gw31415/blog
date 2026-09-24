import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await mkdir("public/mermaid", { recursive: true });
await copyFile(require.resolve("mermaid/dist/mermaid.min.js"), "public/mermaid/mermaid.min.js");
