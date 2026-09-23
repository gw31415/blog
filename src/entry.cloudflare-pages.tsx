import {
  createQwikRouter,
  type PlatformCloudflarePages,
} from "@qwik.dev/router/middleware/cloudflare-pages";
import render from "./entry.ssr";

declare global {
  type QwikRouterPlatform = PlatformCloudflarePages & { env: { DB: D1Database } };
}

export const fetch = createQwikRouter({ render });
