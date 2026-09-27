import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// favicon.svg is the editable master for every platform icon.
const publicDir = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("favicon.svg", publicDir), "utf8");
// Match Haven's SVG URL while retaining favicon.svg as the single editable source.
await writeFile(new URL("icon.svg", publicDir), svg);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const frames = [];
  for (const size of [16, 32, 48, 180]) {
    const isAppleTouchIcon = size === 180;
    const artworkSize = isAppleTouchIcon ? 140 : size;
    const padding = isAppleTouchIcon ? 20 : 0;
    const artwork = svg.replace("<svg ", `<svg width="${artworkSize}" height="${artworkSize}" `);
    await page.setViewportSize({ width: size, height: size });
    // Favicons retain the SVG's transparent corners. Apple gets an opaque square
    // with 20px padding, matching Haven's 140px artwork on a 180px canvas.
    await page.setContent(
      `<html><body style="margin:0;padding:${padding}px;background:${isAppleTouchIcon ? "#fafafa" : "transparent"}">${artwork}</body></html>`,
    );
    const png = await page.screenshot({ type: "png", omitBackground: !isAppleTouchIcon });
    if (isAppleTouchIcon) {
      await writeFile(new URL("apple-touch-icon.png", publicDir), png);
    } else {
      frames.push({ size, png });
      if (size === 32) await writeFile(new URL("favicon-32x32.png", publicDir), png);
    }
  }
  // ICO directory with PNG payloads at native 16, 32 and 48 pixel sizes.
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(
    new URL("favicon.ico", publicDir),
    Buffer.concat([header, ...frames.map(({ png }) => png)]),
  );
} finally {
  await browser.close();
}
