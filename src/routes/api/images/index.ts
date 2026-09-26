import type { RequestHandler } from "@qwik.dev/router";
import { canManagePosts } from "~/content/permissions";
import { database } from "~/server/posts";
import { storeImage } from "~/server/images";
export const onPost: RequestHandler = async (event) => {
  if (!canManagePosts()) {
    event.json(403, { error: "アップロードできません" });
    return;
  }
  if (event.request.headers.get("Origin") !== event.url.origin) {
    event.json(403, { error: "送信元が不正です" });
    return;
  }
  try {
    event.json(
      201,
      await storeImage(database(event), await event.request.formData(), event.platform.env.IMAGES),
    );
  } catch (error) {
    event.json(400, {
      error: error instanceof Error ? error.message : "アップロードできませんでした",
    });
  }
};
