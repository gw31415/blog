import type { RequestHandler } from "@qwik.dev/router";
import { canManagePosts } from "~/content/permissions";
import { imageIdPattern } from "~/server/images";
export const onGet: RequestHandler = async (event) => {
  if (!canManagePosts()) throw event.error(403, "取得できません");
  if (!imageIdPattern.test(event.params.id)) throw event.error(404, "元画像が見つかりません");
  const object = await event.platform.env.IMAGES.get(`images/originals/${event.params.id}`);
  if (!object) throw event.error(404, "元画像が見つかりません");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Disposition", `attachment; filename="${event.params.id}"`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  event.send(new Response(object.body, { headers }));
};
