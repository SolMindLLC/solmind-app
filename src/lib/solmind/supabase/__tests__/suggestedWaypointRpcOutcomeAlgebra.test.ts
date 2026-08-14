import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  SUGGESTED_WAYPOINT_COMMAND_OUTCOMES,
  type SuggestedWaypointCommandOutcome,
} from "../suggestedWaypointRpcContract";
import {
  SUGGESTED_WAYPOINT_RPC_FAILED,
  createSuggestedWaypointHumanRpcExecutor,
  createSuggestedWaypointWorkerRpcExecutor,
} from "../suggestedWaypointRpcExecutor";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const RELATIONSHIP_ID = "33333333-3333-4333-8333-333333333333";
const SUGGESTION_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_ID = "66666666-6666-4666-8666-666666666666";
const TIMESTAMP = "2026-08-14T15:38:00.000Z";

type CommandCase = Readonly<{
  scope: "human" | "worker";
  functionName:
    | "solmind_save_suggested_waypoint_draft"
    | "solmind_schedule_suggested_waypoint_send"
    | "solmind_pull_back_suggested_waypoint"
    | "solmind_deliver_suggested_waypoint"
    | "solmind_mark_suggested_waypoint_read"
    | "solmind_acknowledge_suggested_waypoint_receipt";
  args: Readonly<Record<string, unknown>>;
  outcomes: readonly SuggestedWaypointCommandOutcome[];
}>;

const COMMAND_CASES: readonly CommandCase[] = [
  {
    scope: "human",
    functionName: "solmind_save_suggested_waypoint_draft",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_guide_explorer_relationship_id: RELATIONSHIP_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_revision: 1,
      p_destination: "Protect one evening for recovery",
      p_why: "Create dependable recovery space.",
      p_arrival_signals: ["One evening remains unscheduled."],
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "relationship_unavailable",
      "stale",
    ],
  },
  {
    scope: "human",
    functionName: "solmind_schedule_suggested_waypoint_send",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_suggested_waypoint_version_id: VERSION_ID,
      p_expected_revision: 2,
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "policy_unavailable",
      "relationship_unavailable",
      "stale",
    ],
  },
  {
    scope: "human",
    functionName: "solmind_pull_back_suggested_waypoint",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_revision: 2,
      p_expected_pending_version_id: VERSION_ID,
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "relationship_unavailable",
      "stale",
      "too_late",
    ],
  },
  {
    scope: "worker",
    functionName: "solmind_deliver_suggested_waypoint",
    args: {
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_pending_version_id: VERSION_ID,
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "relationship_unavailable",
      "too_late",
    ],
  },
  {
    scope: "human",
    functionName: "solmind_mark_suggested_waypoint_read",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_version_id: VERSION_ID,
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "relationship_unavailable",
    ],
  },
  {
    scope: "human",
    functionName: "solmind_acknowledge_suggested_waypoint_receipt",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_current_version_id: VERSION_ID,
    },
    outcomes: [
      "applied",
      "idempotent",
      "invalid_transition",
      "operation_conflict",
      "relationship_unavailable",
      "stale",
    ],
  },
];

function commonRow(
  outcome: SuggestedWaypointCommandOutcome,
  currentVersionId: string | null,
) {
  switch (outcome) {
    case "relationship_unavailable":
      return {
        outcome_code: outcome,
        operation_id: OPERATION_ID,
        suggested_waypoint_id: null,
        authoring_revision: null,
        current_version_id: null,
        committed_at: null,
      };
    case "operation_conflict":
      return {
        outcome_code: outcome,
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: null,
        current_version_id: null,
        committed_at: null,
      };
    case "policy_unavailable":
      return {
        outcome_code: outcome,
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 2,
        current_version_id: null,
        committed_at: null,
      };
    case "stale":
    case "too_late":
    case "invalid_transition":
      return {
        outcome_code: outcome,
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 2,
        current_version_id: currentVersionId,
        committed_at: null,
      };
    case "applied":
    case "idempotent":
      return {
        outcome_code: outcome,
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 2,
        current_version_id: currentVersionId,
        committed_at: TIMESTAMP,
      };
  }
}

