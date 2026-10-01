import { describe, expect, it, vi } from "vitest";

import { PROVIDER_PROBE_APPROVAL_GATE } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createProviderProbeCleanupLedger,
  PROVIDER_PROBE_CLEANUP_LIMITS,
  type ProviderProbeCleanupDeleters,
} from "./providerProbeCleanupLedger";
import { gatedTestEnvironment, issueReceiptForTests, testConfig } from "./providerProbeTestSupport";

// Plainly fake, in-memory environments and ids; nothing here contacts anything.
const GATED_ENV = gatedTestEnvironment("ledger");
const RUN_ID = testConfig(GATED_ENV).runId;
const OTHER_RUN_ID = testConfig(gatedTestEnvironment("other-run")).runId;

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-7333-8333-333333333333";
const MAIL_A = "mailMessage01";
const MAIL_B = "mail-message_02";

type Ledger = ReturnType<typeof createProviderProbeCleanupLedger>;

function userReceipt(id: string, runId: string = RUN_ID) {
  return issueReceiptForTests("auth-user", id, runId);
}

function mailReceipt(id: string, runId: string = RUN_ID) {
  return issueReceiptForTests("mailpit-message", id, runId);
}

function recordingDeleters(failing: Set<string> = new Set(), onCall?: (id: string) => void) {
  const calls: string[] = [];
  const deleters: ProviderProbeCleanupDeleters = {
    async deleteAuthUser(id) {
      calls.push(`auth:${id}`);
      onCall?.(id);
      if (failing.has(id)) {
        throw new Error(`DELETECANARY ${id}`);
      }
    },
    async deleteMailpitMessage(id) {
      calls.push(`mail:${id}`);
      onCall?.(id);
      if (failing.has(id)) {
        throw new Error(`DELETECANARY ${id}`);
      }
    },
  };
  return { calls, deleters, failing };
}

function expectNoIds(value: unknown, ids: readonly string[]): void {
  const rendered = JSON.stringify(value);
  for (const id of ids) {
    expect(rendered).not.toContain(id);
  }
  expect(rendered).not.toContain("DELETECANARY");
}

function fillUsers(ledger: Ledger, count: number, marker = "5555"): void {
  for (let index = 1; index <= count; index += 1) {
    ledger.recordCreated(userReceipt(`${String(index).padStart(8, "0")}-${marker}-4555-8555-555555555555`));
  }
}

describe("inert cleanup ledger", () => {
  it.each([
    ["no gates", {}],
    ["only the approval gate", { SOLMIND_PROVIDER_PROBE_APPROVAL: PROVIDER_PROBE_APPROVAL_GATE }],
    ["a near-miss effect gate", { ...GATED_ENV, SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: "approved" }],
  ])("with %s, refuses every receipt and reservation, and calls no deleter", async (_label, environment) => {
    const ledger = createProviderProbeCleanupLedger(environment);
    const { calls, deleters } = recordingDeleters();

    expect(ledger.isGateOpen()).toBe(false);
    expect(ledger.isRecording()).toBe(false);
    expect(ledger.remainingCapacity("auth-user")).toBe(0);
    expect(() => ledger.recordCreated(userReceipt(USER_A))).toThrow("cleanup_ledger_inert");
    expect(() => ledger.reserve("auth-user")).toThrow("cleanup_ledger_inert");
    await expect(ledger.runCleanup(deleters)).rejects.toThrow("cleanup_ledger_inert");
    expect(calls).toEqual([]);
  });

  it("fails closed when the gates are present but the configuration is malformed", () => {
    expect(() =>
      createProviderProbeCleanupLedger({ ...GATED_ENV, SOLMIND_LOCAL_SUPABASE_URL: "http://localhost:54321" }),
    ).toThrow("provider_probe_non_loopback_or_ambiguous_url");
  });
});

