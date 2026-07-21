import { describe, expect, it } from "vitest";

import {
  PROVIDER_PROBE_APPROVAL_GATE,
  PROVIDER_PROBE_EFFECT_GATE,
  readProviderProbeSafetyConfig,
} from "./providerProbeConfig";

const SAFE_ENV = {
  SOLMIND_PROVIDER_PROBE_APPROVAL: PROVIDER_PROBE_APPROVAL_GATE,
  SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: PROVIDER_PROBE_EFFECT_GATE,
  SOLMIND_PROVIDER_PROBE_RUN_ID: "P28-20260716-abcdef",
  SOLMIND_PROVIDER_PROBE_PROFILE: "current-config",
  SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
  SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL:
    "probe+p28-20260716-abcdef@synthetic.invalid",
  SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: "60",
} as const;

describe("provider probe safety config", () => {
  it("stays disabled unless both explicit gates match", () => {
    expect(readProviderProbeSafetyConfig({})).toBeNull();
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: "not-approved",
    })).toBeNull();
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_APPROVAL:
        ` ${PROVIDER_PROBE_APPROVAL_GATE}`,
    })).toBeNull();
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS:
        `${PROVIDER_PROBE_EFFECT_GATE} `,
    })).toBeNull();
  });

  it("accepts a loopback-only reserved-domain configuration", () => {
    const config = readProviderProbeSafetyConfig(SAFE_ENV);
    expect(config).toEqual({
      profile: "current-config",
      expectedProjectId: "solmind-app",
      expectedApiPort: 54321,
      runId: "P28-20260716-abcdef",
      localSupabaseUrl: "http://127.0.0.1:54321",
      syntheticEmail: "probe+p28-20260716-abcdef@synthetic.invalid",
      lifetimeSafetyMarginSeconds: 60,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    "https://example.com",
    "http://supabase.internal:54321",
    "http://user:password@127.0.0.1:54321",
    "http://127.0.0.1:55421",
    "http://127.0.0.1:54321/rest/v1",
    "http://127.0.0.1:54321?linked=true",
    "http://127.0.0.1:54321#linked",
  ])("rejects unsafe or ambiguous endpoint %s", (url) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_LOCAL_SUPABASE_URL: url,
    })).toThrow("provider_probe_non_loopback_or_ambiguous_url");
  });

  it("pins the locked-down profile to its separate project and port", () => {
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
      SOLMIND_LOCAL_SUPABASE_URL: "http://[::1]:55421",
    })).toMatchObject({
      profile: "locked-down",
      expectedProjectId: "solmind-provider-probe-locked-down",
      expectedApiPort: 55421,
      localSupabaseUrl: "http://[::1]:55421",
    });
  });

  it.each([
    "http://localhost:54321",
    "https://127.0.0.1:54321",
  ])("rejects hostname or protocol ambiguity %s", (url) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_LOCAL_SUPABASE_URL: url,
    })).toThrow("provider_probe_non_loopback_or_ambiguous_url");
  });

  it.each([
    [
      "person@example.com",
      "provider_probe_recipient_not_reserved_synthetic_domain",
    ],
    [
      "person@synthetic.invalid",
      "provider_probe_recipient_missing_run_marker",
    ],
    [
      "PROBE+P28-20260716-ABCDEF@synthetic.invalid",
      "provider_probe_invalid_synthetic_email",
    ],
  ])("rejects recipient %s", (syntheticEmail, expectedError) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: syntheticEmail,
    })).toThrow(expectedError);
  });

  it.each(["0", "301", "60.5", "abc"])(
    "rejects lifetime margin %s",
    (margin) => {
      expect(() => readProviderProbeSafetyConfig({
        ...SAFE_ENV,
        SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: margin,
      })).toThrow("provider_probe_invalid_lifetime_margin");
    },
  );

  it.each([
    "P28-2026071-abcdef",
    "P28-20260716-ABCDEF",
    "p28-20260716-abcdef",
    "P28-20260716-ab",
    "x",
  ])("rejects invalid run id %s", (runId) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_RUN_ID: runId,
    })).toThrow("provider_probe_invalid_run_id");
  });

  it("rejects an unapproved profile", () => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_PROFILE: "prod",
    })).toThrow("provider_probe_invalid_profile");
  });

  it.each([
    [
      "SOLMIND_PROVIDER_PROBE_RUN_ID",
      "provider_probe_missing_solmind_provider_probe_run_id",
    ],
    [
      "SOLMIND_PROVIDER_PROBE_PROFILE",
      "provider_probe_missing_solmind_provider_probe_profile",
    ],
    [
      "SOLMIND_LOCAL_SUPABASE_URL",
      "provider_probe_missing_solmind_local_supabase_url",
    ],
    [
      "SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL",
      "provider_probe_missing_solmind_provider_probe_synthetic_email",
    ],
    [
      "SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS",
      "provider_probe_missing_solmind_provider_probe_lifetime_margin_seconds",
    ],
  ])("rejects missing required variable %s", (name, expectedError) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      [name]: undefined,
    })).toThrow(expectedError);
  });

  it.each(["1", "300"])(
    "accepts lifetime margin boundary %s",
    (margin) => {
      expect(readProviderProbeSafetyConfig({
        ...SAFE_ENV,
        SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: margin,
      })).toMatchObject({
        lifetimeSafetyMarginSeconds: Number(margin),
      });
    },
  );

  it("trims required values after exact untrimmed gates pass", () => {
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_RUN_ID:
        ` ${SAFE_ENV.SOLMIND_PROVIDER_PROBE_RUN_ID} `,
      SOLMIND_PROVIDER_PROBE_PROFILE:
        ` ${SAFE_ENV.SOLMIND_PROVIDER_PROBE_PROFILE} `,
      SOLMIND_LOCAL_SUPABASE_URL:
        ` ${SAFE_ENV.SOLMIND_LOCAL_SUPABASE_URL} `,
      SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL:
        ` ${SAFE_ENV.SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL} `,
      SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: " 60 ",
    })).toEqual({
      profile: "current-config",
      expectedProjectId: "solmind-app",
      expectedApiPort: 54321,
      runId: "P28-20260716-abcdef",
      localSupabaseUrl: "http://127.0.0.1:54321",
      syntheticEmail: "probe+p28-20260716-abcdef@synthetic.invalid",
      lifetimeSafetyMarginSeconds: 60,
    });
  });

  it("accepts a 64-character run-tagged synthetic local part", () => {
    const runMarker = SAFE_ENV.SOLMIND_PROVIDER_PROBE_RUN_ID.toLowerCase();
    const localPart = `${runMarker}${"a".repeat(64 - runMarker.length)}`;
    expect(readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL:
        `${localPart}@synthetic.invalid`,
    })).toMatchObject({
      syntheticEmail: `${localPart}@synthetic.invalid`,
    });
  });

  it.each([
    (() => {
      const runMarker = SAFE_ENV.SOLMIND_PROVIDER_PROBE_RUN_ID.toLowerCase();
      return `${runMarker}${"a".repeat(65 - runMarker.length)}@synthetic.invalid`;
    })(),
    "probe$p28-20260716-abcdef@synthetic.invalid",
  ])("rejects invalid synthetic local part %s", (syntheticEmail) => {
    expect(() => readProviderProbeSafetyConfig({
      ...SAFE_ENV,
      SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: syntheticEmail,
    })).toThrow("provider_probe_recipient_missing_run_marker");
  });
});
