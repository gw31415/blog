import { expect, it } from "vite-plus/test";
import { parseArtifactLayout } from "./media-artifact";

it("reads finite math metrics and preserves negative baseline offsets", () => {
  expect(parseArtifactLayout('{"widthEm":2,"heightEm":1,"verticalAlignEm":-0.25}')).toEqual({
    widthEm: 2,
    heightEm: 1,
    verticalAlignEm: -0.25,
  });
  expect(parseArtifactLayout("{}")).toEqual({});
});
it.each([
  "null",
  "[]",
  '{"heightEm":"1"}',
  '{"widthEm":0}',
  '{"heightEm":-1}',
  '{"verticalAlignEm":1e999}',
  '{"mathml":12}',
])("rejects invalid saved layout %s", (json) => {
  expect(() => parseArtifactLayout(json)).toThrow();
});