describe("the gates are re-read before every deletion", () => {
  it("refuses a cleanup round, consuming nothing, when an interlock was removed after construction", async () => {
    const environment: Record<string, string | undefined> = { ...GATED_ENV };
    const ledger = createProviderProbeCleanupLedger(environment);
    ledger.recordCreated(userReceipt(USER_A));
    ledger.recordCreated(mailReceipt(MAIL_A));
    const { calls, deleters } = recordingDeleters();

    delete environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
    await expect(ledger.runCleanup(deleters)).rejects.toThrow("cleanup_ledger_gate_closed");
    environment.SOLMIND_PROVIDER_PROBE_RUN_ID = "P28-20261001-another-run";
    environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS = GATED_ENV.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
    await expect(ledger.runCleanup(deleters)).rejects.toThrow("cleanup_ledger_gate_closed");

    expect(calls).toEqual([]);
    expect(ledger.isGateOpen()).toBe(false);
    expect(ledger.recordedCounts()).toEqual({ authUsers: 1, mailpitMessages: 1 });

    Object.assign(environment, GATED_ENV);
    const report = await ledger.runCleanup(deleters);
    expect(report).toMatchObject({ outcome: "complete", round: 1 });
    expect(calls).toEqual([`auth:${USER_A}`, `mail:${MAIL_A}`]);
  });

  it("stops at the next target when an interlock is removed between two deletions, and keeps the rest", async () => {
    const environment: Record<string, string | undefined> = { ...GATED_ENV };
    const ledger = createProviderProbeCleanupLedger(environment);
    ledger.recordCreated(userReceipt(USER_A));
    ledger.recordCreated(userReceipt(USER_B));
    ledger.recordCreated(mailReceipt(MAIL_A));
    const { calls, deleters } = recordingDeleters(new Set(), () => {
      delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    });

    const report = await ledger.runCleanup(deleters);

    expect(calls).toEqual([`auth:${USER_B}`]);
    expect(report).toEqual({
      outcome: "failed",
      round: 1,
      gateClosedDuringRound: true,
      authUsers: { attempted: 1, deleted: 1, failed: 0, notAttempted: 1 },
      mailpitMessages: { attempted: 0, deleted: 0, failed: 0, notAttempted: 1 },
      residue: { authUsers: 1, mailpitMessages: 1 },
      retryAllowed: true,
      items: [
        { category: "auth-user", ordinal: 2, outcome: "deleted" },
        { category: "auth-user", ordinal: 1, outcome: "not-attempted" },
        { category: "mailpit-message", ordinal: 1, outcome: "not-attempted" },
      ],
    });

    await expect(ledger.retryFailedCleanup(recordingDeleters().deleters)).rejects.toThrow("cleanup_ledger_gate_closed");
    expect(calls).toEqual([`auth:${USER_B}`]);

    environment.SOLMIND_PROVIDER_PROBE_APPROVAL = GATED_ENV.SOLMIND_PROVIDER_PROBE_APPROVAL;
    const retry = recordingDeleters();
    const second = await ledger.retryFailedCleanup(retry.deleters);
    expect(retry.calls).toEqual([`auth:${USER_A}`, `mail:${MAIL_A}`]);
    expect(second).toMatchObject({ outcome: "complete", round: 2, gateClosedDuringRound: false });
  });

  it("refuses a reservation without the live gate, but always lets a held reservation commit", () => {
    const environment: Record<string, string | undefined> = { ...GATED_ENV };
    const ledger = createProviderProbeCleanupLedger(environment);
    const held = ledger.reserve("auth-user");

    delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    expect(() => ledger.reserve("auth-user")).toThrow("cleanup_ledger_gate_closed");
    held.commit(userReceipt(USER_A));

    expect(ledger.recordedCounts().authUsers).toBe(1);
  });
});

