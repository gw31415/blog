import type { RequestHandler } from "@qwik.dev/router";
import { imageIdPattern } from "~/server/images";
export const onGet: RequestHandler = async (event) => {
  if (!imageIdPattern.test(event.params.id)) throw event.error(404, "画像が見つかりません");
  const object = await event.platform.env.IMAGES.get(`images/variants/${event.params.id}`);
  if (!object) throw event.error(404, "画像が見つかりません");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  event.send(new Response(object.body, { headers }));
};
