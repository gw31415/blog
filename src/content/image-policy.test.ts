import { describe, expect, it } from "vite-plus/test";
import { imageType, isAnimated } from "./image-policy";
describe("image container policy", () => {
  it("does not trust a filename or accept truncated headers", () => {
    expect(imageType(new Uint8Array([137, 80, 78, 71]))).toBeNull();
    expect(
      imageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    ).toBeNull();
  });
  it("detects GIF frames without mistaking compressed pixel bytes for image separators", () => {
    const header = [...new TextEncoder().encode("GIF89a"), 1, 0, 1, 0, 0, 0, 0];
    const frame = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x2c, 0, 0];
    expect(isAnimated(new Uint8Array([...header, ...frame, 0x3b]), "image/gif")).toBe(false);
    expect(isAnimated(new Uint8Array([...header, ...frame, ...frame, 0x3b]), "image/gif")).toBe(
      true,
    );
  });
  it("detects APNG and animated WebP and AVIF", () => {
    const png = new Uint8Array(28);
    png.set(new TextEncoder().encode("acTL"), 12);
    expect(isAnimated(png, "image/png")).toBe(true);
    const webp = new Uint8Array(24);
    webp.set(new TextEncoder().encode("ANIM"), 12);
    expect(isAnimated(webp, "image/webp")).toBe(true);
    const avif = new Uint8Array(24);
    avif[3] = 24;
    avif.set(new TextEncoder().encode("ftyp"), 4);
    avif.set(new TextEncoder().encode("avis"), 16);
    expect(imageType(avif)).toBe("image/avif");
    expect(isAnimated(avif, "image/avif")).toBe(true);
  });
});
