import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createProviderProbeEvidence,
  serializeProviderProbeEvidence,
  type ProviderProbeEvidence,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";
import { describeProviderProbeImpact } from "./providerProbeEnvironment";
import { PROVIDER_PROBE_APP_ROOT } from "./providerProbeLocalRoot";
import {
  assembleProviderProbeRunOutput,
  computeProviderProbeConfigDigest,
  createProviderProbeKnownValueRegistry,
  createProviderProbeRunEnvelope,
  isProviderProbeKnownValueRegistry,
  readInstalledSupabaseSdkVersions,
  scanProviderProbeOutput,
  withCountsBeyondEvidenceBounds,
  type ProviderProbeCountBeyondEvidenceBounds,
  type ProviderProbeKnownValueRegistry,
  type ProviderProbeObservedRun,
} from "./providerProbeRunEnvelope";
import { gatedTestEnvironment, testConfig } from "./providerProbeTestSupport";

// Plainly fake, in-memory configuration and values; nothing here reads process.env.
const CONFIG = testConfig(gatedTestEnvironment("envelope"));
const DIGEST = `sha256:${"ab".repeat(32)}`;
const OBSERVED: ProviderProbeObservedRun = {
  supabaseCliVersion: "2.115.0",
  supabaseJsVersion: "2.108.2",
  authJsVersion: "2.108.2",
  configDigest: DIGEST,
  configuredNotObserved: { anonymousSignIns: "disabled", phoneSignUp: "disabled" },
};

const BLOCKED_EVIDENCE = {
  probeId: "PP-00",
  profile: "current-config",
  outcome: "blocked",
  errorClass: "provider-denied",
  userDelta: 0,
  sessionDelta: 0,
  messageDelta: 0,
  requestCount: 0,
  identityMatched: null,
  cookieWriteCount: 0,
  providerLifetimeSeconds: null,
  cleanupOutcome: "not-needed",
  sensitiveMaterialScanPassed: true,
} as const;

// Fake values shaped like what a run would hold in memory.
const FAKE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.ZmFrZS1zaWduYXR1cmU";
const FAKE_CREDENTIAL = "Zq8-fake-generated-value_for-tests-only";
const FAKE_COOKIE_VALUE = "base64-fakecookievalueZXhhbXBsZQ";

function registryWith(...values: string[]): ProviderProbeKnownValueRegistry {
  const registry = createProviderProbeKnownValueRegistry();
  values.forEach((value) => registry.register(value));
  return registry;
}

describe("provider probe run envelope", () => {
  it("records the profile, run id, versions, config digest and the configured-not-observed surfaces, and nothing else", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);

    expect(envelope).toEqual({
      envelopeVersion: 3,
      profile: "current-config",
      runId: "P28-20261001-envelope",
      ...OBSERVED,
      countsBeyondEvidenceBounds: [],
    });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.configuredNotObserved)).toBe(true);
    expect(Object.isFrozen(envelope.countsBeyondEvidenceBounds)).toBe(true);
  });

  it.each([
    { supabaseCliVersion: "v2.115.0" },
    { supabaseCliVersion: "2.115" },
    { supabaseCliVersion: "2.115.0-beta.1" },
    { supabaseJsVersion: "02.108.2" },
    { authJsVersion: "" },
    { configDigest: "ab".repeat(32) },
    { configDigest: `sha256:${"AB".repeat(32)}` },
    { configDigest: `sha256:${"ab".repeat(31)}` },
    { configuredNotObserved: { anonymousSignIns: "observed-closed", phoneSignUp: "disabled" } },
    { configuredNotObserved: { anonymousSignIns: "disabled" } },
    { configuredNotObserved: { anonymousSignIns: "disabled", phoneSignUp: "disabled", emailSignUp: "disabled" } },
    { configuredNotObserved: null },
  ])("refuses observed value %j", (change) => {
    expect(() => createProviderProbeRunEnvelope(CONFIG, { ...OBSERVED, ...change } as unknown as ProviderProbeObservedRun)).toThrow(
      "provider_probe_envelope_invalid",
    );
  });

  it("refuses unknown or missing observed fields", () => {
    expect(() =>
      createProviderProbeRunEnvelope(CONFIG, { ...OBSERVED, apiUrl: "http://127.0.0.1:54321" } as ProviderProbeObservedRun),
    ).toThrow("provider_probe_envelope_invalid");
    const missing: Record<string, unknown> = { ...OBSERVED };
    delete missing.configDigest;
    expect(() => createProviderProbeRunEnvelope(CONFIG, missing as ProviderProbeObservedRun)).toThrow(
      "provider_probe_envelope_invalid",
    );
  });

  it("digests exact bytes", () => {
    expect(computeProviderProbeConfigDigest(new TextEncoder().encode(""))).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("reads the installed SDK versions from the pinned app root, matching the lockfile", () => {
    const versions = readInstalledSupabaseSdkVersions();
    const lock = JSON.parse(readFileSync(path.join(PROVIDER_PROBE_APP_ROOT, "package-lock.json"), "utf8")) as {
      packages: Record<string, { version?: string }>;
    };

    expect(readInstalledSupabaseSdkVersions.length).toBe(0);
    expect(versions).toEqual({
      supabaseJsVersion: lock.packages["node_modules/@supabase/supabase-js"]?.version,
      authJsVersion: lock.packages["node_modules/@supabase/auth-js"]?.version,
    });
  });
});

