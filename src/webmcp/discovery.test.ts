import { describe, expect, it } from "vite-plus/test";
import { catalog } from "./catalog";
import { aiCatalog, llmsText, publicTools, webMcpDiscovery } from "./discovery";

describe("public AI discovery", () => {
  it("tracks the registered public contract without exposing privileged tools", () => {
    const tools = publicTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      catalog.filter((tool) => tool.scope === "public").map((tool) => tool.name),
    );
    for (const tool of tools) {
      expect(tool.inputSchema).toBe(catalog.find((entry) => entry.name === tool.name)?.inputSchema);
    }
    const names = webMcpDiscovery("https://example.org").tools.map((tool) => tool.name);
    const text = llmsText("https://example.org");
    for (const tool of catalog.filter((entry) => entry.scope !== "public")) {
      expect(names).not.toContain(tool.name);
      expect(text).not.toContain(`- [${tool.name}]`);
    }
  });

  it("generates links for the serving origin and capabilities from the same definitions", () => {
    const manifest = aiCatalog("https://example.org");
    expect(manifest.entries[0].url).toBe("https://example.org/webmcp.json");
    expect(manifest.entries[0].capabilities).toEqual(publicTools().map((tool) => tool.name));
    expect(webMcpDiscovery("https://example.org").page).toBe("https://example.org/");
    expect(llmsText("https://example.org")).toContain(
      "https://example.org/.well-known/ai-catalog.json",
    );
  });
});
