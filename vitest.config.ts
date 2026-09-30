import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      thresholds: {
        "src/lib/game/**": { lines: 95, branches: 90 },
        "src/lib/services/**": { lines: 80 },
      },
    },
  },
});
