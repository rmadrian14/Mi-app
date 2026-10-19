import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Configuración propia para los tests: no carga los plugins de TanStack Start ni
// de Cloudflare, que no hacen falta (y tardan) para probar lógica pura.
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
