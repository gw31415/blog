import { collectMedia } from "./media";
import { newUlid } from "./posts";
import {
  DELIVERY_MAX_BYTES,
  IMAGE_MAX_EDGE,
  ORIGINAL_MAX_BYTES,
  imageType,
} from "../content/image-policy";

export interface ImageObjectStore {
  put(
    key: string,
    value: Blob,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}
export const imageIdPattern = /^[0-9A-HJKMNP-TV-Z]{26}\.[a-z0-9]+$/;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function storeImage(db: D1Database, data: FormData, objects: ImageObjectStore) {
  const postId = data.get("postId");
  if (
    typeof postId !== "string" ||
    !(await db.prepare("SELECT id FROM posts WHERE id=?").bind(postId).first())
  )
    throw new Error("アップロード先の記事が見つかりません");
  const delivery = data.get("image");
  if (
    !(delivery instanceof File) ||
    !delivery.size ||
    delivery.size > DELIVERY_MAX_BYTES ||
    imageType(new Uint8Array(await delivery.arrayBuffer())) !== "image/avif"
  )
    throw new Error("配信用画像は1.5MB以内のAVIFにしてください");
  const width = Number(data.get("width")),
    height = Number(data.get("height"));
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= IMAGE_MAX_EDGE))
    throw new Error("配信用画像の寸法が不正です");
  let originalId = data.get("originalId");
  if (typeof originalId === "string" && originalId) {
    if (
      !(await db
        .prepare("SELECT 1 FROM image_originals WHERE id=? LIMIT 1")
        .bind(originalId)
        .first())
    )
      throw new Error("オリジナル画像が見つかりません");
  } else {
    const original = data.get("original");
    if (!(original instanceof File) || !original.size || original.size > ORIGINAL_MAX_BYTES)
      throw new Error("オリジナル画像は25MB以内にしてください");
    const mime = imageType(new Uint8Array(await original.slice(0, 4096).arrayBuffer()));
    if (!mime || !extensions[mime]) throw new Error("対応する画像を選択してください");
    originalId = `${newUlid()}.${extensions[mime]}`;
    await objects.put(`images/originals/${originalId}`, original, {
      httpMetadata: { contentType: mime },
    });
    await db
      .prepare(
        "INSERT INTO image_originals(id,object_key,mime,byte_length,created_at) VALUES(?,?,?,?,unixepoch())",
      )
      .bind(originalId, `images/originals/${originalId}`, mime, original.size)
      .run();
  }
  const id = `${newUlid()}.avif`;
  await db
    .prepare(
      "INSERT INTO media_variants(id,kind,original_id,recipe,object_key,content_hash,mime,width,height,state,created_at,unreferenced_at,upload_expires_at) VALUES(?,'raster',?,'avif:v1',?,'client','image/avif',?,?,'uploading',unixepoch(),unixepoch(),unixepoch()+3600)",
    )
    .bind(id, originalId, `images/variants/${id}`, width, height)
    .run();
  try {
    await objects.put(`images/variants/${id}`, delivery, {
      httpMetadata: { contentType: "image/avif" },
    });
    await db.batch([
      db
        .prepare("UPDATE media_variants SET state='ready' WHERE id=? AND state='uploading'")
        .bind(id),
      db
        .prepare("INSERT INTO media_upload_leases VALUES(?,?,?,unixepoch()+3600)")
        .bind(crypto.randomUUID(), id, postId),
    ]);
  } catch {
    await objects.delete(`images/variants/${id}`).catch(() => {});
    throw new Error("配信用画像を保存できませんでした。オリジナルは保持しています");
  }
  return { url: `/images/variants/${id}`, originalId };
}
export async function postImageIds(db: D1Database, postId: string) {
  return (
    await db
      .prepare(
        "SELECT DISTINCT variant_id FROM post_media_refs WHERE post_id=? AND variant_id IS NOT NULL",
      )
      .bind(postId)
      .all<{ variant_id: string }>()
  ).results.map((r) => r.variant_id);
}
export async function removeUnusedVariants(
  db: D1Database,
  objects: ImageObjectStore,
  _ids: string[],
) {
  return collectMedia(db, objects);
}
export async function collectUnusedImages(db: D1Database, objects: ImageObjectStore) {
  return collectMedia(db, objects);
}

export async function listOriginals(db: D1Database, unused: boolean, before = "") {
  const { results } = await db
    .prepare(`SELECT v.id FROM image_originals v
    WHERE (?='' OR v.id<?) AND (?=0 OR NOT EXISTS(SELECT 1 FROM media_variants x JOIN post_media_refs r ON r.variant_id=x.id WHERE x.original_id=v.id))
    ORDER BY v.id DESC LIMIT 51`)
    .bind(before, before, unused ? 1 : 0)
    .all<{ id: string }>();
  const rows = results.slice(0, 50);
  const articles = rows.length
    ? (
        await db
          .prepare(
            `SELECT DISTINCT v.original_id,p.id AS post_id,p.title AS post_title FROM media_variants v JOIN post_media_refs r ON r.variant_id=v.id JOIN posts p ON p.id=r.post_id WHERE v.original_id IN (${rows.map(() => "?").join(",")})`,
          )
          .bind(...rows.map((row) => row.id))
          .all<{ original_id: string; post_id: string; post_title: string }>()
      ).results
    : [];
  return {
    items: rows.map((row) => ({
      ...row,
      articles: articles.filter((a) => a.original_id === row.id),
    })),
    next: results.length > 50 ? rows.at(-1)!.id : null,
  };
}
