// Login step 6, sub-slice S6-8: the route contract of the two Explorer
// sign-in routes (contract 25 Section 15 items 5 and 10: a client-supplied
// session id, role, purpose or return address is never used; the destination
// is one fixed constant). Pure: nothing here reaches a network, a database or
// a local Supabase stack.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import { SESSION_COOKIE_NO_STORE_HEADERS } from "../../auth/sessionCookiePolicy";
import * as contextBarrel from "../../context/index";
import * as contractModule from "../explorerSignInRouteContract";
import {
  EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED,
  EXPLORER_SIGN_IN_DENIED,
  EXPLORER_SIGN_IN_HOME_PATH,
  EXPLORER_SIGN_IN_INVALID_EMAIL,
  EXPLORER_SIGN_IN_RESPONSE_HEADERS,
  EXPLORER_SIGN_IN_ROUTE_PATHS,
  EXPLORER_SIGN_IN_SIGNED_IN,
  parseExplorerSignInSendBody,
  parseExplorerSignInVerifyBody,
} from "../explorerSignInRouteContract";
import * as supabaseBarrel from "../index";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const EMAIL = "explorer.s68@solmind.example";
const CHALLENGE_ID = "5d0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const CODE = "246810";

// Every key a hostile or mistaken page could add, each with a value that
// would matter if it were ever read.
const WIDENING_KEYS: ReadonlyArray<readonly [string, unknown]> = [
  ["role", "admin"],
  ["activeRoleContext", "guide"],
  ["requestedRoleContext", "admin"],
  ["userAccountId", "11111111-1111-4111-8111-111111111111"],
  ["accountId", "11111111-1111-4111-8111-111111111111"],
  ["sessionId", "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60"],
  ["userSessionId", "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60"],
  ["purpose", "role_reentry"],
  ["duration", 86_400],
  ["verifier", "svf1.synthetic"],
  ["returnTo", "https://attacker.example/after"],
  ["next", "//attacker.example"],
  ["redirect", "\\\\attacker.example"],
  ["destination", "/admin"],
  ["identifierType", "username"],
  ["providerUserId", "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01"],
];

function moduleText(): string {
  return fs.readFileSync(fileURLToPath(new URL("../explorerSignInRouteContract.ts", import.meta.url)), "utf8");
}

function sourceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  // The check runs in `try` and the restore in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
  } finally {
    vi.restoreAllMocks();
  }
});

