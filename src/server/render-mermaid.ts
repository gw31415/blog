import puppeteer from "@cloudflare/puppeteer";
import type { RequestEventLoader } from "@qwik.dev/router";
import type { RenderEntry, RenderResult } from "../content/render-contract";
import { MERMAID_CONFIG } from "../components/editor/mermaid-contract";

export async function generateMermaid(
  entries: RenderEntry[],
  event: RequestEventLoader,
): Promise<RenderResult[]> {
  const assetURL = new URL("/mermaid/mermaid.min.js", event.url);
  const assets = event.platform.env.ASSETS;
  const response = assets ? await assets.fetch(new Request(assetURL)) : await fetch(assetURL);
  if (!response.ok) throw new Error("Mermaid renderer is unavailable");
  const script = await response.text();
  const browser = await puppeteer.launch(event.platform.env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 960, deviceScaleFactor: 1 });
    // Diagram input must not initiate arbitrary network requests.
    await page.setRequestInterception(true);
    page.on("request", (request) => void request.abort());
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ content: script });
    const result = await page.evaluate(
      async ({ inputs, config }) => {
        const mermaid = (globalThis as unknown as { mermaid: typeof import("mermaid").default })
          .mermaid;
        mermaid.initialize(config);
        const output: { output: string | null; diagnostic: string | null }[] = [];
        for (const [index, source] of inputs.entries()) {
          try {
            output.push({
              output: (await mermaid.render(`server-diagram-${index}`, source)).svg,
              diagnostic: null,
            });
          } catch {
            output.push({ output: null, diagnostic: "Mermaidの描画を確認してください。" });
          }
        }
        return output;
      },
      { inputs: entries.map((entry) => entry.source), config: MERMAID_CONFIG },
    );
    return result;
  } finally {
    await browser.close();
  }
}
