// In-memory framework/core integration only. Every assertion reports a fixed
// label and boolean; synthetic credentials and response contents stay private.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as handlers from "../passwordRoleSignInHttpHandlers";
import { type PasswordRoleSignInHttpPorts } from "../passwordRoleSignInHttpHandlers";
import { type PasswordRoleSignInPorts } from "../passwordRoleSignInCore";
import { createLoginIdentityBridge } from "../loginIdentityBridge";
import { PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS } from "../passwordRoleSignInRouteContract";

const ORIGIN = "http://127.0.0.1:4321";
const PRIVATE = "http-private-fixture-canary";
const PASSWORD = " \t" + PRIVATE + "\r\n";
const EMAIL = "stored@example.invalid";
const ID = { account: "11111111-1111-4111-8111-111111111111", contact: "22222222-2222-4222-8222-222222222222",
  provider: "33333333-3333-4333-8333-333333333333", challenge: "44444444-4444-4444-8444-444444444444",
  spare: "55555555-5555-4555-8555-555555555555", actual: "66666666-6666-4666-8666-666666666666",
  session: "77777777-7777-4777-8777-777777777777" };
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"] as const;

// Keep assertion helper source excerpts separate from synthetic private fixtures.
// The reporter may print neighboring lines even when the assertion is boolean.
// These blank lines are deliberate diagnostic isolation, not hidden values.




const yes = (value: boolean, label: string) => expect(value, label).toBe(true);
const same = (actual: unknown, expected: unknown, label: string) => yes(isDeepStrictEqual(actual, expected), label);




// Fixture construction follows outside the helper's reporter source excerpt.

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const OLD_TOKEN = "b2xk.cGFpci50b2tlbg.c2ln";
const OLD_VALUE = "base64-" + encode({ access_token: OLD_TOKEN, refresh_token: PRIVATE,
  expires_at: 2_000_000_000, solmind_pair_proof: "fixture-proof", user: null });
const hostile = () => Object.defineProperty({}, "message", { get() { throw new Error("error inspected"); } });

beforeEach(() => {
  for (const name of CONSOLE) vi.spyOn(console, name).mockImplementation(() => {});
  vi.stubGlobal("fetch", () => { throw new Error("network forbidden in HTTP fixture"); });
});
afterEach(() => {
  try { for (const name of CONSOLE) yes(vi.mocked(console[name]).mock.calls.length === 0, "no console output"); }
  finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});

type Stage = "lookup" | "ownership" | "password" | "redeem" | "assert" | "confirm" | "session" |
  "prepare" | "release" | "discard" | "wait" | "spare" | "issue";
