import type { RequestHandler } from "@qwik.dev/router";
import { executeServerTool } from "~/server/webmcp";
import { failure, ToolError } from "~/webmcp/catalog";

export const onPost: RequestHandler = async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  if (event.request.headers.get("Origin") !== event.url.origin)
    throw event.error(403, "送信元が不正です");
  try {
    const text = await event.request.text();
    if (text.length > 560_000) throw new ToolError("INVALID_INPUT", "入力が長すぎます");
    const { name, input } = JSON.parse(text);
    event.json(200, { ok: true, data: await executeServerTool(event, String(name), input) });
  } catch (error) {
    // Framework authorization failures must retain their HTTP status.
    if (error && typeof error === "object" && "status" in error) throw error;
    event.json(400, failure(error));
  }
};
