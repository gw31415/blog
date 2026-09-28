import { writeFile } from "node:fs/promises";
// The Pages adapter only emits fetch; Workers also needs the scheduled handler.
await writeFile(
  "dist/_worker.js",
  'import { fetch, scheduled } from "../server/entry.cloudflare-pages"; export default { fetch, scheduled };\n',
);
