// RESTRICTED test-only exact-ID cleanup ledger for the future local Supabase Auth
// provider probes. It accepts deleter callbacks, so only the restricted run core
// (`providerProbeRunCore.ts`, which passes its own fixed deleters), the two
// effect-owning cores (for its types) and named unit tests may import it;
// `providerProbeModuleBoundary.test.ts` enforces that. The production run exposes
// cleanup only as `cleanup()` and `retryCleanup()`, with no deleter parameter and no
// way to record anything.
//
// Binding to creation. An identifier can enter the cleanup plan only through a
// receipt (providerProbeCleanupReceipts.ts) that an effect-owning creation operation
// issued from its own successful result, for this run, once. There is no method that
// accepts a raw identifier, and no list, search or "delete everything matching"
// operation.
//
// Reservations. A creation that awaits its effect first takes a reservation, which
// checks the live gate and that the ledger is recording, and holds one unit of
// capacity. Outstanding reservations count against capacity, and cleanup refuses to
// start while any is outstanding. A reservation is committed with the creation's
// receipt (bookkeeping, never blocked by the gate, so a created user is always
// tracked) or released when the creation fails.
//
// Gate. Nothing is cached: the gate is re-read from the environment (the banked
// kernel's two exact interlocks, plus the same run id, profile and URL as at
// construction) at the start of every cleanup round and immediately before every
// single deletion, with no await in between. A gate closed at the start refuses the
// round without consuming it; a gate that closes mid-round stops the round, and the
// targets not yet attempted stay as residue, marked "not-attempted". The interlocks
// are necessary, never sufficient: they record that Paul's current, exact approval
// for the run (cleanup included) was given; they do not grant it.
//
// Failure path. A deleted identifier is dropped from memory at once. A failed or
// not-attempted one stays in private, bounded memory as residue: `retryFailedCleanup`
// re-attempts exactly the residue, up to PROVIDER_PROBE_CLEANUP_LIMITS.maxCleanupRounds
// rounds in all. Residue is never exposed, logged or written; it leaves memory when it
// is deleted or when the run process ends. Reports carry only categories, ordinals,
// closed outcomes and counts.

import {
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import type { ProviderProbeCleanupOutcome } from "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";
import {
  redeemCleanupReceipt,
  type ProviderProbeCleanupKind,
} from "./providerProbeCleanupReceipts";

export type ProviderProbeCleanupItemOutcome = "deleted" | "failed" | "not-attempted";

export type ProviderProbeCleanupItem = Readonly<{
  category: ProviderProbeCleanupKind;
  // 1-based creation order within the category; never the identifier.
  ordinal: number;
  outcome: ProviderProbeCleanupItemOutcome;
}>;

export type ProviderProbeCleanupRoundCounts = Readonly<{
  attempted: number;
  deleted: number;
  failed: number;
  notAttempted: number;
}>;

export type ProviderProbeCleanupReport = Readonly<{
  outcome: ProviderProbeCleanupOutcome;
  round: number;
  gateClosedDuringRound: boolean;
  authUsers: ProviderProbeCleanupRoundCounts;
  mailpitMessages: ProviderProbeCleanupRoundCounts;
  residue: Readonly<{ authUsers: number; mailpitMessages: number }>;
  retryAllowed: boolean;
  items: readonly ProviderProbeCleanupItem[];
}>;

export type ProviderProbeCleanupDeleters = Readonly<{
  deleteAuthUser(id: string): Promise<void>;
  deleteMailpitMessage(id: string): Promise<void>;
}>;

export type ProviderProbeCleanupReservation = Readonly<{
  commit(receipt: unknown): void;
  release(): void;
}>;

export type ProviderProbeCleanupLedger = Readonly<{
  isGateOpen(): boolean;
  isRecording(): boolean;
  remainingCapacity(kind: ProviderProbeCleanupKind): number;
  reserve(kind: ProviderProbeCleanupKind): ProviderProbeCleanupReservation;
  recordCreated(receipt: unknown): void;
  recordedCounts(): Readonly<{ authUsers: number; mailpitMessages: number }>;
  runCleanup(deleters: ProviderProbeCleanupDeleters): Promise<ProviderProbeCleanupReport>;
  retryFailedCleanup(deleters: ProviderProbeCleanupDeleters): Promise<ProviderProbeCleanupReport>;
  residueCounts(): Readonly<{ authUsers: number; mailpitMessages: number }>;
}>;

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;
type Target = { kind: ProviderProbeCleanupKind; id: string; ordinal: number };
type CapturedDeleters = Readonly<{
  deleteAuthUser: (id: string) => Promise<void>;
  deleteMailpitMessage: (id: string) => Promise<void>;
}>;

// Capacity is aligned with the kernel evidence bounds (userDelta <= 10, messageDelta <= 100).
export const PROVIDER_PROBE_CLEANUP_LIMITS = Object.freeze({
  maxAuthUsers: 10,
  maxMailpitMessages: 100,
  maxCleanupRounds: 3,
});

function fail(code: string): never {
  throw new Error(code);
}

function capacityFor(kind: ProviderProbeCleanupKind): number {
  return kind === "auth-user"
    ? PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers
    : PROVIDER_PROBE_CLEANUP_LIMITS.maxMailpitMessages;
}

function captureDeleters(raw: unknown): CapturedDeleters {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("cleanup_ledger_invalid_deleters");
  }
  const keys = Object.keys(raw).sort();
  if (keys.length !== 2 || keys[0] !== "deleteAuthUser" || keys[1] !== "deleteMailpitMessage") {
    fail("cleanup_ledger_invalid_deleters");
  }
  const captured: Partial<Record<keyof CapturedDeleters, (id: string) => Promise<void>>> = {};
  for (const name of ["deleteAuthUser", "deleteMailpitMessage"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, name);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function") {
      // Accessors are refused so a deleter cannot change between calls.
      fail("cleanup_ledger_invalid_deleters");
    }
    captured[name] = descriptor.value as (id: string) => Promise<void>;
  }
  return Object.freeze({
    deleteAuthUser: captured.deleteAuthUser!,
    deleteMailpitMessage: captured.deleteMailpitMessage!,
  });
}