describe("known-value registry", () => {
  it("is branded, bounded and never returns what it holds", () => {
    const registry = registryWith(FAKE_CREDENTIAL);

    expect(isProviderProbeKnownValueRegistry(registry)).toBe(true);
    expect(isProviderProbeKnownValueRegistry({ register: () => undefined, size: () => 1 })).toBe(false);
    expect(registry.size()).toBe(1);
    expect(JSON.stringify(registry)).toBe("{}");
    expect(Object.keys(registry).sort()).toEqual(["register", "size"]);
    expect(() => registry.register("seven77")).toThrow("provider_probe_known_value_invalid");
    expect(() => registry.register("x".repeat(8_193))).toThrow("provider_probe_known_value_invalid");
  });
});

describe("output scanner: kernel rules, stricter rules and decoded forms", () => {
  it("passes value-free output", () => {
    expect(scanProviderProbeOutput('{"probeId":"PP-03","outcome":"pass","userDelta":1}')).toEqual({
      passed: true,
      kernelRuleMatched: false,
      strictRuleMatched: false,
      knownValueMatches: 0,
    });
  });

  it.each([
    ["an address sign", "recipient probe@synthetic.invalid"],
    ["a bearer scheme", "Authorization: Bearer x"],
    ["a bearer scheme after a newline", "line one\nBearer x"],
    ["a bearer scheme after a tab", "header:\tBearer x"],
    ["a version 4 UUID", "id 11111111-1111-4111-8111-111111111111"],
    ["a JWT", `jwt ${FAKE_JWT}`],
    ["a credential word", "the password field"],
    ["a session word (access)", "access_token"],
    ["a session word (refresh)", "refresh_token"],
    ["a link word", "action_link"],
    ["a one-time code word", "email_otp"],
    ["a hash word", "hashed_token"],
    ["a key word", "apikey"],
    ["a secret word", "client_secret"],
    ["a percent-encoded address", "to=probe%40synthetic.invalid"],
    ["a twice percent-encoded address", "to=probe%2540synthetic.invalid"],
    ["a JSON-escaped address", "to=probe\\u0040synthetic.invalid"],
    ["an HTML-encoded address", "to=probe&#64;synthetic.invalid"],
    ["a percent-encoded secret word", "pass%77ord"],
  ])("flags %s with the kernel's rules", (_label, text) => {
    const scan = scanProviderProbeOutput(text);

    expect(scan.passed).toBe(false);
    expect(scan.kernelRuleMatched).toBe(true);
    expect(JSON.stringify(scan)).not.toContain(text);
  });

  it.each([
    ["a version 7 UUID", "id 01890a5d-ac96-774b-bcce-b302099a8057"],
    ["the nil UUID", "id 00000000-0000-0000-0000-000000000000"],
    ["a version 6 UUID", "id 1ec9414c-232a-6b00-b3c8-9e6bdeced846"],
    ["a version 8 UUID", "id 320c3d4d-cc00-875b-8ec9-32d5f69181c0"],
    ["an upper-case UUID", "id 01890A5D-AC96-774B-BCCE-B302099A8057"],
    ["a hyphen-free UUID", "id 01890a5dac96774bbcceb302099a8057"],
    ["a percent-encoded version 7 UUID", "id 01890a5d%2Dac96%2D774b%2Dbcce%2Db302099a8057"],
    ["the word token", "provider_token"],
  ])("flags %s with the stricter rules, which the kernel alone misses", (_label, text) => {
    let kernelRejects = false;
    try {
      serializeProviderProbeEvidence({ sample: text } as unknown as ProviderProbeEvidence);
    } catch {
      kernelRejects = true;
    }
    const scan = scanProviderProbeOutput(text);

    expect(kernelRejects).toBe(false);
    expect(scan.strictRuleMatched).toBe(true);
    expect(scan.passed).toBe(false);
  });

  it("counts registered values in exact, encoded and base64 forms, without returning them", () => {
    const quoted = 'fake"value\\for-tests';
    const registry = registryWith(FAKE_CREDENTIAL, "fake value/for tests", quoted, FAKE_COOKIE_VALUE, "not-present-anywhere");
    const text = [
      `plain ${FAKE_CREDENTIAL}`,
      `encoded ${encodeURIComponent("fake value/for tests")}`,
      `json ${JSON.stringify(quoted)}`,
      `cookie ${Buffer.from(FAKE_COOKIE_VALUE).toString("base64url")}`,
    ].join(" ");

    const scan = scanProviderProbeOutput(text, registry);

    expect(scan.knownValueMatches).toBe(4);
    expect(scan.passed).toBe(false);
    expect(JSON.stringify(scan)).not.toContain(FAKE_CREDENTIAL);
  });

  it("refuses a registry it did not make", () => {
    expect(() =>
      scanProviderProbeOutput("x", { register: () => undefined, size: () => 0 } as ProviderProbeKnownValueRegistry),
    ).toThrow("provider_probe_scan_invalid_registry");
  });
});

