// SolMind MVP0 Vitest configuration.
//
// This config makes the server-only boundary testable and excludes generated copies.
// The `server-only` package's default export THROWS at import time so that any
// accidental client-bundle import fails the Next.js build (that is the intended
// AUTH-RLS-DEC-023 import-time guard). Next applies the "react-server" export
// condition for server bundles, which resolves server-only to an inert empty
// module. Vitest, however, runs in plain Node without that condition, so importing
// any module that does `import "server-only";` would otherwise throw under test.
//
// To keep the already-banked server-only Auth/RLS modules importable in unit tests
// WITHOUT weakening the real guard, alias `server-only` to a tiny inert stub for the
// test runner only. This changes nothing about the production build, where the real
// server-only package and its import-time guard remain in force.
//
// Test discovery keeps Vitest defaults and adds only .codex-validation/** to
// its existing exclusions, so product **/*.test.ts files still run as before.

import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".codex-validation/**"],
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
      // Mirror the tsconfig "@/*" -> "./src/*" path alias for the test runner only,
      // so server-only Route Handlers (which import their composition helpers via the
      // "@/..." alias) can be imported and exercised in unit tests. Vite matches this
      // string alias for an import that equals "@" or starts with "@/", which covers
      // every "@/..." specifier. This is test-runner-only: it does not affect the
      // Next.js production build or the real server-only import-time guard.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
