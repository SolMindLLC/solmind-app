import http from "node:http";
import net from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readProviderProbeSuiteState, verifyProviderProbeWiring } from "./providerProbeSuiteGate";
import { gatedTestEnvironment } from "./providerProbeTestSupport";

// Both sides of the integration file's gate, with plainly fake, in-memory
// environments. The enabled branch's own function runs here with the network blocked.

const GATED = gatedTestEnvironment("suite-gate");

function blockNetwork() {
  const requestSpy = vi.spyOn(http, "request").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  const connectSpy = vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  return { requestSpy, connectSpy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("integration suite state", () => {
  it.each([
    ["no interlocks", {}],
    ["only the approval interlock", { SOLMIND_PROVIDER_PROBE_APPROVAL: GATED.SOLMIND_PROVIDER_PROBE_APPROVAL }],
    ["a near-miss effect interlock", { ...GATED, SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: ` ${GATED.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS}` }],
  ])("is skipped with %s", (_label, environment) => {
    expect(readProviderProbeSuiteState(environment)).toEqual({ state: "skipped" });
  });

  it("is enabled with both interlocks and valid settings", () => {
    const state = readProviderProbeSuiteState(GATED);

    expect(state.state).toBe("enabled");
    expect(state.state === "enabled" ? state.config.runId : null).toBe("P28-20261001-suite-gate");
  });

  it.each([
    [{ SOLMIND_LOCAL_SUPABASE_URL: "http://localhost:54321" }, "provider_probe_non_loopback_or_ambiguous_url"],
    [{ SOLMIND_PROVIDER_PROBE_RUN_ID: undefined }, "provider_probe_missing_solmind_provider_probe_run_id"],
    [{ SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: "person@example.com" }, "provider_probe_recipient_not_reserved_synthetic_domain"],
  ])("is refused, without throwing, for unsafe enabled settings %j", (change, code) => {
    expect(() => readProviderProbeSuiteState({ ...GATED, ...change })).not.toThrow();
    expect(readProviderProbeSuiteState({ ...GATED, ...change })).toEqual({ state: "refused", code });
  });
});

describe("the integration file's enabled branch (run here with a fake environment)", () => {
  it("builds the run wiring and sends no request", () => {
    const { requestSpy, connectSpy } = blockNetwork();

    expect(verifyProviderProbeWiring(GATED)).toEqual({
      profile: "current-config",
      recordedAuthUsers: 0,
      recordedMailpitMessages: 0,
      mailInventoryBuilt: true,
    });
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("leaves the mail inventory unbuilt for the locked-down profile", () => {
    blockNetwork();
    const lockedDown = gatedTestEnvironment("suite-gate", {
      SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
      SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
    });

    expect(verifyProviderProbeWiring(lockedDown)).toMatchObject({ profile: "locked-down", mailInventoryBuilt: false });
  });

  it("refuses without the interlocks", () => {
    expect(() => verifyProviderProbeWiring({})).toThrow("provider_probe_run_ungated");
  });
});