describe("explorerSignInRouteContract - the body parsers (contract 25 Section 15 items 5 and 10)", () => {
  it("ERC-001 the send body is exactly { identifier }, a string, returned as a frozen copy", () => {
    const input = { identifier: EMAIL };
    const before = { identifier: EMAIL };
    const parsed = parseExplorerSignInSendBody(input);
    expect(isDeepStrictEqual(parsed, { identifier: EMAIL }), "the send body is returned with its one key").toBe(true);
    expect(Object.isFrozen(parsed)).toBe(true);
    // A copy: the result is another object than the body handed in (one flat
    // object with one string, nothing nested), and the body handed in is left
    // unfrozen and as it was.
    expect(parsed !== input, "ERC-001: the result is not the object handed in").toBe(true);
    expect(Object.isFrozen(input) === false, "ERC-001: the object handed in was not frozen").toBe(true);
    expect(isDeepStrictEqual(input, before), "ERC-001: the object handed in was not changed").toBe(true);
    // The text is passed through as typed: judging it is the normalizer's job.
    expect(parseExplorerSignInSendBody({ identifier: "  Not An Email  " })).toEqual({
      identifier: "  Not An Email  ",
    });
    expect(parseExplorerSignInSendBody({ identifier: "" })).toEqual({ identifier: "" });
    // A null-prototype object, as a frozen JSON value may be, is accepted too.
    const bare = Object.create(null) as Record<string, unknown>;
    bare.identifier = EMAIL;
    expect(
      isDeepStrictEqual(parseExplorerSignInSendBody(bare), { identifier: EMAIL }),
      "a null-prototype send body is accepted",
    ).toBe(true);
  });

  it("ERC-002 the send body is refused whole for a missing, non-string, inherited or accessor identifier, and for anything that is not a plain object", () => {
    const refused = [
      {},
      { identifier: null },
      { identifier: 42 },
      { identifier: [EMAIL] },
      { identifier: { value: EMAIL } },
      { email: EMAIL },
      { Identifier: EMAIL },
      null,
      undefined,
      EMAIL,
      42,
      [{ identifier: EMAIL }],
      new Map([["identifier", EMAIL]]),
      Object.create({ identifier: EMAIL }),
    ];
    for (const [index, body] of refused.entries()) {
      // A fixed label, the case's number: the bodies hold the email.
      expect(parseExplorerSignInSendBody(body) === null, `refused body ${index + 1} of ${refused.length}`).toBe(true);
    }
    let read = false;
    const accessor = Object.defineProperty({}, "identifier", {
      enumerable: true,
      get: () => {
        read = true;
        return EMAIL;
      },
    });
    expect(parseExplorerSignInSendBody(accessor) === null, "an accessor identifier is refused").toBe(true);
    expect(read).toBe(false);
    const hidden = Object.defineProperty({}, "identifier", { enumerable: false, value: EMAIL });
    expect(parseExplorerSignInSendBody(hidden) === null, "a non-enumerable identifier is refused").toBe(true);
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("sentinel-s68-proxy");
        },
      },
    );
    expect(parseExplorerSignInSendBody(hostile)).toBeNull();
  });

  it("ERC-003 a send body that carries a role, an account id, a session id, a purpose, a duration or a return address is refused whole", () => {
    for (const [key, value] of WIDENING_KEYS) {
      expect(parseExplorerSignInSendBody({ identifier: EMAIL, [key]: value }) === null, key).toBe(true);
    }
    // The verify route's own keys are not the send route's.
    expect(
      parseExplorerSignInSendBody({ identifier: EMAIL, challengeId: CHALLENGE_ID }) === null,
      "a send body with a selector is refused",
    ).toBe(true);
    expect(
      parseExplorerSignInSendBody({ identifier: EMAIL, code: CODE }) === null,
      "a send body with a code is refused",
    ).toBe(true);
    expect(
      parseExplorerSignInSendBody({ identifier: EMAIL, [Symbol("role")]: "admin" }) === null,
      "a send body with a symbol key is refused",
    ).toBe(true);
  });

  it("ERC-004 the verify body is exactly { identifier, challengeId, code }, all strings, returned as a frozen copy", () => {
    const input = { identifier: EMAIL, challengeId: CHALLENGE_ID, code: CODE };
    const before = { identifier: EMAIL, challengeId: CHALLENGE_ID, code: CODE };
    const parsed = parseExplorerSignInVerifyBody(input);
    expect(
      isDeepStrictEqual(parsed, { identifier: EMAIL, challengeId: CHALLENGE_ID, code: CODE }),
      "the verify body is returned with its three keys",
    ).toBe(true);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.keys(parsed as object).sort()).toEqual(["challengeId", "code", "identifier"]);
    // A copy: the result is another object than the body handed in (one flat
    // object with three strings, nothing nested), and the body handed in is
    // left unfrozen and as it was.
    expect(parsed !== input, "ERC-004: the result is not the object handed in").toBe(true);
    expect(Object.isFrozen(input) === false, "ERC-004: the object handed in was not frozen").toBe(true);
    expect(isDeepStrictEqual(input, before), "ERC-004: the object handed in was not changed").toBe(true);
    // The selector's and the code's forms are the redeeming caller's check.
    expect(
      isDeepStrictEqual(parseExplorerSignInVerifyBody({ identifier: EMAIL, challengeId: "not-a-uuid", code: "12" }), {
        identifier: EMAIL,
        challengeId: "not-a-uuid",
        code: "12",
      }),
      "a selector and a code of another form are passed through as typed",
    ).toBe(true);
  });

  it("ERC-005 the verify body is refused whole for a missing or non-string key, and for any added key", () => {
    const complete = { identifier: EMAIL, challengeId: CHALLENGE_ID, code: CODE };
    for (const missing of ["identifier", "challengeId", "code"] as const) {
      const body: Record<string, unknown> = { ...complete };
      delete body[missing];
      expect(parseExplorerSignInVerifyBody(body) === null, `without ${missing}`).toBe(true);
      for (const [index, wrong] of [null, 246810, [CODE], { value: CODE }, true].entries()) {
        // A fixed label, the case's number: some of the wrong values hold
        // the code.
        expect(
          parseExplorerSignInVerifyBody({ ...complete, [missing]: wrong }) === null,
          `${missing} with wrong value ${index + 1} of 5`,
        ).toBe(true);
      }
    }
    for (const [key, value] of WIDENING_KEYS) {
      expect(parseExplorerSignInVerifyBody({ ...complete, [key]: value }) === null, key).toBe(true);
    }
    for (const [index, body] of [null, undefined, "text", [complete], Object.create(complete)].entries()) {
      expect(
        parseExplorerSignInVerifyBody(body) === null,
        `a body that is not a plain object, ${index + 1} of 5`,
      ).toBe(true);
    }
  });
});

