// Fake-only orchestration checks. Every assertion emits fixed labels/booleans;
// synthetic credentials, identifiers, cookies and thrown values never reach diagnostics.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as core from "../passwordRoleSignInCore";
import { requestGuideSignInCode, requestAdminSignInCode, verifyGuideSignIn, verifyAdminSignIn,
  type PasswordRoleSignInPorts } from "../passwordRoleSignInCore";
import type { SessionCookieResponse } from "../loginCookieWriter";
import { createLoginIdentityBridge } from "../loginIdentityBridge";
import { VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES } from "../../auth/verificationChallengeCallers";
import { VERIFICATION_CODE_DELIVERY_OUTCOMES } from "../../auth/verificationCodeDelivery";

const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"] as const;
const PRIVATE = "private-core-fixture-canary";
const IDS = Object.freeze({ account: "11111111-1111-4111-8111-111111111111", contact: "22222222-2222-4222-8222-222222222222",
  provider: "33333333-3333-4333-8333-333333333333", challenge: "44444444-4444-4444-8444-444444444444",
  spare: "55555555-5555-4555-8555-555555555555", actual: "66666666-6666-4666-8666-666666666666",
  session: "77777777-7777-4777-8777-777777777777" });
const EMAIL = "stored@example.invalid";
const ORIGIN = "http://127.0.0.1:4321";
const PASSWORD = " \t" + PRIVATE + "\r\n";
const CODE = "" + PRIVATE;
const EXPIRY = 2_000_000_000;
const BEFORE_FACTORS = ["lookup", "ownership", "password", "redeem", "assert", "confirm"] as const;
const AFTER_HOLD = ["redeem", "assert", "confirm", "session", "prepare", "release", "response", "header", "cookie"] as const;
type Stage = "lookup" | "ownership" | "password" | "password_failure" | "redeem" | "assert" | "confirm" | "session" |
  "prepare" | "release" | "discard" | "response" | "header" | "cookie" | "wait" | "spare" | "issue";
const yes = (value: boolean, label: string) => expect(value, label).toBe(true);
const same = (actual: unknown, expected: unknown, label: string) => yes(isDeepStrictEqual(actual, expected), label);
const hostileError = () => Object.defineProperty({}, "message", { get() { throw new Error("error inspected"); } });

beforeEach(() => {
  for (const name of CONSOLE) vi.spyOn(console, name).mockImplementation(() => {});
  vi.stubGlobal("fetch", () => { throw new Error("network forbidden in core fixture"); });
});
afterEach(() => {
  try { for (const name of CONSOLE) yes(vi.mocked(console[name]).mock.calls.length === 0, "no console output"); }
  finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});

function fixture() {
  const events: string[] = [];
  const args = new Map<string, unknown[][]>();
  const fail = new Set<string>();
  const hooks: Partial<Record<Stage, (...args: unknown[]) => unknown>> = {};
  const answers: Partial<Record<Stage, unknown>> = {
    lookup: { outcome: "found", userAccountId: IDS.account, userContactMethodId: IDS.contact, normalizedEmail: EMAIL, providerUserId: IDS.provider },
    ownership: { outcome: "owned" }, password_failure: { outcome: "recorded" }, redeem: { outcome: "redeemed" }, assert: { outcome: "asserted" },
    confirm: { outcome: "confirmed" }, session: { outcome: "created", sessionId: IDS.session, maxAgeSeconds: 120 },
    release: { outcome: "released", heldCookies: [{ name: "solmind-auth", value: PRIVATE }] },
    discard: { outcome: "discarded", cleanup: "cleaned" },
    spare: { outcome: "invalid_request", challengeId: IDS.spare },
    issue: { outcome: "issued", challengeId: IDS.actual, delivery: "not_attempted" },
  };
  function call(stage: Stage, ...values: unknown[]): unknown {
    events.push(stage); const list = args.get(stage) ?? []; list.push(values); args.set(stage, list);
    if (fail.has(stage)) throw hostileError();
    return hooks[stage] ? hooks[stage](...values) : answers[stage];
  }
  const hold = {
    accessTokenExpiresAt: EXPIRY,
    assertProviderUser: (...values: unknown[]) => call("assert", ...values),
    prepareAcceptedSession: (...values: unknown[]) => call("prepare", ...values),
    release: (...values: unknown[]) => call("release", ...values),
    discard: (...values: unknown[]) => call("discard", ...values),
  };
  answers.password = { outcome: "held", hold };
  const response: SessionCookieResponse = {
    headers: { set: (...values: unknown[]) => call("header", ...values) },
    cookies: { set: (...values: unknown[]) => call("cookie", ...values) },
  };
  answers.response = response;
  let issueCalls = 0;
  const sendDependencies = {
    issuer: { issue: (...values: unknown[]) => call(issueCalls++ === 0 ? "spare" : "issue", ...values) },
    accountLookup: { resolve: (...values: unknown[]) => call("lookup", ...values) },
  };
  const verifyDependencies = {
    accountLookup: sendDependencies.accountLookup,
    ownership: { check: (...values: unknown[]) => call("ownership", ...values) },
    passwordFailureRecorder: { recordWrongPassword: (...values: unknown[]) => call("password_failure", ...values) },
    bridge: { signInWithPassword: (...values: unknown[]) => call("password", ...values) },
    redeemer: { redeem: (...values: unknown[]) => call("redeem", ...values) },
    challengeConfirmation: { confirm: (...values: unknown[]) => call("confirm", ...values) },
    sessionCreator: { create: (...values: unknown[]) => call("session", ...values) },
  };
  const rawPorts = {
    now: () => { events.push("now"); return 1000; },
    epochSeconds: () => { events.push("epoch"); return EXPIRY - 1000; },
    waitUntil: (...values: unknown[]) => call("wait", ...values), responseFloorMilliseconds: 1500,
    createSendDependencies: (): unknown => { events.push("configuration_send"); return sendDependencies; },
    createVerifyDependencies: (): unknown => { events.push("configuration_verify"); return verifyDependencies; },
  };
  const request = {
    trustedOrigin: ORIGIN,
    body: { identifier: "  Typed@Example.Invalid  ", password: PASSWORD, challengeId: IDS.challenge as string, code: CODE },
    requestCookies: [{ name: "solmind-auth.9", value: "" }, { name: "solmind-auth-code-verifier.2", value: "" }],
    createSuccessResponse: () => call("response") as SessionCookieResponse,
  };
  return { events, args, fail, hooks, answers, hold, response, sendDependencies, verifyDependencies, rawPorts, request,
    ports: rawPorts as unknown as PasswordRoleSignInPorts,
    count: (stage: string) => args.get(stage)?.length ?? 0,
    send: () => ({ trustedOrigin: request.trustedOrigin, body: { identifier: request.body.identifier } }),
  };
}
type Fixture = ReturnType<typeof fixture>;
const verifyCases = [{ name: "guide", role: "guide", run: verifyGuideSignIn }, { name: "admin", role: "admin", run: verifyAdminSignIn }] as const;
const sendCases = [{ name: "guide", role: "guide", run: requestGuideSignInCode }, { name: "admin", role: "admin", run: requestAdminSignInCode }] as const;
function refusal(f: Fixture, result: unknown, outcome: "denied" | "not_matched") {
  same(result, { outcome }, "exact value-free refusal");
  same(f.args.get("wait"), [[2500]], "same entry-based floor target");
}
function inaccessible(_outcome: string): object {
  void _outcome;
  return Object.defineProperty({}, "outcome", { enumerable: true, get() { throw hostileError(); } });
}