describe("only receipts from creation can enter the plan", () => {
  it.each([
    ["a raw, well-formed user id", USER_A],
    ["a raw, well-formed message id", MAIL_A],
    ["a receipt-shaped plain object", { kind: "auth-user", id: USER_A }],
    ["a frozen receipt look-alike", Object.freeze({ kind: "auth-user" })],
    ["null", null],
  ])("refuses %s", (_label, candidate) => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);

    expect(() => ledger.recordCreated(candidate)).toThrow("cleanup_ledger_receipt_refused");
    expect(ledger.recordedCounts()).toEqual({ authUsers: 0, mailpitMessages: 0 });
  });

  it("refuses a receipt issued for another run", () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);

    expect(() => ledger.recordCreated(userReceipt(USER_A, OTHER_RUN_ID))).toThrow("cleanup_ledger_receipt_refused");
  });

  it("redeems a receipt once only, even across ledgers", () => {
    const first = createProviderProbeCleanupLedger(GATED_ENV);
    const second = createProviderProbeCleanupLedger(GATED_ENV);
    const receipt = userReceipt(USER_A);

    first.recordCreated(receipt);

    expect(() => first.recordCreated(receipt)).toThrow("cleanup_ledger_receipt_refused");
    expect(() => second.recordCreated(receipt)).toThrow("cleanup_ledger_receipt_refused");
    expect(first.recordedCounts().authUsers).toBe(1);
    expect(second.recordedCounts().authUsers).toBe(0);
  });

  it("refuses a second receipt for an id it already holds", () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));

    expect(() => ledger.recordCreated(userReceipt(USER_A))).toThrow("cleanup_ledger_duplicate_id");
  });

  it("refuses a genuine receipt presented after cleanup has started", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    const late = userReceipt(USER_B);
    await ledger.runCleanup(recordingDeleters().deleters);

    expect(() => ledger.recordCreated(late)).toThrow("cleanup_ledger_closed");
  });

  it("issues receipts only for well-formed ids of either kind", () => {
    expect(() => issueReceiptForTests("auth-user", "11111111-1111-4111-8111-11111111111A", RUN_ID)).toThrow(
      "cleanup_receipt_invalid",
    );
    expect(() => issueReceiptForTests("auth-user", "00000000-0000-0000-0000-000000000000", RUN_ID)).toThrow(
      "cleanup_receipt_invalid",
    );
    expect(() => issueReceiptForTests("mailpit-message", "short", RUN_ID)).toThrow("cleanup_receipt_invalid");
    expect(() => issueReceiptForTests("mailpit-message", "has space1", RUN_ID)).toThrow("cleanup_receipt_invalid");
    expect(JSON.stringify(userReceipt(USER_C))).toBe('{"kind":"auth-user"}');
  });

  it("refuses anything beyond the kernel's evidence bounds before redeeming it", () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    fillUsers(ledger, PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers, "1111");
    for (let index = 1; index <= PROVIDER_PROBE_CLEANUP_LIMITS.maxMailpitMessages; index += 1) {
      ledger.recordCreated(mailReceipt(`message${String(index).padStart(4, "0")}`));
    }
    const spare = userReceipt(USER_A);

    expect(ledger.remainingCapacity("auth-user")).toBe(0);
    expect(ledger.remainingCapacity("mailpit-message")).toBe(0);
    expect(() => ledger.recordCreated(spare)).toThrow("cleanup_ledger_capacity_exceeded");
    expect(() => ledger.recordCreated(mailReceipt("oneTooMany"))).toThrow("cleanup_ledger_capacity_exceeded");
    // The refused receipt was not consumed: a fresh ledger for this run still accepts it.
    expect(() => createProviderProbeCleanupLedger(GATED_ENV).recordCreated(spare)).not.toThrow();
  });
});

describe("reservations held across a creation's await", () => {
  it("counts an outstanding reservation against capacity", () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    fillUsers(ledger, PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers - 1);
    const spare = userReceipt(USER_A);

    const reservation = ledger.reserve("auth-user");

    expect(ledger.remainingCapacity("auth-user")).toBe(0);
    expect(() => ledger.reserve("auth-user")).toThrow("cleanup_ledger_capacity_exceeded");
    expect(() => ledger.recordCreated(spare)).toThrow("cleanup_ledger_capacity_exceeded");
    reservation.commit(userReceipt(USER_B));
    expect(ledger.recordedCounts().authUsers).toBe(PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers);
  });

  it("keeps cleanup from starting while a creation is in flight, then lets the commit land", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    const { calls, deleters } = recordingDeleters();
    const reservation = ledger.reserve("auth-user");

    await expect(ledger.runCleanup(deleters)).rejects.toThrow("cleanup_ledger_creation_in_flight");
    expect(ledger.isRecording()).toBe(true);
    reservation.commit(userReceipt(USER_A));
    const report = await ledger.runCleanup(deleters);

    expect(calls).toEqual([`auth:${USER_A}`]);
    expect(report.outcome).toBe("complete");
  });

  it("frees the unit on release, and settles each reservation once only", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    fillUsers(ledger, PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers - 1);
    const reservation = ledger.reserve("auth-user");

    reservation.release();

    expect(ledger.remainingCapacity("auth-user")).toBe(1);
    expect(() => reservation.release()).toThrow("cleanup_ledger_reservation_used");
    expect(() => reservation.commit(userReceipt(USER_A))).toThrow("cleanup_ledger_reservation_used");
    expect((await ledger.runCleanup(recordingDeleters().deleters)).outcome).toBe("complete");
  });

  it("commits only a genuine receipt of its own kind", () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);

    expect(() => ledger.reserve("auth-user").commit(mailReceipt(MAIL_A))).toThrow("cleanup_ledger_receipt_refused");
    expect(() => ledger.reserve("auth-user").commit({ kind: "auth-user", id: USER_A })).toThrow(
      "cleanup_ledger_receipt_refused",
    );
    expect(() => ledger.reserve("auth-user").commit(userReceipt(USER_A, OTHER_RUN_ID))).toThrow(
      "cleanup_ledger_receipt_refused",
    );
    expect(ledger.recordedCounts()).toEqual({ authUsers: 0, mailpitMessages: 0 });
    expect(ledger.remainingCapacity("auth-user")).toBe(PROVIDER_PROBE_CLEANUP_LIMITS.maxAuthUsers);
  });

  it("refuses to reserve on a closed ledger", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    await ledger.runCleanup(recordingDeleters().deleters);

    expect(() => ledger.reserve("auth-user")).toThrow("cleanup_ledger_closed");
  });
});

