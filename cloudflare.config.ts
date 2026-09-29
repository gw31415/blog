import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
  worker: {
    name: "blog",
    compatibilityDate: "2026-09-04",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "./dist/_worker.js",
    workersDev: false,
    previewUrls: false,
    observability: {
      enabled: true,
    },
    domains: ["amas.dev"],
    triggers: [
      triggers.scheduled({
        schedule: "17 * * * *",
      }),
    ],
    env: {
      ACCESS_TEAM_DOMAIN: bindings.text("https://gw31415.cloudflareaccess.com"),
      ACCESS_AUD: bindings.text("982d5073afdd4f4ba9be453e7917dabdb1499f5e6102184fa400af1c445c743c"),
      DB: bindings.d1({
        name: "blog-posts",
        id: "74e71308-26ca-42d5-b319-6100b7823b4f",
        dev: {
          remote: false,
        },
      }),
      IMAGES: bindings.r2({
        name: "blog-images",
        dev: {
          remote: false,
        },
      }),
      ASSETS: bindings.assets(),
    },
  },
});