for (const c of sendCases) describe("fixed send: " + c.name, () => {
  it("prepares a spare before lookup and sends exactly once to stored email with both binding IDs", async () => {
    const f = fixture(); if (c.role === "admin") f.request.body.identifier = "  ADMIN.User-1  ";
    const result = await c.run(f.send(), f.ports);
    same(f.events, ["now", "configuration_send", "spare", "lookup", "issue", "wait"], "strict send order");
    same(f.args.get("spare"), [[{}]], "spare is invalid shape, not an unbound real issuance");
    same(f.args.get("lookup"), [[{ identifierType: c.role === "admin" ? "username" : "email", normalizedIdentifier: c.role === "admin" ? "admin.user-1" : "typed@example.invalid", requestedRoleContext: c.role }]], "fixed role and normalized typed identifier");
    same(f.args.get("issue"), [[{ purpose: "login", contactMethodType: "email", normalizedContact: EMAIL, userAccountId: IDS.account, userContactMethodId: IDS.contact }]], "server-derived issuance binding");
    same(result, { acknowledgment: "verification_code_requested", challengeId: IDS.actual }, "opaque acknowledgment only");
    yes(Object.isFrozen(result), "frozen acknowledgment"); yes(f.count("cookie") === 0 && f.count("password") === 0, "send never authenticates or sets cookies");
  });
  for (const stage of ["lookup", "issue", "wait"] as const) it("retains an acknowledgment after a thrown " + stage, async () => {
    const f = fixture(); f.fail.add(stage); const result = await c.run(f.send(), f.ports);
    same(result, { acknowledgment: "verification_code_requested", challengeId: stage === "wait" ? IDS.actual : IDS.spare }, "retained acknowledgment");
    yes(f.count("spare") === 1 && f.count("issue") <= 1 && f.count("wait") === 1, "no retry and floor attempted");
  });
  for (const status of VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES) it("exposes only the selector for issuance outcome " + status, async () => {
    const f = fixture(); f.answers.issue = status === "issued" ? { outcome: status, challengeId: IDS.actual, delivery: "accepted" } : { outcome: status, challengeId: IDS.actual };
    same(await c.run(f.send(), f.ports), { acknowledgment: "verification_code_requested", challengeId: IDS.actual }, "no issuance status exposed");
  });
  it("retains spare for no row and every malformed or failed lookup without attempting issuance", async () => {
    for (const value of [null, undefined, { outcome: "not_found" }, { outcome: "failed" }, {}, inaccessible("found"),
      { ...fixture().answers.lookup as object, userAccountId: IDS.account + "\n" }, { ...fixture().answers.lookup as object, extra: PRIVATE }]) {
      const f = fixture(); f.answers.lookup = value;
      same(await c.run(f.send(), f.ports), { acknowledgment: "verification_code_requested", challengeId: IDS.spare }, "retained spare");
      yes(f.count("issue") === 0, "no actual issuance for invalid lookup");
    }
  });
  it("retains spare for malformed issuer response and failed waiter", async () => {
    for (const value of [null, {}, inaccessible("issued"), { outcome: "issued", challengeId: IDS.actual },
      { outcome: "issued", challengeId: IDS.actual, delivery: "unknown" }, { outcome: "failed", challengeId: IDS.actual + "\n" },
      { outcome: "failed", challengeId: IDS.actual, detail: PRIVATE }, { outcome: "invented", challengeId: IDS.actual }]) {
      const f = fixture(); f.answers.issue = value; f.fail.add("wait");
      same(await c.run(f.send(), f.ports), { acknowledgment: "verification_code_requested", challengeId: IDS.spare }, "malformed result cannot replace spare");
      yes(f.count("spare") === 1 && f.count("issue") === 1, "exact issuance attempt count");
    }
  });
  it("does no lookup if configuration or spare preparation fails", async () => {
    for (const kind of ["configuration", "spare_throw", "spare_shape"] as const) {
      const f = fixture();
      if (kind === "configuration") f.rawPorts.createSendDependencies = () => { throw hostileError(); };
      if (kind === "spare_throw") f.fail.add("spare");
      if (kind === "spare_shape") f.answers.spare = null;
      same(await c.run(f.send(), f.ports), { outcome: "denied" }, "early closed refusal");
      yes(f.count("lookup") === 0 && f.count("issue") === 0 && f.count("wait") === 0, "no later account-sensitive work");
    }
  });
});

