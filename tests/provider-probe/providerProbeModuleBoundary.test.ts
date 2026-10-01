import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// Enforces, with TypeScript's own parser, the module rules the provider-probe harness
// relies on:
// - seam-accepting (restricted) modules are reachable only from their named owners,
//   from the test-only support module and from the unit-test files named below;
// - every other test file (the integration file included) is probe-body code: it may
//   import only four listed production modules, the kernel and the listed `vitest`
//   names (never `vi`, a namespace or a default import), may load nothing
//   dynamically, may not use `import.meta`, `vi`, `vitest` or the module runner's
//   `__vite*` loaders, and obeys the identifier rules below (with `process.env`);
//   no test file may load a local or non-literal module dynamically;
// - only the named test files may import the names that issue receipts or add
//   run-owned recipients;
// - network, Supabase, file, console, process-output, global-fetch and dynamic-loading
//   capabilities appear only where listed, judged by identifier references (so
//   computed access, aliasing and destructuring are caught too);
// - every script file in the folder is classified, and the folder has no subfolder.

const FOLDER = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(FOLDER, "..", "..");
const KERNEL_CONFIG = "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
const KERNEL_EVIDENCE = "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";

type ModuleRule = Readonly<{
  kind: "production" | "restricted" | "test-support";
  // Non-test modules allowed to import this module (restricted modules only).
  importers?: readonly string[];
  // External specifiers this module may import. "type:" means type-only, and "fs:"
  // lists the only named fs imports allowed.
  external: readonly string[];
}>;

const MODULES: Readonly<Record<string, ModuleRule>> = {
  "providerProbeLocalRoot.ts": { kind: "production", external: ["node:path", "node:url"] },
  "providerProbeLoopbackCore.ts": {
    kind: "restricted",
    importers: ["providerProbeLoopbackFetch.ts", "providerProbeTestSupport.ts"],
    external: ["node:http", "type:node:net"],
  },
  "providerProbeLoopbackFetch.ts": { kind: "production", external: [KERNEL_CONFIG] },
  "providerProbeCleanupReceipts.ts": {
    kind: "restricted",
    importers: [
      "providerProbeCleanupLedger.ts",
      "providerProbeMailpitClient.ts",
      "providerProbeAuthAdminCore.ts",
      "providerProbeRunCore.ts",
      "providerProbeTestSupport.ts",
    ],
    external: [],
  },
  "providerProbeCleanupLedger.ts": {
    kind: "restricted",
    importers: [
      "providerProbeRunCore.ts",
      "providerProbeAuthAdminCore.ts",
      "providerProbeMailpitClient.ts",
      "providerProbeTestSupport.ts",
    ],
    external: [KERNEL_CONFIG, `type:${KERNEL_EVIDENCE}`],
  },
  "providerProbeRunEnvelope.ts": {
    kind: "production",
    external: ["node:crypto", "fs:readFileSync", "node:path", `type:${KERNEL_CONFIG}`, KERNEL_EVIDENCE],
  },
  "providerProbeMailpitClient.ts": {
    kind: "restricted",
    importers: ["providerProbeRunCore.ts", "providerProbeTestSupport.ts"],
    external: [`type:${KERNEL_CONFIG}`],
  },
  "providerProbeAuthAdminCore.ts": {
    kind: "restricted",
    importers: ["providerProbeRunCore.ts", "providerProbeTestSupport.ts"],
    external: ["node:crypto", `type:${KERNEL_CONFIG}`],
  },
  "providerProbeRunCore.ts": {
    kind: "restricted",
    importers: ["providerProbeRun.ts", "providerProbeTestSupport.ts"],
    external: ["@supabase/supabase-js", KERNEL_CONFIG],
  },
  "providerProbeEnvironment.ts": {
    kind: "production",
    external: ["fs:readFileSync", "node:path", `type:${KERNEL_CONFIG}`],
  },
  "providerProbeRun.ts": { kind: "production", external: [KERNEL_CONFIG] },
  "providerProbeSuiteGate.ts": { kind: "production", external: [KERNEL_CONFIG] },
  "providerProbeTestSupport.ts": { kind: "test-support", external: [KERNEL_CONFIG] },
};

