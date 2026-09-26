import type { RequestHandler } from "@qwik.dev/router";
import { requireManager } from "~/server/access";
import { database } from "~/server/posts";
import { storeImage } from "~/server/images";
export const onPost: RequestHandler = async (event) => {
  await requireManager(event);
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