for (const c of verifyCases) describe("fixed verify: " + c.name, () => {
  for (const sessionOutcome of ["created", "existing"] as const) it("requires both factors and exact same-account confirmation before " + sessionOutcome + " session release", async () => {
    const f = fixture(); if (c.role === "admin") f.request.body.identifier = "  ADMIN.User-1  ";
    f.answers.session = { outcome: sessionOutcome, sessionId: IDS.session, maxAgeSeconds: 120 };
    const result = await c.run(f.request, f.ports);
    yes(result.outcome === "signed_in" && result.response === f.response && Object.isFrozen(result), "only complete original success response published");
    same(f.events, ["now", "configuration_verify", "lookup", "ownership", "password", "redeem", "assert", "confirm", "session", "now", "prepare", "now", "epoch", "release", "response", "header", "header", "header", "cookie", "cookie", "cookie", "cookie"], "complete security order");
    same(f.args.get("lookup"), [[{ identifierType: c.role === "admin" ? "username" : "email", normalizedIdentifier: c.role === "admin" ? "admin.user-1" : "typed@example.invalid", requestedRoleContext: c.role }]], "fixed role lookup");
    same(f.args.get("ownership"), [[{ userAccountId: IDS.account, challengeId: IDS.challenge }]], "exact non-consuming ownership pair");
    same(f.args.get("password"), [[{ email: EMAIL, password: PASSWORD }]], "stored email and unchanged password");
    same(f.args.get("redeem"), [[{ purpose: "login", challengeId: IDS.challenge, code: CODE }]], "exact atomic login redemption");
    same(f.args.get("assert"), [[IDS.provider]], "provider bound to account");
    same(f.args.get("confirm"), [[{ userAccountId: IDS.account, challengeId: IDS.challenge, expectedPurpose: "login" }]], "confirmation required after ownership and redemption");
    same(f.args.get("session"), [[{ userAccountId: IDS.account, activeRoleContext: c.role, challengeId: IDS.challenge, providerAccessTokenExpiresAt: EXPIRY }]], "fixed server session request");
    same(f.args.get("release"), [[{ sessionOutcome }]], "release uses actual accepted session outcome");
    same(f.args.get("prepare"), [[{ sessionOutcome }]], "preparation uses actual accepted session outcome");
    const writes = f.args.get("cookie") ?? [];
    yes(writes.length === 4 && writes[0][1] === "" && writes[1][1] === "" && writes[2][1] === PRIVATE && writes[3][1] === IDS.session, "actual banked writer clears stale names and sets binding");
    yes(f.count("discard") === 0 && f.count("wait") === 0, "success retains released identity without refusal wait");
  });
  for (const stage of BEFORE_FACTORS) it("common refusal after thrown " + stage + " kills the bypass to session", async () => {
    const f = fixture(); f.fail.add(stage); f.fail.add("wait");
    refusal(f, await c.run(f.request, f.ports), "not_matched");
    const index = BEFORE_FACTORS.indexOf(stage);
    for (const later of BEFORE_FACTORS.slice(index + 1)) yes(f.count(later) === 0, "later factor call suppressed");
    yes(f.count("session") === 0 && f.count("prepare") === 0 && f.count("release") === 0 && f.count("response") === 0, "no session or response after factor failure");
    yes(f.count("discard") === (index >= 3 ? 1 : 0), "cleanup only recoverable acquired hold");
  });
  const refusals: ReadonlyArray<readonly [Stage, unknown]> = [
    ["lookup", { outcome: "not_found" }], ["lookup", { outcome: "failed" }], ["ownership", { outcome: "not_owned" }],
    ["ownership", { outcome: "failed" }], ["password", { outcome: "credentials_refused" }], ["password", { outcome: "invalid_request" }],
    ["password", { outcome: "failed" }], ["redeem", { outcome: "denied" }], ["redeem", { outcome: "busy" }],
    ["redeem", { outcome: "invalid_request" }], ["redeem", { outcome: "failed" }], ["assert", { outcome: "denied" }],
    ["confirm", { outcome: "not_confirmed" }], ["confirm", { outcome: "failed" }],
  ];
  refusals.forEach(([stage, answer], index) => it("factor refusal branch " + index + " shares the floor and no-session contract", async () => {
    const f = fixture(); f.answers[stage] = answer;
    refusal(f, await c.run(f.request, f.ports), "not_matched");
    yes(f.count("session") === 0 && f.count("response") === 0 && f.count("cookie") === 0, "no factor bypass or response");
    if (stage === "ownership") yes(f.count("password") === 0 && f.count("redeem") === 0, "ownership precedes both secret checks");
    if (stage === "password") yes(f.count("redeem") === 0, "wrong password cannot consume code");
    yes(f.count("discard") === (["redeem", "assert", "confirm"].includes(stage) ? 1 : 0), "held cleanup awaited where held");
  }));
  for (const stage of AFTER_HOLD) it("throws at " + stage + " await discard and preserve factor-boundary result", async () => {
    const f = fixture(); f.fail.add(stage);
    refusal(f, await c.run(f.request, f.ports), ["redeem", "assert", "confirm"].includes(stage) ? "not_matched" : "denied");
    yes(f.count("discard") === 1, "exact cleanup on post-hold exception");
    yes(f.events.indexOf("discard") < f.events.indexOf("wait"), "cleanup precedes refusal wait");
    yes(f.count("session") <= 1, "session never retried");
  });
  for (const stage of ["ownership", "redeem", "assert", "confirm"] as const) it("malformed " + stage + " cannot count as factor proof", async () => {
    for (const value of [null, {}, inaccessible("accepted"), { outcome: "owned", extra: PRIVATE }, { outcome: "redeemed", extra: PRIVATE },
      { outcome: "asserted", extra: PRIVATE }, { outcome: "confirmed", extra: PRIVATE }, Object.create({ outcome: "confirmed" })]) {
      const f = fixture(); f.answers[stage] = value;
      refusal(f, await c.run(f.request, f.ports), "not_matched"); yes(f.count("session") === 0, "strict accepted shape only");
    }
  });
  it("rejects malformed session results, never releases and awaits discard", async () => {
    for (const answer of [{ outcome: "denied" }, { outcome: "failed" }, null, inaccessible("created"),
      { outcome: "created", sessionId: IDS.session + "\n", maxAgeSeconds: 120 },
      { outcome: "created", sessionId: IDS.session, maxAgeSeconds: 0 }, { outcome: "existing", sessionId: IDS.session, maxAgeSeconds: 3601 },
      { outcome: "created", sessionId: IDS.session, maxAgeSeconds: 120, extra: PRIVATE }]) {
      const f = fixture(); f.answers.session = answer;
      refusal(f, await c.run(f.request, f.ports), "denied");
      yes(f.count("prepare") === 0 && f.count("release") === 0 && f.count("discard") === 1, "invalid session cannot prepare or release cookies");
    }
  });
  it("refuses malformed release and writer cookie plans without publishing a response", async () => {
    for (const answer of [null, { outcome: "refused" }, { outcome: "released", heldCookies: [] },
      { outcome: "released", heldCookies: [{ name: "alien", value: PRIVATE }] },
      { outcome: "released", heldCookies: [{ name: "solmind-auth.1", value: PRIVATE }] },
      { outcome: "released", heldCookies: [{ name: "solmind-auth", value: PRIVATE }], extra: PRIVATE }]) {
      const f = fixture(); f.answers.release = answer;
      refusal(f, await c.run(f.request, f.ports), "denied");
      yes(f.count("cookie") === 0 && f.count("discard") === 1, "no incomplete cookie plan publication");
    }
  });
  it("discards an actually partly written response after setter failure", async () => {
    const f = fixture(); f.hooks.cookie = () => { if (f.count("cookie") === 2) throw hostileError(); };
    refusal(f, await c.run(f.request, f.ports), "denied");
    yes(f.count("cookie") === 2 && f.count("discard") === 1, "partial write observed then discarded");
  });
});

