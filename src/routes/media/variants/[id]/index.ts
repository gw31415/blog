import type { RequestHandler } from "@qwik.dev/router";
export const onGet: RequestHandler = async (event) => {
  const row = await event.platform.env.DB.prepare(
    "SELECT object_key,mime FROM media_variants WHERE id=? AND state='ready'",
  )
    .bind(event.params.id)
    .first<{ object_key: string; mime: string }>();
  if (!row) throw event.error(404, "画像が見つかりません");
  const object = await event.platform.env.IMAGES.get(row.object_key);
  if (!object) throw event.error(404, "画像が見つかりません");
  const headers = new Headers({
    "Content-Type": row.mime,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ETag: object.httpEtag,
  });
  if (row.mime === "image/svg+xml")
    headers.set(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
  event.send(
    new Response(
      event.request.headers.get("If-None-Match") === object.httpEtag ? null : object.body,
      {
        status: event.request.headers.get("If-None-Match") === object.httpEtag ? 304 : 200,
        headers,
      },
    ),
  );
};
