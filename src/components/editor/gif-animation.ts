import { parseGIF, decompressFrame } from "gifuct-js";
import { DELIVERY_MAX_BYTES, IMAGE_MAX_EDGE } from "../../content/image-policy";

import { createAvifSequence } from "./avif-encoder";

export async function convertGif(bytes: ArrayBuffer, progress: (message: string) => void) {
  const gif = parseGIF(bytes);
  const frames = gif.frames.filter((frame) => "image" in frame);
  const { width: sourceWidth, height: sourceHeight } = gif.lsd;
  if (
    !frames.length ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    frames.length > 300 ||
    sourceWidth * sourceHeight > 16_000_000 ||
    sourceWidth * sourceHeight * frames.length > 120_000_000
  )
    throw new Error("GIFは1600万画素・300フレーム・合計1.2億画素以内にしてください");
  let repetitions = 0;
  for (const frame of gif.frames) {
    if ("application" in frame && ["NETSCAPE2.0", "ANIMEXTS1.0"].includes(frame.application.id)) {
      const data = frame.application.blocks;
      if (data[0] === 1 && data.length >= 3) {
        const loops = data[1] | (data[2] << 8);
        repetitions = loops === 0 ? -1 : loops;
      }
    }
  }
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const scene = canvas.getContext("2d", { willReadFrequently: true })!;
  const patchCanvas = new OffscreenCanvas(1, 1);
  const patchContext = patchCanvas.getContext("2d")!;
  const background = gif.gct?.[gif.lsd.backgroundColorIndex] ?? [0, 0, 0];
  for (let attempt = 0; attempt < 5; attempt++) {
    const sequence = await createAvifSequence(
      width,
      height,
      Math.max(40, 60 - attempt * 5),
      repetitions,
    );
    const resized = new OffscreenCanvas(width, height);
    const output = resized.getContext("2d", { willReadFrequently: true })!;
    output.imageSmoothingQuality = "high";
    const clear = (left: number, top: number, w: number, h: number, transparent: boolean) => {
      scene.clearRect(left, top, w, h);
      if (!transparent) {
        scene.fillStyle = `rgb(${background.join(",")})`;
        scene.fillRect(left, top, w, h);
      }
    };
    clear(0, 0, sourceWidth, sourceHeight, frames[0].gce?.extras.transparentColorGiven ?? false);
    try {
      for (const [index, frame] of frames.entries()) {
        progress(`アニメーションを変換中… ${index + 1}/${frames.length}`);
        const { left, top, width: w, height: h } = frame.image.descriptor;
        if (!w || !h || left + w > sourceWidth || top + h > sourceHeight)
          throw new Error("GIFのフレーム範囲が不正です");
        const parsed = decompressFrame(frame, gif.gct, true);
        const previous =
          parsed.disposalType === 3 ? scene.getImageData(0, 0, sourceWidth, sourceHeight) : null;
        patchCanvas.width = w;
        patchCanvas.height = h;
        patchContext.putImageData(new ImageData(new Uint8ClampedArray(parsed.patch), w, h), 0, 0);
        scene.drawImage(patchCanvas, left, top);
        output.clearRect(0, 0, width, height);
        output.drawImage(canvas, 0, 0, width, height);

        const duration = !parsed.delay || parsed.delay <= 10 ? 100 : parsed.delay;
        sequence.add(output.getImageData(0, 0, width, height).data, duration);
        if (parsed.disposalType === 2)
          clear(left, top, w, h, parsed.transparentIndex !== undefined);
        if (previous) scene.putImageData(previous, 0, 0);
      }
      const encoded = sequence.finish();
      if (encoded.byteLength <= DELIVERY_MAX_BYTES) return { bytes: encoded, width, height };
    } finally {
      sequence.destroy();
    }
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
  }
  throw new Error("AVIFアニメーションを1.5MB以内に変換できませんでした");
}