describe("current logout hold and remaining lifetime", () => {
  it("rejects the superseded four-field hold and a non-callable preparation without redemption", async () => {
    for (const kind of ["absent", "accessor", "invalid"] as const) {
      const f = fixture(); let read = false;
      if (kind === "absent") Reflect.deleteProperty(f.hold, "prepareAcceptedSession");
      if (kind === "accessor") Object.defineProperty(f.hold, "prepareAcceptedSession", { get() { read = true; return () => {}; } });
      if (kind === "invalid") Object.defineProperty(f.hold, "prepareAcceptedSession", { value: null });
      refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
      yes(!read && f.count("redeem") === 0 && f.count("discard") === 1, "current exact hold required, recoverable old hold discarded");
    }
  });
  it("awaits accepted-session preparation before release or success publication", async () => {
    const f = fixture(); let finish: (() => void) | undefined; let finished = false;
    f.hooks.prepare = () => new Promise<void>(resolve => { finish = resolve; });
    const pending = verifyGuideSignIn(f.request, f.ports).then(value => { finished = true; return value; });
    for (let n = 0; n < 18; n++) await Promise.resolve();
    yes(finish !== undefined && !finished && f.count("release") === 0 && f.count("response") === 0, "accepted preparation owns the wait");
    finish?.(); const result = await pending;
    yes(result.outcome === "signed_in" && f.count("prepare") === 1, "one awaited preparation then success");
  });
  for (const [elapsed, remaining, expected] of [[0, 1000, 120], [0.1, 1000, 119], [1000, 1000, 119],
    [1000.1, 1000, 118], [0, 60.9, 60], [1500, 119, 118], [0, 1.9, 1]] as const) {
    it("conservatively subtracts preparation and provider lifetime case " + elapsed + "/" + remaining, async () => {
      const f = fixture(); let calls = 0;
      f.rawPorts.now = () => ++calls <= 2 ? 1000 : 1000 + elapsed;
      f.rawPorts.epochSeconds = () => EXPIRY - remaining;
      const result = await verifyGuideSignIn(f.request, f.ports);
      yes(result.outcome === "signed_in", "positive bounded remaining life accepted");
      const writes = f.args.get("cookie") ?? [];
      yes(writes.length === 4 && writes.slice(2).every(write => (write[2] as { maxAge: number }).maxAge === expected), "fresh authentication and binding cookies use reduced lifetime");
    });
  }
  it("denies bad preparation clocks and exhausted life, awaiting cleanup without release", async () => {
    const cases = [
      { begin: NaN, end: 1000, epoch: EXPIRY - 1000, prepare: 0 },
      { begin: -1, end: 1000, epoch: EXPIRY - 1000, prepare: 0 },
      { begin: 1000, end: Infinity, epoch: EXPIRY - 1000, prepare: 1 },
      { begin: 1000, end: 999, epoch: EXPIRY - 1000, prepare: 1 },
      { begin: 1000, end: 1000, epoch: NaN, prepare: 1 },
      { begin: 1000, end: 1000, epoch: -1, prepare: 1 },
      { begin: 1000, end: 121000, epoch: EXPIRY - 1000, prepare: 1 },
      { begin: 1000, end: 1000, epoch: EXPIRY - 0.9, prepare: 1 },
      { begin: 1000, end: 1000, epoch: EXPIRY + 1, prepare: 1 },
    ];
    for (const item of cases) {
      const f = fixture(); let calls = 0;
      f.rawPorts.now = () => ++calls === 1 ? 1000 : calls === 2 ? item.begin : item.end;
      f.rawPorts.epochSeconds = () => item.epoch;
      refusal(f, await verifyAdminSignIn(f.request, f.ports), "denied");
      yes(f.count("prepare") === item.prepare && f.count("release") === 0 && f.count("discard") === 1, "invalid completion lifetime cannot publish cookies");
    }
  });
  it("clock exceptions after acceptance retain post-factor denial and cleanup", async () => {
    for (const stage of ["begin", "end", "epoch"] as const) {
      const f = fixture(); let calls = 0;
      f.rawPorts.now = () => { calls++; if ((stage === "begin" && calls === 2) || (stage === "end" && calls === 3)) throw hostileError(); return 1000; };
      f.rawPorts.epochSeconds = () => { if (stage === "epoch") throw hostileError(); return EXPIRY - 1000; };
      refusal(f, await verifyGuideSignIn(f.request, f.ports), "denied");
      yes(f.count("discard") === 1 && f.count("release") === 0, "clock failure is no successful completion");
    }
  });
});

