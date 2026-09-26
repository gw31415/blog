export const ORIGINAL_MAX_BYTES = 25_000_000;
export const DELIVERY_MAX_BYTES = 1_500_000;
export const IMAGE_MAX_EDGE = 2560;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif";

export function imageType(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 24 && text(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(text(0, 6))) return "image/gif";
  if (bytes.length >= 16 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 24 && text(4, 8) === "ftyp") {
    const end = Math.min(
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0),
      bytes.length,
    );
    for (let i = 8; i + 4 <= end; i += 4)
      if (["avif", "avis"].includes(text(i, i + 4))) return "image/avif";
  }
  return null;
}

// Inspect container structure, not file extensions. Animated input must not silently lose frames.
export function isAnimated(bytes: Uint8Array, type: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (i: number) => String.fromCharCode(...bytes.slice(i, i + 4));
  if (type === "image/png") {
    for (let p = 8; p + 12 <= bytes.length;) {
      if (text(p + 4) === "acTL") return true;
      p += 12 + view.getUint32(p);
    }
  }
  if (type === "image/webp") {
    for (let p = 12; p + 8 <= bytes.length;) {
      if (text(p) === "ANIM" || text(p) === "ANMF") return true;
      const size = view.getUint32(p + 4, true);
      p += 8 + size + (size % 2);
    }
  }
  if (type === "image/avif") {
    const end = Math.min(view.getUint32(0), bytes.length);
    for (let p = 8; p + 4 <= end; p += 4) if (text(p) === "avis") return true;
  }
  if (type === "image/gif") {
    let p = 13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
    let frames = 0;
    const skipBlocks = () => {
      while (p < bytes.length) {
        const n = bytes[p++];
        if (!n) break;
        p += n;
      }
    };
    while (p < bytes.length) {
      const tag = bytes[p++];
      if (tag === 0x3b) break;
      if (tag === 0x21) {
        p++;
        skipBlocks();
      } else if (tag === 0x2c) {
        if (++frames > 1) return true;
        if (p + 9 > bytes.length) break;
        const packed = bytes[p + 8];
        p += 9;
        if (packed & 128) p += 3 * 2 ** ((packed & 7) + 1);
        p++;
        skipBlocks();
      } else break;
    }
  }
  return false;
}
