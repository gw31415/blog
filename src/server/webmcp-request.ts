import { newUlid } from "./posts";
import { ToolError } from "../webmcp/catalog";

export const REQUEST_SAFETY_TTL_MS = 10 * 60 * 1000;

/** Keep only an in-flight guard. Expiry recovers from a failed finally or worker shutdown. */
export async function withDraftRequest<T>(
  db: D1Database,
  requestId: string,
  work: (postId: string) => Promise<T>,
): Promise<T> {
  if (!requestId.trim()) throw new ToolError("INVALID_INPUT", "requestIdは空にできません");
  const owner = newUlid();
  await db.prepare("DELETE FROM webmcp_requests WHERE expires_at<=?").bind(Date.now()).run();
  try {
    // post_id doubles as the ownership token; a stale finally cannot delete a newer guard.
    const acquired = await db
      .prepare(
        "INSERT INTO webmcp_requests(request_id,post_id,expires_at) VALUES (?,?,?) ON CONFLICT(request_id) DO NOTHING RETURNING post_id",
      )
      .bind(requestId, owner, Date.now() + REQUEST_SAFETY_TTL_MS)
      .first();
    if (!acquired)
      throw new ToolError("BUSY", "同じリクエストを処理中です。作成結果を確認してください");
    return await work(owner);
  } finally {
    try {
      await db
        .prepare("DELETE FROM webmcp_requests WHERE request_id=? AND post_id=?")
        .bind(requestId, owner)
        .run();
    } catch (error) {
      // Do not turn a successful creation into a failure that encourages another creation.
      console.warn("WebMCP request cleanup failed; expiry will recover the guard", error);
    }
  }
}