for (const c of verifyCases) describe("confirmed password failure recording: " + c.name, () => {
  it("records exactly once against the owned selector without redeeming or creating a session", async () => {
    const f = fixture(); f.answers.password = { outcome: "credentials_refused" };
    refusal(f, await c.run(f.request, f.ports), "not_matched");
    same(f.events, ["now", "configuration_verify", "lookup", "ownership", "password", "password_failure", "wait"], "failure record follows the confirmed password refusal");
    same(f.args.get("password_failure"), [[{ userAccountId: IDS.account, challengeId: IDS.challenge, roleContext: c.role }]], "server-derived identity only; no password or code");
    yes(f.count("password_failure") === 1 && f.count("redeem") === 0 && f.count("session") === 0 && f.count("cookie") === 0, "one record attempt and no authentication effect");
  });
  it("does not count provider failures, invalid requests, wrong ownership or successful login", async () => {
    for (const outcome of ["failed", "invalid_request"]) {
      const f = fixture(); f.answers.password = { outcome };
      refusal(f, await c.run(f.request, f.ports), "not_matched");
      yes(f.count("password_failure") === 0, "unknown provider outcomes are not wrong passwords");
    }
    const widened = fixture(); widened.answers.password = { outcome: "credentials_refused", extra: "synthetic" };
    refusal(widened, await c.run(widened.request, widened.ports), "not_matched");
    yes(widened.count("password_failure") === 0, "widened refusal shape never records a password failure");
    const wrongOwner = fixture(); wrongOwner.answers.ownership = { outcome: "not_owned" };
    refusal(wrongOwner, await c.run(wrongOwner.request, wrongOwner.ports), "not_matched");
    yes(wrongOwner.count("password") === 0 && wrongOwner.count("password_failure") === 0, "wrong owner reaches neither operation");
    const success = fixture();
    yes((await c.run(success.request, success.ports)).outcome === "signed_in", "existing success remains successful");
    yes(success.count("password_failure") === 0, "successful password never increments a failure");
  });
  it("retains the same refusal with no retry when recording fails or is unconfirmed", async () => {
    for (const outcome of ["failed", "not_recorded", "throw"]) {
      const f = fixture(); f.answers.password = { outcome: "credentials_refused" };
      f.answers.password_failure = { outcome };
      if (outcome === "throw") f.fail.add("password_failure");
      refusal(f, await c.run(f.request, f.ports), "not_matched");
      yes(f.count("password_failure") === 1 && f.count("redeem") === 0 && f.count("session") === 0, "unknown write is not retried or treated as login success");
    }
  });
});

