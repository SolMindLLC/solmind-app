// Login step 6, sub-slice S6-8: the server start hook and the login startup
// check of AUTH-RLS-DEC-032 (contract 25 Section 15 item 11 for what the hook
// may print). The hook's two files are imported for real; only the
// environment and standard error are stood in for. Nothing here starts a
// server, and nothing reaches a network, a database or a local Supabase
// stack.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const PEPPER_ENV = "SOLMIND_VERIFICATION_PEPPER";
// A synthetic pepper of 32 bytes, as base64url text. Never a real value.
const GOOD_PEPPER = Buffer.alloc(32, 0x5a).toString("base64url");
const SENTINEL = "sentinel-s68-startup-detail";
const CHECK_FAILED_LINE = "solmind_login_startup_check_failed\n";
const NOT_RUN_LINE = "solmind_login_startup_check_not_run\n";

let stderrLines: string[] = [];
let stdoutLines: string[] = [];

function text(name: string): string {
  return fs.readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");
}

// The file's code without its comments (no string in either file holds `//`).
function code(name: string): string {
  return text(name)
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf("//");
      return at < 0 ? line : line.slice(0, at);
    })
    .join("\n");
}

async function freshRegister(): Promise<() => Promise<void>> {
  vi.resetModules();
  return (await import("../instrumentation")).register;
}

// Whether a call of the hook returned a promise that resolved with nothing.
// The call is made once. What it returns must have a callable `then` before
// it is awaited, as the `.resolves` matcher this helper replaces required a
// promise: a hook that returned nothing without a promise gives false. A
// rejection's reason or a returned value is never handed to a matcher, so a
// failed check names neither. LSU-007 holds this helper's controls.
async function resolvesWithNothing(run: () => unknown): Promise<boolean> {
  try {
    const result = run();
    if (
      result === null ||
      (typeof result !== "object" && typeof result !== "function") ||
      typeof (result as { then?: unknown }).then !== "function"
    ) {
      return false;
    }
    return (await result) === undefined;
  } catch {
    return false;
  }
}

// Whether a call threw, and nothing of what it threw.
function throwsAnything(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

// Every export of a source file, by syntax, in source order: "default" for a
// declaration that carries both `export` and `default`, whatever name it
// gives itself (`export default function register` is "default", not
// "register"); otherwise the name of an exported function; "variable",
// "class", "enum" or "declaration" for any other declaration that carries the
// `export` modifier (a type, an interface, a namespace and an import-equals
// among them); "export declaration" for `export { ... }` and
// `export * from`; "export assignment" for `export default <expression>` and
// `export =`.
function exportsOf(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      found.push("export declaration");
    } else if (ts.isExportAssignment(node)) {
      found.push("export assignment");
    } else if (
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
        found.push("default");
      } else if (ts.isFunctionDeclaration(node)) {
        found.push(node.name?.text ?? "");
      } else if (ts.isVariableStatement(node)) {
        found.push("variable");
      } else if (ts.isClassDeclaration(node)) {
        found.push("class");
      } else if (ts.isEnumDeclaration(node)) {
        found.push("enum");
      } else {
        found.push("declaration");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
  stderrLines = [];
  stdoutLines = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrLines.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutLines.push(String(chunk));
    return true;
  });
  vi.stubEnv(PEPPER_ENV, GOOD_PEPPER);
  // The pepper source refuses to load while its public-name tripwire is set,
  // so the tests do not depend on this computer's own environment.
  vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

afterEach(() => {
  // The checks run in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
    expect(stdoutLines.length === 0, "nothing was written to standard output").toBe(true);
    // Whatever was written is one of the two fixed lines, and holds no value.
    for (const line of stderrLines) {
      expect(
        line === CHECK_FAILED_LINE || line === NOT_RUN_LINE,
        "standard error carries nothing but the two fixed lines",
      ).toBe(true);
    }
    expect(stderrLines.join("").includes(GOOD_PEPPER), "the pepper appears on standard error").toBe(false);
    expect(stderrLines.join("").includes(SENTINEL), "a caught value appears on standard error").toBe(false);
  } finally {
    vi.doUnmock("../instrumentation-node");
    vi.doUnmock("../lib/solmind/auth/loginRouteConfiguration");
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  }
});

