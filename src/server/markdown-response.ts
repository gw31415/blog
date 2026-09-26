import { canManagePosts } from "./access";
import type { RequestHandler } from "@qwik.dev/router";
import { database, findPost } from "~/server/posts";
import { exportArticle } from "~/content/export-article";

export const sendMarkdown: RequestHandler = async (event) => {
  const type = event.url.searchParams.get("type") ?? "canonical";
  if (type !== "canonical" && type !== "github" && type !== "zenn" && type !== "qiita")
    throw event.error(400, "未対応のMarkdown形式です");
  const post = await findPost(database(event), event.params.id.slice(0, -3));
  if (!post || (post.status !== "published" && !(await canManagePosts(event))))
    throw event.error(404, "記事が見つかりません");
  const result = exportArticle(post, type, event.url.origin);
  event.headers.set("Content-Type", "text/markdown; charset=utf-8");
  event.send(200, result.markdown);
};