function rowFor(testCase: CommandCase, outcome: SuggestedWaypointCommandOutcome) {
  const committed = outcome === "applied" || outcome === "idempotent";
  const currentVersionId =
    testCase.functionName === "solmind_deliver_suggested_waypoint" ||
    testCase.functionName === "solmind_mark_suggested_waypoint_read" ||
    testCase.functionName === "solmind_acknowledge_suggested_waypoint_receipt"
      ? VERSION_ID
      : null;
  const common = commonRow(outcome, currentVersionId);

  switch (testCase.functionName) {
    case "solmind_save_suggested_waypoint_draft":
      return { ...common, draft_saved_at: committed ? TIMESTAMP : null };
    case "solmind_schedule_suggested_waypoint_send":
      return {
        ...common,
        pending_version_id: committed ? VERSION_ID : null,
        deadline_at: committed ? TIMESTAMP : null,
        policy_key: committed
          ? "suggested_waypoint_send_grace_seconds"
          : null,
        policy_version: committed ? 1 : null,
        effective_seconds: committed ? 300 : null,
      };
    case "solmind_pull_back_suggested_waypoint":
      return { ...common, draft_restored_at: committed ? TIMESTAMP : null };
    case "solmind_deliver_suggested_waypoint":
      return {
        ...common,
        delivered_version_id: committed ? VERSION_ID : null,
        delivered_at: committed ? TIMESTAMP : null,
      };
    case "solmind_mark_suggested_waypoint_read":
      return { ...common, read_at: committed ? TIMESTAMP : null };
    case "solmind_acknowledge_suggested_waypoint_receipt":
      return {
        ...common,
        acknowledged_version_id: committed ? VERSION_ID : null,
        acknowledged_at: committed ? TIMESTAMP : null,
      };
  }
}

function fakeClient(data: unknown) {
  const rpc = vi.fn(() => Promise.resolve({ data, error: null }));
  return { client: { rpc }, rpc };
}

async function execute(testCase: CommandCase, row: unknown) {
  const { client, rpc } = fakeClient([row]);
  const executor =
    testCase.scope === "worker"
      ? createSuggestedWaypointWorkerRpcExecutor(client as never)
      : createSuggestedWaypointHumanRpcExecutor(client as never);
  const result = await executor.execute({
    functionName: testCase.functionName,
    args: testCase.args,
  });
  return { result, rpc };
}