describe("instrumentation - the login startup check at server start (AUTH-RLS-DEC-032)", () => {
  it("LSU-001 register loads the Node.js half and runs the check only in the Node.js runtime", async () => {
    // With no pepper the check fails, so a line shows that the check ran.
    vi.stubEnv(PEPPER_ENV, "");
    const runtimes = ["edge", "", "NODEJS", "node"];
    for (const [index, runtime] of runtimes.entries()) {
      // A fixed label, the case's number.
      const label = `LSU-001 runtime ${index + 1} of ${runtimes.length}`;
      vi.stubEnv("NEXT_RUNTIME", runtime);
      const register = await freshRegister();
      expect(await resolvesWithNothing(register), `${label}: register resolves with nothing`).toBe(true);
      expect(stderrLines.length === 0, `${label}: nothing is written to standard error`).toBe(true);
    }
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const register = await freshRegister();
    expect(await resolvesWithNothing(register), "LSU-001 the Node.js runtime: register resolves with nothing").toBe(true);
    expect(
      stderrLines.length === 1 && stderrLines[0] === CHECK_FAILED_LINE,
      "LSU-001 the Node.js runtime: standard error carries exactly the one failed-check line",
    ).toBe(true);
  });

  it("LSU-002 a missing or malformed pepper gives one fixed line, no throw and no value, and the hook returns", async () => {
    const peppers = ["", "too-short", `${GOOD_PEPPER}\n`, "*".repeat(43)];
    for (const [index, pepper] of peppers.entries()) {
      // A fixed label, the case's number: one of the candidates holds the
      // made-up pepper.
      const label = `LSU-002 pepper ${index + 1} of ${peppers.length}`;
      stderrLines = [];
      vi.stubEnv(PEPPER_ENV, pepper);
      const register = await freshRegister();
      expect(await resolvesWithNothing(register), `${label}: register resolves with nothing`).toBe(true);
      expect(
        stderrLines.length === 1 && stderrLines[0] === CHECK_FAILED_LINE,
        `${label}: standard error carries exactly the one failed-check line`,
      ).toBe(true);
    }
    // The public-name tripwire is a failed check too.
    stderrLines = [];
    vi.stubEnv(PEPPER_ENV, GOOD_PEPPER);
    vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", GOOD_PEPPER);
    const register = await freshRegister();
    expect(await resolvesWithNothing(register), "LSU-002 the public-name tripwire: register resolves with nothing").toBe(true);
    expect(
      stderrLines.length === 1 && stderrLines[0] === CHECK_FAILED_LINE,
      "LSU-002 the public-name tripwire: standard error carries exactly the one failed-check line",
    ).toBe(true);
  });

  it("LSU-003 any other throw from the check gives the same fixed line, and the error is never printed", async () => {
    const thrownValues = [new Error(SENTINEL), new TypeError(SENTINEL), SENTINEL, { message: SENTINEL }, null];
    for (const [index, thrown] of thrownValues.entries()) {
      // A fixed label, the case's number: the thrown values hold the
      // stand-in error text.
      const label = `LSU-003 thrown value ${index + 1} of ${thrownValues.length}`;
      stderrLines = [];
      vi.resetModules();
      vi.doMock("../lib/solmind/auth/loginRouteConfiguration", () => ({
        checkLoginVerificationConfigurationAtStartup: () => {
          throw thrown;
        },
      }));
      const register = (await import("../instrumentation")).register;
      expect(await resolvesWithNothing(register), `${label}: register resolves with nothing`).toBe(true);
      expect(
        stderrLines.length === 1 && stderrLines[0] === CHECK_FAILED_LINE,
        `${label}: standard error carries exactly the one failed-check line`,
      ).toBe(true);
      // The Node.js half by itself behaves the same and never throws.
      stderrLines = [];
      const { runLoginStartupCheck } = await import("../instrumentation-node");
      expect(throwsAnything(() => runLoginStartupCheck()), `${label}: the Node.js half throws`).toBe(false);
      expect(
        stderrLines.length === 1 && stderrLines[0] === CHECK_FAILED_LINE,
        `${label}: the Node.js half alone writes exactly the one failed-check line`,
      ).toBe(true);
      vi.doUnmock("../lib/solmind/auth/loginRouteConfiguration");
    }
  });

  it("LSU-004 a good pepper prints nothing, and the banked check is what ran", async () => {
    const register = await freshRegister();
    expect(await resolvesWithNothing(register), "LSU-004 a good pepper: register resolves with nothing").toBe(true);
    expect(stderrLines.length === 0, "LSU-004 a good pepper: nothing is written to standard error").toBe(true);

    vi.resetModules();
    const check = vi.fn();
    vi.doMock("../lib/solmind/auth/loginRouteConfiguration", () => ({
      checkLoginVerificationConfigurationAtStartup: check,
    }));
    const counted = (await import("../instrumentation")).register;
    await counted();
    // Called once, with no argument: the check reads its own environment.
    expect(
      check.mock.calls.length === 1 && check.mock.calls[0].length === 0,
      "LSU-004 the check was called exactly once, with no argument",
    ).toBe(true);
    expect(stderrLines.length === 0, "LSU-004 the counted check: nothing is written to standard error").toBe(true);
  });

  it("LSU-005 a throw while the Node.js half loads, or a half without the check, gives the other fixed line and the hook still returns", async () => {
    vi.resetModules();
    vi.doMock("../instrumentation-node", () => {
      throw new Error(SENTINEL);
    });
    const failing = (await import("../instrumentation")).register;
    expect(
      await resolvesWithNothing(failing),
      "LSU-005 a throw while the Node.js half loads: register resolves with nothing",
    ).toBe(true);
    expect(
      stderrLines.length === 1 && stderrLines[0] === NOT_RUN_LINE,
      "LSU-005 a throw while the Node.js half loads: standard error carries exactly the one not-run line",
    ).toBe(true);

    stderrLines = [];
    vi.resetModules();
    vi.doMock("../instrumentation-node", () => ({ runLoginStartupCheck: undefined }));
    const empty = (await import("../instrumentation")).register;
    expect(await resolvesWithNothing(empty), "LSU-005 a half without the check: register resolves with nothing").toBe(true);
    expect(
      stderrLines.length === 1 && stderrLines[0] === NOT_RUN_LINE,
      "LSU-005 a half without the check: standard error carries exactly the one not-run line",
    ).toBe(true);

    // A failing write is dropped too.
    stderrLines = [];
    vi.mocked(process.stderr.write).mockImplementation(() => {
      throw new Error(SENTINEL);
    });
    expect(await resolvesWithNothing(empty), "LSU-005 a failing write: register resolves with nothing").toBe(true);
    vi.doUnmock("../instrumentation-node");
    vi.resetModules();
    vi.stubEnv(PEPPER_ENV, "");
    const { runLoginStartupCheck } = await import("../instrumentation-node");
    expect(throwsAnything(() => runLoginStartupCheck()), "LSU-005 a failing write: the Node.js half throws").toBe(false);
  });

  it("LSU-006 the hook's own code: one literal import of the Node.js half, only the runtime name read from the environment, `register` its only export, and the two lines are constants", () => {
    const hook = code("instrumentation.ts");
    const source = ts.createSourceFile("instrumentation.ts", text("instrumentation.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const dynamicImports: Array<string | null> = [];
    const staticImports: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        dynamicImports.push(node.arguments.length === 1 && ts.isStringLiteralLike(argument) ? argument.text : null);
      } else if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        staticImports.push(node.moduleSpecifier.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    // Every export syntax is collected, not only functions and variables.
    const exported = exportsOf(source);
    // A control for the collector: one added export of each kind is seen.
    const control = ts.createSourceFile(
      "control.ts",
      [
        "export async function register(): Promise<void> {}",
        "export const added = 1;",
        "export class Added {}",
        "export enum AddedKind { One }",
        "export interface AddedShape { one: 1 }",
        "const local = 2;",
        "export { local };",
        'export * from "./other";',
        "export default local;",
      ].join("\n"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(
      isDeepStrictEqual(exportsOf(control), [
        "register",
        "variable",
        "class",
        "enum",
        "declaration",
        "export declaration",
        "export declaration",
        "export assignment",
      ]),
      "LSU-006 control: the collector sees one added export of each kind",
    ).toBe(true);
    // A second control: the named hook and a default-exported function that
    // calls itself `register` are told apart.
    const sourceOf = (text: string): ts.SourceFile =>
      ts.createSourceFile("control.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(
      isDeepStrictEqual(exportsOf(sourceOf("export async function register(): Promise<void> {}")), ["register"]) &&
        isDeepStrictEqual(exportsOf(sourceOf("export default async function register(): Promise<void> {}")), [
          "default",
        ]),
      "LSU-006 control: a named `register` export and a default-exported function named `register` are told apart",
    ).toBe(true);
    expect(dynamicImports).toEqual(["./instrumentation-node"]);
    expect(staticImports).toEqual([]);
    expect(exported).toEqual(["register"]);
    expect(hook.match(/process\.env[.[\w"']*/g)).toEqual(["process.env.NEXT_RUNTIME"]);
    expect(hook).toContain('process.env.NEXT_RUNTIME === "nodejs"');
    expect(hook).not.toMatch(/console\.|\bfetch\s*\(|import\.meta|\brequire\b/);

    const node = code("instrumentation-node.ts");
    expect(text("instrumentation-node.ts").startsWith('import "server-only";')).toBe(true);
    expect(node).not.toMatch(/process\.env|console\.|\bfetch\s*\(|import\.meta|\brequire\b/);
    expect(node.match(/checkLoginVerificationConfigurationAtStartup\(\)/g)).toEqual([
      "checkLoginVerificationConfigurationAtStartup()",
    ]);
    // Each write is of a named constant, never of a caught value.
    for (const file of [hook, node]) {
      expect(file).toMatch(/catch \{/);
      expect(file).not.toMatch(/catch \(/);
      for (const write of file.match(/process\.stderr\.write\([^)]*\)/g) ?? []) {
        expect(write).toMatch(/^process\.stderr\.write\(LOGIN_STARTUP_CHECK_(?:FAILED|NOT_RUN)_LINE\)$/);
      }
    }
    expect(hook).toContain(`"${NOT_RUN_LINE.trimEnd()}\\n"`);
    expect(node).toContain(`"${CHECK_FAILED_LINE.trimEnd()}\\n"`);
  });

  it("LSU-007 the test's own helper for the hook's promise: only a promise that resolves with nothing passes (controls)", async () => {
    // Controls for `resolvesWithNothing` (review #168f, finding R5-F01). Every
    // control value is a plain constant of this test, never a fixture.
    expect(
      await resolvesWithNothing(() => Promise.resolve(undefined)),
      "LSU-007 control 1: a promise resolved with nothing",
    ).toBe(true);
    expect(
      await resolvesWithNothing(() => undefined),
      "LSU-007 control 2: nothing returned, and no promise",
    ).toBe(false);
    expect(
      await resolvesWithNothing(() => Promise.resolve("control")),
      "LSU-007 control 3: a promise resolved with a value",
    ).toBe(false);
    expect(
      await resolvesWithNothing(() => Promise.reject(new Error("control"))),
      "LSU-007 control 4: a rejected promise",
    ).toBe(false);
    expect(
      await resolvesWithNothing(() => {
        throw new Error("control");
      }),
      "LSU-007 control 5: a throw before any promise",
    ).toBe(false);
    const thenable = {
      then(resolve: (value: undefined) => void): void {
        resolve(undefined);
      },
    };
    expect(
      await resolvesWithNothing(() => thenable),
      "LSU-007 control 6: an ordinary thenable resolved with nothing",
    ).toBe(true);
  });
});
