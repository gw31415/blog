import {
  createQwikRouter,
  type PlatformCloudflarePages,
} from "@qwik.dev/router/middleware/cloudflare-pages";
import render from "./entry.ssr";
import { discoveryPaths } from "./webmcp/discovery";

declare global {
  type QwikRouterPlatform = PlatformCloudflarePages & { env: Env };
}

const router = createQwikRouter({ render });
export const fetch: typeof router = (request, ...args) => {
  const url = new URL(request.url);
  // Qwik deliberately skips /.well-known before running route handlers.
  if (url.pathname === discoveryPaths.catalog) {
    url.pathname = "/ai-catalog.json";
    request = new Request(url, request);
  }
  return router(request, ...args);
};

export async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil((await import("./server/media")).collectMedia(env.DB, env.IMAGES));
}