// The only test files that may import restricted modules or the test-support module.
const UNIT_TEST_FILES = [
  "providerProbeAuthAdmin.test.ts",
  "providerProbeCleanupLedger.test.ts",
  "providerProbeEnvironment.test.ts",
  "providerProbeLoopbackFetch.test.ts",
  "providerProbeMailpitClient.test.ts",
  "providerProbeModuleBoundary.test.ts",
  "providerProbeRun.test.ts",
  "providerProbeRunEnvelope.test.ts",
  "providerProbeSuiteGate.test.ts",
];
// Names that issue receipts or add run-owned recipients, and the only test files
// that may import them. A namespace or default import counts as importing every name.
const ISSUING_NAMES = ["issueReceiptForTests", "issueCleanupReceipt", "addOwnedRecipientForTests", "addRunOwnedRecipient"];
const ISSUING_MODULES = ["providerProbeTestSupport.ts", "providerProbeCleanupReceipts.ts"];
const ISSUING_TEST_FILES = [
  "providerProbeAuthAdmin.test.ts",
  "providerProbeCleanupLedger.test.ts",
  "providerProbeMailpitClient.test.ts",
];
const INTEGRATION_FILE = "supabaseAuthProviderProbe.local.integration.test.ts";
// Every test file NOT named in UNIT_TEST_FILES (the integration file now, and any
// later probe-body file) is probe-body code. It may import only these local modules
// and the kernel, and from `vitest` only the named imports listed below. It loads
// nothing dynamically, uses no `import.meta` (Vite turns `import.meta.glob` into
// imports), and obeys the same identifier rules as non-test modules except that
// `process` may be used as `process.env`. Without `vi` (`vi.importActual`,
// `vi.importMock`, `vi.doMock`), `import.meta` or the module runner's `__vite*`
// loaders it cannot reach a transport, a client library or test support.
const PROBE_BODY_LOCAL_IMPORTS = [
  "providerProbeSuiteGate.ts",
  "providerProbeRun.ts",
  "providerProbeRunEnvelope.ts",
  "providerProbeEnvironment.ts",
];
const PROBE_BODY_EXTERNAL_IMPORTS = [KERNEL_CONFIG, KERNEL_EVIDENCE];
// The only `vitest` names a probe-body file may import, each as a named import.
const PROBE_BODY_VITEST_NAMES = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "expect", "it"];

// Identifiers non-test modules and probe-body test files may not reference as values
// at all, plus every identifier starting with `__vite` (the module runner's injected
// loaders, such as `__vite_ssr_dynamic_import__`). `vi` and `vitest` are listed for
// the case where Vitest globals are switched on. `process` is separate:
// `process.platform` only in non-test modules, and `process.env` only in probe-body
// test files.
const BANNED_IDENTIFIER_PREFIX = "__vite";
const BANNED_IDENTIFIERS = new Set([
  "globalThis",
  "global",
  "window",
  "self",
  "console",
  "Reflect",
  "fetch",
  "require",
  "eval",
  "Function",
  "WebSocket",
  "EventSource",
  "vi",
  "vitest",
]);

type ImportRecord = Readonly<{
  specifier: string;
  typeOnly: boolean;
  names: readonly string[];
  wholeModule: boolean;
  form: "import" | "export-from" | "export-star" | "dynamic-import" | "require" | "import-equals";
}>;

type Analysis = Readonly<{
  imports: readonly ImportRecord[];
  bannedReferences: readonly string[];
  // How each `process` reference is used: the property name after `process.`, or
  // "<other>" for any other use (computed access, aliasing, destructuring, passing it).
  processUses: readonly string[];
  // How each `import.meta` is used, in the same form (for example "url" or "glob").
  importMetaUses: readonly string[];
}>;

function processViolations(analysis: Analysis, allowedProperty: string): string[] {
  return analysis.processUses.filter((use) => use !== allowedProperty).map((use) => `process:${use}`);
}

