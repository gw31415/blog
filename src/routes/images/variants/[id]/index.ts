import type { RequestHandler } from "@qwik.dev/router";
import { imageIdPattern } from "~/server/images";
export const onGet: RequestHandler = async (event) => {
  if (!imageIdPattern.test(event.params.id)) throw event.error(404, "画像が見つかりません");
  const object = await event.platform.env.IMAGES.get(`images/variants/${event.params.id}`);
  if (!object) throw event.error(404, "画像が見つかりません");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  // A variant id is never reused for other bytes, so the response can be cached for good.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  const fresh = event.request.headers.get("If-None-Match") === object.httpEtag;
  event.send(new Response(fresh ? null : object.body, { status: fresh ? 304 : 200, headers }));
};
