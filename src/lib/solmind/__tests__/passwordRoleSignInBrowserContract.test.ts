import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as browser from "../passwordRoleSignInBrowserContract";
import * as server from "../supabase/passwordRoleSignInRouteContract";

const fail = browser.PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
const selector = "12345678-1234-5234-8234-123456789abc";
const nil = "00000000-0000-0000-0000-000000000000";
const privateCanary = "fixture-private-browser-contract-7163";
const sends = [browser.parseGuideSignInSendReply, browser.parseAdminSignInSendReply];
const verifies = [browser.parseGuideSignInVerifyReply, browser.parseAdminSignInVerifyReply];
const parsers = [...sends, ...verifies];
const builders = [browser.buildPasswordRoleSignInSendRequest, browser.buildPasswordRoleSignInVerifyRequest];
const validVerify = () => ({ identifier: privateCanary, password: privateCanary, challengeId: selector, code: privateCanary });
let logs: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  logs = [vi.spyOn(console, "log").mockImplementation(() => undefined),
    vi.spyOn(console, "warn").mockImplementation(() => undefined),
    vi.spyOn(console, "error").mockImplementation(() => undefined)];
});
afterEach(() => {
  const silent = logs.every((spy) => spy.mock.calls.length === 0);
  vi.restoreAllMocks();
  expect(silent).toBe(true);
});
// Assertions on hostile or secret-bearing values reduce to booleans/counts. A
// faulty implementation must not make Vitest pretty-print the supplied fixture.
function rejected(actual: unknown): void { expect(actual === fail).toBe(true); }
function frozen(value: unknown): void { expect(Object.isFrozen(value)).toBe(true); }
function ack(id = selector) { return { acknowledgment: "verification_code_requested", challengeId: id }; }

describe("fixed role contract", () => {
  it("matches actual server paths, destinations and fixed success objects", () => {
    expect(browser.GUIDE_BROWSER_SIGN_IN_PATHS).toEqual(server.GUIDE_SIGN_IN_ROUTE_PATHS);
    expect(browser.ADMIN_BROWSER_SIGN_IN_PATHS).toEqual(server.ADMIN_SIGN_IN_ROUTE_PATHS);
    expect(browser.GUIDE_BROWSER_SIGN_IN_HOME).toBe(server.GUIDE_SIGN_IN_HOME_PATH);
    expect(browser.ADMIN_BROWSER_SIGN_IN_HOME).toBe(server.ADMIN_SIGN_IN_HOME_PATH);
    expect(browser.parseGuideSignInVerifyReply(server.GUIDE_SIGN_IN_SIGNED_IN).ok).toBe(true);
    expect(browser.parseAdminSignInVerifyReply(server.ADMIN_SIGN_IN_SIGNED_IN).ok).toBe(true);
    frozen(browser.GUIDE_BROWSER_SIGN_IN_PATHS); frozen(browser.ADMIN_BROWSER_SIGN_IN_PATHS); frozen(fail);
  });
  it("uses the exact accepted common message", () => {
    expect(browser.PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE).toBe(
      "Couldn't sign you in. Check your password and latest code, or try again later.");
  });
  it("keeps invalid identifier outcomes role-specific", () => {
    expect(browser.parseGuideSignInSendReply(server.GUIDE_SIGN_IN_INVALID_EMAIL).ok).toBe(true);
    expect(browser.parseAdminSignInSendReply(server.ADMIN_SIGN_IN_INVALID_IDENTIFIER).ok).toBe(true);
    rejected(browser.parseGuideSignInSendReply(server.ADMIN_SIGN_IN_INVALID_IDENTIFIER));
    rejected(browser.parseAdminSignInSendReply(server.GUIDE_SIGN_IN_INVALID_EMAIL));
  });
  it("accepts common and denied replies only in their intended phases", () => {
    for (const parse of sends) { expect(parse(server.PASSWORD_ROLE_SIGN_IN_DENIED).ok).toBe(true); rejected(parse(server.PASSWORD_ROLE_SIGN_IN_NOT_MATCHED)); }
    for (const parse of verifies) {
      expect(parse(server.PASSWORD_ROLE_SIGN_IN_NOT_MATCHED).ok).toBe(true);
      expect(parse(server.PASSWORD_ROLE_SIGN_IN_DENIED).ok).toBe(true);
      for (const value of [server.GUIDE_SIGN_IN_INVALID_EMAIL, server.ADMIN_SIGN_IN_INVALID_IDENTIFIER, ack(), { outcome: "code_not_accepted" }]) rejected(parse(value));
    }
  });
  it("rejects cross-role, prototype and arbitrary success destinations", () => {
    for (const value of [server.ADMIN_SIGN_IN_SIGNED_IN, { outcome: "signed_in", destination: "/guide" }, { outcome: "signed_in", destination: privateCanary }]) rejected(browser.parseGuideSignInVerifyReply(value));
    rejected(browser.parseAdminSignInVerifyReply(server.GUIDE_SIGN_IN_SIGNED_IN));
    rejected(browser.parseAdminSignInVerifyReply({ outcome: "signed_in", destination: "/admin" }));
  });
});

