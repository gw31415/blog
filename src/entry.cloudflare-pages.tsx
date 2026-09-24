import {
  createQwikRouter,
  type PlatformCloudflarePages,
} from "@qwik.dev/router/middleware/cloudflare-pages";
import render from "./entry.ssr";

declare global {
  type QwikRouterPlatform = PlatformCloudflarePages & { env: Env };
}

export const fetch = createQwikRouter({ render });