describe("cleanup", () => {
  it("deletes exactly the recorded ids once each, newest first, and reports no id", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));
    ledger.recordCreated(userReceipt(USER_B));
    ledger.recordCreated(mailReceipt(MAIL_A));
    ledger.recordCreated(mailReceipt(MAIL_B));
    const { calls, deleters } = recordingDeleters();

    expect(ledger.recordedCounts()).toEqual({ authUsers: 2, mailpitMessages: 2 });
    const report = await ledger.runCleanup(deleters);

    expect(calls).toEqual([`auth:${USER_B}`, `auth:${USER_A}`, `mail:${MAIL_B}`, `mail:${MAIL_A}`]);
    expect(report).toEqual({
      outcome: "complete",
      round: 1,
      gateClosedDuringRound: false,
      authUsers: { attempted: 2, deleted: 2, failed: 0, notAttempted: 0 },
      mailpitMessages: { attempted: 2, deleted: 2, failed: 0, notAttempted: 0 },
      residue: { authUsers: 0, mailpitMessages: 0 },
      retryAllowed: false,
      items: [
        { category: "auth-user", ordinal: 2, outcome: "deleted" },
        { category: "auth-user", ordinal: 1, outcome: "deleted" },
        { category: "mailpit-message", ordinal: 2, outcome: "deleted" },
        { category: "mailpit-message", ordinal: 1, outcome: "deleted" },
      ],
    });
    expect(Object.isFrozen(report)).toBe(true);
    expectNoIds(report, [USER_A, USER_B, MAIL_A, MAIL_B]);
    expect(ledger.recordedCounts()).toEqual({ authUsers: 0, mailpitMessages: 0 });
    await expect(ledger.retryFailedCleanup(deleters)).rejects.toThrow("cleanup_ledger_no_residue");
  });

  it("reports nothing to do when the run created nothing", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    const { calls, deleters } = recordingDeleters();

    expect((await ledger.runCleanup(deleters)).outcome).toBe("not-needed");
    expect(calls).toEqual([]);
  });

  it("runs the first round once only and refuses new receipts while it runs", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: ProviderProbeCleanupDeleters = { deleteAuthUser: () => pending, deleteMailpitMessage: async () => undefined };

    const first = ledger.runCleanup(slow);
    expect(() => ledger.recordCreated(userReceipt(USER_B))).toThrow("cleanup_ledger_closed");
    await expect(ledger.runCleanup(slow)).rejects.toThrow("cleanup_ledger_already_run");
    await expect(ledger.retryFailedCleanup(slow)).rejects.toThrow("cleanup_ledger_no_residue");
    release();
    expect((await first).outcome).toBe("complete");
  });
});

