// Login step 6, sub-slice S6-8: the link seam's client (contract 21 Section
// 7.9; contract 25 Section 15 item 11; the composition gate that the
// identity bridge's LIB-020 records). The installed Supabase libraries run
// for real over a fake global fetch. Every value is synthetic. Nothing here
// reaches a network or a local Supabase stack: the configured host is a
// reserved name that cannot resolve, and the fetch fake throws on any request
// it does not expect.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, isDeepStrictEqual } from "node:util";

import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import * as contextBarrel from "../../context/index";
import * as supabaseBarrel from "../index";
import { createLoginIdentityBridge } from "../loginIdentityBridge";
import * as linkClientModule from "../loginLinkAdminClient";
import {
  LOGIN_LINK_ADMIN_CLIENT_UNAVAILABLE,
  createLoginLinkAdminClient,
} from "../loginLinkAdminClient";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const SUPABASE_URL = "http://supabase.invalid";
const SERVICE_KEY = "synthetic-service-role-key-s68-link";
const ANON_KEY = "synthetic-anon-key-s68-link";
const EMAIL = "explorer.s68@solmind.example";
const BOUND_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const LINK_TOKEN = "5f3a1c9e8b7d6a4f2e1c0b9a8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a";
const SENTINEL = "sentinel-s68-link-transport-detail";
const LINK_URL = `${SUPABASE_URL}/auth/v1/admin/generate_link`;

type Seen = Readonly<{
  url: string;
  method: string;
  apikey: string | null;
  authorization: string | null;
  body: unknown;
}>;

function linkAnswerBody(): Record<string, unknown> {
  return {
    id: BOUND_ID,
    aud: "authenticated",
    role: "authenticated",
    email: EMAIL,
    action_link: `${SUPABASE_URL}/auth/v1/verify?token=${LINK_TOKEN}&type=magiclink`,
    email_otp: "246810",
    hashed_token: LINK_TOKEN,
    redirect_to: "http://127.0.0.1:3000",
    verification_type: "magiclink",
  };
}

function jsonAnswer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
  });
}

// Every request the fetch fake refused. Checked empty after each test, so a
// request to an unexpected URL fails the test even where the code under test
// turns the fake's throw into an ordinary error answer.
const unexpectedRequests: string[] = [];

// Replaces the global fetch. `respond` decides each answer; a request to any
// URL the test did not name throws.
function stubFetch(respond: (seen: Seen) => Response | Promise<Response>, allowed: ReadonlyArray<string> = [LINK_URL]) {
  const requests: Seen[] = [];
  const send = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (!allowed.includes(url)) {
      unexpectedRequests.push(url);
      throw new Error("test setup: unexpected request");
    }
    const headers = new Headers(init?.headers);
    const seen: Seen = Object.freeze({
      url,
      method: init?.method ?? "GET",
      apikey: headers.get("apikey"),
      authorization: headers.get("authorization"),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    requests.push(seen);
    return respond(seen);
  });
  vi.stubGlobal("fetch", send);
  return { send, requests };
}

