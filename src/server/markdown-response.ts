import type { RequestHandler } from "@qwik.dev/router";
import { database, findPost } from "~/server/posts";
import { exportArticle, type ExportTarget } from "~/content/export-article";

export const sendMarkdown: RequestHandler = async (event) => {
  const type = event.url.searchParams.get("type") ?? "canonical";
  if (!["canonical", "github", "zenn", "qiita"].includes(type))
    throw event.error(400, "未対応のMarkdown形式です");
  const post = await findPost(database(event), event.params.id.slice(0, -3));
  if (!post) throw event.error(404, "記事が見つかりません");
  const result = exportArticle(post, type as ExportTarget, event.url.origin);
  event.headers.set("Content-Type", "text/markdown; charset=utf-8");
  event.send(200, result.markdown);
};