describe("real current identity bridge handoff with fake auth only", () => {
  for (const c of verifyCases) for (const cleanupMode of ["deferred", "rejected"] as const) {
    it(c.name + " accepts the unmodified five-field real hold with " + cleanupMode + " optional cleanup", async () => {
      const f = fixture(); const epoch = Math.floor(Date.now() / 1000);
      const providerOrigin = "http://127.0.0.1:54321";
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({
        iss: providerOrigin + "/auth/v1", aud: "authenticated", sub: IDS.provider,
        session_id: IDS.session, exp: epoch + 3600, iat: epoch, role: "authenticated",
      }) + ".c3ludGhldGlj";
      let authCalls = 0; let localDiscards = 0; let linkCalls = 0; let signals = 0; let cleanupCalls = 0;
      let releaseCleanup: () => void = () => {};
      let notifyCleanup: () => void = () => {};
      const began = new Promise<void>(resolve => { notifyCleanup = resolve; });
      const cleanup = new Promise<void>(resolve => { releaseCleanup = resolve; });
      const bridge = createLoginIdentityBridge({
        supabaseUrl: providerOrigin, anonKey: "synthetic-core-key", authCookieName: "solmind-auth", providerTimeoutMilliseconds: 1000,
        credentialPairContext: { applicationOrigin: ORIGIN, providerIssuer: providerOrigin + "/auth/v1", providerAudience: "authenticated" },
      }, {
        fetch: (async (input, init) => {
          const url = new URL(String(input));
          if (url.pathname + url.search === "/auth/v1/token?grant_type=password") {
            authCalls++;
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
            yes(init?.method === "POST" && body?.email === EMAIL && body?.password === PASSWORD, "real SSR receives only stored email and unchanged password");
            return new Response(JSON.stringify({ access_token: token, refresh_token: PRIVATE, token_type: "bearer", expires_in: 3600,
              expires_at: epoch + 3600, user: { id: IDS.provider, aud: "authenticated", role: "authenticated", email: EMAIL,
                app_metadata: { provider: "email" }, user_metadata: {} } }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.pathname + url.search === "/auth/v1/logout?scope=local") { localDiscards++; return new Response(null, { status: 204 }); }
          throw new Error("unexpected synthetic auth operation");
        }) as typeof fetch,
        linkAdmin: { generateLink: async () => { linkCalls++; return undefined; } },
        signalCleanupFailure: () => { signals++; },
        credentialPairProof: { mintTrustedPair: () => undefined, verifyPair: () => undefined },
        cleanupPriorSession: async () => {
          cleanupCalls++; notifyCleanup();
          if (cleanupMode === "rejected") throw hostileError();
          await cleanup;
        },
        signalPriorCleanupFailure: () => { signals++; },
      });
      // Exact one-method capability; return the actual hold unchanged.
      f.verifyDependencies.bridge.signInWithPassword = (...values: unknown[]) => bridge.signInWithPassword(values[0] as { email: string; password: string });
      f.rawPorts.epochSeconds = () => epoch;
      let finished = false; let timeout: ReturnType<typeof setTimeout> | undefined;
      const pending = c.run(f.request, f.ports).then(result => { finished = true; return result; });
      try {
        await Promise.race([began, new Promise<void>((_, reject) => { timeout = setTimeout(() => reject(new Error("real bridge preparation was not reached")), 1500); })]);
        if (cleanupMode === "deferred") yes(!finished && f.count("cookie") === 0 && f.count("response") === 0, "real pending preparation prevents premature publication");
        releaseCleanup(); const result = await pending;
        yes(result.outcome === "signed_in" && result.response === f.response, "real hold reaches complete cookie response");
        yes(authCalls === 1 && cleanupCalls === 1 && linkCalls === 0 && localDiscards === 0, "one password and optional cleanup, no Explorer link or fresh-session discard");
        yes(signals === (cleanupMode === "rejected" ? 1 : 0), "optional cleanup failure is signaled once and does not invalidate fresh accepted login");
        yes(f.count("session") === 1 && f.count("cookie") >= 2, "factors and real cookie writer complete");
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        releaseCleanup(); await pending.catch(() => {});
      }
    });
  }
});

describe("boundary and lifetime regressions", () => {
  it("Admin email keeps email normalization; username never becomes email and Guide rejects username", async () => {
    const f = fixture(); await verifyAdminSignIn(f.request, f.ports);
    same(f.args.get("lookup"), [[{ identifierType: "email", normalizedIdentifier: "typed@example.invalid", requestedRoleContext: "admin" }]], "email dispatch");
    const g = fixture(); g.request.body.identifier = "Admin.User";
    same(await requestGuideSignInCode(g.send(), g.ports), { outcome: "invalid_email" }, "Guide email only");
    const a = fixture(); a.request.body.identifier = "bad@";
    same(await requestAdminSignInCode(a.send(), a.ports), { outcome: "invalid_identifier" }, "no username fallback for invalid email");
    yes(g.count("lookup") === 0 && a.count("lookup") === 0, "invalid identifier does no lookup");
  });
  it("passes empty password unchanged and does not redeem on its real-bridge-style refusal", async () => {
    const f = fixture(); f.request.body.password = ""; f.answers.password = { outcome: "invalid_request" };
    refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
    same(f.args.get("password"), [[{ email: EMAIL, password: "" }]], "empty password not transformed");
    yes(f.count("redeem") === 0, "empty password leaves challenge unchanged by core");
  });
  it("raw malformed code is left to atomic redeemer after password, then cleaned", async () => {
    const f = fixture(); f.request.body.code = " \r\n"; f.answers.redeem = { outcome: "invalid_request" };
    refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
    same(f.args.get("redeem"), [[{ purpose: "login", challengeId: IDS.challenge, code: " \r\n" }]], "raw code preserved");
    yes(f.count("discard") === 1 && f.count("session") === 0, "invalid code cleanup");
  });
  it("rejects injected authority fields and accessor bodies before dependency construction", async () => {
    for (const extra of ["role", "purpose", "userAccountId", "sessionId", "destination", "rememberBrowser"]) {
      const f = fixture(); Object.assign(f.request.body, { [extra]: PRIVATE });
      same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "extra field denied");
      yes(!f.events.includes("configuration_verify") && f.count("lookup") === 0, "no construction or effects");
    }
    const f = fixture(); let read = false;
    Object.defineProperty(f.request.body, "password", { enumerable: true, get() { read = true; return PRIVATE; } });
    same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "accessor body refused"); yes(!read, "getter not executed");
  });
  it("rejects nonlocal or noncanonical origins before remote work", async () => {
    for (const origin of ["https://example.invalid", "http://example.invalid", ORIGIN + "/", "null", ORIGIN + "?q=1", "http://user@localhost:4321"]) {
      const f = fixture(); f.request.trustedOrigin = origin;
      same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "untrusted origin");
      same(await requestGuideSignInCode(f.send(), f.ports), { outcome: "denied" }, "send origin");
      yes(f.count("lookup") === 0 && f.count("spare") === 0, "origin check before effects");
    }
  });
  it("rejects credentials, invalid cookie names and accessors before constructing dependencies", async () => {
    for (const cookies of [[{ name: "solmind-session", value: PRIVATE }], [{ name: "bad\n", value: "" }],
      [{ name: "bad name", value: "" }], [{ name: "", value: "" }], [inaccessible("cookie")]]) {
      const f = fixture(); f.request.requestCookies = cookies as typeof f.request.requestCookies;
      same(await verifyAdminSignIn(f.request, f.ports), { outcome: "denied" }, "only valid names with empty values");
      yes(!f.events.includes("configuration_verify"), "cookie check before configuration and effects");
    }
  });
  it("rejects malformed executable ports or dependency bundles before lookup", async () => {
    for (const kind of ["extra", "missing", "accessor", "throw", "bridge_extra", "dependency_null"] as const) {
      const f = fixture();
      if (kind === "extra") Object.assign(f.rawPorts, { extra: PRIVATE });
      if (kind === "missing") Object.defineProperty(f.rawPorts, "waitUntil", { value: null });
      if (kind === "accessor") Object.defineProperty(f.rawPorts, "now", { get() { throw hostileError(); } });
      if (kind === "throw") f.rawPorts.createVerifyDependencies = () => { throw hostileError(); };
      if (kind === "bridge_extra") Object.assign(f.verifyDependencies.bridge, { exchangeExplorerLink() { throw hostileError(); } });
      if (kind === "dependency_null") f.rawPorts.createVerifyDependencies = () => null;
      same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "configuration boundary denial");
      yes(f.count("lookup") === 0, "no partial configured effects");
    }
  });
  it("requires an explicit finite positive floor and a finite entry clock", async () => {
    for (const floor of [0, -1, NaN, Infinity]) {
      const f = fixture(); f.rawPorts.responseFloorMilliseconds = floor;
      same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "invalid floor"); yes(f.count("lookup") === 0, "no effects");
    }
    for (const now of [-1, NaN, Infinity]) {
      const f = fixture(); f.rawPorts.now = () => now;
      same(await verifyGuideSignIn(f.request, f.ports), { outcome: "denied" }, "invalid clock"); yes(f.count("lookup") === 0, "no effects");
    }
  });
  it("snapshots parsed body and dependency methods before awaited work", async () => {
    const f = fixture(); f.hooks.lookup = () => {
      f.request.body.password = "later replacement"; f.request.body.challengeId = IDS.actual;
      f.request.requestCookies[0].value = PRIVATE;
      f.verifyDependencies.redeemer.redeem = () => { throw hostileError(); };
      return f.answers.lookup;
    };
    const result = await verifyGuideSignIn(f.request, f.ports);
    yes(result.outcome === "signed_in", "captured valid inputs remain stable");
    same(f.args.get("password"), [[{ email: EMAIL, password: PASSWORD }]], "original password snapshot");
    same(f.args.get("redeem"), [[{ purpose: "login", challengeId: IDS.challenge, code: CODE }]], "original code and method snapshot");
  });
  it("adopts recoverable discard before validating a malformed hold", async () => {
    for (const kind of ["expiry", "assert", "release", "extra", "outer_extra", "outer_outcome"] as const) {
      const f = fixture();
      if (kind === "expiry") f.hold.accessTokenExpiresAt = NaN;
      if (kind === "assert") Object.defineProperty(f.hold, "assertProviderUser", { value: null });
      if (kind === "release") Object.defineProperty(f.hold, "release", { get() { throw hostileError(); } });
      if (kind === "extra") Object.assign(f.hold, { extra: PRIVATE });
      if (kind === "outer_extra") f.answers.password = { outcome: "held", hold: f.hold, extra: PRIVATE };
      if (kind === "outer_outcome") f.answers.password = { outcome: "failed", hold: f.hold };
      refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
      yes(f.count("discard") === 1 && f.count("redeem") === 0, "recoverable hold cleaned before any redemption");
    }
  });
  it("unreadable or missing cleanup capability never permits redemption or success", async () => {
    for (const kind of ["missing", "accessor", "outer_accessor"] as const) {
      const f = fixture(); let reads = 0;
      if (kind === "missing") Object.defineProperty(f.hold, "discard", { value: null });
      if (kind === "accessor") Object.defineProperty(f.hold, "discard", { get() { reads++; return () => {}; } });
      if (kind === "outer_accessor") f.answers.password = Object.defineProperty({ outcome: "held" }, "hold", { enumerable: true, get() { reads++; return f.hold; } });
      refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
      yes(reads === 0 && f.count("redeem") === 0 && f.count("discard") === 0, "unavailable hold cannot be used or fabricated for cleanup");
    }
  });
  it("never accepts malformed account identity or an accessor as a valid lookup row", async () => {
    for (const field of ["userAccountId", "userContactMethodId", "providerUserId", "normalizedEmail"]) {
      for (const malformed of [null, "", "not-a-uuid"]) {
        if (field === "normalizedEmail" && malformed === "not-a-uuid") continue;
        const f = fixture(); f.answers.lookup = { ...f.answers.lookup as object, [field]: malformed };
        refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
        yes(f.count("ownership") === 0 && f.count("password") === 0, "lookup boundary validates required identifiers");
      }
    }
    const f = fixture(); f.answers.lookup = inaccessible("found");
    refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
    yes(f.count("ownership") === 0, "accessor outcome refused");
  });
  it("waits for asynchronous discard, then floor, before publishing refusal", async () => {
    const f = fixture(); f.answers.redeem = { outcome: "denied" };
    let done = false; let finish: (() => void) | undefined;
    f.hooks.discard = () => new Promise<void>(resolve => { finish = resolve; });
    const pending = verifyGuideSignIn(f.request, f.ports).then(result => { done = true; return result; });
    for (let n = 0; n < 12; n++) await Promise.resolve();
    yes(finish !== undefined && !done && f.count("wait") === 0, "refusal waits on cleanup");
    finish?.(); refusal(f, await pending, "not_matched");
  });
  it("discard failure cannot change refusal, retry or expose exception properties", async () => {
    const f = fixture(); f.answers.confirm = { outcome: "not_confirmed" };
    f.hooks.discard = () => Promise.reject(hostileError()); f.hooks.wait = () => Promise.reject(hostileError());
    refusal(f, await verifyGuideSignIn(f.request, f.ports), "not_matched");
    yes(f.count("discard") === 1 && f.count("session") === 0, "bounded attempt contract delegated to real discard");
  });
  it("successful ownership does not replace redeemed confirmation", async () => {
    const f = fixture(); f.answers.confirm = { outcome: "not_confirmed" };
    refusal(f, await verifyAdminSignIn(f.request, f.ports), "not_matched");
    yes(f.count("ownership") === 1 && f.count("redeem") === 1 && f.count("confirm") === 1 && f.count("session") === 0, "kills skip-confirmation mutant");
  });
  it("validates every delivery status without revealing its value", async () => {
    for (const delivery of [...VERIFICATION_CODE_DELIVERY_OUTCOMES, "not_attempted"]) {
      const f = fixture(); f.answers.issue = { outcome: "issued", challengeId: IDS.actual, delivery };
      same(await requestAdminSignInCode(f.send(), f.ports), { acknowledgment: "verification_code_requested", challengeId: IDS.actual }, "all legitimate delivery statuses remain opaque");
    }
  });
  it("has exactly four runtime exports and no runtime imports of provider, Explorer composition, env or IO", () => {
    same(Object.keys(core).sort(), ["requestAdminSignInCode", "requestGuideSignInCode", "verifyAdminSignIn", "verifyGuideSignIn"], "four fixed entrypoints only");
    const path = fileURLToPath(new URL("../passwordRoleSignInCore.ts", import.meta.url));
    const source = fs.readFileSync(path, "utf8");
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let serverOnly = false; let forbidden = false;
    const allowed = new Set(["server-only", "../auth/loginContactNormalizer", "../auth/adminLoginIdentifierNormalizer", "../auth/sessionCookiePolicy",
      "../auth/verificationChallengeCallers", "../auth/verificationCodeDelivery", "../roles", "./loginCookieWriter", "./passwordRoleSignInBodies"]);
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) {
        if (node.moduleSpecifier.text === "server-only") serverOnly = true;
        if (!allowed.has(node.moduleSpecifier.text)) forbidden = true;
      }
      if (ts.isIdentifier(node) && ["process", "fetch", "console", "require", "eval", "Function"].includes(node.text)) forbidden = true;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) forbidden = true;
      ts.forEachChild(node, visit);
    }
    visit(tree); yes(serverOnly && !forbidden, "static dormant import boundary (not authentication proof)");
  });
});


