import { DEV_MANAGER_COOKIE, isDevServer } from "~/dev/manager";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { RequestEventBase, RequestEventCommon } from "@qwik.dev/router";

export interface AccessConfig {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
export interface AccessIdentity {
  subject: string;
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyAccess(
  request: Request,
  config: AccessConfig,
  getKey?: JWTVerifyGetKey,
): Promise<AccessIdentity | null> {
  // Access injects the header on protected paths only. Public paths receive
  // the same signed application token through the host-wide cookie.
  const cookies = (request.headers.get("Cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("CF_Authorization="));
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    (cookies.length === 1 ? cookies[0].slice("CF_Authorization=".length) : null);
  const domain = config.ACCESS_TEAM_DOMAIN?.trim();
  const audience = config.ACCESS_AUD?.trim();
  if (!token || !domain || !audience) return null;
  const issuer = domain.startsWith("https://") ? domain.replace(/\/$/, "") : `https://${domain}`;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) return null;
  try {
    let keys = getKey ?? keySets.get(issuer);
    if (!keys) {
      const remote = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5000,
      });
      keySets.set(issuer, remote);
      keys = remote;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub"],
    });
    // This application grants management to authenticated people, not service tokens.
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email ||
      payload.type !== "app"
    )
      return null;
    return { subject: payload.sub };
  } catch {
    return null;
  }
}
const identityKey = "access.identity";
export function accessIdentity(event: RequestEventBase): Promise<AccessIdentity | null> {
  let identity = event.sharedMap.get(identityKey) as Promise<AccessIdentity | null> | undefined;
  if (!identity) {
    identity = verifyAccess(event.request, {
      ACCESS_TEAM_DOMAIN: event.env.get("ACCESS_TEAM_DOMAIN"),
      ACCESS_AUD: event.env.get("ACCESS_AUD"),
    });
    event.sharedMap.set(identityKey, identity);
  }
  return identity;
}
export async function canManagePosts(event: RequestEventBase) {
  if (isDevServer()) {
    return event.cookie.get(DEV_MANAGER_COOKIE)?.value === "1";
  }
  return !!(await accessIdentity(event));
}
export async function requireManager(event: RequestEventCommon) {
  if (!(await canManagePosts(event)))
    throw event.error(403, "Cloudflare Accessへのログインが必要です");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(event.request.method) &&
    event.request.headers.get("Origin") !== event.url.origin
  )
    throw event.error(403, "送信元が不正です");
}
