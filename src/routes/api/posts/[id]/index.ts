import type { RequestHandler } from "@qwik.dev/router";
import { requireManager } from "~/server/access";
import { database, savePostContent } from "~/server/posts";
import { isRecord } from "~/content/record";

export const onPost: RequestHandler = async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  await requireManager(event);
  try {
    const text = await event.request.text();
    if (text.length > 6_000_000) throw new Error("入力が長すぎます");
    const values: unknown = JSON.parse(text);
    if (!isRecord(values)) throw new Error("入力が不正です");
    const result = await savePostContent(
      database(event),
      event.params.id,
      values,
      event.platform.env.IMAGES,
    );
    event.json(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存できませんでした。";
    event.json(message.startsWith("CONFLICT:") ? 409 : 400, { message });
  }
};