function fixture() {
  const events: string[] = [];
  const calls = new Map<string, unknown[][]>();
  const fail = new Set<string>();
  const hooks: Partial<Record<Stage, (...args: unknown[]) => unknown>> = {};
  const answers: Partial<Record<Stage, unknown>> = {
    lookup: { outcome: "found", userAccountId: ID.account, userContactMethodId: ID.contact, normalizedEmail: EMAIL, providerUserId: ID.provider },
    ownership: { outcome: "owned" }, redeem: { outcome: "redeemed" }, assert: { outcome: "asserted" }, confirm: { outcome: "confirmed" },
    session: { outcome: "created", sessionId: ID.session, maxAgeSeconds: 120 },
    release: { outcome: "released", heldCookies: [{ name: "solmind-auth", value: PRIVATE }] },
    discard: { outcome: "discarded", cleanup: "cleaned" }, spare: { outcome: "invalid_request", challengeId: ID.spare },
    issue: { outcome: "issued", challengeId: ID.actual, delivery: "not_attempted" },
  };
  function call(stage: Stage, ...args: unknown[]) {
    events.push(stage); const list = calls.get(stage) ?? []; list.push(args); calls.set(stage, list);
    if (fail.has(stage)) throw hostile();
    return hooks[stage] ? hooks[stage](...args) : answers[stage];
  }
  const hold = { accessTokenExpiresAt: 2_000_000_000,
    assertProviderUser: (...args: unknown[]) => call("assert", ...args),
    prepareAcceptedSession: (...args: unknown[]) => call("prepare", ...args),
    release: (...args: unknown[]) => call("release", ...args), discard: (...args: unknown[]) => call("discard", ...args) };
  answers.password = { outcome: "held", hold };
  let issued = 0;
  const send = { accountLookup: { resolve: (...args: unknown[]) => call("lookup", ...args) },
    issuer: { issue: (...args: unknown[]) => call(issued++ === 0 ? "spare" : "issue", ...args) } };
  const verify = { accountLookup: send.accountLookup, ownership: { check: (...args: unknown[]) => call("ownership", ...args) },
    passwordFailureRecorder: { recordWrongPassword: async () => ({ outcome: "recorded" as const }) },
    bridge: { signInWithPassword: (...args: unknown[]) => call("password", ...args) },
    redeemer: { redeem: (...args: unknown[]) => call("redeem", ...args) },
    challengeConfirmation: { confirm: (...args: unknown[]) => call("confirm", ...args) },
    sessionCreator: { create: (...args: unknown[]) => call("session", ...args) } };
  const rawCore = { now: () => 1000, epochSeconds: () => 1_999_999_000,
    waitUntil: (...args: unknown[]) => call("wait", ...args), responseFloorMilliseconds: 1500,
    createSendDependencies: (origin: string) => { same(origin, ORIGIN, "trusted send origin"); events.push("send_dependencies"); return send; },
    createVerifyDependencies: (origin: string) => { same(origin, ORIGIN, "trusted verify origin"); events.push("verify_dependencies"); return verify; } };
  const core = rawCore as unknown as PasswordRoleSignInPorts;
  let incoming: unknown = [{ name: "solmind-auth", value: OLD_VALUE }, { name: "solmind-auth.9", value: "oldchunk" },
    { name: "solmind-auth-code-verifier.2", value: PRIVATE }, { name: "unrelated", value: PRIVATE }];
  let cleanupCandidate: unknown;
  const ports: PasswordRoleSignInHttpPorts = {
    loadTrustedOrigin: () => { events.push("origin"); return ORIGIN; },
    readCookies: () => { events.push("cookies"); return incoming; },
    createSendPorts: origin => { same(origin, ORIGIN, "send factory origin"); events.push("send_ports"); return core; },
    createVerifyPorts: (origin, candidate) => {
      same(origin, ORIGIN, "verify factory origin"); events.push("verify_ports"); cleanupCandidate = candidate; return core;
    },
  };
  return { events, calls, fail, hooks, answers, hold, verify, rawCore, core, ports,
    count: (stage: string) => calls.get(stage)?.length ?? 0,
    incoming: (value: unknown) => { incoming = value; }, candidate: () => cleanupCandidate };
}
type Fixture = ReturnType<typeof fixture>;
const cases = [
  { name: "guide send", role: "guide", verify: false, path: "/login/guide/send", run: handlers.handleGuideSignInSend },
  { name: "admin send", role: "admin", verify: false, path: "/login/admin/send", run: handlers.handleAdminSignInSend },
  { name: "guide verify", role: "guide", verify: true, path: "/login/guide/verify", run: handlers.handleGuideSignInVerify },
  { name: "admin verify", role: "admin", verify: true, path: "/login/admin/verify", run: handlers.handleAdminSignInVerify },
] as const;
type Case = typeof cases[number];
function body(c: Case): Record<string, unknown> {
  const identifier = c.role === "admin" ? "  ADMIN.User-1  " : "  Typed@Example.Invalid  ";
  return c.verify ? { identifier, password: PASSWORD, challengeId: ID.challenge, code: " \t" + PRIVATE } : { identifier };
}
function request(c: Case, value: unknown = body(c), options: { method?: string; path?: string; raw?: string;
  headers?: Record<string, string>; omitHeader?: string } = {}): NextRequest {
  const method = options.method ?? "POST";
  const headers: Record<string, string> = { origin: ORIGIN, "content-type": "application/json", "sec-fetch-site": "same-origin", ...options.headers };
  if (options.omitHeader) delete headers[options.omitHeader];
  return new NextRequest(ORIGIN + (options.path ?? c.path), { method, headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body: options.raw ?? JSON.stringify(value) }) });
}
function headers(response: NextResponse) {
  yes(response.status === 200, "fixed handler status");
  for (const [name, value] of Object.entries(PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS)) yes(response.headers.get(name) === value, "fixed refusal and success headers");
}
async function refusal(response: NextResponse, outcome: "denied" | "not_matched" = "denied") {
  headers(response); same(await response.json(), { outcome }, "exact fixed refusal body");
  yes(response.cookies.getAll().length === 0 && !response.headers.has("set-cookie") && !response.headers.has("x-middleware-set-cookie"), "fresh refusal is cookieless");
}
function stopped(f: Fixture) {
  same(f.events, ["origin"], "guard and parser rejection precedes cookies and port construction");
  yes(f.count("lookup") === 0 && f.count("password") === 0, "no remote edge after request refusal");
}

