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
  let newOriginal = false;
  if (typeof originalId === "string" && originalId) {
    if (
      !(await db
        .prepare("SELECT 1 FROM image_variants WHERE original_id=? LIMIT 1")
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
    newOriginal = true;
  }
  const id = `${newUlid()}.avif`;
  try {
    await db
      .prepare("INSERT INTO image_variants VALUES(?,?,?,?)")
      .bind(id, originalId, width, height)
      .run();
  } catch (error) {
    if (newOriginal) await objects.delete(`images/originals/${originalId}`);
    throw error;
  }
  try {
    await objects.put(`images/variants/${id}`, delivery, {
      httpMetadata: { contentType: "image/avif" },
    });
    await db.prepare("INSERT INTO post_images VALUES(?,?)").bind(postId, id).run();
  } catch {
    await objects.delete(`images/variants/${id}`).catch(() => {});
    throw new Error("配信用画像を保存できませんでした。オリジナルは画像管理に保持しています");
  }
  return { url: `/images/variants/${id}`, originalId };
}

export async function postImageIds(db: D1Database, postId: string) {
  return (
    await db
      .prepare("SELECT variant_id FROM post_images WHERE post_id=?")
      .bind(postId)
      .all<{ variant_id: string }>()
  ).results.map((row) => row.variant_id);
}
/** Best effort: retained variant rows allow explicit retry without a deletion queue. */
export async function removeUnusedVariants(
  db: D1Database,
  objects: ImageObjectStore,
  ids: string[],
) {
  let removed = 0;
  for (const id of ids) {
    if (await db.prepare("SELECT 1 FROM post_images WHERE variant_id=? LIMIT 1").bind(id).first())
      continue;
    try {
      await objects.delete(`images/variants/${id}`);
      removed++;
    } catch (error) {
      console.error("Image cleanup failed", id, error);
    }
  }
  return removed;
}
export async function collectUnusedImages(db: D1Database, objects: ImageObjectStore) {
  // Explicit management operation, only after editing has finished.
  await db
    .prepare(`DELETE FROM post_images WHERE NOT EXISTS (
    SELECT 1 FROM posts p, json_tree(p.body_json) j WHERE p.id=post_images.post_id AND j.key='src'
    AND (j.value='/images/variants/'||post_images.variant_id OR ((substr(j.value,1,8)='https://' OR substr(j.value,1,7)='http://') AND substr(j.value,-(17+length(post_images.variant_id)))='/images/variants/'||post_images.variant_id))
  )`)
    .run();
  const { results } = await db
    .prepare(
      "SELECT id FROM image_variants WHERE NOT EXISTS(SELECT 1 FROM post_images WHERE variant_id=image_variants.id)",
    )
    .all<{ id: string }>();
  return removeUnusedVariants(
    db,
    objects,
    results.map((row) => row.id),
  );
}
export async function listOriginals(db: D1Database, unused: boolean, before = "") {
  const { results } = await db
    .prepare(`SELECT DISTINCT v.original_id AS id FROM image_variants v
    WHERE (?='' OR v.original_id<?) AND (?=0 OR NOT EXISTS(SELECT 1 FROM image_variants x JOIN post_images r ON r.variant_id=x.id WHERE x.original_id=v.original_id))
    ORDER BY v.original_id DESC LIMIT 51`)
    .bind(before, before, unused ? 1 : 0)
    .all<{ id: string }>();
  const rows = results.slice(0, 50);
  const articles = rows.length
    ? (
        await db
          .prepare(
            `SELECT DISTINCT v.original_id,p.id AS post_id,p.title AS post_title FROM image_variants v JOIN post_images r ON r.variant_id=v.id JOIN posts p ON p.id=r.post_id WHERE v.original_id IN (${rows.map(() => "?").join(",")})`,
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
