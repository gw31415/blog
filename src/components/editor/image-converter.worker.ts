/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated workers have no targetOrigin. */
import { createAvifSequence } from "./avif-encoder";
import { DELIVERY_MAX_BYTES, IMAGE_MAX_EDGE } from "../../content/image-policy";

self.addEventListener("message", async (event: MessageEvent<ImageBitmap | ArrayBuffer>) => {
  if (event.data instanceof ArrayBuffer) {
    try {
      const { convertGif } = await import("./gif-animation");
      const result = await convertGif(event.data, (progress) => {
        self.postMessage({ progress });
      });
      self.postMessage(result, { transfer: [result.bytes] });
    } catch (error) {
      self.postMessage({
        error: error instanceof Error ? error.message : "GIFの変換に失敗しました",
      });
    }
    return;
  }
  const bitmap = event.data;
  try {
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("画像を変換できません");
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      const sequence = await createAvifSequence(
        width,
        height,
        Math.max(40, 60 - attempt * 5),
        0,
        true,
      );
      let bytes: ArrayBuffer;
      try {
        sequence.add(context.getImageData(0, 0, width, height).data, 1);
        bytes = sequence.finish();
      } finally {
        sequence.destroy();
      }
      if (bytes.byteLength <= DELIVERY_MAX_BYTES) {
        self.postMessage({ bytes, width, height }, { transfer: [bytes] });
        return;
      }
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
    throw new Error("配信用画像を1.5MB以内に変換できませんでした");
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "AVIF変換に失敗しました" });
  } finally {
    bitmap.close();
  }
});
