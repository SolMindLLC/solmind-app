import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(root, "test/stubs/server-only.ts"),
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/whole-path/**/*.wholepath.ts"],
    reporters: ["default"],
    sequence: { concurrent: false },
    testTimeout: 180_000,
  },
});