describe("the closed output boundary", () => {
  it("passes every legitimate output through the stricter scanner", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, {
      ...OBSERVED,
      configDigest: computeProviderProbeConfigDigest(new TextEncoder().encode("example config bytes")),
    });
    const evidenceValues = {
      probeId: ["PP-00", "PP-01", "PP-02", "PP-03", "PP-04", "PP-05", "PP-06", "PP-07", "PP-08", "PP-09", "PP-10", "PP-11", "PP-12"],
      outcome: ["pass", "fail", "blocked"],
      errorClass: [
        "none",
        "invalid-request",
        "identity-mismatch",
        "rate-limited",
        "provider-denied",
        "cleanup-failed",
        "sensitive-material-detected",
        "unexpected",
      ],
      cleanupOutcome: ["not-needed", "not-attempted", "complete", "failed"],
      profile: ["current-config", "locked-down"],
    };
    const impact = describeProviderProbeImpact(CONFIG, {
      users: { expectedMin: 10, expectedMax: 10, plannedMax: 10, capacity: 10 },
      sessions: { expectedMin: 0, expectedMax: 10, plannedMax: 10, capacity: 10 },
      messages: { expectedMin: 100, expectedMax: 100, plannedMax: 100, capacity: 100 },
    });

    expect(scanProviderProbeOutput(JSON.stringify(envelope)).passed).toBe(true);
    expect(scanProviderProbeOutput(JSON.stringify(BLOCKED_EVIDENCE)).passed).toBe(true);
    expect(scanProviderProbeOutput(JSON.stringify(evidenceValues)).passed).toBe(true);
    for (const line of impact) {
      expect(scanProviderProbeOutput(line).passed).toBe(true);
    }
  });

  it("assembles the envelope and kernel-validated evidence into one scanned document", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);
    const callerRecord = { ...BLOCKED_EVIDENCE };

    const output = assembleProviderProbeRunOutput({
      envelope,
      evidence: [callerRecord],
      registry: registryWith(FAKE_CREDENTIAL, FAKE_JWT),
    });

    expect(JSON.parse(output)).toEqual({ envelope, evidence: [BLOCKED_EVIDENCE] });
    expect(Object.isFrozen(callerRecord)).toBe(false);
  });

  it("requires a genuine registry", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);

    for (const registry of [undefined, null, { register: () => undefined, size: () => 0 }]) {
      expect(() =>
        assembleProviderProbeRunOutput({
          envelope,
          evidence: [],
          registry: registry as unknown as ProviderProbeKnownValueRegistry,
        }),
      ).toThrow("provider_probe_output_registry_required");
    }
  });

  it("refuses evidence the kernel refuses, including probe ids it does not know", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);
    const registry = registryWith(FAKE_CREDENTIAL);

    expect(() =>
      assembleProviderProbeRunOutput({ envelope, evidence: [{ ...BLOCKED_EVIDENCE, note: "free text" }], registry }),
    ).toThrow("provider_probe_evidence_unapproved_field");
    expect(() =>
      assembleProviderProbeRunOutput({ envelope, evidence: [{ ...BLOCKED_EVIDENCE, probeId: "PP-13" }], registry }),
    ).toThrow("provider_probe_evidence_invalid_value");
  });

  it("refuses a widened envelope and output that would contain a registered value", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);

    expect(() =>
      assembleProviderProbeRunOutput({
        envelope: { ...envelope, apiUrl: "http://127.0.0.1:54321" } as unknown as typeof envelope,
        evidence: [],
        registry: registryWith(FAKE_CREDENTIAL),
      }),
    ).toThrow("provider_probe_envelope_invalid");
    expect(() =>
      assembleProviderProbeRunOutput({ envelope, evidence: [], registry: registryWith(envelope.runId) }),
    ).toThrow("provider_probe_output_secret_pattern");
  });

  it("accepts every probe outcome shape the kernel accepts", () => {
    const pass = createProviderProbeEvidence({
      ...BLOCKED_EVIDENCE,
      probeId: "PP-03",
      outcome: "pass",
      errorClass: "none",
      userDelta: 1,
      sessionDelta: 1,
      requestCount: 3,
      identityMatched: true,
      providerLifetimeSeconds: 3600,
      cleanupOutcome: "complete",
    });

    expect(() =>
      assembleProviderProbeRunOutput({
        envelope: createProviderProbeRunEnvelope(CONFIG, OBSERVED),
        evidence: [pass, BLOCKED_EVIDENCE],
        registry: registryWith(FAKE_CREDENTIAL),
      }),
    ).not.toThrow();
  });
});

