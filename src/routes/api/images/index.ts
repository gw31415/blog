import type { RequestHandler } from "@qwik.dev/router";
import { canManagePosts } from "~/content/permissions";
import { database, newUlid } from "~/server/posts";
export const onPost: RequestHandler = async (event) => {
  if (!canManagePosts()) {
    event.json(403, { error: "アップロードできません" });
    return;
  }
  const data = await event.request.formData();
  const file = data.get("image");
  if (!(file instanceof File) || file.size > 1_500_000) {
    event.json(400, { error: "1.5MB以内の画像を選択してください" });
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = String.fromCharCode(...bytes.slice(0, 12));
  const mime =
    bytes[0] === 137 && signature.slice(1, 4) === "PNG"
      ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216
        ? "image/jpeg"
        : signature.startsWith("GIF8")
          ? "image/gif"
          : signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP"
            ? "image/webp"
            : null;
  if (!mime) {
    event.json(400, { error: "PNG・JPEG・GIF・WebPを選択してください" });
    return;
  }
  const id = newUlid();
  await database(event)
    .prepare("INSERT INTO images(id,content_type,bytes,created_at) VALUES(?,?,?,?)")
    .bind(id, mime, bytes, new Date().toISOString())
    .run();
  event.json(201, { url: `/images/${id}` });
};
