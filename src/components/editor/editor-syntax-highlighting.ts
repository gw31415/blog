import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";

const lowlight = createLowlight({ css, html: xml });

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
  const result =
    language && lowlight.registered(language)
      ? lowlight.highlight(language, source)
      : lowlight.highlightAuto(source);
  return flatten(result.children);
}