for (const c of sendCases) describe("fixed flow send: " + c.name, () => {
  const flowId = "6f170000-0000-4000-8000-000000000001";
  it("always echoes validated flow independently of lookup, issuance and delivery outcome", async () => {
    for (const mode of ["issued", "denied", "throw", "unknown"] as const) {
      const f = fixture();
      if (mode === "denied") f.answers.issue = { outcome: "denied", challengeId: IDS.actual };
      if (mode === "throw") f.fail.add("issue");
      if (mode === "unknown") f.answers.lookup = { outcome: "not_found" };
      const send = f.send();
      const result = await c.run({ ...send, body: { ...send.body, flowId } }, f.ports);
      same(result, { acknowledgment: "verification_code_requested", flowId }, "public flow only, no actual challenge selector");
      yes(f.count("spare") === 1 && f.count("wait") === 1, "same decoy preparation and floor");
      if (mode !== "unknown") same(f.args.get("issue"), [[{ purpose: "login", contactMethodType: "email", normalizedContact: EMAIL,
        userAccountId: IDS.account, userContactMethodId: IDS.contact, loginFlow: { flowId, roleContext: c.role } }]], "private bound flow issuance payload");
    }
  });
});
for (const c of verifyCases) describe("fixed flow verify: " + c.name, () => {
  const flowId = "6f170000-0000-4000-8000-000000000001";
  function flowRequest(f: Fixture, extra: Record<string, unknown> = {}) {
    return { ...f.request, body: { identifier: f.request.body.identifier, password: PASSWORD, code: CODE, flowId, ...extra } };
  }
  function resolver(f: Fixture, result: unknown = { outcome: "found", challengeId: IDS.actual }) {
    const requests: unknown[] = [];
    Object.assign(f.verifyDependencies, { flowResolver: { resolve: async (request: unknown) => {
      f.events.push("flow"); requests.push(request); return result;
    } } });
    return requests;
  }
  it("resolves once in place of legacy ownership and propagates actual ID through all factors/session", async () => {
    const f = fixture(); const resolutions = resolver(f);
    const result = await c.run(flowRequest(f), f.ports);
    yes(result.outcome === "signed_in", "all fixed factors accepted");
    same(f.events.filter(x => ["lookup", "flow", "ownership", "password", "redeem", "assert", "confirm", "session"].includes(x)),
      ["lookup", "flow", "password", "redeem", "assert", "confirm", "session"], "one resolver replaces ownership read, ordinary factors stay ordered");
    same(resolutions, [{ flowId, userAccountId: IDS.account, userContactMethodId: IDS.contact, roleContext: c.role }], "only server lookup IDs and fixed role resolve");
    same(f.args.get("redeem"), [[{ purpose: "login", challengeId: IDS.actual, code: CODE }]], "actual challenge goes to redemption");
    same(f.args.get("confirm"), [[{ userAccountId: IDS.account, challengeId: IDS.actual, expectedPurpose: "login" }]], "same actual redeemed account confirmation");
    same(f.args.get("session"), [[{ userAccountId: IDS.account, activeRoleContext: c.role, challengeId: IDS.actual,
      providerAccessTokenExpiresAt: EXPIRY }]], "same actual challenge creates session");
  });
  it("records wrong password once against resolved actual code, never alias or a second candidate", async () => {
    const f = fixture(); const resolutions = resolver(f); f.answers.password = { outcome: "credentials_refused" };
    refusal(f, await c.run(flowRequest(f), f.ports), "not_matched");
    same(f.args.get("password_failure"), [[{ userAccountId: IDS.account, challengeId: IDS.actual, roleContext: c.role }]], "password failure uses actual code row");
    yes(resolutions.length === 1 && f.count("redeem") === 0 && f.count("session") === 0 && f.count("ownership") === 0, "no retry or legacy ownership fallback");
  });
  it("missing/foreign/expired/failed mappings stay neutral with no password/provider or code-attempt write", async () => {
    for (const value of [undefined, { outcome: "not_found" }, { outcome: "failed" }, { outcome: "found", challengeId: IDS.actual + "\n" }]) {
      const f = fixture(); if (value !== undefined) resolver(f, value);
      refusal(f, await c.run(flowRequest(f), f.ports), "not_matched");
      yes(f.count("password") === 0 && f.count("redeem") === 0 && f.count("password_failure") === 0 && f.count("session") === 0,
        "no factor/provider attempt without one resolved candidate");
    }
  });
  it("validates flow semantics before dependency construction and refuses mixed protocols", async () => {
    for (const extra of [{ flowId: flowId + "\n" }, { flowId: "00000000-0000-0000-0000-000000000000" }, { challengeId: IDS.challenge }]) {
      const f = fixture(); resolver(f);
      same(await c.run(flowRequest(f, extra), f.ports), { outcome: "denied" }, "fixed early shape/flow denial");
      yes(!f.events.includes("configuration_verify") && f.count("lookup") === 0 && f.count("password") === 0, "invalid protocol never builds or uses dependencies");
    }
  });
});
