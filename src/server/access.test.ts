import { describe, expect, it, beforeAll, beforeEach, vi } from "vite-plus/test";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { verifyAccess, requireManager, canManagePosts } from "./access";
import { isDevServer } from "~/dev/manager";
vi.mock("~/dev/manager", () => ({
  DEV_MANAGER_COOKIE: "blog_dev_manager",
  isDevServer: vi.fn(() => false),
}));
beforeEach(() => vi.mocked(isDevServer).mockReturnValue(false));

const issuer = "https://test.cloudflareaccess.com",
  audience = "blog-aud";
let privateKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" }],
  });
});
async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: issuer,
    aud: [audience],
    sub: "person",
    email: "user@example.test",
    type: "app",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .sign(privateKey);
}
const config = { ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: audience };
const request = (jwt: string) =>
  new Request("https://blog.example/", { headers: { "Cf-Access-Jwt-Assertion": jwt } });
describe("Access identity", () => {
  it("accepts a signed user token for this application", async () =>
    expect(await verifyAccess(request(await token()), config, keys)).toEqual({
      subject: "person",
    }));
  it.each([
    { aud: "other" },
    { iss: "https://other.cloudflareaccess.com" },
    { exp: 1 },
    { nbf: 9999999999 },
    { type: "service" },
    { email: null },
    { sub: "" },
  ])("rejects invalid claims %j", async (claims) =>
    expect(await verifyAccess(request(await token(claims)), config, keys)).toBeNull(),
  );
  it("rejects missing configuration, missing token, forged email and altered signature", async () => {
    expect(await verifyAccess(request(await token()), {}, keys)).toBeNull();
    expect(
      await verifyAccess(
        new Request("https://blog.example", {
          headers: { "Cf-Access-Authenticated-User-Email": "owner@example.test" },
        }),
        config,
        keys,
      ),
    ).toBeNull();
    const jwt = await token();
    const parts = jwt.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect(await verifyAccess(request(parts.join(".")), config, keys)).toBeNull();
  });
  it("verifies the application cookie on public routes", async () => {
    const jwt = await token();
    const cookieRequest = (cookie: string, assertion?: string) =>
      new Request("https://blog.example/", {
        headers: {
          Cookie: cookie,
          ...(assertion === undefined ? {} : { "Cf-Access-Jwt-Assertion": assertion }),
        },
      });
    expect(
      await verifyAccess(cookieRequest(`other=1; CF_Authorization=${jwt}; last=2`), config, keys),
    ).toEqual({ subject: "person" });
    expect(await verifyAccess(cookieRequest(`CF_Authorization=${jwt}`), {}, keys)).toBeNull();
    for (const cookie of [
      "CF_Authorization=forged",
      `CF_Authorization=${await token({ exp: 1 })}`,
      `CF_Authorization=${await token({ aud: "other" })}`,
      `CF_Authorization=${await token({ type: "service" })}`,
      `CF_Authorization=${jwt}; CF_Authorization=${jwt}`,
      `Other_CF_Authorization=${jwt}`,
    ])
      expect(await verifyAccess(cookieRequest(cookie), config, keys)).toBeNull();
    expect(
      await verifyAccess(cookieRequest(`CF_Authorization=${jwt}`, "forged"), config, keys),
    ).toBeNull();
  });
  it("rejects cross-origin mutations even after authentication", async () => {
    const event = {
      request: new Request("https://blog.example/", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
      url: new URL("https://blog.example/"),
      sharedMap: new Map([["access.identity", Promise.resolve({ subject: "person" })]]),
      error: (_status: number, message: string) => new Error(message),
    };
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    await expect(
      requireManager(event as unknown as Parameters<typeof requireManager>[0]),
    ).rejects.toThrow("送信元");
  });
});

it("does not grant production management from the development cookie", async () => {
  const event = {
    request: new Request("https://blog.example/", { headers: { Cookie: "blog_dev_manager=1" } }),
    sharedMap: new Map(),
    env: { get: () => undefined },
    cookie: { get: () => ({ value: "1" }) },
  };
  expect(await canManagePosts(event as unknown as Parameters<typeof canManagePosts>[0])).toBe(
    false,
  );
});

it("uses the development cookie for both granting and removing management", async () => {
  vi.mocked(isDevServer).mockReturnValue(true);
  for (const value of [undefined, "0", "1"]) {
    const event = { cookie: { get: () => (value === undefined ? undefined : { value }) } };
    expect(await canManagePosts(event as unknown as Parameters<typeof canManagePosts>[0])).toBe(
      value === "1",
    );
  }
});
