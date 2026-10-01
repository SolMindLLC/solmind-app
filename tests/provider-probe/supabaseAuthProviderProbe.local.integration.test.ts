// Opt-in local Supabase Auth provider probes (backlog item 70; login step 3).
//
// SKIPPED BY DEFAULT. The probe suite runs only when the banked kernel's two exact
// interlocks are present in the environment and its other settings validate. The
// interlocks are code-visible technical gates, never human authorization: a run
// also needs Paul's exact current approval after he has seen the observed
// environment and the impact display.
//
// Reading the settings never throws here: unsafe enabled settings show as one
// failing test with the kernel's value-free code, instead of breaking the import.
// This revision holds only the wiring and the gate. The enabled branch calls
// `verifyProviderProbeWiring`, which providerProbeSuiteGate.test.ts also runs with a
// fake environment; it reads no key and sends no request. The probe bodies (PP-00
// to PP-12) come in a later revision, after Paul's open decisions.

import { describe, expect, it } from "vitest";

import { readProviderProbeSuiteState, verifyProviderProbeWiring } from "./providerProbeSuiteGate";

const suite = readProviderProbeSuiteState(process.env);

describe("provider probe opt-in gate (always runs)", () => {
  it("is not given unsafe enabled settings", () => {
    expect(suite.state === "refused" ? suite.code : "none").toBe("none");
  });
});

describe.skipIf(suite.state !== "enabled")("local Supabase Auth provider probes (wiring only)", () => {
  it("builds the run wiring without reading a key or sending a request", () => {
    const summary = verifyProviderProbeWiring(process.env);

    expect(summary.recordedAuthUsers + summary.recordedMailpitMessages).toBe(0);
  });

  it.todo("PP-00 preflight: environment comparison, baseline counts, impact display, approval");
  it.todo("PP-01 existing Explorer fixture created through the Auth admin API");
  it.todo("PP-02 generate-only magic-link shape, with no captured message");
  it.todo("PP-03 internal token exchange, getUser identity match, one-time use");
  it.todo("PP-04 current-config public sign-up and sign-in surface (open decision)");
  it.todo("PP-05 locked-down public posture (open decision: workdir)");
  it.todo("PP-06 email credential sign-in: success, failure and bounded rate behaviour");
  it.todo("PP-07 provider-id mismatch denial");
  it.todo("PP-08 duplicate create, locate and retry");
  it.todo("PP-09 missing-user generateLink race");
  it.todo("PP-10 provider lifetime and the safety margin (open decision: margin)");
  it.todo("PP-11 cleanup and cleanup failure");
  it.todo("PP-12 final no-side-effect proof");
});
