import { Extension, Mark, markInputRule } from "@tiptap/core";

import { inlineTags } from "./inline-format-contract";
export { inlineTags, formatCommands } from "./inline-format-contract";

export const semanticMarks = Object.entries(inlineTags).map(([name, tag]) =>
  Mark.create({
    name,
    excludes: name === "subscript" ? "superscript" : name === "superscript" ? "subscript" : name,
    parseHTML: () => [{ tag }],
    renderHTML: () => [tag, {}, 0],
    markdownTokenName: name,
    markdownTokenizer: {
      name,
      level: "inline",
      start: (source) => source.indexOf(`<${tag}>`),
      tokenize(source, _tokens, lexer) {
        if (!source.startsWith(`<${tag}>`)) return undefined;
        let depth = 1;
        const opening = `<${tag}>`,
          closing = `</${tag}>`;
        for (let i = opening.length; i < source.length; i++) {
          if (source[i] === "\\") {
            i++;
            continue;
          }
          if (source[i] === "`") {
            const fence = /^`+/.exec(source.slice(i))![0];
            const end = source.indexOf(fence, i + fence.length);
            if (end >= 0) {
              i = end + fence.length - 1;
              continue;
            }
          }
          if (source.startsWith(opening, i)) depth++;
          if (source.startsWith(closing, i) && --depth === 0) {
            return {
              type: name,
              raw: source.slice(0, i + closing.length),
              tokens: lexer.inlineTokens(source.slice(opening.length, i)),
            };
          }
        }
        return undefined;
      },
    },
    parseMarkdown: (token, helpers) =>
      helpers.parseInline(token.tokens ?? []).map((node) => ({
        ...node,
        marks: [...(node.marks ?? []), { type: name }],
      })),
    renderMarkdown: (node, helpers) =>
      `<${tag}>${helpers.renderChildren(node.content ?? [])}</${tag}>`,
  }),
);

export const InlineFormatting = Extension.create({
  name: "inlineFormatting",
  addInputRules() {
    const rules: [string, RegExp][] = [
      ["bold", /(?:^|\s|(?<=\P{ASCII}))(\*\*([^*\n]+)\*\*)$/u],
      ["b", /(?:^|\s|(?<=\P{ASCII}))(\*(?!\*)([^*\n]+)\*)$/u],
      ["underline", /(?:^|\s|(?<=\P{ASCII}))(__([^_\n]+)__)$/u],
      ["i", /(?:^|\s|(?<=\P{ASCII}))(_(?!_)([^_\n]+)_)$/u],
      ["strike", /(?:^|\s|(?<=\P{ASCII}))(~~([^~\n]+)~~)$/u],
      ["highlight", /(?:^|\s|(?<=\P{ASCII}))(==([^=\n]+)==)$/u],
    ];
    return rules.map(([name, find]) =>
      markInputRule({
        find,
        type: this.editor.schema.marks[name],
      }),
    );
  },
  addKeyboardShortcuts() {
    const toggle = (mark: string) => () =>
      this.editor.isActive("codeBlock") ||
      this.editor
        .chain()
        .toggleMark(mark)
        .command(({ tr }) => {
          tr.doc.descendants((node, pos) => {
            if (node.type.name === "image" || node.type.name === "inlineMath")
              tr.removeMark(pos, pos + node.nodeSize, this.editor.schema.marks[mark]);
          });
          return true;
        })
        .run();
    return {
      "Mod-b": toggle("b"),
      "Mod-i": toggle("i"),
      "Mod-u": toggle("underline"),
      "Mod-Alt-s": toggle("bold"),
      "Mod-Shift-h": toggle("highlight"),
    };
  },
});