for (const c of cases) describe(c.name, () => {
  it("uses actual guard, parser, core and writer with the fixed role and destination", async () => {
    const f = fixture(); const response = await c.run(request(c), f.ports); headers(response);
    same(f.calls.get("lookup"), [[{ identifierType: c.role === "admin" ? "username" : "email",
      normalizedIdentifier: c.role === "admin" ? "admin.user-1" : "typed@example.invalid", requestedRoleContext: c.role }]], "fixed-role lookup");
    if (c.verify) {
      same(await response.json(), { outcome: "signed_in", destination: "/" + c.role + "/home" }, "fixed success destination");
      same(f.calls.get("password"), [[{ email: EMAIL, password: PASSWORD }]], "stored email and exact raw password");
      same(f.calls.get("redeem"), [[{ purpose: "login", challengeId: ID.challenge, code: " \t" + PRIVATE }]], "raw code and fixed purpose");
      same(f.candidate(), { accessToken: OLD_TOKEN, refreshToken: PRIVATE, proof: "fixture-proof" }, "candidate goes only to trusted factory");
      same(f.events, ["origin", "cookies", "verify_ports", "verify_dependencies", "lookup", "ownership", "password", "redeem", "assert", "confirm", "session", "prepare", "release"], "full fixed order");
      const cookies = response.cookies.getAll();
      yes(cookies.length === 4 && cookies.some(x => x.name === "solmind-auth" && x.value === PRIVATE && x.httpOnly && x.sameSite === "lax" && x.path === "/" && x.maxAge === 120), "real writer authenticates only with fresh held values");
      yes(cookies.some(x => x.name === "solmind-session" && x.value === ID.session && x.maxAge === 120), "real binding cookie");
      yes(cookies.filter(x => x.maxAge === 0).length === 2 && cookies.every(x => x.name !== "unrelated"), "names-only stale chunk clearing, unrelated cookie untouched");
    } else {
      same(await response.json(), { acknowledgment: "verification_code_requested", challengeId: ID.actual }, "opaque acknowledgment only");
      yes(!f.events.includes("cookies") && f.candidate() === undefined && response.cookies.getAll().length === 0 && !response.headers.has("set-cookie"), "send never reads or sets cookies");
      same(f.events, ["origin", "send_ports", "send_dependencies", "spare", "lookup", "issue", "wait"], "spare before lookup and refusal floor");
    }
  });
  for (const kind of ["method", "origin", "fetch-site", "media", "encoding", "length", "missing-origin", "query", "path", "json", "array", "extra", "type", "large"] as const) {
    it("refuses request boundary case " + kind + " before cookies and factories", async () => {
      const f = fixture(); let value: unknown = body(c); let options: Parameters<typeof request>[2] = {};
      if (kind === "method") options = { method: "GET" };
      if (kind === "origin") options = { headers: { origin: "https://other.invalid" } };
      if (kind === "fetch-site") options = { headers: { "sec-fetch-site": "cross-site" } };
      if (kind === "media") options = { headers: { "content-type": "text/plain" } };
      if (kind === "encoding") options = { headers: { "content-encoding": "gzip" } };
      if (kind === "length") options = { headers: { "content-length": "1" } };
      if (kind === "missing-origin") options = { omitHeader: "origin" };
      if (kind === "query") options = { path: c.path + "?role=admin" };
      if (kind === "path") options = { path: "/login/other/send" };
      if (kind === "json") options = { raw: "{" + PRIVATE };
      if (kind === "array") value = [];
      if (kind === "extra") value = { ...body(c), role: "admin" };
      if (kind === "type") value = { ...body(c), identifier: 1 };
      if (kind === "large") value = { ...body(c), identifier: "x".repeat(17000) };
      await refusal(await c.run(request(c, value, options), f.ports)); stopped(f);
    });
  }
  it("drops thrown origin and request guard values without inspecting or exposing them", async () => {
    const f = fixture(); const broken = { ...f.ports, loadTrustedOrigin: () => { throw hostile(); } };
    await refusal(await c.run(request(c), broken)); yes(f.events.length === 0, "origin failure before other ports");
    const r = request(c); Object.defineProperty(r, "headers", { get() { throw hostile(); } });
    await refusal(await c.run(r, f.ports)); stopped(f);
  });
  it("drops thrown trusted factory values and prevents later work", async () => {
    const f = fixture(); const broken = { ...f.ports,
      createSendPorts: () => { throw hostile(); }, createVerifyPorts: () => { throw hostile(); } };
    await refusal(await c.run(request(c), broken)); yes(f.count("lookup") === 0, "no lookup on port factory failure");
  });
});

