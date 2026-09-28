import {
  createQwikRouter,
  type PlatformCloudflarePages,
} from "@qwik.dev/router/middleware/cloudflare-pages";
import render from "./entry.ssr";

declare global {
  type QwikRouterPlatform = PlatformCloudflarePages & { env: Env };
}

export const fetch = createQwikRouter({ render });

export async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil((await import("./server/media")).collectMedia(env.DB, env.IMAGES));
}
