import { expect, it } from "vite-plus/test";
import { validatePublication } from "./validate-publication";
import { sampleDocument } from "../content/sample-document";
it("allows the showcase including supported math and diagrams", async () => {
  await expect(validatePublication(sampleDocument)).resolves.toBeUndefined();
});
it("reports invalid render source before publication", async () => {
  await expect(
    validatePublication({
      type: "doc",
      content: [{ type: "blockMath", attrs: { latex: "\\frac{broken" } }],
    }),
  ).rejects.toThrow("数式");
});