for (const c of cases.filter(c => c.verify)) describe(c.name + " completion boundaries", () => {
  for (const stage of ["lookup", "ownership", "password", "redeem", "assert", "confirm"] as const) it("has identical public refusal for thrown " + stage, async () => {
    const f = fixture(); f.fail.add(stage); await refusal(await c.run(request(c), f.ports), "not_matched");
    same(f.calls.get("wait"), [[2500]], "same floor requested"); yes(f.count("session") === 0, "no session before both factors");
    if (stage === "ownership") yes(f.count("password") === 0, "ownership checked first");
    if (stage === "password") yes(f.count("redeem") === 0, "wrong password cannot consume challenge");
  });
  for (const stage of ["session", "prepare", "release"] as const) it("has fresh generic denial after thrown " + stage, async () => {
    const f = fixture(); f.fail.add(stage); await refusal(await c.run(request(c), f.ports));
    yes(f.count("discard") === 1, "held cleanup awaited after completion failure");
  });
  it("denies cookie read failure or malformed data before verify factory", async () => {
    const f = fixture(); await refusal(await c.run(request(c), { ...f.ports, readCookies: () => { throw hostile(); } }));
    yes(!f.events.includes("verify_ports"), "no factory after cookie exception");
    for (const value of [null, {}, [{ name: "x", value: 1 }]]) {
      const g = fixture(); g.incoming(value); await refusal(await c.run(request(c), g.ports)); yes(!g.events.includes("verify_ports"), "malformed cookie list refused before factory");
    }
  });
  it("treats absent or malformed old authentication as optional cleanup only", async () => {
    for (const incoming of [[], [{ name: "solmind-auth", value: "malformed" }], [{ name: "solmind-session", value: ID.session }]]) {
      const f = fixture(); f.incoming(incoming); const result = await c.run(request(c), f.ports);
      yes((await result.json()).outcome === "signed_in" && f.candidate() === null, "fresh factors do not depend on old cookie validity");
      yes(f.events.filter(x => x === "cookies").length === 1 && f.count("password") === 1, "cookies read once and fresh authentication still required");
    }
  });
  it("drops a partially written actual NextResponse and publishes a fresh cookieless denial", async () => {
    const f = fixture(); const made: NextResponse[] = []; let writes = 0;
    const original = NextResponse.json;
    vi.spyOn(NextResponse, "json").mockImplementation((value, init) => {
      const response = original(value, init); made.push(response);
      if ((value as { outcome?: string }).outcome === "signed_in") {
        const store = response.cookies;
        const set = store.set.bind(store);
        Object.defineProperty(response, "cookies", { value: {
          getAll: store.getAll.bind(store),
          set: (...args: Parameters<typeof set>) => {
            if (++writes === 2) throw hostile(); return set(...args);
          },
        } });
      }
      return response;
    });
    const response = await c.run(request(c), f.ports); await refusal(response);
    yes(writes === 2 && made.length === 2 && response !== made[0] && made[0].cookies.getAll().length === 1, "partial object is never returned");
    yes(f.count("discard") === 1, "discard follows failed actual cookie write");
  });
  it("replaces a thrown success response construction with a fresh denial", async () => {
    const f = fixture(); const original = NextResponse.json;
    vi.spyOn(NextResponse, "json").mockImplementation((value, init) => {
      if ((value as { outcome?: string }).outcome === "signed_in") throw hostile();
      return original(value, init);
    });
    await refusal(await c.run(request(c), f.ports)); yes(f.count("discard") === 1, "construction failure cleans held session");
  });
});

