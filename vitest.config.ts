import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js handles `import "server-only"` itself; in tests, the reads are imported directly.
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
    // Starting PGlite and applying the migrations takes several seconds when every file runs at once.
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
