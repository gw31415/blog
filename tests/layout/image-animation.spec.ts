declare global {
  interface Window {
    ImageDecoder: new (options: { data: ArrayBuffer; type: string }) => {
      tracks: {
        ready: Promise<void>;
        selectedTrack: { frameCount: number; repetitionCount: number } | null;
      };
      decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>;
      close(): void;
    };
  }
}
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Small deterministic GIF with transparency, variable frame delays and disposal modes 1/2/3.
function animatedGif() {
  const bytes = [
    ...Buffer.from("GIF89a"),
    16,
    0,
    16,
    0,
    0x81,
    0,
    0,
    0,
    0,
    0,
    255,
    0,
    0,
    0,
    0,
    255,
    0,
    255,
    0,
    0x21,
    0xff,
    11,
    ...Buffer.from("NETSCAPE2.0"),
    3,
    1,
    2,
    0,
    0,
  ];
  function frame(
    left: number,
    width: number,
    height: number,
    pixels: number[],
    delay: number,
    disposal: number,
  ) {
    bytes.push(0x21, 0xf9, 4, (disposal << 2) | 1, delay, 0, 0, 0);
    bytes.push(0x2c, left, 0, 0, 0, width, 0, height, 0, 0, 2);
    let bits = 0,
      count = 0;
    const compressed: number[] = [];
    for (const code of [...pixels.flatMap((pixel) => [4, pixel]), 5]) {
      bits |= code << count;
      count += 3;
      while (count >= 8) {
        compressed.push(bits & 255);
        bits >>= 8;
        count -= 8;
      }
    }
    if (count) compressed.push(bits & 255);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  }
  frame(
    0,
    16,
    16,
    Array.from({ length: 256 }, (_, i) => (i % 16 < 8 ? 1 : 0)),
    10,
    1,
  );
  frame(0, 8, 16, Array(128).fill(2), 20, 3);
  frame(8, 8, 16, Array(128).fill(3), 30, 2);
  frame(0, 1, 1, [0], 40, 1);
  return Buffer.from([...bytes, 0x3b]);
}

test("GIF becomes animated AVIF with timing, loops, transparency and disposal preserved", async ({
  page,
  request,
  browserName,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事", exact: true }).click();
  await expect(page.locator("article .ProseMirror[contenteditable=true]")).toBeVisible();
  const source = animatedGif();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "画像をアップロード", exact: true }).click();
  const uploadedPromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/images") && r.request().method() === "POST",
  );
  await (
    await chooserPromise
  ).setFiles({ name: "animation.gif", mimeType: "image/gif", buffer: source });
  const uploadedResponse = await uploadedPromise;
  expect(uploadedResponse.status(), await uploadedResponse.text()).toBe(201);
  const uploaded = await uploadedResponse.json();
  const image = page.locator(`article img[src^="${uploaded.url}"]`);
  await expect(image).toBeVisible();
  const encoded = await (await request.get(uploaded.url)).body();
  expect(encoded.subarray(0, 64).includes(Buffer.from("avis"))).toBe(true);
  expect(
    (await (await request.get(`/api/images/originals/${uploaded.originalId}`)).body()).equals(
      source,
    ),
  ).toBe(true);
  await writeFile(`.cache/animation-${browserName}.avif`, encoded);
  await writeFile(".cache/animation-source.gif", source);
  if (browserName === "chromium") {
    const decoded = await page.evaluate(async (url) => {
      const Decoder = window.ImageDecoder;
      const decoder = new Decoder({
        data: await (await fetch(url)).arrayBuffer(),
        type: "image/avif",
      });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      if (!track) throw new Error("AVIF track missing");
      const frames = [];
      for (let index = 0; index < track.frameCount; index++) {
        const { image: frame } = await decoder.decode({ frameIndex: index });
        const canvas = new OffscreenCanvas(16, 16),
          context = canvas.getContext("2d")!;
        context.drawImage(frame, 0, 0);
        frames.push({
          duration: frame.duration,
          left: Array.from(context.getImageData(3, 8, 1, 1).data),
          right: Array.from(context.getImageData(12, 8, 1, 1).data),
        });
        frame.close();
      }
      const result = { count: track.frameCount, repeat: track.repetitionCount, frames };
      decoder.close();
      return result;
    }, uploaded.url);
    expect(decoded.count).toBe(4);
    expect(decoded.repeat).toBe(2);
    expect(decoded.frames.map((frame) => frame.duration)).toEqual([100000, 200000, 300000, 400000]);
    const [a, b, c, d] = decoded.frames;
    expect(a.left[0]).toBeGreaterThan(220);
    expect(a.right[3]).toBe(0);
    expect(b.left[2]).toBeGreaterThan(220);
    expect(b.right[3]).toBe(0);
    expect(c.left[0]).toBeGreaterThan(220);
    expect(c.right[1]).toBeGreaterThan(220);
    expect(d.left[0]).toBeGreaterThan(220);
    expect(d.right[3]).toBe(0);
  }
  // Native image playback must actually change, including on WebKit.
  await image.evaluate((img: HTMLImageElement) => {
    img.src += "?playback-check";
  });
  const initial = await image.screenshot();
  await expect
    .poll(async () => !(await image.screenshot()).equals(initial), { timeout: 3000 })
    .toBe(true);
});
