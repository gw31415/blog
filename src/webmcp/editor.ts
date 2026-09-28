import type { JSONContent } from "@tiptap/core";
import type { EditorController } from "../components/editor/editor-controller";
import { normalizeDocument } from "../content/document";
import { formatShortDate, normalizeSingleLine } from "../content/article";
import { catalog, ToolError, inputText, type Input } from "./catalog";
import { confirmAction, registerTools, remote, responseText, setEditorBridge } from "./browser";
export interface EditorState {
  mode: "view" | "loading" | "edit";
  saving: boolean;
  error: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  publishedAt: string;
  alias: string;
  status: "draft" | "published";
  body: JSONContent;
}
export interface EditorBinding {
  id: string;
  ui: EditorState;
  controller(): EditorController | undefined;
  enter(): Promise<void>;
  save(): Promise<void>;
  version(): string;
}
async function token(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function registerEditorTools(binding: EditorBinding) {
  const { ui } = binding;
  // Browser-owned header fields may have an input handler still queued by Qwik.
  const read = () => {
    const metadata = Object.fromEntries(
      (["title", "subtitle", "description"] as const).map((key) => [
        key,
        document.querySelector(`[data-article-field="${key}"]`)?.textContent ?? ui[key],
      ]),
    );
    const tagsElement = document.querySelector('[data-article-field="tags"]');
    const tags = tagsElement
      ? Array.from(tagsElement.childNodes).flatMap((node) =>
          node.nodeType === Node.TEXT_NODE
            ? (node.textContent ?? "").split(/[,，、\s]+/u).filter(Boolean)
            : node instanceof Element && node.classList.contains("meta-tag")
              ? [node.textContent ?? ""]
              : [],
        )
      : ui.tags;
    return {
      title: metadata.title,
      subtitle: metadata.subtitle,
      description: metadata.description,
      tags: [...new Set(tags)],
      publishedAt: ui.publishedAt,
      alias: ui.alias,
      status: ui.status,
      body: binding.controller()?.getJSON() ?? ui.body,
    };
  };
  let saved = JSON.stringify(read());
  let savedStatus = ui.status;
  const dirty = () => {
    const working = binding.controller()?.getWorkingState();
    return !!working?.pending || !!working?.uploading || JSON.stringify(read()) !== saved;
  };
  const disconnect = setEditorBridge({ dirty, editing: () => ui.mode !== "view" });
  const ensureIdle = () => {
    const working = binding.controller()?.getWorkingState();
    if (ui.mode === "loading" || ui.saving || working?.pending || working?.uploading)
      throw new ToolError("BUSY", "未確定入力や画像アップロードを完了してから実行してください");
  };
  const snapshot = () => ({
    ...read(),
    selection: binding.controller()?.getWorkingState()?.selection ?? null,
  });
  const checkState = async (input: Input) => {
    const before = JSON.stringify(snapshot());
    const currentToken = await token(before);
    if (input.expectedState !== currentToken || JSON.stringify(snapshot()) !== before)
      throw new ToolError(
        "CONFLICT",
        "編集内容または選択範囲が変わりました。get_editor_stateで再取得してください",
      );
  };
  const validate = async (data: ReturnType<typeof read>, publication: boolean) => {
    normalizeDocument(data.body);
    if (JSON.stringify(data.body).length > 500000)
      throw new ToolError("INVALID_INPUT", "本文が長すぎます");
    if (data.title.length > 200 || (publication && !data.title.trim()))
      throw new ToolError("INVALID_INPUT", "公開時は200文字以内のタイトルが必要です");
    if (data.publishedAt) formatShortDate(data.publishedAt);
    if (
      data.alias &&
      (data.alias.length > 80 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.alias) ||
        /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(data.alias))
    )
      throw new ToolError("INVALID_INPUT", "URL別名には英小文字・数字・ハイフンを使用してください");
    if (publication) {
      const [{ validatePublication }, { validateMermaidDocument }] = await Promise.all([
        import("../content/validate-publication"),
        import("../components/editor/mermaid-renderer"),
      ]);
      await validatePublication(data.body);
      await validateMermaidDocument(data.body);
    }
  };
  const applyMetadata = (data: ReturnType<typeof read>) => {
    Object.assign(ui, data);
    for (const key of ["title", "subtitle", "description"] as const) {
      const element = document.querySelector<HTMLElement>(`[data-article-field="${key}"]`);
      if (element && element.textContent !== data[key]) element.textContent = data[key];
      if (key === "subtitle") element?.toggleAttribute("data-empty", !data[key].trim());
    }
    const tags = document.querySelector('[data-article-field="tags"]');
    if (tags)
      tags.replaceChildren(
        ...data.tags.map((tag) => {
          const chip = document.createElement("span");
          chip.className = "meta-tag";
          chip.contentEditable = "false";
          chip.textContent = tag;
          return chip;
        }),
      );
  };
  const unregister = registerTools(
    catalog.filter((tool) => tool.scope === "editor"),
    async (name, input, signal) => {
      if (name === "get_editor_state") {
        const current = snapshot();
        return {
          ...current,
          id: binding.id,
          version: binding.version(),
          stateToken: await token(JSON.stringify(current)),
          dirty: dirty(),
          mode: ui.mode,
          workingState: binding.controller()?.getWorkingState() ?? null,
        };
      }
      ensureIdle();
      if (name === "validate_post") {
        await validate(read(), true);
        return { valid: true, saved: false };
      }
      await checkState(input);
      signal?.throwIfAborted();
      if (name === "update_draft") {
        const data = read();
        for (const key of ["title", "subtitle", "description"] as const)
          if (input[key] !== undefined) data[key] = normalizeSingleLine(inputText(input, key));
        if (input.tags)
          data.tags = [
            ...new Set(
              (Array.isArray(input.tags)
                ? input.tags.filter((tag): tag is string => typeof tag === "string")
                : []
              )
                .map((tag) => normalizeSingleLine(tag).trim())
                .filter(Boolean),
            ),
          ];
        if (input.alias !== undefined) data.alias = inputText(input, "alias").trim();
        if (input.publishedAt !== undefined) data.publishedAt = inputText(input, "publishedAt");
        if (
          input.body &&
          (input.blocks || input.startBlock !== undefined || input.deleteCount !== undefined)
        )
          throw new ToolError("INVALID_INPUT", "本文全体と部分置換を同時に指定できません");
        if (input.body) data.body = normalizeDocument(input.body);
        if (
          input.blocks !== undefined ||
          input.startBlock !== undefined ||
          input.deleteCount !== undefined
        ) {
          if (!input.blocks || input.startBlock === undefined || input.deleteCount === undefined)
            throw new ToolError(
              "INVALID_INPUT",
              "部分置換にはstartBlock/deleteCount/blocksが必要です",
            );
          const content: unknown[] = [...(data.body.content ?? [])],
            start = Number(input.startBlock),
            count = Number(input.deleteCount);
          if (start > content.length || start + count > content.length)
            throw new ToolError("INVALID_INPUT", "ブロック範囲が不正です");
          if (!Array.isArray(input.blocks))
            throw new ToolError("INVALID_INPUT", "blocksは配列です");
          content.splice(start, count, ...input.blocks);
          data.body = normalizeDocument({ type: "doc", content });
        }
        await validate(data, false);
        await checkState(input);
        const beforeEnter = JSON.stringify(read());
        await binding.enter();
        if (JSON.stringify(read()) !== beforeEnter)
          throw new ToolError("CONFLICT", "編集開始中に内容が変わりました。再取得してください");
        ensureIdle();
        if (ui.mode !== "edit")
          throw new ToolError("FAILED", ui.error || "編集を開始できませんでした");
        signal?.throwIfAborted();
        if (input.body || input.blocks) {
          if (!binding.controller()?.replaceDocument(data.body))
            throw new ToolError("FAILED", "本文を適用できませんでした");
        }
        applyMetadata(data);
        return { saved: false, stateToken: await token(JSON.stringify(snapshot())) };
      }
      if (name === "attach_image") {
        // Resolve existence server-side instead of accepting an arbitrary resource URL.
        const image = await remote("attach_image", input, signal);
        await checkState(input);
        const beforeEnter = JSON.stringify(read());
        await binding.enter();
        if (JSON.stringify(read()) !== beforeEnter)
          throw new ToolError("CONFLICT", "編集開始中に内容が変わりました。再取得してください");
        ensureIdle();
        signal?.throwIfAborted();
        if (
          ui.mode !== "edit" ||
          !binding.controller()?.run({
            type: "image",
            src: responseText(image, "url"),
            alt: inputText(input, "alt"),
            caption: inputText(input, "caption"),
          })
        )
          throw new ToolError("FAILED", "画像を挿入できませんでした");
        return { saved: false, stateToken: await token(JSON.stringify(snapshot())) };
      }
      const nextStatus =
        name === "publish_post" ? "published" : name === "unpublish_post" ? "draft" : savedStatus;
      const data = { ...read(), status: nextStatus };
      await validate(data, nextStatus === "published");
      await checkState(input);
      if (name !== "save_post" || nextStatus === "published")
        confirmAction(
          `「${data.title || "無題"}」の現在の編集内容を${nextStatus === "published" ? "公開状態で" : "非公開にして"}保存します。よろしいですか？`,
          signal,
        );
      signal?.throwIfAborted();
      applyMetadata(data);
      await binding.save();
      if (ui.error)
        throw new ToolError(ui.error.startsWith("CONFLICT:") ? "CONFLICT" : "FAILED", ui.error);
      saved = JSON.stringify(read());
      savedStatus = ui.status;
      return {
        saved: true,
        status: ui.status,
        version: binding.version(),
        url: window.location.pathname,
      };
    },
  );
  // Normal UI saves also establish a new clean baseline.
  const onSaved = () => {
    saved = JSON.stringify(read());
    savedStatus = ui.status;
  };
  document.addEventListener("blog:article-saved", onSaved);
  return () => {
    unregister();
    disconnect();
    document.removeEventListener("blog:article-saved", onSaved);
  };
}
