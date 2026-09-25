import { finalizeMermaidSVG } from "./mermaid-svg";
import {
  MERMAID_CONFIG,
  MERMAID_RENDERER,
  mermaidImageHTML,
  mermaidSources,
  type MermaidArtifact,
} from "./mermaid-contract";
let counter = 0;
let engine: Promise<typeof import("mermaid")> | undefined;
const rendered = new Map<string, Promise<string>>();
async function svgFor(source: string): Promise<string> {
  if (rendered.has(source)) return rendered.get(source)!;
  const job = (async () => {
    engine ??= import("mermaid");
    const { default: mermaid } = await engine;
    mermaid.initialize(MERMAID_CONFIG);
    if (/^sankey(?:-beta)?\b/.test(source.trim())) {
      const parsed = await mermaid.mermaidAPI.getDiagramFromText(source);
      if (!("getGraph" in parsed.db) || typeof parsed.db.getGraph !== "function")
        throw new Error("Sankey database is invalid");
      const graph: unknown = parsed.db.getGraph();
      if (!graph || typeof graph !== "object" || !("nodes" in graph) || !Array.isArray(graph.nodes))
        throw new Error("Sankey graph is invalid");
      const nodes = graph.nodes.map((node: unknown) => {
        if (!node || typeof node !== "object" || !("id" in node) || typeof node.id !== "string")
          throw new Error("Sankey node is invalid");
        return { id: node.id };
      });
      mermaid.initialize({
        ...MERMAID_CONFIG,
        sankey: {
          nodeColors: Object.fromEntries(
            nodes.map((node, colorIndex) => [
              node.id,
              MERMAID_CONFIG.themeVariables["cScale" + (colorIndex % 12)],
            ]),
          ),
        },
      });
    }
    return finalizeMermaidSVG((await mermaid.render(`blog-diagram-${++counter}`, source)).svg);
  })();
  if (rendered.size >= 64) rendered.delete(rendered.keys().next().value!);
  rendered.set(source, job);
  try {
    return await job;
  } catch (error) {
    rendered.delete(source);
    throw error;
  }
}
export async function renderMermaidPreview(element: HTMLElement, source: string, asImage = false) {
  const request = String(++counter);
  element.dataset.mermaidRequest = request;
  try {
    const svg = await svgFor(source);
    if (element.dataset.mermaidRequest === request) {
      element.innerHTML = asImage ? mermaidImageHTML(svg) : svg;
      element.removeAttribute("role");
    }
  } catch (error) {
    if (element.dataset.mermaidRequest === request) {
      element.textContent = `Mermaidの描画を確認してください：${error instanceof Error ? error.message : String(error)}`;
      element.setAttribute("role", "alert");
    }
  }
}
export async function prepareMermaidArtifacts(
  body: import("@tiptap/core").JSONContent,
): Promise<MermaidArtifact[]> {
  const result: MermaidArtifact[] = [];
  for (const source of new Set(mermaidSources(body))) {
    // Adopt SSR images without spending time rendering unchanged diagrams again.
    const image = [...document.querySelectorAll<HTMLElement>(".mermaid-diagram")]
      .find((element) => element.dataset.mermaidSource === source)
      ?.querySelector<HTMLImageElement>("img.mermaid-image");
    const url = image?.getAttribute("src");
    try {
      const svg = url?.startsWith("data:image/svg+xml,")
        ? decodeURIComponent(url.slice("data:image/svg+xml,".length))
        : await svgFor(source);
      result.push({ source, renderer: MERMAID_RENDERER, svg });
    } catch {
      /* Keep invalid draft source; SSR will retain its rendering diagnostic. */
    }
  }
  return result;
}

export async function validateMermaidDocument(
  body: import("@tiptap/core").JSONContent,
): Promise<void> {
  const sources = mermaidSources(body);
  if (!sources.length) return;
  engine ??= import("mermaid");
  const { default: mermaid } = await engine;
  mermaid.initialize(MERMAID_CONFIG);
  for (const source of sources) {
    try {
      await mermaid.parse(source);
    } catch (error) {
      throw new Error(
        `公開前にMermaidを確認してください: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
