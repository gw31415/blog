import type { RequestHandler } from "@qwik.dev/router";
import { database } from "~/server/posts";
export const onGet: RequestHandler = async (event) => {
  const image = await database(event)
    .prepare("SELECT content_type,bytes FROM images WHERE id=?")
    .bind(event.params.id)
    .first<{ content_type: string; bytes: number[] }>();
  if (!image) throw event.error(404, "画像が見つかりません");
  event.headers.set("Content-Type", image.content_type);
  event.headers.set("X-Content-Type-Options", "nosniff");
  event.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  event.send(200, new Uint8Array(image.bytes));
};