describe("raw exact request builders", () => {
  it("send carries only raw identifier and no password", () => {
    const value = { identifier: "  Mixed.User@example.test\t" };
    const result = browser.buildPasswordRoleSignInSendRequest(value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.identifier === value.identifier).toBe(true);
    expect(Object.keys(result.body)).toEqual(["identifier"]);
    frozen(result); frozen(result.body);
    value.identifier = "changed";
    expect(result.body.identifier === value.identifier).toBe(false);
    rejected(browser.buildPasswordRoleSignInSendRequest({ ...value, password: privateCanary }));
  });
  it("preserves all four raw strings without semantic validation", () => {
    for (const raw of ["", "\t", " Mixed_CASE ", "<>", "x".repeat(513), "\ud800", privateCanary]) {
      const value = { identifier: raw, password: raw, challengeId: raw, code: raw };
      const result = browser.buildPasswordRoleSignInVerifyRequest(value);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(Object.values(result.body).every((v) => v === raw)).toBe(true);
      expect(Object.keys(result.body)).toEqual(["identifier", "password", "challengeId", "code"]);
      frozen(result); frozen(result.body);
      value.password = "changed";
      expect(result.body.password === raw).toBe(true);
      expect(browser.buildPasswordRoleSignInSendRequest({ identifier: raw }).ok).toBe(true);
    }
  });
  it("rejects each missing, wrong-type and extra authority field", () => {
    for (const key of ["identifier", "password", "challengeId", "code"] as const) {
      const missing: Record<string, unknown> = validVerify(); delete missing[key];
      rejected(browser.buildPasswordRoleSignInVerifyRequest(missing));
      for (const wrong of [null, 0, false, {}, [], undefined]) rejected(browser.buildPasswordRoleSignInVerifyRequest({ ...validVerify(), [key]: wrong }));
    }
    for (const key of ["role", "purpose", "account", "destination", "remembered", "extra"]) {
      rejected(browser.buildPasswordRoleSignInVerifyRequest({ ...validVerify(), [key]: privateCanary }));
      rejected(browser.buildPasswordRoleSignInSendRequest({ identifier: privateCanary, [key]: privateCanary }));
    }
  });
});

