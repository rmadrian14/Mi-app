import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    ...(command === "build" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
  ],
  optimizeDeps: {
    include: [
      "@tanstack/router-core",
      "@tanstack/router-core/ssr/client",
      "seroval",
      "react",
      "react-dom/client",
    ],
  },
}));
