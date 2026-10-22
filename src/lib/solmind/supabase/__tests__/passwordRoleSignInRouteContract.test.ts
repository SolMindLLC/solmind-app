// Pure contract checks only: no handler, server, network, cookie or browser proof.
import { isDeepStrictEqual } from "node:util";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import * as contract from "../passwordRoleSignInRouteContract";
import type { GuideSignInSendResult, AdminSignInSendResult, GuideSignInVerifyBodyResult, AdminSignInVerifyBodyResult,
  PasswordRoleSignInSendAcknowledgment } from "../passwordRoleSignInRouteContract";
import type { VerificationChallengeIssuanceAcknowledgment } from "../../auth/verificationChallengeCallers";
import { SESSION_COOKIE_NO_STORE_HEADERS } from "../../auth/sessionCookiePolicy";
import { SOLMIND_ROLE_HOME_ROUTES } from "../../roles";

const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"] as const;
const yes = (value: boolean, label: string) => expect(value, label).toBe(true);
const same = (value: unknown, expected: unknown, label: string) => yes(isDeepStrictEqual(value, expected), label);
beforeEach(() => {
  for (const name of CONSOLE) vi.spyOn(console, name).mockImplementation(() => {});
  vi.stubGlobal("fetch", () => { throw new Error("network forbidden in route contract fixture"); });
});
afterEach(() => {
  try { for (const name of CONSOLE) yes(vi.mocked(console[name]).mock.calls.length === 0, "no console sink"); }
  finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});

