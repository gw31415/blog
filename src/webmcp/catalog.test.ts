import { describe, expect, it } from "vite-plus/test";
import { catalog, validateInput } from "./catalog";

describe("WebMCP input boundary", () => {
  it("rejects extra fields, missing state tokens, excessive input and wrong types", () => {
    expect(() => validateInput("search_posts", { includeDrafts: true })).toThrow();
    expect(() => validateInput("update_draft", { title: "lost update" })).toThrow();
    expect(() => validateInput("get_post_outline", { identifier: "x", section: -1 })).toThrow();
    expect(() => validateInput("search_posts", { query: "a".repeat(201) })).toThrow();
    expect(() => validateInput("list_images", { unused: "true" })).toThrow();
    expect(() => validateInput("export_post", { identifier: "x", target: "html" })).toThrow();
    expect(() => validateInput("update_draft", { expectedState: "x", tags: [1] })).toThrow();
  });
  it("accepts structured editor and search inputs without coercing them", () => {
    const input = {
      expectedState: "token",
      startBlock: 0,
      deleteCount: 1,
      blocks: [{ type: "paragraph" }],
    };
    expect(validateInput("update_draft", input)).toEqual(input);
    expect(new Set(catalog.map((tool) => tool.name)).size).toBe(catalog.length);
  });
});
