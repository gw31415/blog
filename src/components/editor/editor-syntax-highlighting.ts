import latex from "highlight.js/lib/languages/latex";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";

const lowlight = createLowlight({
  latex,
  mermaid: () => ({
    contains: [
      { scope: "comment", begin: /%%/, end: /$/ },
      { scope: "string", begin: /"/, end: /"/ },
      {
        scope: "keyword",
        match:
          /\b(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|timeline|subgraph|end|participant|actor|style|classDef|LR|RL|TB|TD|BT)\b/,
      },
      { scope: "operator", match: /--?>|==>|-\.->|---|<-->/ },
      { scope: "number", match: /\b\d+\b/ },
    ],
  }),
  bash,
  css,
  html: xml,
  javascript,
  json,
  markdown,
  typescript,
});

export interface HighlightSpan {
  classes: string[];
  text: string;
}

function flatten(nodes: any[], inheritedClasses: string[] = []): HighlightSpan[] {
  return nodes.flatMap((node) => {
    const classes = [...inheritedClasses, ...(node.properties?.className ?? [])];
    return node.children ? flatten(node.children, classes) : [{ classes, text: node.value }];
  });
}

export function highlightCode(languageInfo: string, source: string): HighlightSpan[] {
  const language = languageInfo.split(/\s+/, 1)[0];
  if (!language || !lowlight.registered(language)) return [{ classes: [], text: source }];
  const result = lowlight.highlight(language, source);
  return flatten(result.children);
}