// The probe-body import rule: only the four listed production modules, the kernel
// and the listed `vitest` names, each as a static import.
function probeBodyImportViolations(name: string, analysis: Analysis): string[] {
  const violations: string[] = [];
  for (const record of analysis.imports) {
    if (record.form !== "import" && record.form !== "export-from") {
      violations.push(`${name}: ${record.form} ${record.specifier}`);
      continue;
    }
    if (record.specifier === "vitest") {
      if (record.form !== "import") {
        violations.push(`${name}: vitest ${record.form}`);
      } else if (record.wholeModule || record.names.length === 0) {
        violations.push(`${name}: vitest whole module`);
      }
      for (const imported of record.names.filter((entry) => !PROBE_BODY_VITEST_NAMES.includes(entry))) {
        violations.push(`${name}: vitest name ${imported}`);
      }
      continue;
    }
    const target = localTarget(record.specifier);
    const allowed =
      target !== null ? PROBE_BODY_LOCAL_IMPORTS.includes(target) : PROBE_BODY_EXTERNAL_IMPORTS.includes(record.specifier);
    if (!allowed) {
      violations.push(`${name}: ${record.specifier}`);
    }
  }
  return violations;
}

// The probe-body reference rule: no banned identifier, no `import.meta`, and
// `process` only as `process.env`.
function probeBodyReferenceViolations(name: string, analysis: Analysis): string[] {
  return [
    ...analysis.bannedReferences,
    ...processViolations(analysis, "env"),
    ...analysis.importMetaUses.map((use) => `import.meta:${use}`),
  ].map((reference) => `${name}: ${reference}`);
}

function isInTypePosition(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (ts.isTypeNode(current)) {
      return true;
    }
    if (ts.isStatement(current) || ts.isExpression(current)) {
      return false;
    }
  }
  return false;
}

// True when this identifier is a name being declared or a property name, not a
// reference to a value.
function isNameNotReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (parent === undefined) {
    return false;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return true;
  }
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  if (ts.isBindingElement(parent) && (parent.propertyName === node || (parent.name === node && parent.propertyName !== undefined))) {
    return true;
  }
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) {
    return true;
  }
  if (ts.isQualifiedName(parent) || ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) {
    return true;
  }
  return isInTypePosition(node);
}

