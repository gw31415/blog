import type { RequestHandler } from "@qwik.dev/router";
import { presentsCredentials } from "~/server/access";
import { discoveryPaths } from "~/webmcp/discovery";
// SSR and Qwik loader/action responses depend on request identity. Never share them
// across visitors or retain privileged pages in the browser's HTTP cache.
// Anonymous pages hold nothing privileged: they may stay in the visitor's own cache
// after revalidation, which also keeps them eligible for the back/forward cache.
const immutableMedia = /^\/(?:images|media)\/variants\//;
const privileged = /^\/(?:api|auth|manage)(?:\/|$)/;
export const onRequest: RequestHandler = async (event) => {
  event.headers.append(
    "Link",
    `<${discoveryPaths.catalog}>; rel="ai-catalog"; type="application/json"`,
  );
  // Issued by Chrome for this deployment's origin; never fabricate a token.
  const webMcpToken = event.env.get("WEBMCP_ORIGIN_TRIAL_TOKEN");
  if (webMcpToken) event.headers.set("Origin-Trial", webMcpToken);
  if (!immutableMedia.test(event.url.pathname)) {
    event.headers.set(
      "Cache-Control",
      privileged.test(event.url.pathname) || presentsCredentials(event)
        ? "private, no-store"
        : "private, no-cache",
    );
    event.headers.set("Vary", "Cookie, Cf-Access-Jwt-Assertion");
  }
};
