import { Extension, InputRule } from "@tiptap/core";
import { parseArticleMarkdown } from "./markdown";
import { normalizeDocument } from "../../content/document";
export const DocumentTypingRules = Extension.create({
  name: "documentTypingRules",
  addInputRules() {
    return [
      new InputRule({
        find: /(?<![\\[])(\[!\[.*\]\(.*\)\]\(.*\)|!\[.*\]\(.*\)|\[[^\]]+\]\(.*\))$/,
        handler: ({ state, range, match }) => {
          if (this.editor.view.composing || state.selection.$from.parent.type.name === "codeBlock")
            return null;
          try {
            const parsed = normalizeDocument(parseArticleMarkdown(match[1]));
            const paragraph = parsed.content?.[0];
            if (
              parsed.content?.length !== 1 ||
              paragraph?.type !== "paragraph" ||
              !paragraph.content?.every(
                (n) => n.type === "image" || n.marks?.some((m) => m.type === "link"),
              )
            )
              return null;
            state.tr.replaceWith(
              range.from,
              range.to,
              paragraph.content.map((n) => state.schema.nodeFromJSON(n)),
            );
            return undefined;
          } catch {
            return null;
          }
        },
      }),
    ];
  },
});
