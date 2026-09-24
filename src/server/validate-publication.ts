import type { JSONContent } from "@tiptap/core";
import { validateLatex } from "../components/editor/mathjax-renderer";

export async function validatePublication(body: JSONContent): Promise<void> {
  const visit = (node: JSONContent) => {
    if (node.type === "inlineMath" || node.type === "blockMath") {
      const result = validateLatex(String(node.attrs?.latex ?? ""), node.type === "blockMath");
      if (!result.ok) throw new Error(`公開前に数式を確認してください: ${result.message}`);
    }
    node.content?.forEach(visit);
  };
  visit(body);
}
