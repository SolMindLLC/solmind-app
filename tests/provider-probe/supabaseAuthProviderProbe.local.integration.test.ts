// Opt-in local Supabase Auth provider probes (backlog item 70; login step 3).
//
// SKIPPED BY DEFAULT. The probe suite runs only when the banked kernel's two exact
// interlocks are present in the environment and its other settings validate. The
// interlocks are code-visible technical gates, never human authorization: a run also
// needs Paul's exact current approval, given after he has seen the impact display that
// the preview phase writes (README.md, "The run procedure").
//
// Reading the settings never throws here: unsafe enabled settings show as one failing
// test with a value-free code, instead of breaking the import.
//
// Phases. With SOLMIND_PROVIDER_PROBE_PHASE=preview only PP-00 runs: it reads, makes no
// effect, and writes the impact display with its approval digest. With
// SOLMIND_PROVIDER_PROBE_PHASE=run, PP-00 repeats and refuses before any effect unless
// the display it computes has the digest Paul approved; then every step runs in the
// fixed order, and the afterAll safety net still cleans up and writes the evidence if a
// step was skipped. This file sees only value-free step summaries.
//
// Merged and deferred (decision D and the kernel's closed probe ids): PP-05 is merged
// into PP-04, which runs against the current settings; session renewal and email change
// are deferred.
//
// R6: PP-00 observes the running stack first and stops with no effect unless its
// workdir, project id and API URL all match; a stopped step shows its value-free stop
// code in the failed assertion. PP-07 is a pre-bridge provider-id rule check, not a test
// of the bridge, whose real-seam deny test is still owed.

import { afterAll, describe, expect, it } from "vitest";

import {
  createProviderProbeSession,
  PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS,
  PROVIDER_PROBE_STEPS,
  providerProbeStepTimeoutMilliseconds,
  readProviderProbeSuiteState,
  type ProviderProbeSession,
  type ProviderProbeStep,
} from "./providerProbeSuiteGate";

const suite = readProviderProbeSuiteState(process.env);
const runPhase = suite.state === "enabled" && suite.phase === "run";

const STEP_TITLES: Readonly<Record<ProviderProbeStep, string>> = {
  "PP-00": "PP-00 preflight: the observed running stack, versions, baselines and the impact display",
  "PP-01": "PP-01 existing Explorer fixture created through the Auth admin API",
  "PP-02": "PP-02 generate-only magic link: exact shape, matching user, no message",
  "PP-03": "PP-03 internal exchange, getUser recognition and one-time use",
  "PP-04": "PP-04 (PP-05 merged) sign-up surfaces refused by policy now, and existing-account email sign-in",
  "PP-06": "PP-06 credential sign-in and failure opacity",
  "PP-07": "PP-07 pre-bridge provider-id rule check (a local comparison; the bridge's own deny test is still owed)",
  "PP-08": "PP-08 duplicate create, locate and retry",
  "PP-09": "PP-09 generateLink for a missing user",
  "PP-10": "PP-10 usable session length: min(measured, configured) minus 60 seconds",
  "PP-06-rate": "PP-06 bounded rate behaviour, after every other sign-in",
  "PP-11": "PP-11 sign-out and exact cleanup, at most three tries, then stop for Paul",
  "PP-12": "PP-12 final no-side-effect proof",
  evidence: "writes the one scanned evidence document",
};

describe("provider probe opt-in gate (always runs)", () => {
  it("is not given unsafe enabled settings", () => {
    expect(suite.state === "refused" ? suite.code : "none").toBe("none");
  });
});

describe.skipIf(suite.state !== "enabled")("local Supabase Auth provider probes", () => {
  let session: ProviderProbeSession | null = null;

  // Steps run one at a time inside the session, and each test's timeout covers its
  // step's own waits and requests, so a slow stack cannot make steps overlap.
  afterAll(async () => {
    await session?.finish();
  }, PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS);

  it(
    STEP_TITLES["PP-00"],
    async () => {
      session = createProviderProbeSession(process.env);
      const summary = await session.runStep("PP-00");
      // The stop code shows in a failure (for example "environment-unobserved").
      expect({ outcome: summary.outcome, code: summary.code }).toEqual({ outcome: runPhase ? "pass" : "preview", code: "none" });
    },
    providerProbeStepTimeoutMilliseconds("PP-00"),
  );

  for (const step of PROVIDER_PROBE_STEPS.slice(1)) {
    it.skipIf(!runPhase)(
      STEP_TITLES[step],
      async () => {
        expect(session).not.toBeNull();
        const summary = await session!.runStep(step);
        expect(summary.stoppedForPaul).toBe(false);
        expect({ outcome: summary.outcome, code: summary.code }).toEqual({
          outcome: step === "evidence" ? "written" : "pass",
          code: "none",
        });
      },
      providerProbeStepTimeoutMilliseconds(step),
    );
  }

  it.todo("deferred: session renewal (refresh rotation and reuse); needs a kernel probe id");
  it.todo("deferred: email change (double confirmation); needs a kernel probe id");
});