describe("closed handler edges", () => {
  it("preserves send-only invalid identifier results and rejects injected authority", async () => {
    for (const c of cases) {
      const f = fixture(); const response = await c.run(request(c, { ...body(c), identifier: "<bad>" }), f.ports);
      headers(response); same(await response.json(), { outcome: c.verify ? "denied" : c.role === "guide" ? "invalid_email" : "invalid_identifier" }, "typed input only");
      yes(f.count("lookup") === 0, "invalid typed identifier cannot select account");
      for (const key of ["password", "purpose", "userAccountId", "sessionId", "destination", "rememberBrowser"]) {
        if (c.verify && key === "password") continue;
        const g = fixture(); await refusal(await c.run(request(c, { ...body(c), [key]: PRIVATE }), g.ports)); stopped(g);
      }
    }
  });
  it("retains send acknowledgment through lookup, issue or waiter failure", async () => {
    for (const c of cases.filter(c => !c.verify)) for (const stage of ["lookup", "issue", "wait"] as const) {
      const f = fixture(); f.fail.add(stage); const response = await c.run(request(c), f.ports); headers(response);
      same(await response.json(), { acknowledgment: "verification_code_requested", challengeId: stage === "wait" ? ID.actual : ID.spare }, "prepared acknowledgment remains opaque");
      yes(!response.headers.has("set-cookie") && !f.events.includes("cookies"), "no cookie on failed send");
    }
  });
  it("matches complete status/header/body refusals across pre-factor stages", async () => {
    let prior: unknown;
    for (const c of cases.filter(c => c.verify)) for (const stage of ["lookup", "ownership", "password", "redeem", "assert", "confirm"] as const) {
      const f = fixture(); f.fail.add(stage); const r = await c.run(request(c), f.ports);
      const current = { status: r.status, headers: [...r.headers.entries()], body: await r.text() };
      if (prior !== undefined) same(current, prior, "identical outward refusal envelope"); prior = current;
    }
  });
  it("keeps exactly four fixed handlers and excludes environment, factories, IO and Explorer composition", () => {
    same(Object.keys(handlers).sort(), ["handleAdminSignInSend", "handleAdminSignInVerify", "handleGuideSignInSend", "handleGuideSignInVerify"], "closed public surface");
    const path = fileURLToPath(new URL("../passwordRoleSignInHttpHandlers.ts", import.meta.url));
    const tree = ts.createSourceFile(path, fs.readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let marker = false; let forbidden = false;
    const allowed = new Set(["server-only", "next/server", "../auth/sameOriginJsonWriteRequest", "../auth/sessionCookiePolicy",
      "./passwordRoleSignInBodies", "./passwordRoleSignInCore", "./passwordRoleSignInRouteContract"]);
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        if (node.moduleSpecifier.text === "server-only") marker = true;
        if (!allowed.has(node.moduleSpecifier.text)) forbidden = true;
      }
      if (ts.isIdentifier(node) && ["process", "fetch", "console", "require", "eval", "Function"].includes(node.text)) forbidden = true;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) forbidden = true;
      ts.forEachChild(node, visit);
    }
    visit(tree); yes(marker && !forbidden, "dormant direct-import boundary");
  });
});

