// Synthetic in-memory shape checks only. Failure diagnostics contain fixed labels
// and booleans; raw identifiers, password/code strings and thrown values stay out.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bodies from "../passwordRoleSignInBodies";
import { parsePasswordRoleSignInSendBody, parsePasswordRoleSignInVerifyBody } from "../passwordRoleSignInBodies";

const SENTINEL = "private-body-fixture-canary";
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const cases = [
  { name: "send", parse: parsePasswordRoleSignInSendBody, keys: ["identifier"], make: () => ({ identifier: SENTINEL }) },
  { name: "verify", parse: parsePasswordRoleSignInVerifyBody, keys: ["identifier", "password", "challengeId", "code"],
    make: () => ({ identifier: SENTINEL, password: SENTINEL, challengeId: SENTINEL, code: SENTINEL }) },
  { name: "flow send", parse: parsePasswordRoleSignInSendBody, keys: ["identifier", "flowId"],
    make: () => ({ identifier: SENTINEL, flowId: SENTINEL }) },
  { name: "flow verify", parse: parsePasswordRoleSignInVerifyBody, keys: ["identifier", "password", "flowId", "code"],
    make: () => ({ identifier: SENTINEL, password: SENTINEL, flowId: SENTINEL, code: SENTINEL }) },
] as const;

beforeEach(() => {
  for (const name of CONSOLE_METHODS) vi.spyOn(console, name).mockImplementation(() => {});
  vi.stubGlobal("fetch", () => { throw new Error("network forbidden in pure parser test"); });
});
afterEach(() => {
  try {
    for (const name of CONSOLE_METHODS) expect(vi.mocked(console[name]).mock.calls.length === 0, "no console sink").toBe(true);
  } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});

