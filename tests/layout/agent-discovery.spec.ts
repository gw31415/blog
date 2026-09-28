import { expect, test } from "@playwright/test";
import { catalog } from "../../src/webmcp/catalog";

test("SSR discovery serves the current public tool contract without JavaScript", async ({
  request,
  baseURL,
}) => {
  const manifestResponse = await request.get("/.well-known/ai-catalog.json");
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()["content-type"]).toContain("application/json");
  expect(manifestResponse.headers().link).toContain('rel="ai-catalog"');
  const manifest = await manifestResponse.json();
  expect(manifest.specVersion).toBe("1.0");
  const descriptor = await request.get(manifest.entries[0].url);
  expect(descriptor.status()).toBe(200);
  const data = await descriptor.json();
  expect(data.page).toBe(new URL("/", baseURL).href);
  expect(data.tools).toEqual(
    catalog
      .filter((tool) => tool.scope === "public")
      .map(({ name, description, inputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        annotations,
      })),
  );
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  expect(await llms.text()).toContain(manifest.entries[0].url);
});
