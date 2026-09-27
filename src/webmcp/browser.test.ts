import { expect, it } from "vite-plus/test";
import { registerTools, type ModelContext, type RegisteredTool } from "./browser";
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