describe("explorerSignInRouteContract - the closed results, the destination and the headers", () => {
  it("ERC-006 the outward results are frozen constants from a closed set: the three failures carry nothing but their outcome, and the success carries its outcome and the fixed destination", () => {
    expect(EXPLORER_SIGN_IN_DENIED).toEqual({ outcome: "denied" });
    expect(EXPLORER_SIGN_IN_INVALID_EMAIL).toEqual({ outcome: "invalid_email" });
    expect(EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED).toEqual({ outcome: "code_not_accepted" });
    expect(EXPLORER_SIGN_IN_SIGNED_IN).toEqual({ outcome: "signed_in", destination: EXPLORER_SIGN_IN_HOME_PATH });
    for (const result of [
      EXPLORER_SIGN_IN_DENIED,
      EXPLORER_SIGN_IN_INVALID_EMAIL,
      EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED,
      EXPLORER_SIGN_IN_SIGNED_IN,
    ]) {
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(Object.keys(EXPLORER_SIGN_IN_SIGNED_IN)).toEqual(["outcome", "destination"]);
    // The serialized bodies, byte for byte.
    expect(JSON.stringify(EXPLORER_SIGN_IN_DENIED)).toBe('{"outcome":"denied"}');
    expect(JSON.stringify(EXPLORER_SIGN_IN_INVALID_EMAIL)).toBe('{"outcome":"invalid_email"}');
    expect(JSON.stringify(EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED)).toBe('{"outcome":"code_not_accepted"}');
    expect(JSON.stringify(EXPLORER_SIGN_IN_SIGNED_IN)).toBe(
      `{"outcome":"signed_in","destination":"${EXPLORER_SIGN_IN_HOME_PATH}"}`,
    );
  });

  it("ERC-007 the destination is one server constant: an app-internal path, written once, that no function of this module can change", () => {
    expect(EXPLORER_SIGN_IN_HOME_PATH).toMatch(/^\/[a-z][a-z0-9/-]*$/);
    expect(EXPLORER_SIGN_IN_HOME_PATH.startsWith("//")).toBe(false);
    expect(EXPLORER_SIGN_IN_HOME_PATH).not.toContain("\\");
    expect(EXPLORER_SIGN_IN_HOME_PATH).not.toContain(":");
    // The literal appears exactly once in the module's code.
    const source = ts.createSourceFile("contract.ts", moduleText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const literals: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node)) {
        literals.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(literals.filter((literal) => literal === EXPLORER_SIGN_IN_HOME_PATH)).toHaveLength(1);
    // No exported function takes a destination: the two parsers take one
    // argument each and return only the listed body keys.
    const functions = Object.entries(contractModule).filter(([, value]) => typeof value === "function");
    expect(functions.map(([name]) => name).sort()).toEqual([
      "parseExplorerSignInSendBody",
      "parseExplorerSignInVerifyBody",
    ]);
    for (const [, value] of functions) {
      expect(value as (...args: unknown[]) => unknown).toHaveLength(1);
    }
  });

  it("ERC-008 every answer's headers are the policy's three no-store headers and nosniff, as one frozen record", () => {
    const expected: Record<string, string> = {};
    for (const header of SESSION_COOKIE_NO_STORE_HEADERS) {
      expected[header.name] = header.value;
    }
    expected["X-Content-Type-Options"] = "nosniff";
    expect(EXPLORER_SIGN_IN_RESPONSE_HEADERS).toEqual(expected);
    expect(Object.isFrozen(EXPLORER_SIGN_IN_RESPONSE_HEADERS)).toBe(true);
    expect(Object.keys(EXPLORER_SIGN_IN_RESPONSE_HEADERS).sort()).toEqual([
      "Cache-Control",
      "Expires",
      "Pragma",
      "X-Content-Type-Options",
    ]);
    expect(EXPLORER_SIGN_IN_RESPONSE_HEADERS["Cache-Control"]).toContain("no-store");
  });

  it("ERC-009 the two route paths are the two route files' own locations", () => {
    expect(EXPLORER_SIGN_IN_ROUTE_PATHS).toEqual({ send: "/login/explorer/send", verify: "/login/explorer/verify" });
    expect(Object.isFrozen(EXPLORER_SIGN_IN_ROUTE_PATHS)).toBe(true);
    const appRoot = path.join(sourceRoot(), "app");
    for (const routePath of Object.values(EXPLORER_SIGN_IN_ROUTE_PATHS)) {
      expect(fs.existsSync(path.join(appRoot, ...routePath.split("/").filter(Boolean), "route.ts")), routePath).toBe(true);
    }
    // And no other route handler sits under /login/explorer.
    const handlers: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(entryPath);
        } else if (/^route\.[cm]?[jt]sx?$/.test(entry.name)) {
          handlers.push(path.relative(appRoot, entryPath).split(path.sep).join("/"));
        }
      }
    };
    walk(path.join(appRoot, "login"));
    expect(handlers.sort()).toEqual(["login/explorer/send/route.ts", "login/explorer/verify/route.ts"]);
  });
});

