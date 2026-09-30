import { afterEach, expect, it, vi } from "vite-plus/test";
import type { SaveIntent } from "../../server/posts";
import { createDraftAutosaver, type DraftSnapshot, type SaveResult } from "./draft-autosave";
const initial: DraftSnapshot = {
  title: "first",
  subtitle: "",
  description: "",
  tags: [],
  publishedAt: "",
  alias: "",
  editingState: null,
  body: { type: "doc", content: [{ type: "paragraph" }] },
};
const result: SaveResult = { version: "1", status: "draft", hasDraft: true };
afterEach(() => vi.useRealTimers());
function setup(
  save = vi.fn(async (_draft: DraftSnapshot, _intent: SaveIntent, _keepalive: boolean) => result),
) {
  vi.useFakeTimers();
  let draft = { ...initial },
    blocked = false;
  const state = vi.fn(),
    saved = vi.fn();
  const saver = createDraftAutosaver({
    initial,
    read: () => draft,
    blocked: () => blocked,
    save,
    state,
    saved,
    delay: 100,
  });
  return {
    saver,
    save,
    state,
    saved,
    change: (title: string) => {
      draft = { ...draft, title };
      saver.schedule();
    },
    block: (value: boolean) => {
      blocked = value;
    },
  };
}
it("debounces edits and saves without leaving the editor", async () => {
  const t = setup();
  t.change("second");
  await vi.advanceTimersByTimeAsync(50);
  t.change("third");
  await vi.advanceTimersByTimeAsync(99);
  expect(t.save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(t.save).toHaveBeenCalledOnce();
  expect(t.save.mock.calls[0]?.[0]).toMatchObject({ title: "third" });
  expect(t.saver.dirty()).toBe(false);
  t.saver.dispose();
});
it("serializes slow saves and never acknowledges newer unsent input", async () => {
  let resolve!: (value: SaveResult) => void;
  const save = vi.fn(
    (_draft: DraftSnapshot, _intent: SaveIntent, _keepalive: boolean) =>
      new Promise<SaveResult>((r) => {
        resolve = r;
      }),
  );
  const t = setup(save);
  t.change("second");
  await vi.advanceTimersByTimeAsync(100);
  t.change("third");
  await vi.advanceTimersByTimeAsync(100);
  expect(save).toHaveBeenCalledOnce();
  resolve(result);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.saver.dirty()).toBe(true);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]?.[0]).toMatchObject({ title: "third" });
  resolve(result);
  await vi.advanceTimersByTimeAsync(0);
  expect(t.saver.dirty()).toBe(false);
  t.saver.dispose();
});
it("queues repeated flushes and an explicit publish behind in-flight autosave", async () => {
  let resolve!: (value: SaveResult) => void;
  const save = vi.fn(
    (_draft: DraftSnapshot, _intent: SaveIntent, _keepalive: boolean) =>
      new Promise<SaveResult>((r) => {
        resolve = r;
      }),
  );
  const t = setup(save);
  t.change("second");
  await vi.advanceTimersByTimeAsync(100);
  const publish = t.saver.flush("publish"),
    repeat = t.saver.flush();
  resolve(result);
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]?.[1]).toBe("publish");
  resolve(result);
  await Promise.all([publish, repeat]);
  expect(save).toHaveBeenCalledTimes(2);
  t.saver.dispose();
});
it("retains failed input for retry and stops automatic conflict retries", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(result);
  const t = setup(save);
  t.change("second");
  await vi.advanceTimersByTimeAsync(100);
  expect(t.saver.dirty()).toBe(true);
  expect(t.state).toHaveBeenLastCalledWith("error", "offline");
  await t.saver.flush();
  expect(t.saver.dirty()).toBe(false);
  save.mockRejectedValueOnce(new Error("CONFLICT: newer version"));
  t.change("third");
  await vi.advanceTimersByTimeAsync(100);
  t.change("fourth");
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(3);
  expect(t.saver.dirty()).toBe(true);
  t.saver.dispose();
});
it("waits for pending forms/uploads and supports best-effort keepalive", async () => {
  const t = setup();
  t.block(true);
  t.change("second");
  await vi.advanceTimersByTimeAsync(100);
  expect(t.save).not.toHaveBeenCalled();
  t.block(false);
  await vi.advanceTimersByTimeAsync(100);
  expect(t.save).toHaveBeenCalledOnce();
  t.change("third");
  await t.saver.flush("save", true);
  expect(t.save.mock.calls[1]?.[2]).toBe(true);
  t.saver.dispose();
});

it("does not close past a pending form even when the document itself is clean", async () => {
  const t = setup();
  t.block(true);
  await expect(t.saver.flush()).rejects.toThrow("フォーム");
  expect(t.save).not.toHaveBeenCalled();
  t.block(false);
  await t.saver.flush();
  expect(t.state).toHaveBeenLastCalledWith("saved");
  t.saver.dispose();
});

it("accepts the server-assigned first publication date without creating another draft", async () => {
  vi.useFakeTimers();
  let draft = { ...initial };
  const save = vi.fn(async () => ({
    ...result,
    status: "published" as const,
    hasDraft: false,
    publishedAt: "2026-09-30T06:00:00Z",
  }));
  const saver = createDraftAutosaver({
    initial,
    read: () => draft,
    blocked: () => false,
    save,
    state: () => {},
    saved: (r) => {
      draft = { ...draft, publishedAt: r.publishedAt!.slice(0, 10) };
    },
  });
  await saver.flush("publish");
  expect(saver.dirty()).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).toHaveBeenCalledOnce();
  saver.dispose();
});
