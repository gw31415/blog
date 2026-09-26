import { ORIGINAL_MAX_BYTES, imageType, isAnimated } from "../../content/image-policy";

export async function convertImage(
  file: File,
  progress?: (message: string) => void,
): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
  if (!file.size || file.size > ORIGINAL_MAX_BYTES)
    throw new Error("25MB以内の画像を選択してください");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new Error("PNG・JPEG・GIF・WebP・AVIFを選択してください");
  const animated = isAnimated(bytes, type);
  if (animated && type !== "image/gif")
    throw new Error("GIF以外のアニメーション変換には未対応です");
  let input: ImageBitmap | ArrayBuffer;
  if (animated) input = bytes.buffer;
  else {
    input = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
      throw new Error("画像を読み込めません。対応形式の正常な画像を選択してください");
    });
    if (input.width * input.height > 80_000_000) {
      input.close();
      throw new Error("画像は8000万画素以内にしてください");
    }
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./image-converter.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      if (!(input instanceof ArrayBuffer)) input.close();
      reject(new Error("このブラウザーでは画像変換を開始できません"));
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(
      () => {
        finish();
        reject(new Error("画像変換がタイムアウトしました"));
      },
      animated ? 300_000 : 120_000,
    );
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("AVIF変換に失敗しました。もう一度お試しください"));
    });
    worker.addEventListener(
      "message",
      (
        event: MessageEvent<{
          bytes: ArrayBuffer;
          width: number;
          height: number;
          error?: string;
          progress?: string;
        }>,
      ) => {
        if (event.data.progress) {
          progress?.(event.data.progress);
          return;
        }
        finish();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      },
    );
    worker.postMessage(input, [input]);
  });
}

export async function uploadImage(
  file: File,
  postId: string,
  status: (message: string) => void,
  originalId?: string,
) {
  status("画像を変換中…");
  const converted = await convertImage(file, status);
  const payload = new FormData();
  payload.set("postId", postId);
  if (originalId) payload.set("originalId", originalId);
  else payload.set("original", file);
  payload.set("image", new Blob([converted.bytes], { type: "image/avif" }), "image.avif");
  payload.set("width", String(converted.width));
  payload.set("height", String(converted.height));
  status("画像をアップロード中…");
  const response = await fetch("/api/images", { method: "POST", body: payload });
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    typeof result !== "object" ||
    !("url" in result) ||
    typeof result.url !== "string"
  )
    throw new Error(
      result && typeof result === "object" && "error" in result
        ? String(result.error)
        : "アップロードに失敗しました",
    );
  return result.url;
}
