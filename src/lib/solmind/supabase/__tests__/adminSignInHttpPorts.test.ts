import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSessionCookieEntries } from "../../auth/sessionCookiePolicy";

const seams = vi.hoisted(() => ({ cookies: vi.fn(), factory: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: seams.cookies }));
vi.mock("../passwordRoleSignInDependencies", () => ({ createPasswordRoleSignInHttpPorts: seams.factory }));

import { createAdminSignInHttpPorts, ADMIN_SIGN_IN_CONFIGURATION } from "../adminSignInHttpPorts";

beforeEach(() => {
  vi.resetAllMocks();
  seams.factory.mockImplementation((_configuration, readCookies) => ({ readCookies }));
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_network"); });
});
afterEach(() => {
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0);
  vi.restoreAllMocks();
});

describe("Admin concrete Next cookie boundary", () => {
  it("does not construct ports or read request cookies when the module loads", async () => {
    vi.resetModules();
    const loaded = await import("../adminSignInHttpPorts");
    expect(typeof loaded.createAdminSignInHttpPorts === "function").toBe(true);
    expect(seams.factory.mock.calls.length === 0 && seams.cookies.mock.calls.length === 0).toBe(true);
  });

  it("lazily projects framework cookie metadata into plain strict-reader entries", async () => {
    const source = [{ name: "solmind-session", value: "synthetic-binding", path: "/", sameSite: "lax" }];
    seams.cookies.mockResolvedValue({ getAll: () => source });
    const ports = createAdminSignInHttpPorts();
    expect(seams.cookies.mock.calls.length).toBe(0);
    const entries = await ports.readCookies();
    expect(readSessionCookieEntries(entries, false) !== null).toBe(true);
    expect(JSON.stringify(entries) === JSON.stringify([{ name: source[0].name, value: source[0].value }])).toBe(true);
    expect(Object.keys(source[0]).includes("path")).toBe(true);
  });

  it("preserves duplicate framework records for the stricter reader instead of merging them", async () => {
    seams.cookies.mockResolvedValue({ getAll: () => [
      { name: "solmind-session", value: "synthetic-first", path: "/" },
      { name: "solmind-session", value: "synthetic-second", path: "/" },
    ] });
    const entries = readSessionCookieEntries(await createAdminSignInHttpPorts().readCookies(), false);
    expect(entries !== null).toBe(true);
    if (entries === null) throw new Error("synthetic_cookie_projection_invalid");
    expect(entries.length === 2 && entries[0].name === entries[1].name && entries[0].value !== entries[1].value).toBe(true);
    expect(entries.every(entry => Object.keys(entry).sort().join() === "name,value")).toBe(true);
  });

  it("does not suppress cookie-read failure or substitute empty credentials", async () => {
    seams.cookies.mockRejectedValue(new Error("synthetic_cookie_failure"));
    const ports = createAdminSignInHttpPorts();
    await expect(ports.readCookies()).rejects.toThrow("synthetic_cookie_failure");
  });

  it("supplies all six explicit candidate budgets including ownership to the shared factory", () => {
    createAdminSignInHttpPorts();
    expect(seams.factory.mock.calls[0][0] === ADMIN_SIGN_IN_CONFIGURATION).toBe(true);
    expect(Object.isFrozen(ADMIN_SIGN_IN_CONFIGURATION)).toBe(true);
    expect(Object.keys(ADMIN_SIGN_IN_CONFIGURATION).sort()).toEqual([
      "accountLookupTimeoutMilliseconds", "challengeConfirmationTimeoutMilliseconds",
      "challengeOwnershipTimeoutMilliseconds", "providerTimeoutMilliseconds",
      "responseFloorMilliseconds", "sessionCreationTimeoutMilliseconds",
    ]);
    expect(ADMIN_SIGN_IN_CONFIGURATION.responseFloorMilliseconds === 1_500
      && ADMIN_SIGN_IN_CONFIGURATION.accountLookupTimeoutMilliseconds === 3_000
      && ADMIN_SIGN_IN_CONFIGURATION.challengeOwnershipTimeoutMilliseconds === 3_000
      && ADMIN_SIGN_IN_CONFIGURATION.challengeConfirmationTimeoutMilliseconds === 3_000
      && ADMIN_SIGN_IN_CONFIGURATION.providerTimeoutMilliseconds === 5_000
      && ADMIN_SIGN_IN_CONFIGURATION.sessionCreationTimeoutMilliseconds === 18_000).toBe(true);
    // Configuration assertions establish neither actual wall-clock behavior nor
    // acceptance of Admin timing/capacity risks or Guide's private-local waiver.
  });
});