describe("the failure path: residue is kept privately and retried exactly", () => {
  it("keeps failed targets, reports them as counts only, and retries exactly them", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));
    ledger.recordCreated(userReceipt(USER_B));
    ledger.recordCreated(userReceipt(USER_C));
    ledger.recordCreated(mailReceipt(MAIL_A));
    const { calls, deleters, failing } = recordingDeleters(new Set([USER_B, MAIL_A]));

    const first = await ledger.runCleanup(deleters);

    expect(calls).toEqual([`auth:${USER_C}`, `auth:${USER_B}`, `auth:${USER_A}`, `mail:${MAIL_A}`]);
    expect(first).toMatchObject({
      outcome: "failed",
      round: 1,
      authUsers: { attempted: 3, deleted: 2, failed: 1, notAttempted: 0 },
      mailpitMessages: { attempted: 1, deleted: 0, failed: 1, notAttempted: 0 },
      residue: { authUsers: 1, mailpitMessages: 1 },
      retryAllowed: true,
    });
    expect(first.items).toEqual([
      { category: "auth-user", ordinal: 3, outcome: "deleted" },
      { category: "auth-user", ordinal: 2, outcome: "failed" },
      { category: "auth-user", ordinal: 1, outcome: "deleted" },
      { category: "mailpit-message", ordinal: 1, outcome: "failed" },
    ]);
    expect(ledger.residueCounts()).toEqual({ authUsers: 1, mailpitMessages: 1 });
    expect(() => ledger.recordCreated(userReceipt("44444444-4444-4444-8444-444444444444"))).toThrow(
      "cleanup_ledger_closed",
    );
    expectNoIds(first, [USER_A, USER_B, USER_C, MAIL_A]);
    expectNoIds(ledger, [USER_A, USER_B, USER_C, MAIL_A]);

    failing.delete(USER_B);
    calls.length = 0;
    const second = await ledger.retryFailedCleanup(deleters);

    expect(calls).toEqual([`auth:${USER_B}`, `mail:${MAIL_A}`]);
    expect(second).toMatchObject({
      outcome: "failed",
      round: 2,
      authUsers: { attempted: 1, deleted: 1, failed: 0 },
      mailpitMessages: { attempted: 1, deleted: 0, failed: 1 },
      residue: { authUsers: 0, mailpitMessages: 1 },
      retryAllowed: true,
    });

    failing.delete(MAIL_A);
    calls.length = 0;
    const third = await ledger.retryFailedCleanup(deleters);

    expect(calls).toEqual([`mail:${MAIL_A}`]);
    expect(third).toMatchObject({ outcome: "complete", round: 3, residue: { authUsers: 0, mailpitMessages: 0 }, retryAllowed: false });
    expect(ledger.residueCounts()).toEqual({ authUsers: 0, mailpitMessages: 0 });
  });

  it("stops retrying after the bounded number of rounds and keeps the residue", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));
    const { calls, deleters } = recordingDeleters(new Set([USER_A]));

    const reports = [await ledger.runCleanup(deleters)];
    while (reports.at(-1)!.retryAllowed) {
      reports.push(await ledger.retryFailedCleanup(deleters));
    }

    expect(reports.map((report) => report.round)).toEqual([1, 2, 3]);
    expect(PROVIDER_PROBE_CLEANUP_LIMITS.maxCleanupRounds).toBe(3);
    expect(calls).toEqual([`auth:${USER_A}`, `auth:${USER_A}`, `auth:${USER_A}`]);
    expect(reports.at(-1)).toMatchObject({ outcome: "failed", residue: { authUsers: 1, mailpitMessages: 0 }, retryAllowed: false });
    expect(ledger.residueCounts()).toEqual({ authUsers: 1, mailpitMessages: 0 });
    await expect(ledger.retryFailedCleanup(deleters)).rejects.toThrow("cleanup_ledger_retry_limit");
    expect(calls).toHaveLength(3);
  });
});

describe("deleter wiring", () => {
  const noop = async (): Promise<void> => undefined;

  it.each<[string, unknown]>([
    ["a missing deleter", { deleteAuthUser: noop }],
    ["an extra member", { deleteAuthUser: noop, deleteMailpitMessage: noop, listAll: noop }],
    ["a non-function deleter", { deleteAuthUser: "x", deleteMailpitMessage: noop }],
    ["null", null],
  ])("refuses %s before deleting anything", async (_label, deleters) => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));

    await expect(ledger.runCleanup(deleters as ProviderProbeCleanupDeleters)).rejects.toThrow(
      "cleanup_ledger_invalid_deleters",
    );
    expect(ledger.recordedCounts()).toEqual({ authUsers: 1, mailpitMessages: 0 });
  });

  it("refuses accessor deleters and ignores later changes to the deleter object", async () => {
    const ledger = createProviderProbeCleanupLedger(GATED_ENV);
    ledger.recordCreated(userReceipt(USER_A));
    const accessor = Object.defineProperty({ deleteMailpitMessage: noop }, "deleteAuthUser", {
      enumerable: true,
      get: () => noop,
    });
    await expect(ledger.runCleanup(accessor as unknown as ProviderProbeCleanupDeleters)).rejects.toThrow(
      "cleanup_ledger_invalid_deleters",
    );

    const original = vi.fn<(id: string) => Promise<void>>(async () => undefined);
    const replacement = vi.fn<(id: string) => Promise<void>>(async () => undefined);
    const deleters = { deleteAuthUser: original, deleteMailpitMessage: noop };
    const running = ledger.runCleanup(deleters);
    deleters.deleteAuthUser = replacement;
    await running;

    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(USER_A);
    expect(replacement).not.toHaveBeenCalled();
  });
});
