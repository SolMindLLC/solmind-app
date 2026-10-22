import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSessionCookieEntries } from "../../auth/sessionCookiePolicy";

const seams = vi.hoisted(() => ({ cookies: vi.fn(), factory: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: seams.cookies }));
vi.mock("../passwordRoleSignInDependencies", () => ({ createPasswordRoleSignInHttpPorts: seams.factory }));

import { createGuideSignInHttpPorts, GUIDE_SIGN_IN_CONFIGURATION } from "../guideSignInHttpPorts";

beforeEach(() => {
  vi.resetAllMocks();
  seams.factory.mockImplementation((_configuration, readCookies) => ({ readCookies }));
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_network"); });
});
afterEach(() => {
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0);
  vi.restoreAllMocks();
});

describe("Guide concrete Next cookie boundary", () => {
  it("lazily projects framework cookie metadata to the strict reader's plain entries", async () => {
    const source = [{ name: "solmind-session", value: "synthetic-binding", path: "/", sameSite: "lax" }];
    seams.cookies.mockResolvedValue({ getAll: () => source });
    const ports = createGuideSignInHttpPorts();
    expect(seams.cookies.mock.calls.length).toBe(0);
    const entries = await ports.readCookies();
    expect(readSessionCookieEntries(entries, false) !== null).toBe(true);
    expect(JSON.stringify(entries) === JSON.stringify([{ name: source[0].name, value: source[0].value }])).toBe(true);
    expect(Object.keys(source[0]).includes("path")).toBe(true);
  });

  it("does not suppress cookie-read failure or substitute empty credentials", async () => {
    seams.cookies.mockRejectedValue(new Error("synthetic_cookie_failure"));
    const ports = createGuideSignInHttpPorts();
    await expect(ports.readCookies()).rejects.toThrow("synthetic_cookie_failure");
  });

  it("supplies every explicit deadline including ownership, without environment defaults", () => {
    createGuideSignInHttpPorts();
    expect(seams.factory.mock.calls[0][0] === GUIDE_SIGN_IN_CONFIGURATION).toBe(true);
    expect(Object.isFrozen(GUIDE_SIGN_IN_CONFIGURATION)).toBe(true);
    expect(Object.keys(GUIDE_SIGN_IN_CONFIGURATION).length).toBe(6);
    expect(GUIDE_SIGN_IN_CONFIGURATION.challengeOwnershipTimeoutMilliseconds > 0).toBe(true);
    // Existing redemption response budget plus provider/confirmation/session is
    // below the 60-second challenge freshness minimum. This is configured sum
    // only; it does not prove wall-clock completion or timing-risk acceptance.
    const afterRedemption = 6_000 + GUIDE_SIGN_IN_CONFIGURATION.providerTimeoutMilliseconds
      + GUIDE_SIGN_IN_CONFIGURATION.challengeConfirmationTimeoutMilliseconds
      + GUIDE_SIGN_IN_CONFIGURATION.sessionCreationTimeoutMilliseconds;
    expect(afterRedemption < 60_000).toBe(true);
  });
});