describe("Suggested Waypoint canonical command outcome algebra", () => {
  it("keeps the exact eight-value canonical vocabulary", () => {
    expect(SUGGESTED_WAYPOINT_COMMAND_OUTCOMES).toEqual([
      "applied",
      "idempotent",
      "stale",
      "too_late",
      "invalid_transition",
      "relationship_unavailable",
      "policy_unavailable",
      "operation_conflict",
    ]);
    expect(Object.isFrozen(SUGGESTED_WAYPOINT_COMMAND_OUTCOMES)).toBe(true);
  });

  it("pins each TypeScript outcome subset to the source-current SQL function", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260813000000_suggested_waypoint_persistence_security_foundation.sql",
      ),
      "utf8",
    );
    const canonical = new Set<string>(SUGGESTED_WAYPOINT_COMMAND_OUTCOMES);

    for (const testCase of COMMAND_CASES) {
      const startMarker = `create function public.${testCase.functionName}(`;
      const start = migration.indexOf(startMarker);
      expect(start, `${testCase.functionName} must exist in the migration`).toBeGreaterThanOrEqual(0);
      const next = migration.indexOf("\ncreate function public.", start + startMarker.length);
      const body = migration.slice(start, next === -1 ? undefined : next);
      const outcomes = new Set(
        [...body.matchAll(/'([a-z_]+)'::text/g)]
          .map((match) => match[1]!)
          .filter((value) => canonical.has(value)),
      );

      expect([...outcomes].sort()).toEqual([...testCase.outcomes].sort());
      expect(body).not.toContain("'already_applied'::text");
    }
  });

  for (const testCase of COMMAND_CASES) {
    for (const outcome of testCase.outcomes) {
      it(`accepts ${outcome} for ${testCase.functionName}`, async () => {
        const row = rowFor(testCase, outcome);
        const { result, rpc } = await execute(testCase, row);

        expect(rpc).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          functionName: testCase.functionName,
          data: row,
          error: null,
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.data)).toBe(true);
      });
    }
  }

  it("rejects the nonexistent already_applied vocabulary", async () => {
    const testCase = COMMAND_CASES[0]!;
    const row = {
      ...rowFor(testCase, "applied"),
      outcome_code: "already_applied",
    };
    const { result } = await execute(testCase, row);

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
    expect(result.data).toBeNull();
  });

  it("rejects a globally valid outcome outside the function subset", async () => {
    const testCase = COMMAND_CASES[0]!;
    const row = {
      ...rowFor(testCase, "stale"),
      outcome_code: "policy_unavailable",
      current_version_id: null,
    };
    const { result } = await execute(testCase, row);

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
  });

  it("keeps relationship_unavailable opaque while binding the operation", async () => {
    const testCase = COMMAND_CASES[1]!;
    const row = rowFor(testCase, "relationship_unavailable");
    const accepted = await execute(testCase, row);
    expect(accepted.result.error).toBeNull();

    const wrongOperation = {
      ...row,
      operation_id: OTHER_ID,
    };
    const rejected = await execute(testCase, wrongOperation);
    expect(rejected.result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
  });

  it("binds every disclosed suggestion identity on non-applied outcomes", async () => {
    const testCase = COMMAND_CASES[0]!;
    const row = {
      ...rowFor(testCase, "operation_conflict"),
      suggested_waypoint_id: OTHER_ID,
    };
    const { result } = await execute(testCase, row);

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
  });

  it("accepts authoritative nullable current-version evidence where SQL permits it", async () => {
    const save = COMMAND_CASES[0]!;
    const staleWithVersion = {
      ...rowFor(save, "stale"),
      current_version_id: VERSION_ID,
    };
    expect((await execute(save, staleWithVersion)).result.error).toBeNull();

    const idempotentWithVersion = {
      ...rowFor(save, "idempotent"),
      current_version_id: VERSION_ID,
    };
    expect((await execute(save, idempotentWithVersion)).result.error).toBeNull();
  });

  it("rejects invalid common-field nullability for every branch class", async () => {
    const save = COMMAND_CASES[0]!;
    const relationshipLeak = {
      ...rowFor(save, "relationship_unavailable"),
      suggested_waypoint_id: SUGGESTION_ID,
    };
    expect((await execute(save, relationshipLeak)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );

    const conflictRevision = {
      ...rowFor(save, "operation_conflict"),
      authoring_revision: 2,
    };
    expect((await execute(save, conflictRevision)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );

    const staleCommit = {
      ...rowFor(save, "stale"),
      committed_at: TIMESTAMP,
    };
    expect((await execute(save, staleCommit)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );

    const appliedWithoutCommit = {
      ...rowFor(save, "applied"),
      committed_at: null,
    };
    expect((await execute(save, appliedWithoutCommit)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );
  });

  it("rejects success-only values on a non-applied outcome", async () => {
    const testCase = COMMAND_CASES[1]!;
    const row = {
      ...rowFor(testCase, "stale"),
      pending_version_id: VERSION_ID,
    };
    const { result } = await execute(testCase, row);

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
  });

  it("requires committed proof fields to match the call and commit time", async () => {
    const schedule = COMMAND_CASES[1]!;
    const wrongVersion = {
      ...rowFor(schedule, "idempotent"),
      pending_version_id: OTHER_ID,
    };
    expect((await execute(schedule, wrongVersion)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );

    const read = COMMAND_CASES[4]!;
    const wrongTime = {
      ...rowFor(read, "applied"),
      read_at: "2026-08-14T15:39:00.000Z",
    };
    expect((await execute(read, wrongTime)).result.error).toBe(
      SUGGESTED_WAYPOINT_RPC_FAILED,
    );
  });
});
