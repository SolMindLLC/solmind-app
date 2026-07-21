import { describe, expect, it } from "vitest";

import {
  createProviderProbeEvidence,
  serializeProviderProbeEvidence,
} from "./providerProbeEvidence";

const SAFE_EVIDENCE = {
  probeId: "PP-03",
  profile: "current-config",
  outcome: "pass",
  errorClass: "none",
  userDelta: 1,
  sessionDelta: 1,
  messageDelta: 0,
  requestCount: 3,
  identityMatched: true,
  cookieWriteCount: 0,
  providerLifetimeSeconds: 3600,
  cleanupOutcome: "complete",
  sensitiveMaterialScanPassed: true,
} as const;

const FAIL_EVIDENCE = {
  ...SAFE_EVIDENCE,
  outcome: "fail",
  errorClass: "unexpected",
  userDelta: 0,
  sessionDelta: 0,
  identityMatched: null,
  providerLifetimeSeconds: null,
  cleanupOutcome: "not-attempted",
} as const;

const BLOCKED_EVIDENCE = {
  ...SAFE_EVIDENCE,
  outcome: "blocked",
  errorClass: "provider-denied",
  userDelta: 0,
  sessionDelta: 0,
  messageDelta: 0,
  identityMatched: null,
  cookieWriteCount: 0,
  providerLifetimeSeconds: null,
  cleanupOutcome: "not-attempted",
} as const;

describe("provider probe evidence allowlist", () => {
  it("accepts and freezes one bounded token-free record", () => {
    const evidence = createProviderProbeEvidence(SAFE_EVIDENCE);
    expect(evidence).toEqual(SAFE_EVIDENCE);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(JSON.parse(serializeProviderProbeEvidence(evidence))).toEqual(
      SAFE_EVIDENCE,
    );
  });

  it.each([
    { token: "eyJheader.payload.signature" },
    { email: "probe@synthetic.invalid" },
    { providerUserId: "00000000-0000-4000-8000-000000000000" },
    { notes: "arbitrary text" },
  ])("rejects unapproved field %#", (extra) => {
    expect(() => createProviderProbeEvidence({
      ...SAFE_EVIDENCE,
      ...extra,
    })).toThrow("provider_probe_evidence_unapproved_field");
  });

  it.each([
    { userDelta: 11 },
    { userDelta: -1 },
    { requestCount: 101 },
    { providerLifetimeSeconds: 0 },
    { errorClass: "raw-provider-message" },
    { sensitiveMaterialScanPassed: "yes" },
  ])("rejects unbounded or open value %#", (change) => {
    expect(() => createProviderProbeEvidence({
      ...SAFE_EVIDENCE,
      ...change,
    })).toThrow("provider_probe_evidence_invalid_value");
  });

  it.each([
    { errorClass: "unexpected" },
    { cleanupOutcome: "failed" },
    { sensitiveMaterialScanPassed: false },
  ])("rejects contradictory pass evidence %#", (change) => {
    expect(() => createProviderProbeEvidence({
      ...SAFE_EVIDENCE,
      ...change,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it("rejects an otherwise valid pass that reports a cookie write", () => {
    expect(() => createProviderProbeEvidence({
      ...SAFE_EVIDENCE,
      cookieWriteCount: 1,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it.each([
    { cleanupOutcome: "failed" },
    { errorClass: "cleanup-failed" },
    { sensitiveMaterialScanPassed: false },
    {
      errorClass: "sensitive-material-detected",
      sensitiveMaterialScanPassed: true,
    },
    { cleanupOutcome: "not-needed", userDelta: 1 },
  ])("rejects contradictory fail evidence %#", (change) => {
    expect(() => createProviderProbeEvidence({
      ...FAIL_EVIDENCE,
      ...change,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it.each([
    { userDelta: 1 },
    { sessionDelta: 1 },
    { messageDelta: 1 },
    { cookieWriteCount: 1 },
    { cleanupOutcome: "complete" },
  ])("rejects contradictory blocked evidence %#", (change) => {
    expect(() => createProviderProbeEvidence({
      ...BLOCKED_EVIDENCE,
      ...change,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it("rejects blocked evidence that asserts an identity match", () => {
    expect(() => createProviderProbeEvidence({
      ...BLOCKED_EVIDENCE,
      identityMatched: true,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it("rejects blocked evidence that asserts a provider lifetime", () => {
    expect(() => createProviderProbeEvidence({
      ...BLOCKED_EVIDENCE,
      providerLifetimeSeconds: 3600,
    })).toThrow("provider_probe_evidence_incoherent_outcome");
  });

  it("accepts a blocked no-effect record", () => {
    expect(createProviderProbeEvidence(BLOCKED_EVIDENCE)).toMatchObject({
      outcome: "blocked",
      errorClass: "provider-denied",
      cleanupOutcome: "not-attempted",
    });
  });
});