function analyze(fileName: string, text: string): Analysis {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: ImportRecord[] = [];
  const bannedReferences: string[] = [];
  const processUses: string[] = [];
  const importMetaUses: string[] = [];

  function literal(node: ts.Node | undefined): string {
    return node && ts.isStringLiteralLike(node) ? node.text : "<non-literal>";
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      const allTypeElements = named.length > 0 && named.every((element) => element.isTypeOnly);
      imports.push({
        specifier: literal(node.moduleSpecifier),
        typeOnly: !!clause && (clause.isTypeOnly || (allTypeElements && clause.name === undefined)),
        names: named.map((element) => (element.propertyName ?? element.name).text),
        wholeModule:
          !clause || clause.name !== undefined || (!!clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)),
        form: "import",
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [];
      imports.push({
        specifier: literal(node.moduleSpecifier),
        typeOnly: node.isTypeOnly,
        names: named.map((element) => (element.propertyName ?? element.name).text),
        wholeModule: !node.exportClause || ts.isNamespaceExport(node.exportClause),
        form: node.exportClause ? "export-from" : "export-star",
      });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      imports.push({
        specifier: literal(node.moduleReference.expression),
        typeOnly: node.isTypeOnly,
        names: [],
        wholeModule: true,
        form: "import-equals",
      });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      imports.push({ specifier: literal(node.arguments[0]), typeOnly: false, names: [], wholeModule: true, form: "dynamic-import" });
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      imports.push({ specifier: literal(node.arguments[0]), typeOnly: false, names: [], wholeModule: true, form: "require" });
    }
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      const parent = node.parent;
      importMetaUses.push(
        parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.expression === node
          ? parent.name.text
          : "<other>",
      );
    }
    if (ts.isIdentifier(node) && !isNameNotReference(node)) {
      if (BANNED_IDENTIFIERS.has(node.text) || node.text.startsWith(BANNED_IDENTIFIER_PREFIX)) {
        bannedReferences.push(node.text);
      } else if (node.text === "process") {
        const parent = node.parent;
        processUses.push(
          parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.expression === node
            ? parent.name.text
            : "<other>",
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return { imports, bannedReferences, processUses, importMetaUses };
}

const SCRIPT_EXTENSION = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

// The app-wide scan skips installed packages and every dot-directory (.git, .next,
// .vite-cache, and local tool output such as .codex-validation, whose copies of the
// app are not part of it).
function isSkippedDirectory(name: string): boolean {
  return name === "node_modules" || name.startsWith(".");
}

function isTestFile(name: string): boolean {
  return name.endsWith(".test.ts");
}

// Every relative specifier must be exactly `./<file in this folder>` (without its
// `.ts`) or one of the two kernel paths; anything else is a violation.
function checkLocalSpecifier(specifier: string, folderFiles: readonly string[]): "ok" | "violation" | "external" {
  if (!specifier.startsWith(".")) {
    return "external";
  }
  if (specifier === KERNEL_CONFIG || specifier === KERNEL_EVIDENCE) {
    return "ok";
  }
  const match = /^\.\/([A-Za-z0-9_.-]+)$/.exec(specifier);
  return match && !match[1]!.endsWith(".ts") && folderFiles.includes(`${match[1]}.ts`) ? "ok" : "violation";
}

function localTarget(specifier: string): string | null {
  return /^\.\/[A-Za-z0-9_.-]+$/.test(specifier) ? `${specifier.slice(2)}.ts` : null;
}

const ENTRIES = readdirSync(FOLDER, { withFileTypes: true });
const SUBDIRECTORIES = ENTRIES.filter((entry) => !entry.isFile()).map((entry) => entry.name);
const ALL_FILES = ENTRIES.filter((entry) => entry.isFile()).map((entry) => entry.name);
const FILES = ALL_FILES.filter((name) => SCRIPT_EXTENSION.test(name));
const ANALYSES = new Map(FILES.map((name) => [name, analyze(name, readFileSync(path.join(FOLDER, name), "utf8"))]));
const NON_TEST = FILES.filter((name) => !isTestFile(name));
const TEST_FILES = FILES.filter(isTestFile);

describe("provider-probe module boundary analyzer", () => {
  it("detects every import form", () => {
    const analysis = analyze(
      "sample.ts",
      [
        'import a from "m-default";',
        'import * as b from "m-namespace";',
        'import { c, type D } from "m-named";',
        'import type { E } from "m-type";',
        'import "m-side-effect";',
        'export { f } from "m-export";',
        'export * from "m-star";',
        'export type { G } from "m-export-type";',
        'import h = require("m-equals");',
        'const i = require("m-require");',
        'const j = await import("m-dynamic");',
      ].join("\n"),
    );

    expect(analysis.imports.map((record) => [record.specifier, record.form, record.typeOnly])).toEqual([
      ["m-default", "import", false],
      ["m-namespace", "import", false],
      ["m-named", "import", false],
      ["m-type", "import", true],
      ["m-side-effect", "import", false],
      ["m-export", "export-from", false],
      ["m-star", "export-star", false],
      ["m-export-type", "export-from", true],
      ["m-equals", "import-equals", false],
      ["m-require", "require", false],
      ["m-dynamic", "dynamic-import", false],
    ]);
  });

  it.each([
    ["console.log(1);", "console"],
    ['console["log"](1);', "console"],
    ["process.stdout.write('x');", "process"],
    ['process["stdout"].write("x");', "process"],
    ['process[`std${"out"}`].write("x");', "process"],
    ["const { stdout } = process;", "process"],
    ["const p = process; p.stdout.write('x');", "process"],
    ["process.env.SECRET;", "process"],
    ["fetch('x');", "fetch"],
    ["const f = fetch; f('x');", "fetch"],
    ["const options = { fetch };", "fetch"],
    ["globalThis.fetch('y');", "globalThis"],
    ['globalThis["fetch"]("y");', "globalThis"],
    ['global["process"].stdout;', "global"],
    ['window["fetch"]("y");', "window"],
    ["self.fetch('y');", "self"],
    ['Reflect.get(process, "stdout");', "Reflect"],
    ['require("node:http");', "require"],
    ['eval("process.stdout");', "eval"],
    ['new Function("return process")();', "Function"],
    ['new WebSocket("ws://127.0.0.1:1");', "WebSocket"],
    ['new EventSource("http://127.0.0.1:1");', "EventSource"],
  ])("flags the value reference in %s", (code, identifier) => {
    const analysis = analyze("fixture.ts", code);
    const flagged = [...analysis.bannedReferences, ...processViolations(analysis, "platform").map(() => "process")];
    expect(flagged).toContain(identifier);
  });

  it("records a dynamic import whose specifier is not a literal", () => {
    const analysis = analyze("fixture.ts", 'const m = await import(["./providerProbe", "TestSupport"].join(""));');

    expect(analysis.imports).toEqual([
      { specifier: "<non-literal>", typeOnly: false, names: [], wholeModule: true, form: "dynamic-import" },
    ]);
  });

  it("separates process.platform, process.env and every other process use", () => {
    const analysis = analyze("fixture.ts", 'process.platform; process.env.X; process["env"]; const p = process;');

    expect(analysis.processUses).toEqual(["platform", "env", "<other>", "<other>"]);
    expect(processViolations(analysis, "platform")).toEqual(["process:env", "process:<other>", "process:<other>"]);
    expect(processViolations(analysis, "env")).toEqual(["process:platform", "process:<other>", "process:<other>"]);
  });

  it("does not flag property names, declarations, types or process.platform", () => {
    const analysis = analyze(
      "fixture.ts",
      [
        "const platform = process.platform;",
        "const options = { global: { fetch: transport.fetch } };",
        "const fetchPage = input.fetch;",
        "type Fetcher = typeof fetch;",
        "function f(x: NodeJS.Platform): void {}",
        "interface Shape { fetch(): void; console: number }",
        "const { fetch: renamed } = input;",
        'const kind = typeof value === "function";',
      ].join("\n"),
    );
    expect(analysis.bannedReferences).toEqual([]);
    expect(processViolations(analysis, "platform")).toEqual([]);
  });

  it("flags every relative specifier that is not a file of this folder", () => {
    const folderFiles = ["providerProbeRun.ts", "providerProbeLoopbackCore.ts"];

    expect(checkLocalSpecifier("./providerProbeRun", folderFiles)).toBe("ok");
    expect(checkLocalSpecifier(KERNEL_CONFIG, folderFiles)).toBe("ok");
    expect(checkLocalSpecifier("@supabase/supabase-js", folderFiles)).toBe("external");
    for (const specifier of [
      "./sub/providerProbeLoopbackCore",
      "./providerProbeRun.ts",
      "./providerProbeMissing",
      "../provider-probe/providerProbeLoopbackCore",
      "../../src/lib/solmind/supabase/__tests__/other",
      ".",
      "./",
    ]) {
      expect(checkLocalSpecifier(specifier, folderFiles)).toBe("violation");
    }
  });
});

describe("provider-probe module boundary", () => {
  it("holds no subfolder and only README.md, classified modules and *.test.ts files", () => {
    expect(SUBDIRECTORIES).toEqual([]);
    expect(ALL_FILES.filter((name) => !SCRIPT_EXTENSION.test(name))).toEqual(["README.md"]);
    expect(FILES.filter((name) => !name.endsWith(".ts"))).toEqual([]);
  });

  it("classifies every non-test module, and every classified module exists", () => {
    expect([...NON_TEST].sort()).toEqual(Object.keys(MODULES).sort());
  });

  it("names unit-test files that exist, and never the integration file", () => {
    expect(UNIT_TEST_FILES.filter((name) => !TEST_FILES.includes(name))).toEqual([]);
    expect(ISSUING_TEST_FILES.filter((name) => !UNIT_TEST_FILES.includes(name))).toEqual([]);
    expect(UNIT_TEST_FILES).not.toContain(INTEGRATION_FILE);
    expect(TEST_FILES).toContain(INTEGRATION_FILE);
  });

  it("allows only `./<file of this folder>` and the two kernel paths as relative imports, in every file", () => {
    const violations: string[] = [];
    for (const name of FILES) {
      for (const record of ANALYSES.get(name)!.imports) {
        if (checkLocalSpecifier(record.specifier, FILES) === "violation") {
          violations.push(`${name}: ${record.specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("lets restricted modules be imported only by their named owners and the test-support module", () => {
    const violations: string[] = [];
    for (const importer of NON_TEST) {
      for (const record of ANALYSES.get(importer)!.imports) {
        const target = localTarget(record.specifier);
        const rule = target === null ? undefined : MODULES[target];
        if (target === null) {
          continue;
        }
        if (rule === undefined) {
          violations.push(`${importer} -> unknown ${target}`);
        } else if (rule.kind === "test-support") {
          violations.push(`${importer} -> test support`);
        } else if (rule.kind === "restricted" && !(rule.importers ?? []).includes(importer)) {
          violations.push(`${importer} -> restricted ${target}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("lets only the named unit-test files reach restricted modules or test support, and none load locally at run time", () => {
    const violations: string[] = [];
    for (const name of TEST_FILES) {
      for (const record of ANALYSES.get(name)!.imports) {
        const target = localTarget(record.specifier);
        if (
          ["dynamic-import", "require", "import-equals", "export-star"].includes(record.form) &&
          (record.specifier.startsWith(".") || record.specifier === "<non-literal>")
        ) {
          violations.push(`${name}: ${record.form} ${record.specifier}`);
        }
        if (target === null) {
          continue;
        }
        const rule = MODULES[target];
        if (rule !== undefined && rule.kind !== "production" && !UNIT_TEST_FILES.includes(name)) {
          violations.push(`${name} -> ${rule.kind} ${target}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("lets only the named test files import the names that issue receipts or add run-owned recipients", () => {
    const violations: string[] = [];
    for (const name of FILES) {
      for (const record of ANALYSES.get(name)!.imports) {
        const target = localTarget(record.specifier);
        if (target === null || !ISSUING_MODULES.includes(target)) {
          continue;
        }
        const issuing = record.wholeModule || record.names.some((imported) => ISSUING_NAMES.includes(imported));
        const allowed =
          ISSUING_TEST_FILES.includes(name) ||
          // The issuing modules' own production users, which the restricted-import rule already names.
          (!isTestFile(name) && MODULES[target]?.importers?.includes(name) === true);
        if (issuing && !allowed) {
          violations.push(`${name} -> ${target}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("allows external capabilities only where listed", () => {
    const violations: string[] = [];
    for (const name of NON_TEST) {
      const rule = MODULES[name]!;
      for (const record of ANALYSES.get(name)!.imports) {
        if (record.specifier.startsWith("./")) {
          continue;
        }
        if (["dynamic-import", "require", "import-equals", "export-star"].includes(record.form)) {
          violations.push(`${name}: ${record.form} ${record.specifier}`);
          continue;
        }
        if (record.specifier === "node:fs" || record.specifier === "fs") {
          const allowed = rule.external.filter((entry) => entry.startsWith("fs:")).map((entry) => entry.slice(3));
          if (record.wholeModule || record.names.length === 0 || record.names.some((imported) => !allowed.includes(imported))) {
            violations.push(`${name}: fs ${record.names.join(",")}`);
          }
          continue;
        }
        const permitted =
          rule.external.includes(record.specifier) ||
          (record.typeOnly && rule.external.includes(`type:${record.specifier}`));
        if (!permitted) {
          violations.push(`${name}: ${record.typeOnly ? "type " : ""}${record.specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps globals, console, process (other than process.platform) and global fetch out of every non-test module", () => {
    const violations = NON_TEST.flatMap((name) => {
      const analysis = ANALYSES.get(name)!;
      return [...analysis.bannedReferences, ...processViolations(analysis, "platform")].map(
        (reference) => `${name}: ${reference}`,
      );
    });
    expect(violations).toEqual([]);
  });

  describe("probe-body test files (every test file not named as a unit test)", () => {
    const PROBE_BODY_FILES = TEST_FILES.filter((name) => !UNIT_TEST_FILES.includes(name));

    it("include the integration file", () => {
      expect(PROBE_BODY_FILES).toContain(INTEGRATION_FILE);
    });

    it("import only the four listed production modules, the kernel and the listed vitest names, and load nothing dynamically", () => {
      const violations = PROBE_BODY_FILES.flatMap((name) => probeBodyImportViolations(name, ANALYSES.get(name)!));
      expect(violations).toEqual([]);
    });

    it("reference no banned identifier and no import.meta, and use process only as process.env", () => {
      const violations = PROBE_BODY_FILES.flatMap((name) => probeBodyReferenceViolations(name, ANALYSES.get(name)!));
      expect(violations).toEqual([]);
    });

    // Fixtures for the rule itself. The first three routes each loaded test support
    // from the integration file in a Vitest run of sip1 before this rule existed.
    it.each([
      [
        "vi.importActual (re-check #126c)",
        'import { describe, it, vi } from "vitest";\nawait vi.importActual("./providerProbeTestSupport");',
        ["probe.test.ts: vitest name vi", "probe.test.ts: vi"],
      ],
      [
        "import.meta.glob",
        'import.meta.glob("./providerProbeTestSupport.ts", { eager: true });',
        ["probe.test.ts: import.meta:glob"],
      ],
      [
        "the module runner's dynamic import",
        'await __vite_ssr_dynamic_import__("./providerProbeTestSupport");',
        ["probe.test.ts: __vite_ssr_dynamic_import__"],
      ],
      [
        "the module runner's static import",
        'await __vite_ssr_import__("./providerProbeTestSupport");',
        ["probe.test.ts: __vite_ssr_import__"],
      ],
      [
        "a renamed vi",
        'import { vi as loader } from "vitest";\nawait loader.importActual("./providerProbeTestSupport");',
        ["probe.test.ts: vitest name vi"],
      ],
      ["a namespace import of vitest", 'import * as runner from "vitest";\nvoid runner;', ["probe.test.ts: vitest whole module"]],
      ["a default import of vitest", 'import runner from "vitest";\nvoid runner;', ["probe.test.ts: vitest whole module"]],
      ["a side-effect import of vitest", 'import "vitest";', ["probe.test.ts: vitest whole module"]],
      ["a re-export of vi", 'export { vi } from "vitest";', ["probe.test.ts: vitest export-from", "probe.test.ts: vitest name vi"]],
      ["an unlisted vitest name", 'import { describe, test } from "vitest";', ["probe.test.ts: vitest name test"]],
      [
        "a global vi with no import (Vitest globals switched on)",
        'await vi.importActual("./providerProbeTestSupport");',
        ["probe.test.ts: vi"],
      ],
      ["an aliased import.meta", "const meta = import.meta;\nvoid meta;", ["probe.test.ts: import.meta:<other>"]],
      [
        "a non-literal import()",
        'await import(["./providerProbe", "TestSupport"].join(""));',
        ["probe.test.ts: dynamic-import <non-literal>"],
      ],
    ])("refuses %s", (_label, code, expected) => {
      const analysis = analyze("probe.test.ts", code);
      const violations = [
        ...probeBodyImportViolations("probe.test.ts", analysis),
        ...probeBodyReferenceViolations("probe.test.ts", analysis),
      ];
      for (const entry of expected) {
        expect(violations).toContain(entry);
      }
    });

    it("positive control: accepts every listed vitest name, a listed module and process.env", () => {
      const analysis = analyze(
        "probe.test.ts",
        [
          'import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";',
          'import { readProviderProbeSuiteState } from "./providerProbeSuiteGate";',
          "const suite = readProviderProbeSuiteState(process.env);",
          "beforeAll(() => undefined);",
          'describe("x", () => { it("y", () => { expect(suite).toBeDefined(); }); });',
          "afterEach(() => undefined);",
          "beforeEach(() => undefined);",
          "afterAll(() => undefined);",
        ].join("\n"),
      );

      expect(probeBodyImportViolations("probe.test.ts", analysis)).toEqual([]);
      expect(probeBodyReferenceViolations("probe.test.ts", analysis)).toEqual([]);
    });
  });

  it("is not imported from anywhere else in the app", () => {
    const offenders: string[] = [];
    let scanned = 0;
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const full = path.join(directory, entry);
        if (statSync(full).isDirectory()) {
          if (!isSkippedDirectory(entry) && path.resolve(full) !== path.resolve(FOLDER)) {
            walk(full);
          }
        } else if (SCRIPT_EXTENSION.test(entry)) {
          scanned += 1;
          const imports = analyze(entry, readFileSync(full, "utf8")).imports;
          if (imports.some((record) => record.specifier.includes("provider-probe"))) {
            offenders.push(path.relative(APP_ROOT, full));
          }
        }
      }
    };
    walk(APP_ROOT);
    // The walk covered the app root's own files (for example vitest.config.ts) and src/.
    expect(scanned).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
