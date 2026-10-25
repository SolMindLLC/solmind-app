import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import explorerSourceIsolation, {
  EXPLORER_SOURCE_PROFILES,
} from "./eslint-rules/explorer-source-isolation.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: EXPLORER_SOURCE_PROFILES.map(profile => profile.file),
    plugins: {
      "solmind-explorer-source-isolation": explorerSourceIsolation,
    },
    rules: {
      "solmind-explorer-source-isolation/approved-dependencies": "error",
      "no-restricted-globals": ["error", {
        globals: [
          "process",
          "module",
          "require",
          "fetch",
          "WebSocket",
          "XMLHttpRequest",
          "eval",
          "Function",
          "globalThis",
          "global",
          "window",
          "self",
        ],
        checkGlobalObject: true,
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