describe("strict selector and reply shapes", () => {
  it("accepts canonical lowercase selectors including nil and non-v4", () => {
    for (const parse of sends) for (const id of [selector, nil]) {
      const input = ack(id); const result = parse(input); expect(result.ok).toBe(true);
      if (!result.ok || !("challengeId" in result.value)) continue;
      expect(result.value.challengeId === id).toBe(true); frozen(result); frozen(result.value);
      input.challengeId = "changed"; expect(result.value.challengeId === id).toBe(true);
    }
  });
  it("rejects noncanonical, extended and non-string selectors", () => {
    for (const parse of sends) for (const id of [selector.toUpperCase(), selector + "\n", " " + selector, selector.slice(1), selector.replace("-", "_"), "", null, 5, privateCanary]) rejected(parse({ ...ack(), challengeId: id }));
  });
  it("rejects missing and added reply fields without exposing values", () => {
    for (const parse of sends) for (const input of [{ acknowledgment: "verification_code_requested" }, { challengeId: selector }, { ...ack(), extra: privateCanary }, { ...ack(), acknowledgment: privateCanary }, { outcome: "denied", challengeId: selector }]) rejected(parse(input));
    for (const parse of parsers) for (const input of [{ outcome: "unknown" }, { outcome: "denied", reason: privateCanary }, { outcome: "not_matched", message: privateCanary }, { outcome: "signed_in" }]) rejected(parse(input));
    rejected(browser.parseGuideSignInVerifyReply({ ...server.GUIDE_SIGN_IN_SIGNED_IN, extra: privateCanary }));
  });
  it("freezes accepted one-field and success replies", () => {
    for (const [parse, input] of [[browser.parseGuideSignInVerifyReply, server.GUIDE_SIGN_IN_SIGNED_IN], [browser.parseAdminSignInVerifyReply, server.ADMIN_SIGN_IN_SIGNED_IN], [browser.parseGuideSignInSendReply, server.GUIDE_SIGN_IN_INVALID_EMAIL], [browser.parseAdminSignInSendReply, server.ADMIN_SIGN_IN_INVALID_IDENTIFIER], [browser.parseGuideSignInVerifyReply, server.PASSWORD_ROLE_SIGN_IN_NOT_MATCHED]] as const) {
      const result = parse(input); expect(result.ok).toBe(true); frozen(result); if (result.ok) frozen(result.value);
    }
  });
});

describe("hostile input and value-free failures", () => {
  it("rejects non-record and inherited fields across every entrypoint", () => {
    for (const parse of [...parsers, ...builders]) for (const input of [undefined, null, false, 1, privateCanary, [], () => 0, new Date(), Object.create({ outcome: "denied", identifier: privateCanary }), {}]) rejected(parse(input));
  });
  it("accepts null-prototype records without invoking prototype methods", () => {
    expect(browser.buildPasswordRoleSignInSendRequest(Object.assign(Object.create(null), { identifier: privateCanary })).ok).toBe(true);
    expect(browser.buildPasswordRoleSignInVerifyRequest(Object.assign(Object.create(null), validVerify())).ok).toBe(true);
    for (const parse of parsers) expect(parse(Object.assign(Object.create(null), { outcome: "denied" })).ok).toBe(true);
  });
  it("does not evaluate accessor fields or coercion hooks", () => {
    let reads = 0;
    const hidden = { toString() { reads++; throw privateCanary; } };
    for (const parse of [...parsers, ...builders]) {
      const input = Object.defineProperty({}, "outcome", { enumerable: true, get() { reads++; throw hidden; } });
      rejected(parse(input));
    }
    for (const key of ["identifier", "password", "challengeId", "code"]) {
      const input = validVerify(); Object.defineProperty(input, key, { enumerable: true, get() { reads++; throw hidden; } });
      rejected(browser.buildPasswordRoleSignInVerifyRequest(input));
    }
    rejected(browser.buildPasswordRoleSignInSendRequest({ identifier: hidden }));
    expect(reads).toBe(0);
  });
  it("rejects symbols and non-enumerable data", () => {
    for (const parse of parsers) {
      rejected(parse({ outcome: "denied", [Symbol("fixture")]: privateCanary }));
      rejected(parse(Object.defineProperty({}, "outcome", { value: "denied" })));
    }
    for (const build of builders) {
      rejected(build({ ...validVerify(), [Symbol("fixture")]: privateCanary }));
      rejected(build(Object.defineProperty({}, "identifier", { value: privateCanary })));
    }
  });
  it("discards all reflection exceptions without reading thrown objects", () => {
    let touched = 0;
    const thrown = Object.defineProperty({}, "message", { get() { touched++; throw privateCanary; } });
    for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
      const input = new Proxy({ outcome: "denied" }, { [trap]() { throw thrown; } });
      for (const parse of [...parsers, ...builders]) rejected(parse(input));
    }
    expect(touched).toBe(0);
    expect(JSON.stringify(fail) === '{"ok":false,"error":"password_role_browser_contract_failed"}').toBe(true);
  });
});