// R11 (re-check #128f): a record count outside the kernel's evidence bounds is written as
// the bound and named in the envelope ("more than 10"); assembly checks each name against
// its record.
describe("counts beyond the kernel's evidence bounds (envelope version 3)", () => {
  // A failed record whose user count is held at the kernel's maximum of 10.
  const AT_USER_MAXIMUM = {
    ...BLOCKED_EVIDENCE,
    probeId: "PP-06",
    outcome: "fail",
    errorClass: "cleanup-failed",
    userDelta: 10,
    requestCount: 12,
    cleanupOutcome: "failed",
  } as const;
  const MORE_THAN_10_USERS: ProviderProbeCountBeyondEvidenceBounds = {
    record: 1,
    probeId: "PP-06",
    field: "userDelta",
    relation: "more-than",
    limit: 10,
  };

  function assemble(entries: readonly ProviderProbeCountBeyondEvidenceBounds[], evidence: readonly unknown[]): string {
    return assembleProviderProbeRunOutput({
      envelope: withCountsBeyondEvidenceBounds(createProviderProbeRunEnvelope(CONFIG, OBSERVED), entries),
      evidence,
      registry: registryWith(FAKE_CREDENTIAL),
    });
  }

  it("writes each named count beside a record that holds exactly the bound and did not pass", () => {
    const lessThanZero: ProviderProbeCountBeyondEvidenceBounds = {
      record: 0,
      probeId: "PP-00",
      field: "messageDelta",
      relation: "less-than",
      limit: 0,
    };
    const output = JSON.parse(assemble([MORE_THAN_10_USERS, lessThanZero], [BLOCKED_EVIDENCE, AT_USER_MAXIMUM]));

    expect(output.envelope.envelopeVersion).toBe(3);
    expect(output.envelope.countsBeyondEvidenceBounds).toEqual([MORE_THAN_10_USERS, lessThanZero]);
    expect(output.evidence[1]).toMatchObject({ probeId: "PP-06", outcome: "fail", userDelta: 10 });
  });

  it.each([
    ["a limit that is not the field's maximum", { limit: 11 }],
    ["a below-zero marker paired with the maximum", { relation: "less-than" }],
    ["an unknown relation", { relation: "exactly" }],
    ["a field the kernel does not bound by count", { field: "cookieWriteCount" }],
    ["an inherited property name as the field", { field: "toString" }],
    ["a record position past the evidence limit", { record: 32 }],
    ["a negative record position", { record: -1 }],
    ["a fractional record position", { record: 1.5 }],
    ["a probe id the kernel does not know", { probeId: "PP-13" }],
    ["an extra key", { exactCount: 11 }],
  ])("refuses a marker with %s", (_label, change) => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);

    expect(() =>
      withCountsBeyondEvidenceBounds(envelope, [{ ...MORE_THAN_10_USERS, ...change } as unknown as ProviderProbeCountBeyondEvidenceBounds]),
    ).toThrow("provider_probe_envelope_invalid");
  });

  it("refuses a missing key, a repeated record and field, and a list that is not a list", () => {
    const envelope = createProviderProbeRunEnvelope(CONFIG, OBSERVED);
    const missing: Record<string, unknown> = { ...MORE_THAN_10_USERS };
    delete missing.limit;

    expect(() =>
      withCountsBeyondEvidenceBounds(envelope, [missing as unknown as ProviderProbeCountBeyondEvidenceBounds]),
    ).toThrow("provider_probe_envelope_invalid");
    expect(() => withCountsBeyondEvidenceBounds(envelope, [MORE_THAN_10_USERS, MORE_THAN_10_USERS])).toThrow(
      "provider_probe_envelope_invalid",
    );
    expect(() =>
      withCountsBeyondEvidenceBounds(envelope, "more than 10" as unknown as ProviderProbeCountBeyondEvidenceBounds[]),
    ).toThrow("provider_probe_envelope_invalid");
    expect(() =>
      assembleProviderProbeRunOutput({
        envelope: { ...envelope, envelopeVersion: 2 } as unknown as typeof envelope,
        evidence: [],
        registry: registryWith(FAKE_CREDENTIAL),
      }),
    ).toThrow("provider_probe_envelope_invalid");
  });

  it.each([
    ["names a record that does not exist", [MORE_THAN_10_USERS], [BLOCKED_EVIDENCE]],
    ["names the wrong probe", [{ ...MORE_THAN_10_USERS, probeId: "PP-07" }], [BLOCKED_EVIDENCE, AT_USER_MAXIMUM]],
    ["names a field below the bound", [MORE_THAN_10_USERS], [BLOCKED_EVIDENCE, { ...AT_USER_MAXIMUM, userDelta: 9 }]],
    [
      "names a record that passed",
      [MORE_THAN_10_USERS],
      [BLOCKED_EVIDENCE, { ...AT_USER_MAXIMUM, outcome: "pass", errorClass: "none", cleanupOutcome: "complete" }],
    ],
  ])("refuses output whose marker %s", (_label, entries, evidence) => {
    expect(() => assemble(entries as ProviderProbeCountBeyondEvidenceBounds[], evidence)).toThrow(
      "provider_probe_output_invalid_evidence",
    );
  });
});
