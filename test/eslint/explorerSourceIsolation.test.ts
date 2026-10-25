import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "eslint";
import * as typescriptParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import flatConfig from "../../eslint.config.mjs";
import explorerSourceIsolation, { EXPLORER_SOURCE_PROFILES } from "../../eslint-rules/explorer-source-isolation.mjs";

// Mutants are strings parsed by ESLint.lintText only. No fixture import,
// require, eval, global access or network expression is ever executed.
// This static dependency proof is not runtime/source-completeness assurance.
const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PLUGIN = "solmind-explorer-source-isolation";
const RULE = `${PLUGIN}/approved-dependencies`;
const GLOBAL_RULE = "no-restricted-globals";
const PRIVATE = "SYNTHETIC_PRIVATE_SOURCE_DETAIL";
const MESSAGES = {
  missingProfile: "Explorer source isolation requires an approved file profile.",
  unapprovedDependency: "Explorer assembly dependency is not approved for this file.",
  unsupportedImport: "Explorer assembly permits approved static imports and reexports only.",
} as const;
type Profile = Readonly<{ file: string; runtimeImports: readonly string[]; typeImports: readonly string[] }>;
const profile = (file: string, runtimeImports: readonly string[], typeImports: readonly string[] = []): Profile =>
  ({ file: `src/lib/solmind/${file}`, runtimeImports, typeImports });
const EXPECTED_PROFILES: readonly Profile[] = [
  profile("roles.ts", []),
  profile("onboarding.ts", []),
  profile("context/aiRoleContext.ts", ["../roles"]),
  profile("context/explorerContext.ts", []),
  profile("context/explorerSafeContext.ts", ["server-only", "./aiRoleContext", "./explorerContext"]),
  profile("virtual-guide/virtualGuideConversationContract.ts", ["server-only", "node:util"]),
  profile("virtual-guide/authorizedVirtualGuideContext.ts", ["server-only", "node:crypto",
    "@/lib/solmind/context/explorerSafeContext", "@/lib/solmind/virtual-guide/virtualGuideConversationContract"]),
  profile("virtual-guide/effectiveMethodologyContext.ts", ["server-only", "node:util", "./methodologySafetyScreenContract"],
    ["./explorerConversationComposition"]),
  profile("virtual-guide/methodologySafetyScreenContract.ts", ["server-only", "node:crypto", "node:util", "../context/explorerSafeContext"]),
  profile("virtual-guide/explorerContextExclusionGuard.ts", ["server-only", "node:crypto", "node:util", "../context/explorerSafeContext"]),
  profile("virtual-guide/explorerConversationContext.ts", ["server-only", "./authorizedVirtualGuideContext",
    "../context/explorerSafeContext", "../onboarding", "node:util", "./effectiveMethodologyContext"], ["./explorerConversationComposition"]),
];
const CONTEXT_FILE = "src/lib/solmind/virtual-guide/explorerConversationContext.ts";
const TYPE_EDGE_FILES = ["src/lib/solmind/virtual-guide/effectiveMethodologyContext.ts", CONTEXT_FILE];
const GLOBALS = ["process", "module", "require", "fetch", "WebSocket", "XMLHttpRequest", "eval", "Function",
  "globalThis", "global", "window", "self"];
const absolute = (file: string) => resolve(APP_ROOT, file);

// Reuse engines: actual application configuration is never replaced for profile
// or mutant assertions. The second engine deliberately forces the actual rule
// onto unknown filenames to exercise its missing-profile refusal.
const actual = new ESLint({ cwd: APP_ROOT, overrideConfigFile: absolute("eslint.config.mjs") });
const forcedRule = new ESLint({ cwd: APP_ROOT, overrideConfigFile: true, overrideConfig: [{
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: typescriptParser, ecmaVersion: "latest", sourceType: "module" },
  plugins: { [PLUGIN]: explorerSourceIsolation as unknown as ESLint.Plugin },
  rules: { [RULE]: "error" },
}] });
// This baseline is used only to prove unrelated files retain the preexisting
// presets/settings. It removes the one new, profile-scoped block from the actual
// exported configuration; it is never used to accept a profile or mutant.
const baselineBlocks = (flatConfig as unknown as Linter.Config[]).filter(block =>
  !Object.hasOwn(block.rules ?? {}, RULE));