function roundCounts(items: readonly ProviderProbeCleanupItem[], kind: ProviderProbeCleanupKind): ProviderProbeCleanupRoundCounts {
  const own = items.filter((item) => item.category === kind);
  return Object.freeze({
    attempted: own.filter((item) => item.outcome !== "not-attempted").length,
    deleted: own.filter((item) => item.outcome === "deleted").length,
    failed: own.filter((item) => item.outcome === "failed").length,
    notAttempted: own.filter((item) => item.outcome === "not-attempted").length,
  });
}

function sameRun(current: ProviderProbeSafetyConfig | null, expected: ProviderProbeSafetyConfig): boolean {
  return (
    current !== null &&
    current.runId === expected.runId &&
    current.profile === expected.profile &&
    current.localSupabaseUrl === expected.localSupabaseUrl
  );
}

export function createProviderProbeCleanupLedger(environment: ProbeEnvironment): ProviderProbeCleanupLedger {
  // Throws on an enabled but malformed configuration, exactly as the kernel does.
  const config = readProviderProbeSafetyConfig(environment);
  const runId = config?.runId ?? "";
  // Private, bounded memory. Nothing below ever returns, logs or writes an identifier.
  const targets: Target[] = [];
  const nextOrdinal: Record<ProviderProbeCleanupKind, number> = { "auth-user": 1, "mailpit-message": 1 };
  const outstanding: Record<ProviderProbeCleanupKind, number> = { "auth-user": 0, "mailpit-message": 0 };
  let state: "recording" | "cleaning" | "complete" | "residue" | "exhausted" = "recording";
  let rounds = 0;

  // Re-read every time; never cached.
  function gateOpen(): boolean {
    if (config === null) {
      return false;
    }
    try {
      return sameRun(readProviderProbeSafetyConfig(environment), config);
    } catch {
      return false;
    }
  }

  function countOf(kind: ProviderProbeCleanupKind): number {
    return targets.filter((target) => target.kind === kind).length;
  }

  function isKind(kind: unknown): kind is ProviderProbeCleanupKind {
    return kind === "auth-user" || kind === "mailpit-message";
  }

  function assertRecording(): void {
    if (config === null) {
      fail("cleanup_ledger_inert");
    }
    if (state !== "recording") {
      fail("cleanup_ledger_closed");
    }
  }

  // Redeems a genuine receipt of this run and keeps its identifier. `reserved` is
  // true when the caller already holds a unit of capacity for it.
  function keep(receipt: unknown, reserved: boolean): void {
    const claimedKind = (receipt as { kind?: unknown } | null)?.kind;
    if (isKind(claimedKind) && !reserved && countOf(claimedKind) + outstanding[claimedKind] >= capacityFor(claimedKind)) {
      // Checked before redemption, so a receipt is never consumed without being kept.
      fail("cleanup_ledger_capacity_exceeded");
    }
    const redeemed = redeemCleanupReceipt(receipt, runId);
    if (redeemed === null) {
      fail("cleanup_ledger_receipt_refused");
    }
    if (targets.some((target) => target.kind === redeemed.kind && target.id === redeemed.id)) {
      fail("cleanup_ledger_duplicate_id");
    }
    targets.push({ kind: redeemed.kind, id: redeemed.id, ordinal: nextOrdinal[redeemed.kind]++ });
  }

  async function cleanupRound(deleters: CapturedDeleters): Promise<ProviderProbeCleanupReport> {
    state = "cleaning";
    rounds += 1;
    const items: ProviderProbeCleanupItem[] = [];
    // Newest first within each category: Auth users, then test messages.
    const plan = [
      ...targets.filter((target) => target.kind === "auth-user").reverse(),
      ...targets.filter((target) => target.kind === "mailpit-message").reverse(),
    ];
    let gateClosedDuringRound = false;
    for (const target of plan) {
      // The gate is checked immediately before each deletion, with no await between.
      if (gateClosedDuringRound || !gateOpen()) {
        gateClosedDuringRound = true;
        items.push(Object.freeze({ category: target.kind, ordinal: target.ordinal, outcome: "not-attempted" as const }));
        continue;
      }
      let outcome: ProviderProbeCleanupItemOutcome = "deleted";
      try {
        if (target.kind === "auth-user") {
          await deleters.deleteAuthUser(target.id);
        } else {
          await deleters.deleteMailpitMessage(target.id);
        }
      } catch {
        outcome = "failed";
      }
      if (outcome === "deleted") {
        // Dropped from memory at once.
        targets.splice(targets.indexOf(target), 1);
      }
      items.push(Object.freeze({ category: target.kind, ordinal: target.ordinal, outcome }));
    }
    const residue = Object.freeze({ authUsers: countOf("auth-user"), mailpitMessages: countOf("mailpit-message") });
    const hasResidue = residue.authUsers + residue.mailpitMessages > 0;
    state = !hasResidue
      ? "complete"
      : rounds >= PROVIDER_PROBE_CLEANUP_LIMITS.maxCleanupRounds
        ? "exhausted"
        : "residue";
    const frozenItems = Object.freeze([...items]);
    return Object.freeze({
      outcome: plan.length === 0 ? "not-needed" : hasResidue ? "failed" : "complete",
      round: rounds,
      gateClosedDuringRound,
      authUsers: roundCounts(frozenItems, "auth-user"),
      mailpitMessages: roundCounts(frozenItems, "mailpit-message"),
      residue,
      retryAllowed: state === "residue",
      items: frozenItems,
    });
  }

  return Object.freeze({
    isGateOpen: () => gateOpen(),

    isRecording: () => config !== null && state === "recording",

    remainingCapacity(kind: ProviderProbeCleanupKind): number {
      if (config === null || state !== "recording" || !isKind(kind)) {
        return 0;
      }
      return capacityFor(kind) - countOf(kind) - outstanding[kind];
    },

    reserve(kind: ProviderProbeCleanupKind): ProviderProbeCleanupReservation {
      assertRecording();
      if (!gateOpen()) {
        // A reservation precedes an effect, so it needs the live gate.
        fail("cleanup_ledger_gate_closed");
      }
      if (!isKind(kind)) {
        fail("cleanup_ledger_invalid_kind");
      }
      if (countOf(kind) + outstanding[kind] >= capacityFor(kind)) {
        fail("cleanup_ledger_capacity_exceeded");
      }
      outstanding[kind] += 1;
      let open = true;
      const settle = () => {
        if (!open) {
          fail("cleanup_ledger_reservation_used");
        }
        open = false;
        outstanding[kind] -= 1;
      };
      return Object.freeze({
        commit(receipt: unknown): void {
          settle();
          if ((receipt as { kind?: unknown } | null)?.kind !== kind) {
            fail("cleanup_ledger_receipt_refused");
          }
          // Bookkeeping only: recording is still open, because cleanup cannot start
          // while this was outstanding, and the gate never blocks tracking.
          keep(receipt, true);
        },
        release(): void {
          settle();
        },
      });
    },

    recordCreated(receipt: unknown): void {
      assertRecording();
      keep(receipt, false);
    },

    recordedCounts: () =>
      Object.freeze({ authUsers: countOf("auth-user"), mailpitMessages: countOf("mailpit-message") }),

    residueCounts: () =>
      state === "residue" || state === "exhausted"
        ? Object.freeze({ authUsers: countOf("auth-user"), mailpitMessages: countOf("mailpit-message") })
        : Object.freeze({ authUsers: 0, mailpitMessages: 0 }),

    async runCleanup(deleters: ProviderProbeCleanupDeleters): Promise<ProviderProbeCleanupReport> {
      if (config === null) {
        fail("cleanup_ledger_inert");
      }
      if (state !== "recording") {
        fail("cleanup_ledger_already_run");
      }
      if (outstanding["auth-user"] + outstanding["mailpit-message"] > 0) {
        // A creation is in flight; its user must be committed before cleanup starts.
        fail("cleanup_ledger_creation_in_flight");
      }
      // Captured before the first await, so a later change to the object has no effect.
      const captured = captureDeleters(deleters);
      if (!gateOpen()) {
        // Refused without consuming a round; every target stays.
        fail("cleanup_ledger_gate_closed");
      }
      return await cleanupRound(captured);
    },

    async retryFailedCleanup(deleters: ProviderProbeCleanupDeleters): Promise<ProviderProbeCleanupReport> {
      if (state === "exhausted") {
        fail("cleanup_ledger_retry_limit");
      }
      if (state !== "residue") {
        fail("cleanup_ledger_no_residue");
      }
      const captured = captureDeleters(deleters);
      if (!gateOpen()) {
        fail("cleanup_ledger_gate_closed");
      }
      return await cleanupRound(captured);
    },
  });
}