describe("explorerSignInRouteContract - module boundary (server-only, off the three checked barrels)", () => {
  it("ERB-001 starts with the server-only import, imports only the session-cookie policy besides it, and is pure", () => {
    const text = moduleText();
    expect(text.startsWith('import "server-only";')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    const source = ts.createSourceFile("contract.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports: string[] = [];
    source.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    });
    expect(imports).toEqual(["server-only", "../auth/sessionCookiePolicy"]);
    expect(text).not.toMatch(
      /process\.|console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|randomUUID|Date\.now|performance\.now|setTimeout|import\.meta|next\/|@supabase|\.rpc\s*\(/,
    );
    expect(Object.keys(contractModule).sort()).toEqual(
      [
        "EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED",
        "EXPLORER_SIGN_IN_DENIED",
        "EXPLORER_SIGN_IN_HOME_PATH",
        "EXPLORER_SIGN_IN_INVALID_EMAIL",
        "EXPLORER_SIGN_IN_RESPONSE_HEADERS",
        "EXPLORER_SIGN_IN_ROUTE_PATHS",
        "EXPLORER_SIGN_IN_SIGNED_IN",
        "parseExplorerSignInSendBody",
        "parseExplorerSignInVerifyBody",
      ].sort(),
    );
  });

  it("ERB-002 is not exported from the three barrels checked: src/lib/solmind/auth/index.ts, src/lib/solmind/context/index.ts and src/lib/solmind/supabase/index.ts", () => {
    for (const exportedName of Object.keys(contractModule)) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    for (const barrel of [
      path.join(root, "lib", "solmind", "auth", "index.ts"),
      path.join(root, "lib", "solmind", "context", "index.ts"),
      path.join(root, "lib", "solmind", "supabase", "index.ts"),
    ]) {
      expect(fs.readFileSync(barrel, "utf8"), barrel).not.toContain("explorerSignInRouteContract");
    }
  });
});