describe("actual current bridge with injected in-memory Auth edge", () => {
  for (const c of cases.filter(c => c.verify)) it(c.name + " reaches complete cookie response with real current bridge and installed SSR", async () => {
    const f = fixture(); const epoch = Math.floor(Date.now() / 1000); const provider = "http://127.0.0.1:54321";
    const token = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ iss: provider + "/auth/v1", aud: "authenticated",
      sub: ID.provider, session_id: ID.session, exp: epoch + 3600, iat: epoch, role: "authenticated" }) + ".c3ludGhldGlj";
    let auth = 0; let cleanup = 0; let link = 0; let discard = 0; let cleanupCandidate: unknown;
    const ports = { ...f.ports, createVerifyPorts: (origin: string, candidate: Parameters<PasswordRoleSignInHttpPorts["createVerifyPorts"]>[1]) => {
      cleanupCandidate = candidate;
      const bridge = createLoginIdentityBridge({ supabaseUrl: provider, anonKey: "synthetic-http-key", authCookieName: "solmind-auth",
        providerTimeoutMilliseconds: 1000, credentialPairContext: { applicationOrigin: origin, providerIssuer: provider + "/auth/v1", providerAudience: "authenticated" } }, {
        fetch: (async (input, init) => {
          const url = new URL(String(input));
          if (url.pathname + url.search === "/auth/v1/token?grant_type=password") {
            auth++; const value = typeof init?.body === "string" ? JSON.parse(init.body) : null;
            same({ email: value?.email, password: value?.password }, { email: EMAIL, password: PASSWORD }, "real SSR receives fresh credentials only");
            return new Response(JSON.stringify({ access_token: token, refresh_token: PRIVATE, token_type: "bearer", expires_in: 3600,
              expires_at: epoch + 3600, user: { id: ID.provider, aud: "authenticated", role: "authenticated", email: EMAIL,
                app_metadata: { provider: "email" }, user_metadata: {} } }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.pathname + url.search === "/auth/v1/logout?scope=local") { discard++; return new Response(null, { status: 204 }); }
          throw new Error("unexpected synthetic Auth operation");
        }) as typeof fetch,
        linkAdmin: { generateLink: async () => { link++; return undefined; } },
        signalCleanupFailure: () => { throw new Error("unexpected cleanup failure"); },
        credentialPairProof: { mintTrustedPair: () => undefined, verifyPair: () => undefined },
        cleanupPriorSession: async () => {
          cleanup++; yes(f.count("session") === 1, "optional prior cleanup after accepted session");
          same(candidate, { accessToken: OLD_TOKEN, refreshToken: PRIVATE, proof: "fixture-proof" }, "captured candidate closure stays in trusted factory");
        },
      });
      f.verify.bridge.signInWithPassword = (...args: unknown[]) => bridge.signInWithPassword(args[0] as { email: string; password: string });
      f.rawCore.epochSeconds = () => epoch; return f.core;
    } };
    const response = await c.run(request(c), ports); headers(response);
    same(await response.json(), { outcome: "signed_in", destination: "/" + c.role + "/home" }, "actual bridge/core/writer completed");
    yes(auth === 1 && cleanup === 1 && link === 0 && discard === 0 && cleanupCandidate !== null, "fresh password flow and optional cleanup, no link or fresh revocation");
    yes(response.cookies.getAll().some(x => x.name === "solmind-auth" && x.value.startsWith("base64-")), "actual SSR-held authentication cookie published");
  });
});
