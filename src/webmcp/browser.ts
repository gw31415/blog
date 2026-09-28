import { isRecord } from "../content/record";
import { catalog, failure, ToolError, validateInput, type Input } from "./catalog";
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: object;
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
}
export interface ModelContext {
  registerTool(tool: RegisteredTool, options?: { signal: AbortSignal }): void | Promise<void>;
  unregisterTool?(name: string): void;
}
export function modelContext(): ModelContext | undefined {
  return document.modelContext ?? navigator.modelContext;
}
export async function remote(name: string, input: Input, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const response = await fetch("/api/webmcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, input }),
    signal,
  });
  if (response.status === 403 || response.redirected)
    throw new ToolError("FORBIDDEN", "管理者ログインが必要です");
  const result: unknown = await response.json();
  if (!isRecord(result) || typeof result.ok !== "boolean")
    throw new ToolError("FAILED", "応答の形式が不正です");
  if (!result.ok) {
    const error = isRecord(result.error) ? result.error : {};
    throw new ToolError(
      typeof error.code === "string" ? error.code : "FAILED",
      typeof error.message === "string" ? error.message : "処理できませんでした",
    );
  }
  if (!response.ok || !isRecord(result.data)) throw new ToolError("FAILED", "応答の形式が不正です");
  return result.data;
}

export function responseText(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new ToolError("FAILED", `${key}の応答が不正です`);
  return value;
}

export function registerTools(
  definitions: (typeof catalog)[number][],
  execute: (name: string, input: Input, signal?: AbortSignal) => Promise<unknown>,
  context = modelContext(),
) {
  if (!context) return () => {};
  const lifecycle = new AbortController();
  const registered = new Set<string>();
  let busy = false;
  for (const definition of definitions) {
    const tool: RegisteredTool = {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: definition.annotations,
      async execute(raw, options) {
        try {
          lifecycle.signal.throwIfAborted();
          options?.signal?.throwIfAborted();
          if (busy) throw new ToolError("BUSY", "前の操作が完了するまでお待ちください");
          const input = validateInput(definition.name, raw);
          busy = true;
          try {
            return {
              ok: true,
              data: await execute(
                definition.name,
                input,
                options?.signal
                  ? AbortSignal.any([lifecycle.signal, options.signal])
                  : lifecycle.signal,
              ),
            };
          } finally {
            busy = false;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return failure(
              new ToolError(
                "CANCELLED",
                "操作を中止しました。送信済みの保存は再取得して状態を確認してください",
              ),
            );
          return failure(error);
        }
      },
    };
    try {
      registered.add(tool.name);
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        (error) => {
          registered.delete(tool.name);
          if (!lifecycle.signal.aborted)
            console.warn("WebMCP registration failed", tool.name, error);
        },
      );
    } catch (error) {
      registered.delete(tool.name);
      console.warn("WebMCP registration failed", tool.name, error);
    }
  }
  return () => {
    lifecycle.abort();
    // Earlier implementations use navigator.modelContext.unregisterTool.
    for (const name of registered) context.unregisterTool?.(name);
  };
}
export interface EditorBridge {
  dirty(): boolean;
  editing(): boolean;
}
let editor: EditorBridge | undefined;
export function setEditorBridge(value: EditorBridge) {
  editor = value;
  return () => {
    if (editor === value) editor = undefined;
  };
}
export function confirmAction(message: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!window.confirm(message)) throw new ToolError("CANCELLED", "操作をキャンセルしました");
  signal?.throwIfAborted();
}
function canLeave() {
  if (editor?.dirty())
    throw new ToolError("UNSAVED_CHANGES", "未保存の変更があります。保存してから移動してください");
}
export function registerSiteTools(manager: boolean, navigate: (url: string) => Promise<unknown>) {
  return registerTools(
    catalog.filter((entry) => entry.scope !== "editor" && (manager || entry.scope === "public")),
    async (name, input, signal) => {
      if (name === "open_post") {
        canLeave();
        const post = await remote("get_post", { identifier: input.identifier }, signal);
        if (input.section !== undefined) await remote("get_post_outline", input, signal);
        signal?.throwIfAborted();
        canLeave();
        const url =
          responseText(post, "url") +
          (input.section === undefined ? "" : `#webmcp-section-${Number(input.section)}`);
        await navigate(url);
        return { url };
      }
      if (name === "create_draft") {
        canLeave();
        const result = await remote(name, input, signal);
        canLeave();
        await navigate(responseText(result, "url"));
        return result;
      }
      if (name === "delete_post") {
        canLeave();
        const post = await remote("get_post", { identifier: input.identifier }, signal);
        if (responseText(post, "version") !== input.expectedVersion)
          throw new ToolError("CONFLICT", "記事が変更されています。再取得してください");
        confirmAction(
          `「${responseText(post, "title")}」を削除します。元画像は保持します。よろしいですか？`,
          signal,
        );
        const result = await remote(name, input, signal);
        await navigate("/");
        return result;
      }
      if (name === "cleanup_unused_images") {
        if (editor?.editing() || editor?.dirty())
          throw new ToolError("BUSY", "記事の編集を終えてから画像を整理してください");
        confirmAction(
          "未使用の配信用画像と未保存の紐付けを整理します。元画像は保持します。よろしいですか？",
          signal,
        );
        const result = await remote(name, input, signal);
        await navigate("/manage/images");
        return result;
      }
      return remote(name, input, signal);
    },
  );
}