for (const c of cases) describe("passwordRoleSignInBodies: " + c.name, () => {
  it("accepts only the exact plain shape, returns a separate frozen copy and leaves input unchanged", () => {
    const input = c.make();
    const before = { ...input };
    const result = c.parse(input);
    expect(result !== input && Object.isFrozen(result) && isDeepStrictEqual(result, before), "exact independent frozen result").toBe(true);
    expect(isDeepStrictEqual(input, before) && !Object.isFrozen(input), "input untouched").toBe(true);
    input.identifier = "changed after parse";
    expect(result?.identifier === SENTINEL, "output detached from later input changes").toBe(true);
    expect(result !== null && Object.getPrototypeOf(result) === Object.prototype, "plain output").toBe(true);
  });

  it("accepts a null-prototype record and a frozen input", () => {
    for (const input of [Object.assign(Object.create(null), c.make()), Object.freeze(c.make())]) {
      const result = c.parse(input);
      expect(isDeepStrictEqual(result, c.make()) && Object.isFrozen(result), "accepted fixed shape").toBe(true);
    }
  });

  const rawStrings = ["", " ", "\t\r\n", "  Raw.Mixed@Example.Invalid  ", "non-uuid/non-code", "\0", "\ud800", "\udc00", "\u2028\u2029", "e\u0301", "\ud83d\ude00", "x".repeat(20_000)];
  for (let n = 0; n < rawStrings.length; n++) it("preserves raw string case " + n + " without semantic validation", () => {
    const input = Object.fromEntries(c.keys.map(key => [key, rawStrings[n]]));
    expect(isDeepStrictEqual(c.parse(input), input), "every raw string preserved exactly").toBe(true);
  });

  for (const key of c.keys) it("requires a primitive string and presence for field " + key, () => {
    const invalid: unknown[] = [null, undefined, 1, NaN, true, BigInt(1), Symbol("fixture"), {}, [], new String(SENTINEL), () => SENTINEL];
    for (const value of invalid) {
      expect(c.parse({ ...c.make(), [key]: value }) === null, "non-string field refused").toBe(true);
    }
    const missing: Record<string, unknown> = { ...c.make() }; delete missing[key];
    if (c.name === "flow send" && key === "flowId") expect(c.parse(missing)).toEqual({ identifier: SENTINEL });
    else expect(c.parse(missing) === null, "missing required field refused").toBe(true);
  });

  it("rejects nonrecords, arrays, class instances and inherited/custom shapes", () => {
    class Custom { identifier = SENTINEL; }
    const invalid: unknown[] = [null, undefined, SENTINEL, 0, true, BigInt(1), Symbol("fixture"), () => c.make(),
      [], Object.assign([], c.make()), new Date(0), new Custom(), Object.create(c.make()),
      Object.assign(Object.create({ inherited: true }), c.make())];
    for (const value of invalid) expect(c.parse(value) === null, "nonplain input refused").toBe(true);
  });

  it("rejects every additional own field, including symbols and nonenumerable fields", () => {
    for (const key of ["role", "purpose", "userAccountId", "sessionId", "destination", "rememberBrowser", "extra"]) {
      expect(c.parse({ ...c.make(), [key]: SENTINEL }) === null, "authority or extra field refused").toBe(true);
    }
    expect(c.parse({ ...c.make(), [Symbol("extra")]: SENTINEL }) === null, "symbol refused").toBe(true);
    const extra = c.make(); Object.defineProperty(extra, "hidden", { value: SENTINEL });
    expect(c.parse(extra) === null, "hidden extra field refused").toBe(true);
  });

  for (const key of c.keys) it("rejects accessor and nonenumerable descriptor for " + key + " without executing field code", () => {
    let calls = 0;
    for (const descriptor of [
      { enumerable: true, get() { calls++; return SENTINEL; } },
      { enumerable: true, set(_value: unknown) { void _value; calls++; } },
      { enumerable: false, value: SENTINEL },
    ]) {
      const input = c.make(); Object.defineProperty(input, key, descriptor);
      expect(c.parse(input) === null, "invalid descriptor refused").toBe(true);
    }
    expect(calls === 0, "field getter and setter never execute").toBe(true);
  });

  it("reads each data descriptor once and never executes an ordinary get trap", () => {
    const descriptorCalls = new Map<string | symbol, number>(); let gets = 0;
    const input = new Proxy(c.make(), {
      get() { gets++; throw new Error(SENTINEL); },
      getOwnPropertyDescriptor(target, key) {
        descriptorCalls.set(key, (descriptorCalls.get(key) ?? 0) + 1);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(isDeepStrictEqual(c.parse(input), c.make()), "descriptor-only snapshot accepted").toBe(true);
    expect(gets === 0 && c.keys.every(key => descriptorCalls.get(key) === 1), "one descriptor observation, no get").toBe(true);
  });

  it("fails closed on reflective throws or missing descriptors without inspecting thrown values", () => {
    let errorReads = 0;
    const thrown = new Proxy({}, { get() { errorReads++; throw new Error(SENTINEL); },
      getPrototypeOf() { errorReads++; throw new Error(SENTINEL); }, ownKeys() { errorReads++; throw new Error(SENTINEL); } });
    for (const traps of [
      { getPrototypeOf() { throw thrown; } }, { ownKeys() { throw thrown; } },
      { getOwnPropertyDescriptor() { throw thrown; } }, { getOwnPropertyDescriptor() { return undefined; } },
    ]) expect(c.parse(new Proxy(c.make(), traps)) === null, "reflection failure refused").toBe(true);
    const revoked = Proxy.revocable(c.make(), {}); revoked.revoke();
    expect(c.parse(revoked.proxy) === null, "revoked proxy refused").toBe(true);
    expect(errorReads === 0, "underlying thrown value untouched").toBe(true);
  });

  it("does not coerce objects or serialize fields", () => {
    let calls = 0;
    const value = { toString() { calls++; return SENTINEL; }, valueOf() { calls++; return SENTINEL; },
      toJSON() { calls++; return SENTINEL; }, [Symbol.toPrimitive]() { calls++; return SENTINEL; } };
    expect(c.parse({ ...c.make(), identifier: value }) === null, "coercible object refused").toBe(true);
    expect(calls === 0, "coercion and serialization hooks untouched").toBe(true);
  });
});

it("send refuses password and verify refuses the incomplete send shape", () => {
  expect(parsePasswordRoleSignInSendBody({ identifier: SENTINEL, password: SENTINEL }) === null, "send accepts no password").toBe(true);
  expect(parsePasswordRoleSignInVerifyBody({ identifier: SENTINEL }) === null, "verify needs all four fields").toBe(true);
});

it("flow and direct challenge shapes are distinct and mixed selectors are refused whole", () => {
  const flowSend = { identifier: SENTINEL, flowId: SENTINEL };
  const flowVerify = { ...flowSend, password: SENTINEL, code: SENTINEL };
  expect(parsePasswordRoleSignInSendBody({ ...flowSend, challengeId: SENTINEL }) === null, "mixed send refused").toBe(true);
  expect(parsePasswordRoleSignInVerifyBody({ ...flowVerify, challengeId: SENTINEL }) === null, "mixed verify refused").toBe(true);
  expect(parsePasswordRoleSignInVerifyBody({ identifier: SENTINEL, password: SENTINEL, code: SENTINEL }) === null, "missing both selectors refused").toBe(true);
  expect(parsePasswordRoleSignInVerifyBody({ ...flowVerify, role: "admin" }) === null, "flow adds no role authority").toBe(true);
  const parsed = parsePasswordRoleSignInVerifyBody(flowVerify);
  expect(parsed !== null && "flowId" in parsed && !("challengeId" in parsed), "flow stays explicit without fallback").toBe(true);
});

it("server-only module exposes only two parsers and imports no effect or product-policy dependency", () => {
  const text = fs.readFileSync(fileURLToPath(new URL("../passwordRoleSignInBodies.ts", import.meta.url)), "utf8");
  expect(text.startsWith('import "server-only";') && text.charCodeAt(0) !== 0xfeff, "server-only first import").toBe(true);
  const source = ts.createSourceFile("bodies.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = []; const names: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isIdentifier(node)) names.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(isDeepStrictEqual(imports, ["server-only"]), "only server-only import").toBe(true);
  expect(isDeepStrictEqual(Object.keys(bodies).sort(), ["parsePasswordRoleSignInSendBody", "parsePasswordRoleSignInVerifyBody"]), "only the two parser exports").toBe(true);
  const forbidden = ["process", "console", "fetch", "Date", "performance", "setTimeout", "localStorage", "sessionStorage", "document", "window", "eval", "Function"];
  expect(!names.some(name => forbidden.includes(name)), "no IO clock logging or dynamic execution reference").toBe(true);
});
