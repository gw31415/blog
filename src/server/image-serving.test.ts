import { expect, it } from "vite-plus/test";
import { onGet } from "../routes/images/variants/[id]/index";

it("serves R2 metadata and bytes without touching D1", async () => {
  const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV.avif";
  let response: Response | undefined;
  const event = {
    params: { id },
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
  expect(response?.headers.get("Content-Type")).toBe("image/avif");
  expect(await response?.text()).toBe("avif bytes");
});
