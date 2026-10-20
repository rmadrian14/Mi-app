import { defineConfig } from "vitest/config";

// Configuración propia para los tests: no carga los plugins de TanStack Start ni
// de Cloudflare, que no hacen falta (y tardan) para probar lógica pura.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