function textOf(value: unknown): string {
  return [String(value), JSON.stringify(value), inspect(value, { showHidden: true, depth: 6 })].join(" ");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const LINK_PARAMS = Object.freeze({ type: "magiclink" as const, email: EMAIL });

let stderrWrite: ReturnType<typeof vi.spyOn>;
let stdoutWrite: ReturnType<typeof vi.spyOn>;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason);
};

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
  stderrWrite = vi.spyOn(process.stderr, "write");
  stdoutWrite = vi.spyOn(process.stdout, "write");
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
  // The checks run in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  const unexpected = unexpectedRequests.splice(0);
  try {
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
    expect(stderrWrite.mock.calls.length === 0, "nothing was written to standard error").toBe(true);
    expect(stdoutWrite.mock.calls.length === 0, "nothing was written to standard output").toBe(true);
    expect(unhandled.length === 0, "no rejection was left unhandled").toBe(true);
    expect(unexpected).toEqual([]);
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

describe("loginLinkAdminClient - the link seam's client", () => {
  it("LLC-001 hands out one frozen object with only generateLink, and building it sends nothing", async () => {
    const { send } = stubFetch(() => jsonAnswer(200, linkAnswerBody()));
    const seam = createLoginLinkAdminClient();
    expect(Object.isFrozen(seam)).toBe(true);
    expect(Reflect.ownKeys(seam)).toEqual(["generateLink"]);
    expect(Object.getPrototypeOf(seam)).toBe(Object.prototype);
    expect(typeof seam.generateLink).toBe("function");
    await delay(20);
    expect(send.mock.calls.length === 0, "nothing was sent").toBe(true);
  });

  it("LLC-002 called the way the bridge calls it (Reflect.apply, with the handed-out object as `this`), it sends one POST with the service key and exactly the link request, and returns the library's answer", async () => {
    const { send, requests } = stubFetch(() => jsonAnswer(200, linkAnswerBody()));
    const seam = createLoginLinkAdminClient();
    const answer = (await Reflect.apply(seam.generateLink, seam, [LINK_PARAMS])) as {
      data: { properties: Record<string, unknown>; user: Record<string, unknown> };
      error: unknown;
    };
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      isDeepStrictEqual(requests, [
        {
          url: LINK_URL,
          method: "POST",
          apikey: SERVICE_KEY,
          authorization: `Bearer ${SERVICE_KEY}`,
          body: { type: "magiclink", email: EMAIL },
        },
      ]),
      "exactly one POST: the link request, with the service key and the email",
    ).toBe(true);
    expect(answer.error).toBeNull();
    expect(answer.data.user.id).toBe(BOUND_ID);
    expect(answer.data.properties.hashed_token === LINK_TOKEN, "the answer carries the link's token hash").toBe(true);
    expect(answer.data.properties.verification_type).toBe("magiclink");
    // A detached call works too: the library's own object is kept inside.
    const detached = seam.generateLink;
    expect(((await detached(LINK_PARAMS)) as { error: unknown }).error).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("LLC-003 serves the real identity bridge's Explorer exchange: the link request goes through this client, and the exchange holds", async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const segment = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    const accessToken = `${segment({ alg: "HS256", typ: "JWT" })}.${segment({
      aud: "authenticated",
      exp: issuedAt + 3600,
      iat: issuedAt,
      sub: BOUND_ID,
      role: "authenticated",
    })}.c3ludGhldGljLXNpZ25hdHVyZQ`;
    const VERIFY_URL = `${SUPABASE_URL}/auth/v1/verify`;
    const LOGOUT_URL = `${SUPABASE_URL}/auth/v1/logout?scope=local`;
    const { requests } = stubFetch(
      (seen) => {
        if (seen.url === LINK_URL) {
          return jsonAnswer(200, linkAnswerBody());
        }
        if (seen.url === VERIFY_URL) {
          return jsonAnswer(200, {
            access_token: accessToken,
            token_type: "bearer",
            expires_in: 3600,
            expires_at: issuedAt + 3600,
            refresh_token: "synthetic-refresh-s68-link",
            user: { id: BOUND_ID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: {}, user_metadata: {} },
          });
        }
        return new Response(null, { status: 204 });
      },
      [LINK_URL, VERIFY_URL, LOGOUT_URL],
    );
    const signal = vi.fn();
    const bridge = createLoginIdentityBridge(
      { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, authCookieName: "solmind-auth", providerTimeoutMilliseconds: 2_000 },
      { fetch: (input, init) => fetch(input, init), linkAdmin: createLoginLinkAdminClient(), signalCleanupFailure: signal },
    );
    const result = await bridge.exchangeExplorerLink({ email: EMAIL, boundProviderUserId: BOUND_ID });
    expect(result.outcome).toBe("held");
    expect(requests.map((request) => request.url)).toEqual([LINK_URL, VERIFY_URL]);
    // The link request carried the service key; the exchange carried the anon key.
    expect(requests[0].authorization === `Bearer ${SERVICE_KEY}`, "the link request carried the service key").toBe(true);
    expect(requests[1].apikey === ANON_KEY, "the exchange carried the anon key").toBe(true);
    expect(
      isDeepStrictEqual(requests[1].body, { token_hash: LINK_TOKEN, type: "email", gotrue_meta_security: {} }),
      "the exchange carried only the link's token hash",
    ).toBe(true);
    if (result.outcome === "held") {
      expect(await result.hold.discard()).toEqual({ outcome: "discarded", cleanup: "cleaned" });
    }
    expect(requests.map((request) => request.url)).toEqual([LINK_URL, VERIFY_URL, LOGOUT_URL]);
    expect(signal).not.toHaveBeenCalled();
  });

  it("LLC-004 a fetch that rejects with a sentinel-bearing error, at once or late, becomes the fixed 503: the library returns an error, nothing is logged and nothing is left unhandled", async () => {
    for (const lateMilliseconds of [0, 60]) {
      const { send } = stubFetch(
        () =>
          new Promise<Response>((_resolve, reject) => {
            const fail = () => reject(new TypeError(`fetch failed: ${SENTINEL}`));
            if (lateMilliseconds === 0) {
              fail();
            } else {
              setTimeout(fail, lateMilliseconds);
            }
          }),
      );
      const seam = createLoginLinkAdminClient();
      const answer = (await Reflect.apply(seam.generateLink, seam, [LINK_PARAMS])) as {
        data: { properties: unknown; user: unknown };
        error: { status?: number } | null;
      };
      expect(send, String(lateMilliseconds)).toHaveBeenCalledTimes(1);
      expect(answer.error, String(lateMilliseconds)).not.toBeNull();
      expect(answer.error?.status, String(lateMilliseconds)).toBe(503);
      expect(answer.data, String(lateMilliseconds)).toEqual({ properties: null, user: null });
      // The rejection's own text is in no part of the answer.
      expect(textOf(answer), String(lateMilliseconds)).not.toContain(SENTINEL);
      await delay(30);
      vi.unstubAllGlobals();
    }
  });

  it("LLC-005 a synchronous throw inside fetch is the same fixed 503, with nothing logged", async () => {
    const send = vi.fn((): Promise<Response> => {
      throw new TypeError(`fetch failed: ${SENTINEL}`);
    });
    vi.stubGlobal("fetch", send);
    const seam = createLoginLinkAdminClient();
    const answer = (await Reflect.apply(seam.generateLink, seam, [LINK_PARAMS])) as { error: { status?: number } | null };
    expect(send).toHaveBeenCalledTimes(1);
    expect(answer.error?.status).toBe(503);
    expect(textOf(answer)).not.toContain(SENTINEL);
  });

  it("LLC-006 a body that fails while it is read, carrying a sentinel, logs nothing; the library returns an error and no link", async () => {
    const { send } = stubFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.error(new Error(`body failed: ${SENTINEL}`));
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const seam = createLoginLinkAdminClient();
    const answer = (await Reflect.apply(seam.generateLink, seam, [LINK_PARAMS])) as {
      data: { properties: unknown; user: unknown };
      error: unknown;
    };
    expect(send).toHaveBeenCalledTimes(1);
    // Only the error's class and status are read, as booleans: the library's
    // error object can quote the failure's own message. At the installed
    // library version a body that fails while it is read becomes the
    // library's retryable-fetch error with status 0 (no HTTP status).
    const error = answer.error;
    expect(
      error instanceof Error && isAuthError(error),
      "LLC-006: the answer's error is the library's own error object",
    ).toBe(true);
    expect(
      isAuthRetryableFetchError(error) && error.status === 0,
      "LLC-006: the error is the library's retryable-fetch error, with no HTTP status",
    ).toBe(true);
    expect(answer.data).toEqual({ properties: null, user: null });
    await delay(30);
    // Nothing printed: the afterEach hook checks every console method and
    // both output streams.
  });

  it("LLC-007 an error answer from Supabase Auth is returned as an error, with one request and nothing logged", async () => {
    const statuses = [400, 401, 404, 422, 500, 503];
    for (const [index, status] of statuses.entries()) {
      // A fixed label: the test's id and the case's number, and nothing of
      // the error, whose message can quote the answer's own text.
      const label = `LLC-007: case ${index + 1} of ${statuses.length}`;
      const { send } = stubFetch(() => jsonAnswer(status, { code: "unexpected_failure", msg: SENTINEL }));
      const seam = createLoginLinkAdminClient();
      const answer = (await Reflect.apply(seam.generateLink, seam, [LINK_PARAMS])) as { error: unknown };
      const error = answer.error;
      expect(
        error instanceof Error && isAuthError(error),
        `${label}, the answer's error is the library's own error object`,
      ).toBe(true);
      // The library's class for the answer's status: its retryable-fetch
      // error for a 5xx answer, its API error for the others.
      expect(
        status >= 500 ? isAuthRetryableFetchError(error) : isAuthApiError(error),
        `${label}, the error is the library's class for that answer's status`,
      ).toBe(true);
      expect(
        isAuthError(error) && error.status === status,
        `${label}, the error carries the answer's HTTP status`,
      ).toBe(true);
      expect(send, String(status)).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    }
  });

  it("LLC-008 a missing or blank setting gives one fixed, value-free error, and nothing is sent", async () => {
    const { send } = stubFetch(() => jsonAnswer(200, linkAnswerBody()));
    const settings = [
      ["SUPABASE_SERVICE_ROLE_KEY", ""],
      ["SUPABASE_SERVICE_ROLE_KEY", "   "],
      ["NEXT_PUBLIC_SUPABASE_URL", ""],
      ["NEXT_PUBLIC_SUPABASE_URL", "not a url"],
    ] as const;
    for (const [index, [name, value]] of settings.entries()) {
      // A fixed label: the setting's name and the case's number, never the
      // setting's value and nothing of the error.
      const label = `${name}, case ${index + 1} of ${settings.length}`;
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
      vi.stubEnv(name, value);
      let thrown: unknown = null;
      try {
        createLoginLinkAdminClient();
      } catch (error) {
        thrown = error;
      }
      expect(thrown instanceof Error, `${label}: an Error was thrown`).toBe(true);
      expect(
        (thrown as Error).message === LOGIN_LINK_ADMIN_CLIENT_UNAVAILABLE,
        `${label}: the error is the one fixed message`,
      ).toBe(true);
      expect(textOf(thrown).includes(SERVICE_KEY), `${label}: the error holds the service key`).toBe(false);
      expect((thrown as Error).message.includes("SUPABASE"), `${label}: the error names a setting`).toBe(false);
    }
    await delay(20);
    expect(send.mock.calls.length === 0, "nothing was sent").toBe(true);
  });
});

describe("loginLinkAdminClient - module boundary (server-only, off the three checked barrels)", () => {
  function moduleText(): string {
    return fs.readFileSync(fileURLToPath(new URL("../loginLinkAdminClient.ts", import.meta.url)), "utf8");
  }

  it("LLB-001 starts with the server-only import, imports only the Supabase client factory and the server environment reader, carries its own browser guard, and does not load where a browser window exists", async () => {
    const text = moduleText();
    expect(text.startsWith('import "server-only";')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    const source = ts.createSourceFile("client.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports: string[] = [];
    source.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    });
    expect(imports).toEqual(["server-only", "@supabase/supabase-js", "./serverEnv"]);

    // The module's own guard, in its code.
    expect(text).toContain(
      '"SolMind server configuration error: the login link client must not be imported in browser code."',
    );
    expect(text).toContain('if (typeof window !== "undefined") {');
    // Where a browser window exists the import fails. The environment reader
    // it imports is evaluated first, so that module's guard is the one that
    // fires; either way nothing of this module loads.
    vi.resetModules();
    vi.stubGlobal("window", {});
    try {
      await expect(import("../loginLinkAdminClient")).rejects.toThrow(
        /^SolMind server configuration error: .+ must not be imported in browser code\.$/,
      );
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it("LLB-002 its own code logs nothing, reads no environment itself, makes one fetch call and one Auth admin call, and exports only its two runtime names", () => {
    const text = moduleText();
    // The code without its comments (no string in this file holds `//`).
    const code = text
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("//");
        return at < 0 ? line : line.slice(0, at);
      })
      .join("\n");
    expect(code).not.toMatch(
      /process\.|console\.|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|randomUUID|import\.meta|next\/|NEXT_PUBLIC_|SERVICE_ROLE|\.rpc\s*\(|\.from\s*\(/,
    );
    expect(code.match(/\bfetch\s*\(/g)).toEqual(["fetch("]);
    expect(code.match(/\.auth\.admin\b/g)).toEqual([".auth.admin"]);
    expect(code.match(/admin\.[A-Za-z]+\s*\(/g)).toEqual(["admin.generateLink("]);
    expect(code).not.toMatch(/createUser|deleteUser|listUsers|updateUserById|inviteUserByEmail|signOut|getUserById/);
    // The whole text, comments included, names no module another boundary
    // test guards.
    for (const name of [
      "loginIdentityBridge",
      "loginCookieWriter",
      "sessionCookiePolicy",
      "userSessionCreationCaller",
      "loginSessionDuration",
      "loginRouteConfiguration",
      "loginContactNormalizer",
      "verificationPepperSource",
      "verificationChallengeComposition",
      "verificationChallengeCallers",
      "verificationChallengeCallersCore",
      "verificationCode",
    ]) {
      expect(new RegExp(`\\b${name}\\b`).test(text), name).toBe(false);
    }
    expect(Object.keys(linkClientModule).sort()).toEqual(
      ["LOGIN_LINK_ADMIN_CLIENT_UNAVAILABLE", "createLoginLinkAdminClient"].sort(),
    );
  });

  it("LLB-003 is not exported from the three barrels checked: src/lib/solmind/auth/index.ts, src/lib/solmind/context/index.ts and src/lib/solmind/supabase/index.ts", () => {
    for (const exportedName of Object.keys(linkClientModule)) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    for (const barrel of [
      path.join(root, "lib", "solmind", "auth", "index.ts"),
      path.join(root, "lib", "solmind", "context", "index.ts"),
      path.join(root, "lib", "solmind", "supabase", "index.ts"),
    ]) {
      expect(fs.readFileSync(barrel, "utf8"), barrel).not.toContain("loginLinkAdminClient");
    }
  });
});
