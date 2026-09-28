import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  registerTools,
  remote,
  responseText,
  type ModelContext,
  type RegisteredTool,
} from "./browser";
import { catalog } from "./catalog";
it("unregisters both signal-based and legacy tools and rejects stale callbacks", async () => {
  for (const legacy of [true, false]) {
    const tools = new Map<string, RegisteredTool>();
    const context: ModelContext = {
      registerTool(tool, options) {
        tools.set(tool.name, tool);
        if (!legacy) options?.signal.addEventListener("abort", () => tools.delete(tool.name));
      },
      ...(legacy
        ? {
            unregisterTool(name: string) {
              tools.delete(name);
            },
          }
        : {}),
    };
    let calls = 0;
    const dispose = registerTools(
      catalog.filter((tool) => tool.name === "search_posts"),
      async () => ++calls,
      context,
    );
    const tool = tools.get("search_posts")!;
    expect(await tool.execute({})).toEqual({ ok: true, data: 1 });
    dispose();
    expect(tools.size).toBe(0);
    expect(await tool.execute({})).toMatchObject({ ok: false, error: { code: "CANCELLED" } });
    expect(calls).toBe(1);
  }
});
it("rejects concurrent operations and propagates lifecycle cancellation", async () => {
  let tool: RegisteredTool | undefined,
    release: (() => void) | undefined,
    signal: AbortSignal | undefined;
  const context: ModelContext = {
    registerTool(value) {
      tool = value;
    },
  };
  const dispose = registerTools(
    catalog.slice(0, 1),
    async (_name, _input, activeSignal) => {
      signal = activeSignal;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "done";
    },
    context,
  );
  const pending = tool!.execute({});
  expect(await tool!.execute({})).toMatchObject({ ok: false, error: { code: "BUSY" } });
  dispose();
  expect(signal?.aborted).toBe(true);
  release?.();
  await pending;
});

afterEach(() => vi.unstubAllGlobals());
it.each([null, [], { ok: "true", data: {} }, { ok: true, data: [] }, { ok: true }])(
  "rejects malformed remote responses %j",
  async (value) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(value)),
    );
    await expect(remote("get_post", { identifier: "post" })).rejects.toThrow("応答");
  },
);
it("validates remote data and preserves server error codes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: { url: "/blog/post" } })),
  );
  const data = await remote("get_post", { identifier: "post" });
  expect(responseText(data, "url")).toBe("/blog/post");
  expect(() => responseText(data, "version")).toThrow("version");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { ok: false, error: { code: "CONFLICT", message: "changed" } },
        { status: 409 },
      ),
    ),
  );
  await expect(remote("save_post", {})).rejects.toMatchObject({
    code: "CONFLICT",
    message: "changed",
  });
});