const baseline = new ESLint({ cwd: APP_ROOT, overrideConfigFile: true, overrideConfig: baselineBlocks });

function targetMessages(result: ESLint.LintResult): Linter.LintMessage[] {
  return result.messages.filter(message => message.ruleId === RULE || message.ruleId === GLOBAL_RULE);
}
async function lint(code: string, file = CONTEXT_FILE, engine = actual): Promise<ESLint.LintResult> {
  const results = await engine.lintText(code, { filePath: absolute(file) });
  expect(results).toHaveLength(1);
  expect(results[0].fatalErrorCount).toBe(0);
  return results[0];
}
function errorsFor(result: ESLint.LintResult, rule = RULE): Linter.LintMessage[] {
  return result.messages.filter(message => message.ruleId === rule);
}
function expectFixedFailure(result: ESLint.LintResult, messageId: keyof typeof MESSAGES) {
  const errors = errorsFor(result);
  expect(errors.length).toBeGreaterThan(0);
  for (const error of errors) {
    expect(error.severity).toBe(2);
    expect(error.messageId).toBe(messageId);
    expect(error.message).toBe(MESSAGES[messageId]);
    expect(error.message).not.toContain(PRIVATE);
    expect(error.fix).toBeUndefined();
    expect(error.suggestions).toBeUndefined();
  }
  expect(result.output).toBeUndefined();
}
const severity = (entry: unknown) => Array.isArray(entry) ? entry[0] : entry;

