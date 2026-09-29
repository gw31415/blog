import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { localStatePath } from "../../scripts/local-platform";

// Qwik emits the client and SSR chunks first. Package those outputs for cf
// without running the Qwik optimizer a second time.
export default defineConfig({
  publicDir: "dist",
  plugins: [
    cloudflare({
      remoteBindings: false,
      persistState: { path: localStatePath },
      experimental: { newConfig: { cfBuildOutput: true } },
    }),
  ],
});
