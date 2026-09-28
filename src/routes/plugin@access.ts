import type { RequestHandler } from "@qwik.dev/router";
import { discoveryPaths } from "~/webmcp/discovery";
// SSR and Qwik loader/action responses depend on request identity. Never share them
// across visitors or retain privileged pages in the browser's HTTP cache.
export const onRequest: RequestHandler = async (event) => {
  event.headers.append(
    "Link",
    `<${discoveryPaths.catalog}>; rel="ai-catalog"; type="application/json"`,
  );
  // Issued by Chrome for this deployment's origin; never fabricate a token.
  const webMcpToken = event.env.get("WEBMCP_ORIGIN_TRIAL_TOKEN");
  if (webMcpToken) event.headers.set("Origin-Trial", webMcpToken);
  if (!event.url.pathname.startsWith("/images/variants/")) {
    event.headers.set("Cache-Control", "private, no-store");
    event.headers.set("Vary", "Cookie, Cf-Access-Jwt-Assertion");
  }
};
