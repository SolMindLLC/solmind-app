// RESTRICTED test-only probe core: the bodies of the local Supabase Auth provider probes
// PP-00 to PP-12 (backlog item 70; contract 21 section 7.9), as adjusted by Paul's
// decision D (2026-10-01): exact-ID cleanup of only what the run created; a 60-second
// lifetime margin; no separate locked-down settings copy, but the checks of Supabase's
// own magic-link and email-code sign-in for existing accounts kept, with the public
// sign-up surface; a stop for Paul when any test user cannot be cleaned up after three
// tries; and test users created at run-minted addresses.
//
// It accepts a run and test seams (clock, wait, stack observer, output writer), so only
// the production suite gate (`providerProbeSuiteGate.ts`, which passes the real ones) and
// named unit tests may import it; `providerProbeModuleBoundary.test.ts` enforces that.
//
// R6 (after review #128a):
// - PP-00 first observes the running stack (its workdir and project labels and its API
//   port, `providerProbeStackObserver.ts`) and stops with no effect, before any request
//   to it, unless all three match this checkout and the kernel ("environment-unobserved"
//   or "environment-mismatch").
// - The anonymous and phone sign-up attempts are removed: neither had a minted address.
//   What this checkout's settings file configures for those two surfaces is recorded as
//   "configured, not observed" (the envelope and the display); item 70's anon-key check
//   of them stays owed, a decision for Paul.
// - A pass needs a confirmed answer: a closed surface passes only on a policy refusal
//   with no new user, session or message; an existing-account sign-in only when the code
//   or link signs that same account in; PP-03's replay only on an expired-or-invalid
//   refusal; PP-08 only with exactly one success and one duplicate refusal; PP-09 only
//   on a conclusive answer. A transport or input failure is never a pass.
// - Each record may make at most 100 requests (the kernel's bound), enforced through the
//   run's request allowance; cleanup has none. Every step's test timeout is derived from
//   its own worst case: its waits, its request bound times the transport's per-request
//   timeout, and (PP-00) the observer's two command timeouts.
// - (R6b) The impact display never shows the checkout's path, so it passes the scanner
//   wherever the checkout lives; a run id the scanner would refuse stops PP-00 before
//   any request.
//
// R7 (after re-check #128b):
// - PP-00's observer pins the local Docker engine and refuses a remote or non-default
//   engine setting before running docker, and before any Auth request
//   (`providerProbeStackObserver.ts`).
// - PP-01 and PP-06 count an admin creation that could not be attributed as an untracked
//   user, which stops every further effect (PP-11 then stops for Paul). A creation
//   reconciled by its minted address is tracked for exact-id cleanup but fails its record
//   and is not used as a fixture.
// - A refusal counts only when confirmed for the surface attempted: a refusal status and
//   a code from that surface's set (`PROVIDER_PROBE_REFUSALS`); the disabled provider also
//   by its message. PP-09 passes only on a success with exactly one created, tracked user,
//   or on a confirmed user_not_found with no user.
// - A session that comes with an error answer is held and signed out, and the answer
//   never passes (closed surfaces, PP-03's exchange and replay, the existing-account
//   exchanges, PP-06 and PP-07 require a clean success or a confirmed refusal).
//
// R8 (after re-check #128c):
// - A creating answer without a usable id whose follow-up listing fails counts one
//   unresolved user even after a confirmed refusal, so every further effect stops and the
//   run stops for Paul (closed surfaces, PP-08, PP-09).
// - PP-00's observer refuses an empty published host IP as undecidable.
// - The existing-account send's session is held and signed out; a send that carries one
//   fails its record.
//
// R9 (after re-check #128d):
// - An unresolved creation is counted by the Auth probe core at settlement, before any
//   processing of the answer that can throw, and this module reads that count after every
//   creating operation and every guarded step, also when the step threw. A malformed
//   session or an unregistrable property still fails its record, but can no longer lose
//   the count: effects stop as "untracked-effect" and PP-11 stops for Paul.
//
// R11 (after re-check #128f):
// - No count is silently reduced to fit the evidence record. The banked kernel holds
//   each record count only up to a fixed maximum (users and sessions 10, messages and
//   requests 100) and never below zero, and it stays unchanged. A count outside those
//   bounds is written as the bound itself, named in the envelope (version 3,
//   `countsBeyondEvidenceBounds`: for example PP-01's userDelta "more-than" 10), and
//   that record never passes; the evidence step then stops for Paul with the code
//   "count-beyond-evidence-bounds". Finalizing a record outside the bounds without
//   somewhere to name it throws instead. A "blocked" record that somehow carries an
//   effect is written as failed with its counts, not zeroed. Every later effect is
//   blocked as before, and nothing is deleted by a guessed id.
//
// R12 (after re-check #128g):
// - PP-11's and PP-12's cleanup field follows the run's actual cleanup state. PP-11
//   with more than 100 requests still fails (its request count is named in the envelope),
//   but no longer as failed cleanup when cleanup completed.
// - The written evidence step counts its failed records from the finalized evidence.
//
// What leaves this module: value-free step summaries, the impact display text, and the
// one evidence document, which is the run's own `assembleOutput` (closed envelope plus
// kernel-validated records, scanned against the run's registry). Every record is built
// from closed kinds and counts; a record that reflects any user, session or message is
// finalized only after cleanup has run, so its cleanup field is a fact.
//
// Two phases. "preview" runs PP-00 only (reads, no effect) and writes the impact display
// with its approval digest. "run" repeats PP-00 and refuses before any effect unless the
// digest it computes equals the digest Paul approved, then runs the steps in the fixed
// order below. Merged or deferred: PP-05 is merged into PP-04 (decision D: no locked-down
// copy); session renewal and email change are deferred (they need kernel probe ids).

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import type {
  ProviderProbeErrorClass,
  ProviderProbeId,
  ProviderProbeOutcome,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";
import {
  PROVIDER_PROBE_AUTH_LIMITS,
  type ProviderProbeAuthErrorKind,
  type ProviderProbeAuthProbe,
  type ProviderProbeAuthUserHandle,
  type ProviderProbeCreationFacts,
  type ProviderProbeLinkHandle,
  type ProviderProbeSessionHandle,
} from "./providerProbeAuthProbeCore";
import {
  compareProviderProbeEnvironment,
  describeProviderProbeImpact,
  readProviderProbeCheckoutProjectId,
  readVerifiedProviderProbeConfigDigest,
  readVerifiedProviderProbeConfiguredSurfaces,
  readVerifiedProviderProbeJwtExpiry,
  type ProviderProbeEnvironmentComparison,
} from "./providerProbeEnvironment";
import { PROVIDER_PROBE_TRANSPORT_LIMITS } from "./providerProbeLoopbackFetch";
import type { ProviderProbeRun } from "./providerProbeRun";
import {
  computeProviderProbeConfigDigest,
  createProviderProbeRunEnvelope,
  PROVIDER_PROBE_EVIDENCE_BOUNDS,
  readInstalledSupabaseSdkVersions,
  scanProviderProbeOutput,
  withCountsBeyondEvidenceBounds,
  type ProviderProbeCountBeyondEvidenceBounds,
  type ProviderProbeEvidenceCountField,
  type ProviderProbeRunEnvelope,
} from "./providerProbeRunEnvelope";

export type ProviderProbePhase = "preview" | "run";

export type ProviderProbeSuiteSettings = Readonly<{
  phase: ProviderProbePhase;
  anonKey: string;
  serviceRoleKey: string;
  cliVersion: string;
  approvedImpact: string | null;
}>;

export type ProviderProbeOutputKind = "impact-display" | "evidence";

export type ProviderProbeSuiteSeams = Readonly<{
  clock: () => number;
  wait: (milliseconds: number) => Promise<void>;
  // R6: the running stack's workdir, project id and API URL (an observation for
  // `compareProviderProbeEnvironment`), or a throw when they cannot be read.
  observeStack: () => Promise<unknown>;
  writeOutput: (kind: ProviderProbeOutputKind, text: string) => void;
}>;

// The fixed order. The integration file runs one test per step, in this order.
export const PROVIDER_PROBE_STEPS = Object.freeze([
  "PP-00",
  "PP-01",
  "PP-02",
  "PP-03",
  "PP-04",
  "PP-06",
  "PP-07",
  "PP-08",
  "PP-09",
  "PP-10",
  "PP-06-rate",
  "PP-11",
  "PP-12",
  "evidence",
] as const);

export type ProviderProbeStep = (typeof PROVIDER_PROBE_STEPS)[number];

export type ProviderProbeStepSummary = Readonly<{
  step: ProviderProbeStep;
  outcome: ProviderProbeOutcome | "preview" | "written" | "not-written";
  records: number;
  failedRecords: number;
  stoppedForPaul: boolean;
  code: ProviderProbeStopCode | "none";
}>;

export type ProviderProbeStopCode =
  | "preflight-refused"
  | "environment-unobserved"
  | "environment-mismatch"
  | "approval-mismatch"
  | "untracked-effect"
  | "unexpected-error"
  | "cleanup-incomplete"
  | "no-envelope"
  // R11: a record count was outside the kernel's evidence bounds (named in the envelope).
  | "count-beyond-evidence-bounds";

// Mirrors of limits owned by modules this core does not import (the cleanup ledger and
// the mail client, which are restricted, and the stack observer, which only the suite
// gate may import). `providerProbeProbes.test.ts` checks each against its source, so
// they cannot drift.
export const PROVIDER_PROBE_MIRRORED_LIMITS = Object.freeze({
  // providerProbeCleanupLedger.ts PROVIDER_PROBE_CLEANUP_LIMITS
  maxAuthUsers: 10,
  maxMailpitMessages: 100,
  maxCleanupRounds: 3,
  // providerProbeMailpitClient.ts MAILPIT_MAX_INVENTORY_PASSES and MAILPIT_MAX_PAGES
  mailInventoryPasses: 4,
  mailInventoryPages: 20,
  // providerProbeStackObserver.ts PROVIDER_PROBE_STACK_OBSERVER_LIMITS.timeoutMilliseconds
  observerCommandTimeoutMilliseconds: 10_000,
});

export const PROVIDER_PROBE_SUITE_LIMITS = Object.freeze({
  requiredCliVersion: "2.115.0",
  // Decision D: the lifetime margin is 60 seconds.
  requiredMarginSeconds: 60,
  // R6: each count as a conditional expected range, a planned maximum (if every check
  // found an unexpected result), and the capacity the run enforces, separately (README,
  // "What a run creates and deletes").
  // - Users: expected 3 (PP-01, PP-06, PP-08) plus PP-09's missing-address user if the
  //   server creates it; planned at most 8: a second PP-08 create and the three sign-up
  //   attempts' minted addresses too.
  // - Sessions: expected 3 (PP-03, PP-06, PP-07) plus the two existing-account sign-ins
  //   if they work; planned at most 10: PP-03's replay, the credential sign-up, the wrong
  //   and unknown sign-ins and the rate check too.
  // - Messages: expected 0 to 2 (the existing-account code and link); planned at most 7:
  //   PP-02's and PP-09's links and the three sign-up attempts too.
  plan: Object.freeze({
    users: Object.freeze({ expectedMin: 3, expectedMax: 4, plannedMax: 8, capacity: PROVIDER_PROBE_MIRRORED_LIMITS.maxAuthUsers }),
    sessions: Object.freeze({ expectedMin: 3, expectedMax: 5, plannedMax: 10, capacity: PROVIDER_PROBE_AUTH_LIMITS.maxOpenSessions }),
    messages: Object.freeze({ expectedMin: 0, expectedMax: 2, plannedMax: 7, capacity: PROVIDER_PROBE_MIRRORED_LIMITS.maxMailpitMessages }),
  }),
  mailPollAttempts: 10,
  mailPollMilliseconds: 500,
  mailSettleMilliseconds: 1_500,
  // [auth.email] max_frequency = "1s": the second send to one address waits longer.
  resendWaitMilliseconds: 2_000,
  rateMaxAttempts: 40,
  lifetimeFieldTolerance: 2,
  lifetimeReceiptTolerance: 5,
  maxUsableLifetime: 3_600,
  // R6: the kernel's per-record request bound (requestCount <= 100), enforced per record
  // through the run's request allowance: the 101st request is refused before it is sent.
  recordRequestAllowance: 100,
});

// Time budgets (R6: derived from enforced or structural worst cases, not assumed).
// - Waits: the longest a step can spend in its own waits, computed from the limits above.
// - Requests: each record may make at most `recordRequestAllowance` requests, and each
//   request is bounded by the transport's whole-exchange timeout (10 seconds). PP-11
//   (cleanup) has no allowance; its bound is structural: every held session signed out
//   once, one late-mail inventory read (passes x pages), and three cleanup rounds over at
//   most every user and message the ledger can hold.
// - PP-00 also runs the stack observer: two docker commands, each with its own timeout.
// The integration file uses these, so Vitest never gives up on a step, or on the
// afterAll safety net, before that step's worst case has passed. They are ceilings for a
// stack that answers every request at the last moment; a normal run takes about a minute.
const SETTLE = PROVIDER_PROBE_SUITE_LIMITS.mailSettleMilliseconds;
const POLL = (PROVIDER_PROBE_SUITE_LIMITS.mailPollAttempts - 1) * PROVIDER_PROBE_SUITE_LIMITS.mailPollMilliseconds;
const STEP_WAIT_BUDGETS: Readonly<Record<ProviderProbeStep, number>> = {
  "PP-00": 0,
  "PP-01": 0,
  "PP-02": SETTLE,
  "PP-03": 0,
  // Three settle waits (the sign-up attempts), two existing-account sign-ins (each a poll
  // or a settle) and the resend wait.
  "PP-04": 3 * SETTLE + 2 * Math.max(POLL, SETTLE) + PROVIDER_PROBE_SUITE_LIMITS.resendWaitMilliseconds,
  "PP-06": 0,
  "PP-07": 0,
  "PP-08": 0,
  "PP-09": SETTLE,
  "PP-10": 0,
  "PP-06-rate": 0,
  "PP-11": SETTLE,
  "PP-12": 0,
  evidence: 0,
};
const RECORDS_PER_STEP: Readonly<Record<Exclude<ProviderProbeStep, "PP-11">, number>> = {
  "PP-00": 1,
  "PP-01": 1,
  "PP-02": 1,
  "PP-03": 1,
  "PP-04": 6,
  "PP-06": 2,
  "PP-07": 1,
  "PP-08": 1,
  "PP-09": 1,
  "PP-10": 1,
  "PP-06-rate": 1,
  "PP-12": 1,
  evidence: 0,
};
const CLEANUP_REQUEST_BOUND =
  PROVIDER_PROBE_AUTH_LIMITS.maxOpenSessions +
  PROVIDER_PROBE_MIRRORED_LIMITS.mailInventoryPasses * PROVIDER_PROBE_MIRRORED_LIMITS.mailInventoryPages +
  PROVIDER_PROBE_MIRRORED_LIMITS.maxCleanupRounds *
    (PROVIDER_PROBE_MIRRORED_LIMITS.maxAuthUsers + PROVIDER_PROBE_MIRRORED_LIMITS.maxMailpitMessages);
const OBSERVER_BOUND_MILLISECONDS = 2 * PROVIDER_PROBE_MIRRORED_LIMITS.observerCommandTimeoutMilliseconds;
const STEP_SLACK_MILLISECONDS = 10_000;

export function providerProbeStepWaitBudgetMilliseconds(step: ProviderProbeStep): number {
  return STEP_WAIT_BUDGETS[step];
}

// The most requests a step can make.
export function providerProbeStepRequestBound(step: ProviderProbeStep): number {
  return step === "PP-11" ? CLEANUP_REQUEST_BOUND : RECORDS_PER_STEP[step] * PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance;
}

export function providerProbeStepTimeoutMilliseconds(step: ProviderProbeStep): number {
  return (
    STEP_WAIT_BUDGETS[step] +
    providerProbeStepRequestBound(step) * PROVIDER_PROBE_TRANSPORT_LIMITS.timeoutMilliseconds +
    (step === "PP-00" ? OBSERVER_BOUND_MILLISECONDS : 0) +
    STEP_SLACK_MILLISECONDS
  );
}

// The afterAll safety net may first wait for a step in flight (at most that step's own
// worst case), then run PP-11, PP-12 and the evidence document.
export const PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS =
  Math.max(...PROVIDER_PROBE_STEPS.map(providerProbeStepTimeoutMilliseconds)) +
  providerProbeStepTimeoutMilliseconds("PP-11") +
  providerProbeStepTimeoutMilliseconds("PP-12") +
  providerProbeStepTimeoutMilliseconds("evidence");

type PendingRecord = {
  probeId: ProviderProbeId;
  outcome: ProviderProbeOutcome;
  errorClass: ProviderProbeErrorClass;
  userDelta: number;
  sessionDelta: number;
  messageDelta: number;
  requestCount: number;
  identityMatched: boolean | null;
  providerLifetimeSeconds: number | null;
};

type Snapshot = Readonly<{ users: number; sessions: number; messages: number; requests: number }>;

type CleanupState = "not-run" | "complete" | "failed";

type ProviderProbeMailpitInventory = ReturnType<ProviderProbeRun["createMailpitInventory"]>;

function fail(code: string): never {
  throw new Error(code);
}

// R11 (re-check #128f): a record count outside the kernel's evidence bounds, as found while
// finalizing one record (the caller adds the record's position and probe id).
export type ProviderProbeFieldBeyondBounds = Readonly<{
  field: ProviderProbeEvidenceCountField;
  relation: "more-than" | "less-than";
  limit: number;
}>;

// R11: a count as the kernel's record can hold it. A count above the field's maximum (or
// below zero) is written as that bound, and is reported in `found`; the caller passes the
// report on to the envelope ("more than 10") or throws. No count is ever silently reduced.
function boundedForEvidence(value: number, field: ProviderProbeEvidenceCountField, found: ProviderProbeFieldBeyondBounds[]): number {
  if (!Number.isSafeInteger(value)) {
    fail("provider_probe_count_invalid");
  }
  const maximum = PROVIDER_PROBE_EVIDENCE_BOUNDS[field];
  if (value > maximum) {
    found.push(Object.freeze({ field, relation: "more-than" as const, limit: maximum }));
    return maximum;
  }
  if (value < 0) {
    found.push(Object.freeze({ field, relation: "less-than" as const, limit: 0 }));
    return 0;
  }
  return value;
}

// Kernel coherence (providerProbeEvidence.ts): pass needs cleanup "complete" or
// "not-needed"; "not-needed" needs no effect; "failed" cleanup holds exactly when the
// error class is "cleanup-failed"; "blocked" needs no effect and null identity/lifetime.
//
// R11: every count goes through `boundedForEvidence`. Any count outside the bounds is
// added to `beyond`, for the envelope; when no `beyond` is given, such a record throws
// (`provider_probe_count_beyond_evidence_bounds`) instead of being written. A record with
// a count outside the bounds never passes. A "blocked" record that somehow carries an
// effect is written as failed with its counts, not zeroed.
export function finalizeProviderProbeRecord(
  record: PendingRecord,
  cleanup: CleanupState,
  beyond: ProviderProbeFieldBeyondBounds[] | null = null,
): Record<string, unknown> {
  const found: ProviderProbeFieldBeyondBounds[] = [];
  const userDelta = boundedForEvidence(record.userDelta, "userDelta", found);
  const sessionDelta = boundedForEvidence(record.sessionDelta, "sessionDelta", found);
  const messageDelta = boundedForEvidence(record.messageDelta, "messageDelta", found);
  const requestCount = boundedForEvidence(record.requestCount, "requestCount", found);
  if (found.length > 0) {
    if (beyond === null) {
      fail("provider_probe_count_beyond_evidence_bounds");
    }
    beyond.push(...found);
  }
  const rawEffect = record.userDelta !== 0 || record.sessionDelta !== 0 || record.messageDelta !== 0;
  const effect = userDelta + sessionDelta + messageDelta > 0;
  let { outcome, errorClass } = record;
  if (outcome === "blocked" && rawEffect) {
    outcome = "fail";
    errorClass = errorClass === "invalid-request" ? "unexpected" : errorClass;
  }
  if (outcome === "pass" && found.length > 0) {
    outcome = "fail";
    errorClass = "unexpected";
  }
  let cleanupOutcome: "not-needed" | "not-attempted" | "complete" | "failed";
  if (!effect) {
    cleanupOutcome = "not-needed";
  } else if (cleanup === "complete") {
    cleanupOutcome = "complete";
  } else if (cleanup === "failed") {
    cleanupOutcome = "failed";
    outcome = "fail";
    errorClass = "cleanup-failed";
  } else {
    cleanupOutcome = "not-attempted";
    outcome = "fail";
    errorClass = errorClass === "none" ? "unexpected" : errorClass;
  }
  if (outcome === "pass") {
    errorClass = "none";
  } else if (errorClass === "none") {
    errorClass = "unexpected";
  }
  if (outcome === "blocked") {
    // No effect (checked above): every delta is zero by count, not by override.
    return {
      probeId: record.probeId,
      profile: "current-config",
      outcome,
      errorClass: errorClass === "cleanup-failed" ? "unexpected" : errorClass,
      userDelta: 0,
      sessionDelta: 0,
      messageDelta: 0,
      requestCount,
      identityMatched: null,
      cookieWriteCount: 0,
      providerLifetimeSeconds: null,
      cleanupOutcome: "not-needed",
      sensitiveMaterialScanPassed: true,
    };
  }
  return {
    probeId: record.probeId,
    profile: "current-config",
    outcome,
    errorClass,
    userDelta,
    sessionDelta,
    messageDelta,
    requestCount,
    identityMatched: record.identityMatched,
    // The harness never writes a cookie: there is no cookie jar, and the transport
    // drops every Set-Cookie header before any client sees it.
    cookieWriteCount: 0,
    providerLifetimeSeconds: record.providerLifetimeSeconds,
    cleanupOutcome,
    sensitiveMaterialScanPassed: true,
  };
}

// PP-10: the usable session length is min(measured, configured) minus the margin,
// where measured is the smallest lifetime any probe session showed at receipt.
export function computeUsableSessionSeconds(
  sessions: readonly Readonly<{ expiresIn: number; expiresAt: number; jwtExp: number; jwtIat: number; receivedAtSeconds: number }>[],
  configuredSeconds: number,
  marginSeconds: number,
): Readonly<{ consistent: boolean; measuredSeconds: number | null; usableSeconds: number | null }> {
  if (sessions.length === 0 || !Number.isSafeInteger(configuredSeconds) || configuredSeconds < 1) {
    return { consistent: false, measuredSeconds: null, usableSeconds: null };
  }
  let consistent = true;
  let measured = Number.POSITIVE_INFINITY;
  for (const session of sessions) {
    const issued = session.jwtExp - session.jwtIat;
    const remainingAtReceipt = session.expiresAt - session.receivedAtSeconds;
    if (
      Math.abs(session.expiresAt - session.jwtExp) > PROVIDER_PROBE_SUITE_LIMITS.lifetimeFieldTolerance ||
      Math.abs(session.expiresIn - issued) > PROVIDER_PROBE_SUITE_LIMITS.lifetimeFieldTolerance ||
      Math.abs(remainingAtReceipt - session.expiresIn) > PROVIDER_PROBE_SUITE_LIMITS.lifetimeReceiptTolerance
    ) {
      consistent = false;
    }
    measured = Math.min(measured, session.expiresIn, issued, remainingAtReceipt);
  }
  const usable = Math.min(measured, configuredSeconds) - marginSeconds;
  return { consistent, measuredSeconds: measured, usableSeconds: usable };
}

function isRateLimited(kind: ProviderProbeAuthErrorKind): boolean {
  return kind === "rate-limited";
}

export function createProviderProbeSuiteCore(
  input: Readonly<{
    run: ProviderProbeRun;
    settings: ProviderProbeSuiteSettings;
    seams: ProviderProbeSuiteSeams;
  }>,
) {
  const { run, settings, seams } = input;
  if (
    !run ||
    typeof run.createAuthProbe !== "function" ||
    typeof run.limitRequests !== "function" ||
    !settings ||
    (settings.phase !== "preview" && settings.phase !== "run") ||
    !seams ||
    typeof seams.clock !== "function" ||
    typeof seams.wait !== "function" ||
    typeof seams.observeStack !== "function" ||
    typeof seams.writeOutput !== "function"
  ) {
    fail("provider_probe_suite_invalid_dependencies");
  }
  const config: ProviderProbeSafetyConfig = run.config;
  const records: PendingRecord[] = [];
  let next = 0;
  let auth: ProviderProbeAuthProbe | null = null;
  let inventory: ProviderProbeMailpitInventory | null = null;
  let envelope: ProviderProbeRunEnvelope | null = null;
  let jwtExpiry: number | null = null;
  let explorer: ProviderProbeAuthUserHandle | null = null;
  let passwordUser: ProviderProbeAuthUserHandle | null = null;
  let link: ProviderProbeLinkHandle | null = null;
  const lifetimeSessions: { session: ProviderProbeSessionHandle; owner: ProviderProbeAuthUserHandle }[] = [];
  let effectsStarted = false;
  let stopCode: ProviderProbeStopCode | null = null;
  let cleanupState: CleanupState = "not-run";
  let untrackedUsers = 0;
  let unownedMessages = 0;
  let evidenceWritten = false;

  // Effects are counted, never inferred: users the ledger tracks plus any found but
  // untrackable, sessions opened, messages tracked plus any run-tagged message that
  // cannot be (current count), and requests either transport was asked to make.
  function snapshot(): Snapshot {
    return {
      users: run.cleanupCounts().authUsers + untrackedUsers,
      sessions: auth === null ? 0 : auth.sessionsOpened(),
      messages: run.cleanupCounts().mailpitMessages + unownedMessages,
      requests: run.requestCount(),
    };
  }

  function record(
    probeId: ProviderProbeId,
    before: Snapshot,
    result: Readonly<{
      outcome: ProviderProbeOutcome;
      errorClass?: ProviderProbeErrorClass;
      identityMatched?: boolean | null;
      providerLifetimeSeconds?: number | null;
    }>,
  ): PendingRecord {
    const after = snapshot();
    const entry: PendingRecord = {
      probeId,
      outcome: result.outcome,
      errorClass: result.outcome === "pass" ? "none" : (result.errorClass ?? "unexpected"),
      userDelta: after.users - before.users,
      sessionDelta: after.sessions - before.sessions,
      messageDelta: after.messages - before.messages,
      requestCount: after.requests - before.requests,
      identityMatched: result.identityMatched ?? null,
      providerLifetimeSeconds: result.providerLifetimeSeconds ?? null,
    };
    if (entry.requestCount > 100 && entry.outcome === "pass") {
      entry.outcome = "fail";
      entry.errorClass = "unexpected";
    }
    records.push(entry);
    return entry;
  }

  function blocked(probeId: ProviderProbeId, before: Snapshot): PendingRecord {
    return record(probeId, before, { outcome: "blocked", errorClass: "invalid-request" });
  }

  function stopEffects(code: ProviderProbeStopCode): void {
    if (stopCode === null) {
      stopCode = code;
    }
  }

  // R9: the run's count of unresolved creations is the Auth probe core's own, which every
  // creating path adds to at settlement, before any processing that can throw. It is read
  // here after each creating operation, after every guarded step (also when the step
  // threw), and before cleanup and the final proof decide, so an exception can no longer
  // lose an unresolved user. Any increase stops every further effect.
  function noteCreation(): void {
    const unresolved = auth === null ? 0 : auth.unresolvedCreations();
    if (unresolved > untrackedUsers) {
      untrackedUsers = unresolved;
      stopEffects("untracked-effect");
    }
  }

  async function captureMail(expectAtLeast: number): Promise<number> {
    if (inventory === null) {
      return 0;
    }
    let captured = 0;
    for (let attempt = 0; attempt < PROVIDER_PROBE_SUITE_LIMITS.mailPollAttempts; attempt += 1) {
      if (attempt > 0 || expectAtLeast === 0) {
        await seams.wait(
          expectAtLeast === 0 ? PROVIDER_PROBE_SUITE_LIMITS.mailSettleMilliseconds : PROVIDER_PROBE_SUITE_LIMITS.mailPollMilliseconds,
        );
      }
      const result = await inventory.captureNewRunOwnedMessages();
      captured += result.captured;
      unownedMessages = result.unownedRunTagged;
      if (unownedMessages > 0) {
        stopEffects("untracked-effect");
      }
      if (expectAtLeast === 0 || captured >= expectAtLeast) {
        break;
      }
    }
    return captured;
  }

  function canRunEffects(): boolean {
    return effectsStarted && stopCode === null;
  }

  // R6: the running stack is observed first, before any request to it. Null when it
  // cannot be observed (the observer threw, or its observation is malformed).
  async function observedComparison(): Promise<ProviderProbeEnvironmentComparison | null> {
    let observed: unknown;
    try {
      observed = await seams.observeStack();
    } catch {
      return null;
    }
    try {
      return compareProviderProbeEnvironment(config, observed);
    } catch {
      return null;
    }
  }

  // ---- PP-00 ----------------------------------------------------------------------
  async function preflight(): Promise<ProviderProbeStepSummary> {
    run.limitRequests(PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance);
    const before = snapshot();
    let refused: ProviderProbeStopCode | null = null;
    let lines: string[] = [];
    let digest = "";
    try {
      if (
        settings.cliVersion !== PROVIDER_PROBE_SUITE_LIMITS.requiredCliVersion ||
        config.profile !== "current-config" ||
        config.lifetimeSafetyMarginSeconds !== PROVIDER_PROBE_SUITE_LIMITS.requiredMarginSeconds ||
        // (R6b) The run id is the one operator-chosen text in the display and the evidence
        // envelope. One the scanner would refuse (the kernel's pattern still allows a word
        // such as "token" or "secret", or 32 hexadecimal digits in a row) is refused here,
        // before any request, rather than after PP-00's reads; the run procedure's
        // generated run id always passes.
        !scanProviderProbeOutput(config.runId).passed
      ) {
        refused = "preflight-refused";
      } else {
        const comparison = await observedComparison();
        if (comparison === null) {
          refused = "environment-unobserved";
        } else if (!comparison.matches || readProviderProbeCheckoutProjectId() !== config.expectedProjectId) {
          refused = "environment-mismatch";
        } else {
          auth = run.createAuthProbe({ anonKey: settings.anonKey, serviceRoleKey: settings.serviceRoleKey });
          const healthy = await auth.checkHealth();
          const configDigest = readVerifiedProviderProbeConfigDigest(comparison);
          jwtExpiry = readVerifiedProviderProbeJwtExpiry(comparison);
          const configured = readVerifiedProviderProbeConfiguredSurfaces(comparison);
          const sdk = readInstalledSupabaseSdkVersions();
          envelope = createProviderProbeRunEnvelope(config, {
            supabaseCliVersion: settings.cliVersion,
            supabaseJsVersion: sdk.supabaseJsVersion,
            authJsVersion: sdk.authJsVersion,
            configDigest,
            configuredNotObserved: configured,
          });
          const users = healthy ? await auth.listUsers() : null;
          if (users !== null) {
            inventory = run.createMailpitInventory();
            await inventory.takeBaseline();
          }
          if (users === null || jwtExpiry === null || users.runTaggedUsers !== 0) {
            refused = "preflight-refused";
          } else {
            // Every environment value shown is the expected one, which the observation
            // above matched; no observed text is echoed. (R6b) The checkout's path is
            // never shown: a folder name can look like a value the scanner refuses (a
            // UUID, an address, a word such as "token"), and the display, its digest and
            // the scan must not depend on where the checkout lives. The comparison above
            // checked the path itself against the pinned app root.
            const allowance = PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance;
            lines = [
              ...describeProviderProbeImpact(config, PROVIDER_PROBE_SUITE_LIMITS.plan, comparison),
              `Observed running stack (its Docker container labels and published port): workdir is this checkout's pinned app root, project ${config.expectedProjectId}, API ${config.localSupabaseUrl}; each matches this checkout and the kernel`,
              `Auth API: answered at ${config.localSupabaseUrl} through the gated transport`,
              `Run id: ${config.runId}`,
              `Versions: Supabase CLI ${settings.cliVersion} (stated by the operator), supabase-js ${sdk.supabaseJsVersion}, auth-js ${sdk.authJsVersion}`,
              `Settings file: ${configDigest}`,
              `Session length: configured ${jwtExpiry} seconds; margin ${config.lifetimeSafetyMarginSeconds} seconds (decision D)`,
              `Configured, not observed: this checkout's supabase/config.toml has anonymous sign-in ${configured.anonymousSignIns} and phone sign-up ${configured.phoneSignUp}; the run does not try either, so item 70's anon-key check of those two surfaces stays owed (a decision for Paul)`,
              "Baseline: no local user and no local test message carries this run id",
              "Sign-up surfaces tried once each, at its own minted address: email and credential sign-up, email-code sign-up allowing creation, and an email code for a missing address; each passes only if refused by policy with no user, session or message",
              "Existing-account email sign-in: one email code and one magic link to the Explorer fixture, each read once, used once to sign in, and deleted; each passes only if it signs that same account in",
              "One-time sign-in links and codes: the server issues them only for addresses this run minted (PP-02, PP-09 and the two existing-account messages); each is used at most once, and the rest expire",
              "Sign-out: each session the run holds is signed out once (local scope) before cleanup; sign-out does not revoke a session credential already issued, which stays in memory only until the process ends",
              `Rate check: up to ${PROVIDER_PROBE_SUITE_LIMITS.rateMaxAttempts} wrong-credential sign-ins for the credential fixture; local sign-ins from this machine may then be throttled for about 5 minutes`,
              `Requests: at most ${allowance} per record (enforced); cleanup is not limited`,
              "Stops: any refused check before an effect stops the run; after three failed cleanup tries the run stops for Paul",
            ];
            for (const line of lines) {
              if (!scanProviderProbeOutput(line).passed) {
                fail("provider_probe_impact_display_secret_pattern");
              }
            }
            digest = computeProviderProbeConfigDigest(new TextEncoder().encode(lines.join("\n")));
            if (settings.phase === "run" && settings.approvedImpact !== digest) {
              refused = "approval-mismatch";
            }
          }
        }
      }
    } catch {
      refused = refused ?? "preflight-refused";
    }
    if (refused !== null) {
      stopEffects(refused);
      const entry = blocked("PP-00", before);
      return summary("PP-00", [entry]);
    }
    if (settings.phase === "preview") {
      seams.writeOutput("impact-display", `${lines.join("\n")}\nApproval digest: ${digest}\n`);
      return Object.freeze({ step: "PP-00" as const, outcome: "preview" as const, records: 0, failedRecords: 0, stoppedForPaul: false, code: "none" as const });
    }
    effectsStarted = true;
    const entry = record("PP-00", before, { outcome: "pass" });
    return summary("PP-00", [entry]);
  }

  function summary(step: ProviderProbeStep, entries: readonly PendingRecord[]): ProviderProbeStepSummary {
    const failed = entries.filter((entry) => entry.outcome !== "pass").length;
    const outcome: ProviderProbeOutcome = entries.some((entry) => entry.outcome === "fail")
      ? "fail"
      : entries.some((entry) => entry.outcome === "blocked")
        ? "blocked"
        : "pass";
    return Object.freeze({
      step,
      outcome,
      records: entries.length,
      failedRecords: failed,
      stoppedForPaul: cleanupState === "failed",
      code: stopCode ?? "none",
    });
  }

  // Runs one effect record; a thrown error becomes one failed record and stops effects.
  // R6: each record gets its own request allowance (the kernel's 100-request bound).
  async function guarded(
    probeId: ProviderProbeId,
    body: (before: Snapshot) => Promise<PendingRecord | readonly PendingRecord[]>,
  ): Promise<readonly PendingRecord[]> {
    run.limitRequests(PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance);
    const before = snapshot();
    if (!canRunEffects()) {
      return [blocked(probeId, before)];
    }
    try {
      const result = await body(before);
      noteCreation();
      return Array.isArray(result) ? (result as readonly PendingRecord[]) : [result as PendingRecord];
    } catch {
      // R9: an unresolved creation delivered before the throw is counted first (and stops
      // effects as "untracked-effect"), so the failed record's user count includes it.
      noteCreation();
      stopEffects("unexpected-error");
      return [record(probeId, before, { outcome: "fail", errorClass: "unexpected" })];
    }
  }

  // ---- PP-01: the existing Explorer fixture ---------------------------------------
  const pp01 = () =>
    guarded("PP-01", async (before) => {
      const created = await auth!.createExplorer();
      // R7: a creation that could not be attributed is counted and stops every effect.
      noteCreation();
      if (created.user === null) {
        return record("PP-01", before, { outcome: "fail", errorClass: "provider-denied" });
      }
      if (created.reconciled) {
        // R7: the creation answer was lost, failed or carried no id. The user located at
        // its minted address is tracked for exact-id cleanup, but it is never a pass and
        // never a fixture for a later step.
        return record("PP-01", before, { outcome: "fail", errorClass: "unexpected" });
      }
      explorer = created.user;
      const facts = await auth!.describeUser(created.user);
      const located = await auth!.countUsersWithAddressOf(created.user);
      const identity = created.emailMatched && facts.found && facts.emailMatches;
      const ok = identity && !facts.anonymous && !facts.hasPhone && located === 1;
      return record("PP-01", before, { outcome: ok ? "pass" : "fail", identityMatched: identity });
    });

  // ---- PP-02: generate-only magic link, and no email ------------------------------
  const pp02 = () =>
    guarded("PP-02", async (before) => {
      if (explorer === null) {
        return blocked("PP-02", before);
      }
      const facts = await auth!.generateMagicLink(explorer);
      link = facts.link;
      const messages = await captureMail(0);
      const noEmail = messages === 0 && unownedMessages === 0;
      const ok =
        facts.errorKind === "none" &&
        facts.userIdMatched &&
        facts.propertyKeysExact &&
        facts.verificationTypeMagiclink &&
        facts.hashedTokenPresent &&
        noEmail;
      return record("PP-02", before, {
        outcome: ok ? "pass" : "fail",
        errorClass: facts.errorKind === "none" && !facts.userIdMatched ? "identity-mismatch" : "unexpected",
        identityMatched: facts.errorKind === "none" ? facts.userIdMatched : null,
      });
    });

  // ---- PP-03: internal exchange, getUser, replay ----------------------------------
  const pp03 = () =>
    guarded("PP-03", async (before) => {
      if (explorer === null || link === null) {
        return blocked("PP-03", before);
      }
      const verified = await auth!.verifyLink(link);
      const session = verified.session;
      const belongs = session !== null && auth!.sessionBelongsTo(session, explorer);
      const recognized = session !== null && (await auth!.serverRecognizes(session, explorer));
      const replay = await auth!.verifyLink(link);
      // R6: only GoTrue's expired-or-invalid answer is a refusal; a transport or other
      // failure says nothing about one-time use. R7: it must be confirmed (a refusal
      // status and code), and an answer that carries a session is never a refusal (its
      // session is held and signed out).
      const replayRefused = replay.confirmedRefusal && replay.session === null;
      // R7: only a clean success's session is measured (PP-10).
      if (verified.errorKind === "none" && session !== null && belongs) {
        lifetimeSessions.push({ session, owner: explorer });
      }
      // R7: the first exchange must be a clean success, not an error that carried a session.
      const ok = verified.errorKind === "none" && session !== null && belongs && recognized && replayRefused;
      return record("PP-03", before, {
        outcome: ok ? "pass" : "fail",
        errorClass: session !== null && (!belongs || !recognized) ? "identity-mismatch" : isRateLimited(verified.errorKind) ? "rate-limited" : "unexpected",
        identityMatched: session === null ? null : belongs && recognized,
      });
    });

  // ---- PP-04 (PP-05 merged): the public surface under the current settings --------
  // R6: a pass needs a confirmed policy refusal and no new user, session or message.
  // R7: confirmed means a refusal status and a code from that surface's own set
  // (`PROVIDER_PROBE_REFUSALS`), with no session in the answer.
  async function closedSurface(attempt: () => Promise<ProviderProbeCreationFacts>): Promise<PendingRecord> {
    const before = snapshot();
    const facts = await attempt();
    noteCreation();
    // Any message the attempt caused is counted here, owned or not.
    await captureMail(0);
    const after = snapshot();
    const created = facts.usersCreated + facts.usersUntracked;
    const quiet = after.messages === before.messages && unownedMessages === 0;
    const ok = facts.confirmedRefusal && created === 0 && facts.session === null && quiet;
    return record("PP-04", before, {
      outcome: ok ? "pass" : "fail",
      errorClass: isRateLimited(facts.errorKind) ? "rate-limited" : "unexpected",
    });
  }

  // An email code for an address with no user, without creation: conclusive when the
  // server refused by policy or accepted without effect; a pass needs no new user,
  // session or message either way.
  async function missingAddressCode(): Promise<PendingRecord> {
    const before = snapshot();
    const facts = await auth!.tryEmailCodeForMissingAddress();
    noteCreation();
    await captureMail(0);
    const after = snapshot();
    // R7: a refusal counts only when confirmed for this surface.
    const conclusive = facts.errorKind === "none" || facts.confirmedRefusal;
    const ok =
      conclusive &&
      facts.usersCreated + facts.usersUntracked === 0 &&
      facts.session === null &&
      after.messages === before.messages &&
      unownedMessages === 0;
    return record("PP-04", before, {
      outcome: ok ? "pass" : "fail",
      errorClass: isRateLimited(facts.errorKind) ? "rate-limited" : "unexpected",
    });
  }

  // R6: a pass needs GoTrue's own disabled-provider refusal, not just any 4xx (R7: its
  // status, code and message, matched in the Auth probe core; only a boolean comes back).
  async function disabledProvider(): Promise<PendingRecord> {
    const before = snapshot();
    const facts = await auth!.tryDisabledProvider();
    return record("PP-04", before, { outcome: facts.confirmedRefusal ? "pass" : "fail" });
  }

  // Kept by decision D: does Supabase's own email sign-in work for an existing account?
  // R6: a pass needs exactly one new message whose credential signs that same account
  // in. A refused send is recorded as a failure (provider-denied), never as a pass.
  async function existingAccountSignIn(mode: "code" | "link"): Promise<PendingRecord> {
    const before = snapshot();
    if (explorer === null) {
      return blocked("PP-04", before);
    }
    const send = await auth!.sendExistingAccountEmail(explorer);
    // R8: neither a clean send nor a refusal may come with a session (it is held and
    // signed out in PP-11, and the record fails).
    if (send.errorKind !== "none" || send.session !== null) {
      await captureMail(0);
      // R7: "provider-denied" only for a confirmed refusal of this surface.
      return record("PP-04", before, {
        outcome: "fail",
        errorClass: send.confirmedRefusal ? "provider-denied" : isRateLimited(send.errorKind) ? "rate-limited" : "unexpected",
      });
    }
    const captured = await captureMail(1);
    const verified = await auth!.verifyFromNewMessage(explorer, mode);
    const session = verified.result.session;
    const belongs = session !== null && auth!.sessionBelongsTo(session, explorer);
    // R7: the exchange must be a clean success, not an error that carried a session.
    const ok = captured === 1 && verified.credentialFound && verified.result.errorKind === "none" && session !== null && belongs;
    return record("PP-04", before, {
      outcome: ok ? "pass" : "fail",
      errorClass:
        session !== null && !belongs ? "identity-mismatch" : isRateLimited(verified.result.errorKind) ? "rate-limited" : "unexpected",
      identityMatched: session === null ? null : belongs,
    });
  }

  async function pp04(): Promise<readonly PendingRecord[]> {
    const entries: PendingRecord[] = [];
    const subChecks: readonly (() => Promise<PendingRecord>)[] = [
      () => closedSurface(() => auth!.trySignUpWithPassword()),
      () => closedSurface(() => auth!.tryEmailCodeSignUp()),
      () => missingAddressCode(),
      () => disabledProvider(),
      () => existingAccountSignIn("code"),
      async () => {
        await seams.wait(PROVIDER_PROBE_SUITE_LIMITS.resendWaitMilliseconds);
        return existingAccountSignIn("link");
      },
    ];
    for (const subCheck of subChecks) {
      entries.push(...(await guarded("PP-04", async () => subCheck())));
    }
    return entries;
  }

  // ---- PP-06: credential sign-in, failure opacity ---------------------------------
  const pp06 = async (): Promise<readonly PendingRecord[]> => [
    ...(await guarded("PP-06", async (before) => {
      const created = await auth!.createPasswordUser();
      // R7: as PP-01.
      noteCreation();
      if (created.user === null) {
        return record("PP-06", before, { outcome: "fail", errorClass: "provider-denied" });
      }
      if (created.reconciled) {
        return record("PP-06", before, { outcome: "fail", errorClass: "unexpected" });
      }
      passwordUser = created.user;
      const signedIn = await auth!.passwordSignIn(created.user, "correct");
      const session = signedIn.session;
      const belongs = session !== null && auth!.sessionBelongsTo(session, created.user);
      if (signedIn.errorKind === "none" && session !== null && belongs) {
        lifetimeSessions.push({ session, owner: created.user });
      }
      return record("PP-06", before, {
        // R7: a clean success, not an error that carried a session.
        outcome: created.emailMatched && signedIn.errorKind === "none" && belongs ? "pass" : "fail",
        errorClass: session !== null && !belongs ? "identity-mismatch" : isRateLimited(signedIn.errorKind) ? "rate-limited" : "unexpected",
        identityMatched: session === null ? null : belongs,
      });
    })),
    ...(await guarded("PP-06", async (before) => {
      if (passwordUser === null) {
        return blocked("PP-06", before);
      }
      const wrong = await auth!.passwordSignIn(passwordUser, "wrong");
      const unknown = await auth!.passwordSignInUnknownAddress();
      const opaque =
        wrong.errorKind === "invalid-credentials" &&
        unknown.errorKind === "invalid-credentials" &&
        wrong.session === null &&
        unknown.session === null;
      return record("PP-06", before, {
        outcome: opaque ? "pass" : "fail",
        errorClass: isRateLimited(wrong.errorKind) || isRateLimited(unknown.errorKind) ? "rate-limited" : "unexpected",
      });
    })),
  ];

  // ---- PP-07: pre-bridge provider-id rule check ------------------------------------
  // R6: what this exercises is a local comparison of the rule the future SolMind bridge
  // must apply, on a real provider session; it does not call the bridge (a later slice).
  // A deny test through the real bridge seam is still owed before any bridge assurance
  // is claimed from this record.
  const pp07 = () =>
    guarded("PP-07", async (before) => {
      if (passwordUser === null || explorer === null) {
        return blocked("PP-07", before);
      }
      // User A (the credential fixture) signs in while the bound id is B (the Explorer).
      const signedIn = await auth!.passwordSignIn(passwordUser, "correct");
      const session = signedIn.session;
      const isA = session !== null && auth!.sessionBelongsTo(session, passwordUser);
      const matchesBound = session !== null && auth!.sessionBelongsTo(session, explorer);
      // The rule, applied locally: deny unless the session's user is the bound one.
      const decision = matchesBound ? "allow" : "deny";
      return record("PP-07", before, {
        outcome: signedIn.errorKind === "none" && session !== null && isA && decision === "deny" ? "pass" : "fail",
        errorClass: isRateLimited(signedIn.errorKind) ? "rate-limited" : "unexpected",
        identityMatched: session === null ? null : matchesBound,
      });
    });

  // ---- PP-08: duplicate create, locate, retry --------------------------------------
  // R6: a pass needs exactly one success and the other attempt's duplicate refusal (R7:
  // confirmed, a refusal status and a duplicate code).
  const pp08 = () =>
    guarded("PP-08", async (before) => {
      const facts = await auth!.duplicateCreate();
      noteCreation();
      const ok =
        facts.located === 1 &&
        facts.usersCreated === 1 &&
        facts.usersUntracked === 0 &&
        facts.successes === 1 &&
        facts.duplicateRefusals === 1 &&
        facts.otherErrors === 0;
      return record("PP-08", before, { outcome: ok ? "pass" : "fail" });
    });

  // ---- PP-09: generateLink for a missing user --------------------------------------
  // Recorded either way the server answers (it creates the user, or refuses with
  // user_not_found); R6: a transport or any other failure is not an answer, so it fails.
  // R7: the two answers are exclusive. A success passes only with exactly one created,
  // tracked user; a refusal only when confirmed (404, user_not_found) with no user created
  // or unresolved. A refusal with a user, or a success with none or two, fails.
  const pp09 = () =>
    guarded("PP-09", async (before) => {
      const facts = await auth!.generateLinkForMissingAddress();
      noteCreation();
      await captureMail(0);
      const quiet = snapshot().messages === before.messages;
      const createdAndTracked = facts.errorKind === "none" && facts.usersCreated === 1 && facts.usersUntracked === 0;
      const refusedCleanly = facts.confirmedNotFound && facts.usersCreated + facts.usersUntracked === 0;
      const conclusive = createdAndTracked || refusedCleanly;
      // A created user can never match a bound id (there is none), and its link is
      // never verified.
      return record("PP-09", before, {
        outcome: conclusive && quiet ? "pass" : "fail",
        errorClass: isRateLimited(facts.errorKind) ? "rate-limited" : "unexpected",
        identityMatched: facts.createdOnMissing ? false : null,
      });
    });

  // ---- PP-10: lifetime ---------------------------------------------------------------
  const pp10 = () =>
    guarded("PP-10", async (before) => {
      const facts = lifetimeSessions
        .map((entry) => auth!.lifetimeOf(entry.session))
        .filter((value): value is NonNullable<typeof value> => value !== null);
      // The server must still recognize the newest session for its own user.
      const newest = lifetimeSessions[lifetimeSessions.length - 1];
      const recognized = newest !== undefined && (await auth!.serverRecognizes(newest.session, newest.owner));
      const computed = computeUsableSessionSeconds(facts, jwtExpiry ?? 0, config.lifetimeSafetyMarginSeconds);
      const usable = computed.usableSeconds;
      const inRange = usable !== null && usable >= 1 && usable <= PROVIDER_PROBE_SUITE_LIMITS.maxUsableLifetime;
      const ok = facts.length === lifetimeSessions.length && facts.length > 0 && computed.consistent && recognized && inRange;
      return record("PP-10", before, {
        outcome: ok ? "pass" : "fail",
        identityMatched: lifetimeSessions.length === 0 ? null : recognized,
        providerLifetimeSeconds: inRange ? usable : null,
      });
    });

  // ---- PP-06 (rate): after every other sign-in -------------------------------------
  const pp06Rate = () =>
    guarded("PP-06", async (before) => {
      if (passwordUser === null) {
        return blocked("PP-06", before);
      }
      let throttledAt: number | null = null;
      let other = 0;
      let sessionSeen = false;
      for (let attempt = 1; attempt <= PROVIDER_PROBE_SUITE_LIMITS.rateMaxAttempts; attempt += 1) {
        const result = await auth!.passwordSignIn(passwordUser, "wrong");
        if (result.session !== null) {
          sessionSeen = true;
          break;
        }
        if (isRateLimited(result.errorKind)) {
          throttledAt = attempt;
          break;
        }
        if (result.errorKind !== "invalid-credentials") {
          other += 1;
        }
      }
      return record("PP-06", before, { outcome: throttledAt !== null && other === 0 && !sessionSeen ? "pass" : "fail" });
    });

  // ---- PP-11: sign-out and exact cleanup, at most three tries -----------------------
  // The ledger allows one cleanup round and at most two retries: three tries in all
  // (decision D). When residue remains after the third, the run stops for Paul: no
  // fourth deletion is attempted and no further effect runs.
  async function pp11(): Promise<readonly PendingRecord[]> {
    // R6: cleanup is never limited by a request allowance, whichever step ran before it
    // (directly or through the safety net); its bound is structural (see the budgets).
    run.limitRequests(null);
    // R9: the latest count of unresolved creations, before cleanup decides.
    noteCreation();
    const before = snapshot();
    if (!effectsStarted) {
      return [blocked("PP-11", before)];
    }
    try {
      if (auth !== null) {
        for (const session of auth.openSessions()) {
          // Best effort: local sign-out does not revoke an access JWT already issued;
          // deleting the user removes its sessions.
          await auth.signOut(session);
        }
      }
      // A late message is tracked before cleanup starts.
      await captureMail(0);
    } catch {
      stopEffects("unexpected-error");
    }
    createdAnything = createdAnything || run.cleanupCounts().authUsers + run.cleanupCounts().mailpitMessages > 0;
    try {
      let report = await run.cleanup();
      while (report.residue.authUsers + report.residue.mailpitMessages > 0 && report.retryAllowed) {
        report = await run.retryCleanup();
      }
      cleanupState = report.residue.authUsers + report.residue.mailpitMessages === 0 ? "complete" : "failed";
    } catch {
      cleanupState = "failed";
    }
    if (untrackedUsers > 0 || unownedMessages > 0) {
      cleanupState = "failed";
    }
    if (cleanupState === "failed") {
      stopEffects("cleanup-incomplete");
    }
    return [cleanupRecord("PP-11", before, cleanupState === "complete")];
  }
  let createdAnything = false;

  // PP-11 and PP-12 describe cleanup itself: no effect of their own, and a cleanup
  // field that says what the run's cleanup achieved.
  function cleanupRecord(probeId: "PP-11" | "PP-12", before: Snapshot, clean: boolean): PendingRecord {
    const entry = record(probeId, before, {
      outcome: clean ? "pass" : "fail",
      errorClass: clean ? "none" : "cleanup-failed",
    });
    entry.sessionDelta = 0;
    entry.userDelta = 0;
    entry.messageDelta = 0;
    return entry;
  }

  // ---- PP-12: final no-side-effect proof (read only) -------------------------------
  async function pp12(): Promise<readonly PendingRecord[]> {
    run.limitRequests(PROVIDER_PROBE_SUITE_LIMITS.recordRequestAllowance);
    // R9: the latest count of unresolved creations, before the final proof decides.
    noteCreation();
    const before = snapshot();
    if (!effectsStarted || auth === null || inventory === null) {
      return [blocked("PP-12", before)];
    }
    let clean = false;
    try {
      const users = await auth.listUsers();
      const messages = await inventory.readCounts();
      clean =
        users.runTaggedUsers === 0 &&
        messages.runTaggedMessageCount === 0 &&
        untrackedUsers === 0 &&
        cleanupState === "complete";
    } catch {
      clean = false;
    }
    if (!clean) {
      cleanupState = "failed";
      stopEffects("cleanup-incomplete");
    }
    return [cleanupRecord("PP-12", before, clean)];
  }

  // Records are finalized only here, after cleanup, so each cleanup field is a fact.
  // R11: every count outside the kernel's evidence bounds is collected in `beyond`, with
  // its record's position and probe id, for the envelope.
  function finalizedRecords(beyond: ProviderProbeCountBeyondEvidenceBounds[]): Record<string, unknown>[] {
    return records.map((entry, index) => {
      const found: ProviderProbeFieldBeyondBounds[] = [];
      let finalized: Record<string, unknown>;
      if ((entry.probeId === "PP-11" || entry.probeId === "PP-12") && entry.outcome !== "blocked") {
        const base = finalizeProviderProbeRecord({ ...entry, outcome: "pass", errorClass: "none" }, "complete", found);
        // R12 (re-check #128g): the cleanup field follows the run's actual cleanup state.
        // PP-11 above its request bound carries the requestCount marker, so `base` already
        // fails it as "unexpected" (a marked record never passes), with cleanup as it was.
        if (cleanupState !== "complete") {
          finalized = { ...base, outcome: "fail", errorClass: "cleanup-failed", cleanupOutcome: "failed" };
        } else {
          finalized = { ...base, cleanupOutcome: createdAnything ? "complete" : "not-needed" };
        }
      } else {
        finalized = finalizeProviderProbeRecord(entry, cleanupState, found);
      }
      for (const field of found) {
        beyond.push(Object.freeze({ record: index, probeId: entry.probeId, ...field }));
      }
      return finalized;
    });
  }

  async function writeEvidence(): Promise<ProviderProbeStepSummary> {
    if (settings.phase !== "run" || envelope === null || evidenceWritten || !effectsStarted) {
      return Object.freeze({
        step: "evidence" as const,
        outcome: "not-written" as const,
        records: records.length,
        failedRecords: records.filter((entry) => entry.outcome !== "pass").length,
        stoppedForPaul: cleanupState === "failed",
        code: envelope === null ? ("no-envelope" as const) : (stopCode ?? ("none" as const)),
      });
    }
    // R11: a count outside the kernel's evidence bounds is written as the bound in its
    // record, named in the envelope ("more than 10"), and stops the run for Paul.
    const beyond: ProviderProbeCountBeyondEvidenceBounds[] = [];
    const evidence = finalizedRecords(beyond);
    if (beyond.length > 0) {
      stopEffects("count-beyond-evidence-bounds");
    }
    // Throws (and writes nothing) if any record fails the kernel, a marker does not match
    // its record, or the scan fails.
    const output = run.assembleOutput({ envelope: withCountsBeyondEvidenceBounds(envelope, beyond), evidence });
    seams.writeOutput("evidence", output);
    evidenceWritten = true;
    return Object.freeze({
      step: "evidence" as const,
      outcome: "written" as const,
      records: records.length,
      // R12 (re-check #128g): counted from the finalized evidence, where a marker or the
      // cleanup state can fail a record that was pending as a pass.
      failedRecords: evidence.filter((entry) => entry.outcome !== "pass").length,
      stoppedForPaul: cleanupState === "failed" || beyond.length > 0,
      code: beyond.length > 0 ? ("count-beyond-evidence-bounds" as const) : (stopCode ?? ("none" as const)),
    });
  }

  const bodies: Readonly<Record<Exclude<ProviderProbeStep, "PP-00" | "evidence">, () => Promise<readonly PendingRecord[]>>> = {
    "PP-01": pp01,
    "PP-02": pp02,
    "PP-03": pp03,
    "PP-04": async () => (canRunEffects() ? pp04() : [blocked("PP-04", snapshot())]),
    "PP-06": pp06,
    "PP-07": pp07,
    "PP-08": pp08,
    "PP-09": pp09,
    "PP-10": pp10,
    "PP-06-rate": pp06Rate,
    "PP-11": pp11,
    "PP-12": pp12,
  };

  // Every step and the safety net run one at a time, in call order: a call waits until
  // the previous one has settled, whatever its outcome. Steps therefore never overlap,
  // even if a caller stops waiting for one, and the safety net always waits for any
  // creation in flight before it cleans up.
  let chain: Promise<unknown> = Promise.resolve();
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = chain.then(work, work);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function runStepNow(step: ProviderProbeStep): Promise<ProviderProbeStepSummary> {
    if (PROVIDER_PROBE_STEPS[next] !== step) {
      fail("provider_probe_step_out_of_order");
    }
    next += 1;
    if (step === "PP-00") {
      return preflight();
    }
    if (settings.phase !== "run") {
      fail("provider_probe_step_preview_only");
    }
    if (step === "evidence") {
      return writeEvidence();
    }
    return summary(step, await bodies[step]());
  }

  // Safety net for the integration file's afterAll: any step not reached is recorded as
  // blocked, and cleanup, the final proof and the evidence document still happen.
  async function finishNow(): Promise<void> {
    if (settings.phase !== "run" || !effectsStarted) {
      return;
    }
    while (next < PROVIDER_PROBE_STEPS.length) {
      const step = PROVIDER_PROBE_STEPS[next]!;
      if (step === "PP-11" || step === "PP-12" || step === "evidence") {
        await runStepNow(step);
      } else {
        next += 1;
        blocked(step === "PP-06-rate" ? "PP-06" : (step as ProviderProbeId), snapshot());
      }
    }
  }

  return Object.freeze({
    phase: settings.phase,
    runStep: (step: ProviderProbeStep) => serialized(() => runStepNow(step)),
    finish: () => serialized(() => finishNow()),
    cleanupState: (): CleanupState => cleanupState,
  });
}

export type ProviderProbeSuite = ReturnType<typeof createProviderProbeSuiteCore>;
