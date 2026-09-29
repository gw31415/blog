import { Miniflare } from "miniflare";
import config from "../cloudflare.config";

// Shared by dev, preview and local data tools. Never connects to Cloudflare.
export const localStatePath = process.env.BLOG_LOCAL_STATE ?? ".cache/webmcp-test";

export async function getLocalPlatform() {
  const { entrypoint: _entrypoint, ...worker } = config.worker;
  const mf = new Miniflare({
    // cf and the Vite plugin append v3 to their persistence paths.
    resourcePersistencePath: `${localStatePath}/v3`,
    workers: [
      {
        config: {
          ...worker,
          env: {
            ...worker.env,
            ASSETS: { type: "fetcher", handler: () => new Response("Not found", { status: 404 }) },
          },
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents: "export default {}",
              },
            },
          },
        },
      },
    ],
  });
  try {
    return { env: await mf.getBindings<Env>(), dispose: () => mf.dispose() };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
