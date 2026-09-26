/* eslint-disable no-underscore-dangle -- Emscripten's exported C ABI uses leading underscores. */
interface AvifModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _sequence_create(
    width: number,
    height: number,
    quality: number,
    repetitions: number,
    still: number,
  ): number;
  _sequence_add(sequence: number, pixels: number, duration: number): number;
  _sequence_finish(sequence: number): number;
  _sequence_data(sequence: number): number;
  _sequence_size(sequence: number): number;
  _sequence_destroy(sequence: number): void;
}
let modulePromise: Promise<AvifModule> | undefined;
async function loadEncoder(): Promise<AvifModule> {
  modulePromise ??= (async () => {
    const moduleUrl = "/codecs/avif-encoder.js";
    const { default: createEncoder } = await import(/* @vite-ignore */ moduleUrl);
    return createEncoder({ locateFile: (path: string) => `/codecs/${path}` });
  })();
  return modulePromise;
}

/** One pixel-only encoder for still images and timed sequences. No source metadata enters WASM. */
export async function createAvifSequence(
  width: number,
  height: number,
  quality: number,
  repetitions = 0,
  still = false,
) {
  const encoder = await loadEncoder();
  const sequence = encoder._sequence_create(width, height, quality, repetitions, Number(still));
  const pixels = encoder._malloc(width * height * 4);
  if (!sequence || !pixels) {
    if (sequence) encoder._sequence_destroy(sequence);
    if (pixels) encoder._free(pixels);
    throw new Error("AVIF変換用のメモリーが不足しています");
  }
  return {
    add(data: Uint8ClampedArray, duration: number) {
      if (data.length !== width * height * 4) throw new Error("画像の画素数が不正です");
      encoder.HEAPU8.set(data, pixels);
      if (encoder._sequence_add(sequence, pixels, duration) !== 0)
        throw new Error("画像のフレームをAVIFへ変換できませんでした");
    },
    finish() {
      if (encoder._sequence_finish(sequence) !== 0) throw new Error("AVIFを生成できませんでした");
      const start = encoder._sequence_data(sequence),
        size = encoder._sequence_size(sequence);
      return encoder.HEAPU8.slice(start, start + size).buffer;
    },
    destroy() {
      encoder._free(pixels);
      encoder._sequence_destroy(sequence);
    },
  };
}
