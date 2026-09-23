import { cloudflarePagesAdapter } from "@qwik.dev/router/adapters/cloudflare-pages/vite";
import { extendConfig } from "@qwik.dev/router/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => ({
  build: {
    ssr: true,
    rolldownOptions: {
      input: ["src/entry.cloudflare-pages.tsx"],
    },
  },
  // NOTE: sharedPlugins: true は SSG の誤警告回避のため。
  // builder モードでは設定が環境ごとに再評価され plugin 実体が分岐するが、
  // Qwik アダプタの buildApp 実行フラグはクロージャ保持のため実体間で見えない。
  // patches/ の修正と併せてこの問題を解消する。
  builder: {
    sharedPlugins: true,
  },
  plugins: [cloudflarePagesAdapter()],
}));