describe("Guide/Admin dormant route contract", () => {
  it("exports constants only, without parsers, mappers or caller-selected role/destination functions", () => {
    same(Object.keys(contract).sort(), [
      "ADMIN_SIGN_IN_HOME_PATH", "ADMIN_SIGN_IN_INVALID_IDENTIFIER", "ADMIN_SIGN_IN_ROUTE_PATHS", "ADMIN_SIGN_IN_SIGNED_IN",
      "GUIDE_SIGN_IN_HOME_PATH", "GUIDE_SIGN_IN_INVALID_EMAIL", "GUIDE_SIGN_IN_ROUTE_PATHS", "GUIDE_SIGN_IN_SIGNED_IN",
      "PASSWORD_ROLE_SIGN_IN_DENIED", "PASSWORD_ROLE_SIGN_IN_NOT_MATCHED", "PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS", "PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS",
    ], "exact runtime export surface");
    yes(Object.values(contract).every(value => typeof value !== "function"), "no executable role or destination input seam");
  });
  it("keeps four literal route paths and two fixed guarded-home destinations separate from prototype homes", () => {
    same(contract.GUIDE_SIGN_IN_ROUTE_PATHS, { send: "/login/guide/send", verify: "/login/guide/verify" }, "Guide paths");
    same(contract.ADMIN_SIGN_IN_ROUTE_PATHS, { send: "/login/admin/send", verify: "/login/admin/verify" }, "Admin paths");
    yes(contract.GUIDE_SIGN_IN_HOME_PATH === "/guide/home" && contract.ADMIN_SIGN_IN_HOME_PATH === "/admin/home", "fixed future homes");
    same(SOLMIND_ROLE_HOME_ROUTES, { admin: "/admin", guide: "/guide", explorer: "/explorer" }, "existing prototype owner preserved");
  });
  it("shares exactly the existing no-store values plus nosniff, with status200 and no cookie header", () => {
    same(contract.PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS, {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", "Expires": "0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff",
    }, "one exact header record for all handler-generated responses");
    yes(SESSION_COOKIE_NO_STORE_HEADERS.every(({ name, value }) => contract.PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS[name] === value), "reuse current cookie policy values");
    yes(contract.PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS === 200, "handler-generated POST status");
    yes(!Object.keys(contract.PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS).some(name => name.toLowerCase() === "set-cookie"), "contract sets no cookie");
  });
  it("contains only the closed outward fields and fixed role-success destination", () => {
    same(contract.GUIDE_SIGN_IN_INVALID_EMAIL, { outcome: "invalid_email" }, "typed Guide send refusal");
    same(contract.ADMIN_SIGN_IN_INVALID_IDENTIFIER, { outcome: "invalid_identifier" }, "typed Admin send refusal");
    same(contract.PASSWORD_ROLE_SIGN_IN_NOT_MATCHED, { outcome: "not_matched" }, "common verification interval");
    same(contract.PASSWORD_ROLE_SIGN_IN_DENIED, { outcome: "denied" }, "earlier and later general refusal");
    same(contract.GUIDE_SIGN_IN_SIGNED_IN, { outcome: "signed_in", destination: "/guide/home" }, "Guide fixed success");
    same(contract.ADMIN_SIGN_IN_SIGNED_IN, { outcome: "signed_in", destination: "/admin/home" }, "Admin fixed success");
  });
  it("freezes every object constant, with no nested mutable values", () => {
    for (const value of Object.values(contract)) {
      if (typeof value !== "object" || value === null) continue;
      yes(Object.isFrozen(value), "object constant frozen");
      yes(Object.values(value).every(item => typeof item === "string" || typeof item === "number"), "no nested mutable data");
      yes(Reflect.set(value, "extra", "fixed synthetic marker") === false, "cannot add output detail or authority");
    }
  });
  it("types preserve the shared acknowledgment and distinct complete role result unions", () => {
    expectTypeOf<PasswordRoleSignInSendAcknowledgment>().toEqualTypeOf<VerificationChallengeIssuanceAcknowledgment>();
    expectTypeOf<GuideSignInSendResult>().toEqualTypeOf<Readonly<{ acknowledgment: "verification_code_requested"; challengeId: string }> |
      Readonly<{ outcome: "invalid_email" }> | Readonly<{ outcome: "denied" }>>();
    expectTypeOf<AdminSignInSendResult>().toEqualTypeOf<Readonly<{ acknowledgment: "verification_code_requested"; challengeId: string }> |
      Readonly<{ outcome: "invalid_identifier" }> | Readonly<{ outcome: "denied" }>>();
    expectTypeOf<GuideSignInVerifyBodyResult>().toEqualTypeOf<Readonly<{ outcome: "not_matched" }> | Readonly<{ outcome: "denied" }> |
      Readonly<{ outcome: "signed_in"; destination: "/guide/home" }>>();
    expectTypeOf<AdminSignInVerifyBodyResult>().toEqualTypeOf<Readonly<{ outcome: "not_matched" }> | Readonly<{ outcome: "denied" }> |
      Readonly<{ outcome: "signed_in"; destination: "/admin/home" }>>();
    expectTypeOf<typeof contract.GUIDE_SIGN_IN_ROUTE_PATHS.send>().toEqualTypeOf<"/login/guide/send">();
    expectTypeOf<typeof contract.ADMIN_SIGN_IN_ROUTE_PATHS.verify>().toEqualTypeOf<"/login/admin/verify">();
    expectTypeOf<typeof contract.PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS>().toEqualTypeOf<200>();
  });
  it("typechecks refuse crossed destinations, send-only outcomes, secrets and stage detail in fresh literals", () => {
    // TypeScript structural types are not runtime validation. These negative
    // compile checks guard fresh contract shapes; future adapters own exact output.
    // @ts-expect-error A Guide success never names the Admin destination.
    const crossedGuide: GuideSignInVerifyBodyResult = contract.ADMIN_SIGN_IN_SIGNED_IN;
    // @ts-expect-error An Admin success never names the Guide destination.
    const crossedAdmin: AdminSignInVerifyBodyResult = contract.GUIDE_SIGN_IN_SIGNED_IN;
    // @ts-expect-error Guide send does not publish the Admin identifier outcome.
    const guideSend: GuideSignInSendResult = contract.ADMIN_SIGN_IN_INVALID_IDENTIFIER;
    // @ts-expect-error Admin send does not publish the Guide email outcome.
    const adminSend: AdminSignInSendResult = contract.GUIDE_SIGN_IN_INVALID_EMAIL;
    // @ts-expect-error Send-only typed-identifier refusal is not a verify result.
    const verify: GuideSignInVerifyBodyResult = contract.GUIDE_SIGN_IN_INVALID_EMAIL;
    // @ts-expect-error No internal factor/provider/database reason in JSON.
    const detail: AdminSignInVerifyBodyResult = { outcome: "not_matched", reason: "fixed synthetic reason" };
    // @ts-expect-error No credential value in the outward contract.
    const secret: GuideSignInVerifyBodyResult = { outcome: "denied", password: "fixed synthetic marker" };
    // @ts-expect-error The human message is not another JSON field.
    const message: AdminSignInVerifyBodyResult = { outcome: "not_matched", message: "fixed synthetic message" };
    // @ts-expect-error Outcome constants are readonly.
    if (false) contract.GUIDE_SIGN_IN_SIGNED_IN.destination = "/guide/home";
    yes([crossedGuide, crossedAdmin, guideSend, adminSend, verify, detail, secret, message].length === 8, "negative compile cases retained without diagnostics containing data");
  });
});
