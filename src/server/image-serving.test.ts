import { expect, it } from "vite-plus/test";
import { onGet } from "../routes/images/variants/[id]/index";

async function get(requestHeaders: Record<string, string> = {}) {
  const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV.avif";
  let response: Response | undefined;
  const event = {
    params: { id },
    request: new Request(`https://blog.example/images/variants/${id}`, { headers: requestHeaders }),
    platform: {
      env: {
        get DB() {
          throw new Error("Image delivery must not access D1");
        },
        IMAGES: {
          async get(key: string) {
            expect(key).toBe(`images/variants/${id}`);
            return {
              body: new Blob(["avif bytes"]).stream(),
              httpEtag: '"etag"',
              writeHttpMetadata(headers: Headers) {
                headers.set("Content-Type", "image/avif");
              },
            };
          },
        },
      },
    },
    send(value: Response) {
      response = value;
    },
  };
  // Minimal request event: deliberately no database access is available.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  await onGet(event as unknown as Parameters<typeof onGet>[0]);
  return response;
}

it("serves R2 metadata and bytes without touching D1", async () => {
  const response = await get();
  expect(response?.headers.get("Content-Type")).toBe("image/avif");
  expect(response?.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  expect(await response?.text()).toBe("avif bytes");
});

it("answers a matching validator without resending the image", async () => {
  const response = await get({ "If-None-Match": '"etag"' });
  expect(response?.status).toBe(304);
  expect(await response?.text()).toBe("");
});