describe("actual Explorer assembly source-isolation plugin and flat configuration", () => {
  it("exports exactly the eleven reviewed direct-source profiles, deeply frozen", () => {
    expect(EXPLORER_SOURCE_PROFILES).toEqual(EXPECTED_PROFILES);
    expect(Object.isFrozen(EXPLORER_SOURCE_PROFILES)).toBe(true);
    for (const entry of EXPLORER_SOURCE_PROFILES) {
      expect(Object.keys(entry)).toEqual(["file", "runtimeImports", "typeImports"]);
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.runtimeImports)).toBe(true);
      expect(Object.isFrozen(entry.typeImports)).toBe(true);
    }
    expect(Object.keys(explorerSourceIsolation.rules)).toEqual(["approved-dependencies"]);
    const meta = explorerSourceIsolation.rules["approved-dependencies"].meta;
    expect(meta.messages).toEqual(MESSAGES);
    expect(Object.hasOwn(meta, "fixable")).toBe(false);
    expect(Object.hasOwn(meta, "hasSuggestions")).toBe(false);
  });

  it.each(EXPECTED_PROFILES)("applies both error rules and accepts current source $file", async entry => {
    const config = await actual.calculateConfigForFile(absolute(entry.file));
    expect(config).toBeDefined();
    expect(severity(config.rules[RULE])).toBe(2);
    expect(severity(config.rules[GLOBAL_RULE])).toBe(2);
    const restricted = config.rules[GLOBAL_RULE][1] as {
      globals: Array<string | { name: string }>; checkGlobalObject: boolean;
    };
    expect(restricted.checkGlobalObject).toBe(true);
    expect(restricted.globals.map(value => typeof value === "string" ? value : value.name)).toEqual(GLOBALS);
    expect(config.plugins[PLUGIN]).toBeDefined();
    const source = await readFile(absolute(entry.file), "utf8");
    const result = await lint(source, entry.file);
    expect(targetMessages(result)).toEqual([]);
  });

  it.each(EXPECTED_PROFILES)("denies a new filesystem edge in every profile: $file", async entry => {
    expectFixedFailure(await lint('import "node:fs";', entry.file), "unapprovedDependency");
  });

  it.each(EXPECTED_PROFILES.filter(entry => entry.runtimeImports.length > 0))(
    "permits exactly listed runtime dependencies in static forms for $file", async entry => {
      for (const specifier of entry.runtimeImports) {
        const source = JSON.stringify(specifier);
        for (const code of [`import ${source};`, `import * as Synthetic from ${source};`,
          `import type { Synthetic } from ${source};`, `export * from ${source};`, `export type * from ${source};`]) {
          expect(targetMessages(await lint(code, entry.file))).toEqual([]);
        }
      }
    });

  it.each(TYPE_EDGE_FILES)("allows only erased, nonempty static composition edges for %s", async file => {
    for (const code of [
      'import type { SyntheticPort } from "./explorerConversationComposition";',
      'import { type SyntheticPort } from "./explorerConversationComposition";',
      'import type SyntheticDefault from "./explorerConversationComposition";',
      'import type * as SyntheticNamespace from "./explorerConversationComposition";',
      'export type { SyntheticPort } from "./explorerConversationComposition";',
      'export { type SyntheticPort } from "./explorerConversationComposition";',
      'export type * from "./explorerConversationComposition";',
      'export type * as SyntheticNamespace from "./explorerConversationComposition";',
    ]) expect(targetMessages(await lint(code, file))).toEqual([]);
  });

  it.each(TYPE_EDGE_FILES)("rejects value, mixed, empty and side-effect composition edges for %s", async file => {
    for (const code of [
      'import { SyntheticPort } from "./explorerConversationComposition";',
      'import { type SyntheticPort, syntheticValue } from "./explorerConversationComposition";',
      'import SyntheticDefault from "./explorerConversationComposition";',
      'import * as SyntheticNamespace from "./explorerConversationComposition";',
      'import "./explorerConversationComposition";',
      'import {} from "./explorerConversationComposition";',
      'import type {} from "./explorerConversationComposition";',
      'export {} from "./explorerConversationComposition";',
      'export type {} from "./explorerConversationComposition";',
      'export { SyntheticPort } from "./explorerConversationComposition";',
      'export { type SyntheticPort, syntheticValue } from "./explorerConversationComposition";',
      'export * from "./explorerConversationComposition";',
      'export * as SyntheticNamespace from "./explorerConversationComposition";',
    ]) expectFixedFailure(await lint(code, file), "unapprovedDependency");
  });

  it.each([
    "../supabase/privateNoteRepository", "../supabase/triggerObservationRepository", "../supabase/summaryRepository",
    "../supabase/safetyRepository", "../supabase/adminAccessRecords", "../supabase/requestAuthClient",
    "@/lib/solmind/supabase/privateNoteRepository", "@supabase/supabase-js", "@supabase/ssr",
    "./openAiLunaVirtualGuideTransport", "openai", "node:fs", "node:fs/promises", "fs", "dotenv/config",
    "@/lib/solmind/supabase", "@/lib/solmind", "../index", "./index",
    "@/lib/solmind/context/explorerSafeContext", "./authorizedVirtualGuideContext.ts",
    "./../virtual-guide/authorizedVirtualGuideContext", `../supabase/${PRIVATE}`,
  ])("rejects forbidden repository/client/provider/filesystem/env/barrel/alternate spelling %s", async specifier => {
    const source = JSON.stringify(specifier);
    for (const code of [`import ${source};`, `import type { Synthetic } from ${source};`,
      `export { Synthetic } from ${source};`, `export type { Synthetic } from ${source};`, `export * from ${source};`]) {
      expectFixedFailure(await lint(code), "unapprovedDependency");
    }
  });

  it.each([
    'void import("../supabase/privateNoteRepository");',
    'void import("./effectiveMethodologyContext");',
    'const path = "../supabase/privateNoteRepository"; void import(path);',
    'void import("../supabase/" + "privateNoteRepository");',
    'type Synthetic = import("../supabase/privateNoteRepository").Synthetic;',
    'type Synthetic = typeof import("./effectiveMethodologyContext");',
    'import Synthetic = require("../supabase/privateNoteRepository");',
    'import Synthetic = require("./effectiveMethodologyContext");',
    'namespace SyntheticNamespace { export const item = 1; } import Synthetic = SyntheticNamespace.item;',
  ])("rejects dynamic/import-type/import-equals spelling without executing it: %#", async code => {
    expectFixedFailure(await lint(code), "unsupportedImport");
  });

  it.each(GLOBALS)("rejects the restricted global reference %s through the actual builtin rule", async name => {
    const result = await lint(`void ${name};`);
    const errors = errorsFor(result, GLOBAL_RULE);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(error => error.severity === 2 && error.fix === undefined && error.suggestions === undefined)).toBe(true);
    expect(errors.map(error => error.message).join(" ")).not.toContain(PRIVATE);
  });

  it.each([
    'void globalThis.process;', 'void globalThis["fetch"];', 'void window.fetch;', 'void self.XMLHttpRequest;',
    'void globalThis["Function"];', 'void globalThis["process"]["env"]["SYNTHETIC_PRIVATE_SOURCE_DETAIL"];',
  ])("rejects global-object escape text without evaluating it: %#", async code => {
    const errors = errorsFor(await lint(code), GLOBAL_RULE);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(error => error.severity === 2)).toBe(true);
    expect(errors.map(error => error.message).join(" ")).not.toContain(PRIVATE);
  });

  it("retains local declarations/exports without inventing dependency edges", async () => {
    expect(targetMessages(await lint('const value = 1; export { value }; export type Local = { value: string };'))).toEqual([]);
  });

  it("selects profiles across native/slash paths and a whole nested checkout suffix", async () => {
    for (const filePath of [absolute("src/lib/solmind/roles.ts"),
      absolute("src/lib/solmind/roles.ts").replace(/\\/g, "/"), absolute("nested-checkout/src/lib/solmind/roles.ts")]) {
      const [result] = await forcedRule.lintText('import "node:fs";', { filePath });
      expect(result.fatalErrorCount).toBe(0);
      expectFixedFailure(result, "unapprovedDependency");
    }
  });

  it.each(["src/lib/solmind/not-profiled.ts", "src/lib/solmind/roles.tsx",
    "src/lib/solmind/roles.ts.extra.ts", "not-src/lib/solmind/roles.ts", "src/lib/solmind/roles.ts/extra.ts"])(
    "fails closed when the actual custom rule is deliberately applied without a profile: %s", async file => {
      const result = await lint(`import "${PRIVATE}";`, file, forcedRule);
      expect(errorsFor(result)).toHaveLength(1);
      expectFixedFailure(result, "missingProfile");
    });

  it.each(["src/lib/solmind/auth/adminHomeAccess.ts", "src/lib/solmind/supabase/explorerConversationRepository.ts",
    "src/app/explorer/conversation/page.tsx", "test/eslint/explorerSourceIsolation.test.ts"])(
    "preserves existing unrelated configuration for %s", async file => {
      const current = await actual.calculateConfigForFile(absolute(file));
      const previous = await baseline.calculateConfigForFile(absolute(file));
      expect(current.rules).toEqual(previous.rules);
      expect(current.settings).toEqual(previous.settings);
      expect(current.linterOptions).toEqual(previous.linterOptions);
      expect(current.languageOptions.globals).toEqual(previous.languageOptions.globals);
      expect(Object.keys(current.plugins).sort()).toEqual(Object.keys(previous.plugins).sort());
      expect(current.rules[RULE]).toBeUndefined();
      expect(current.plugins[PLUGIN]).toBeUndefined();
      const source = 'import "node:fs"; void process.env.SYNTHETIC_PRIVATE_SOURCE_DETAIL;';
      expect(targetMessages(await lint(source, file))).toEqual(targetMessages(await lint(source, file, baseline)));
    });

  it.each([".next/synthetic.ts", "out/synthetic.ts", "build/synthetic.ts", "next-env.d.ts"])(
    "retains the existing ignored output %s", async file => {
      expect(await actual.isPathIgnored(absolute(file))).toBe(true);
      expect(await baseline.isPathIgnored(absolute(file))).toBe(true);
    });
});
