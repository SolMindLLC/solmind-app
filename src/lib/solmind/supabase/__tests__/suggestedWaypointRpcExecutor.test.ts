import { describe, expect, it, vi } from "vitest";

import * as supabaseBarrel from "../index";
import {
  SUGGESTED_WAYPOINT_HUMAN_RPC_FUNCTIONS,
  SUGGESTED_WAYPOINT_WORKER_RPC_FUNCTIONS,
} from "../suggestedWaypointRpcContract";
import {
  SUGGESTED_WAYPOINT_RPC_DENIED,
  SUGGESTED_WAYPOINT_RPC_FAILED,
  SUGGESTED_WAYPOINT_RPC_REFRESH_REQUIRED,
  SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL,
  createSuggestedWaypointHumanRpcExecutor,
  createSuggestedWaypointWorkerRpcExecutor,
} from "../suggestedWaypointRpcExecutor";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const RELATIONSHIP_ID = "33333333-3333-4333-8333-333333333333";
const SUGGESTION_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TIMESTAMP = "2026-08-14T02:20:00.000Z";

function commandBase(currentVersionId: string | null = null) {
  return {
    outcome_code: "applied",
    operation_id: OPERATION_ID,
    suggested_waypoint_id: SUGGESTION_ID,
    authoring_revision: 2,
    current_version_id: currentVersionId,
    committed_at: TIMESTAMP,
  };
}

const DISPATCH_CASES = [
  {
    scope: "human" as const,
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
    row: { ...commandBase(), draft_saved_at: TIMESTAMP },
  },
  {
    scope: "human" as const,
    functionName: "solmind_schedule_suggested_waypoint_send",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_suggested_waypoint_version_id: VERSION_ID,
      p_expected_revision: 2,
    },
    row: {
      ...commandBase(),
      pending_version_id: VERSION_ID,
      deadline_at: TIMESTAMP,
      policy_key: "suggested_waypoint_send_grace_seconds",
      policy_version: 1,
      effective_seconds: 300,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_pull_back_suggested_waypoint",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_revision: 2,
      p_expected_pending_version_id: VERSION_ID,
    },
    row: { ...commandBase(), draft_restored_at: TIMESTAMP },
  },
  {
    scope: "worker" as const,
    functionName: "solmind_deliver_suggested_waypoint",
    args: {
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_pending_version_id: VERSION_ID,
    },
    row: {
      ...commandBase(VERSION_ID),
      delivered_version_id: VERSION_ID,
      delivered_at: TIMESTAMP,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_mark_suggested_waypoint_read",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_version_id: VERSION_ID,
    },
    row: { ...commandBase(VERSION_ID), read_at: TIMESTAMP },
  },
  {
    scope: "human" as const,
    functionName: "solmind_acknowledge_suggested_waypoint_receipt",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_current_version_id: VERSION_ID,
    },
    row: {
      ...commandBase(VERSION_ID),
      acknowledged_version_id: VERSION_ID,
      acknowledged_at: TIMESTAMP,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_list_guide_suggested_waypoints",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_guide_explorer_relationship_id: RELATIONSHIP_ID,
      p_page_size: 10,
      p_cursor: null,
    },
    row: {
      items: [
        {
          suggested_waypoint_id: SUGGESTION_ID,
          authoring_mode: "pending",
          authoring_revision: 2,
          destination_preview: "Protect one evening for recovery",
          pending_deadline_at: TIMESTAMP,
          pull_back_available: true,
          channel_category: "pending",
          current_version_id: null,
          delivered_at: null,
          acknowledged_version_id: null,
          acknowledged_at: null,
        },
      ],
      next_cursor: null,
      total_count: 1,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_get_guide_suggested_waypoint",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_guide_explorer_relationship_id: RELATIONSHIP_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
    },
    row: {
      suggested_waypoint_id: SUGGESTION_ID,
      authoring_mode: "delivered",
      authoring_revision: 2,
      destination_preview: "Protect one evening for recovery",
      pending_deadline_at: null,
      pull_back_available: false,
      channel_category: "open",
      current_version_id: VERSION_ID,
      delivered_at: TIMESTAMP,
      acknowledged_version_id: null,
      acknowledged_at: null,
      draft_or_pending_destination: null,
      draft_or_pending_why: null,
      draft_or_pending_arrival_signals: null,
      delivered_destination: "Protect one evening for recovery",
      delivered_why: "Create dependable recovery space.",
      delivered_arrival_signals: ["One evening remains unscheduled."],
      policy_key: null,
      policy_version: null,
      effective_seconds: null,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_list_explorer_suggested_waypoints",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_page_size: 10,
      p_cursor: null,
    },
    row: {
      items: [
        {
          suggested_waypoint_id: SUGGESTION_ID,
          current_version_id: VERSION_ID,
          destination_preview: "Protect one evening for recovery",
          received_at: TIMESTAMP,
          read: false,
          receipt_acknowledged: false,
          acknowledged_at: null,
          channel_category: "open",
        },
      ],
      next_cursor: null,
      total_count: 1,
    },
  },
  {
    scope: "human" as const,
    functionName: "solmind_get_explorer_suggested_waypoint",
    args: {
      p_actor_user_account_id: ACTOR_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
    },
    row: {
      suggested_waypoint_id: SUGGESTION_ID,
      current_version_id: VERSION_ID,
      destination: "Protect one evening for recovery",
      why: "Create dependable recovery space.",
      arrival_signals: ["One evening remains unscheduled."],
      received_at: TIMESTAMP,
      read: false,
      read_at: null,
      receipt_acknowledged: false,
      acknowledged_at: null,
      channel_category: "open",
    },
  },
] as const;

function fakeClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  const client = { rpc } as unknown as Parameters<
    typeof createSuggestedWaypointHumanRpcExecutor
  >[0];
  return { client, rpc };
}

describe("Suggested Waypoint RPC closed catalog", () => {
  it("contains exactly nine human functions and one physically separate worker function", () => {
    expect(SUGGESTED_WAYPOINT_HUMAN_RPC_FUNCTIONS).toHaveLength(9);
    expect(SUGGESTED_WAYPOINT_WORKER_RPC_FUNCTIONS).toEqual([
      "solmind_deliver_suggested_waypoint",
    ]);
    expect(
      [...SUGGESTED_WAYPOINT_HUMAN_RPC_FUNCTIONS, ...SUGGESTED_WAYPOINT_WORKER_RPC_FUNCTIONS],
    ).not.toContain("solmind_get_admin_suggested_waypoint_operational_state");
  });

  it("keeps both server-only factories off the shared Supabase barrel", () => {
    expect("createSuggestedWaypointHumanRpcExecutor" in supabaseBarrel).toBe(false);
    expect("createSuggestedWaypointWorkerRpcExecutor" in supabaseBarrel).toBe(false);
  });
});

describe("Suggested Waypoint RPC exact dispatch and result validation", () => {
  for (const testCase of DISPATCH_CASES) {
    it(`dispatches and validates ${testCase.functionName}`, async () => {
      const { client, rpc } = fakeClient({ data: [testCase.row], error: null });
      const executor =
        testCase.scope === "human"
          ? createSuggestedWaypointHumanRpcExecutor(client)
          : createSuggestedWaypointWorkerRpcExecutor(client);

      const result = await executor.execute({
        functionName: testCase.functionName,
        args: testCase.args,
      });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(testCase.functionName, testCase.args);
      expect(result).toEqual({
        functionName: testCase.functionName,
        data: testCase.row,
        error: null,
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.data)).toBe(true);
    });
  }

  it("copies and deeply freezes nested list data", async () => {
    const row = structuredClone(DISPATCH_CASES[6].row);
    const { client } = fakeClient({ data: [row], error: null });
    const executor = createSuggestedWaypointHumanRpcExecutor(client);

    const result = await executor.execute({
      functionName: DISPATCH_CASES[6].functionName,
      args: DISPATCH_CASES[6].args,
    });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data).not.toBe(row);
      expect(Object.isFrozen(result.data)).toBe(true);
      expect(
        Object.isFrozen(
          (result.data as unknown as { items: unknown[] }).items,
        ),
      ).toBe(true);
      const mutableRow = row as unknown as {
        items: Array<{ destination_preview: string }>;
      };
      mutableRow.items[0]!.destination_preview = "Changed after validation";
      expect(JSON.stringify(result.data)).not.toContain("Changed after validation");
    }
  });
});

describe("Suggested Waypoint RPC fail-closed boundaries", () => {
  const validHuman = {
    functionName: DISPATCH_CASES[0].functionName,
    args: DISPATCH_CASES[0].args,
  };

  it.each([
    ["unknown function", { functionName: "solmind_unknown", args: {} }],
    [
      "dormant Admin query",
      {
        functionName: "solmind_get_admin_suggested_waypoint_operational_state",
        args: { p_suggested_waypoint_id: SUGGESTION_ID },
      },
    ],
    ["extra envelope key", { ...validHuman, extra: true }],
    [
      "extra argument",
      { ...validHuman, args: { ...validHuman.args, p_actor_role: "guide" } },
    ],
    [
      "invalid page size",
      {
        functionName: DISPATCH_CASES[6].functionName,
        args: { ...DISPATCH_CASES[6].args, p_page_size: 25 },
      },
    ],
    [
      "duplicate arrival signal",
      {
        ...validHuman,
        args: {
          ...validHuman.args,
          p_arrival_signals: ["Same signal", "Same signal"],
        },
      },
    ],
  ])("rejects %s without an RPC call", async (_name, call) => {
    const { client, rpc } = fakeClient({ data: [DISPATCH_CASES[0].row], error: null });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute(call);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      functionName: null,
      data: null,
      error: SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL,
    });
  });

  it("prevents the human executor from invoking the worker delivery call", async () => {
    const { client, rpc } = fakeClient({ data: [DISPATCH_CASES[3].row], error: null });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute({
      functionName: DISPATCH_CASES[3].functionName,
      args: DISPATCH_CASES[3].args,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL);
  });

  it("prevents the worker executor from invoking a human call", async () => {
    const { client, rpc } = fakeClient({ data: [DISPATCH_CASES[0].row], error: null });
    const result = await createSuggestedWaypointWorkerRpcExecutor(client).execute(validHuman);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL);
  });

  it.each([
    ["Guide", 7],
    ["Explorer", 9],
  ] as const)(
    "maps a zero-row %s detail result to an explicit value-free denial",
    async (_role, caseIndex) => {
      const testCase = DISPATCH_CASES[caseIndex];
      const { client } = fakeClient({ data: [], error: null });
      const result = await createSuggestedWaypointHumanRpcExecutor(
        client,
      ).execute({
        functionName: testCase.functionName,
        args: testCase.args,
      });

      expect(result).toEqual({
        functionName: testCase.functionName,
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_DENIED,
      });
      expect(Object.isFrozen(result)).toBe(true);
    },
  );

  it.each([
    ["Guide", 6],
    ["Explorer", 8],
  ] as const)(
    "maps only the exact %s list invalid-cursor error to a function-bound refresh result",
    async (_role, caseIndex) => {
      const testCase = DISPATCH_CASES[caseIndex];
      const { client } = fakeClient({
        data: null,
        error: {
          code: "P0001",
          message: "solmind_suggested_waypoint_invalid_cursor",
        },
      });
      const result = await createSuggestedWaypointHumanRpcExecutor(
        client,
      ).execute({
        functionName: testCase.functionName,
        args: testCase.args,
      });

      expect(result).toEqual({
        functionName: testCase.functionName,
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_REFRESH_REQUIRED,
      });
      expect(Object.isFrozen(result)).toBe(true);
    },
  );

  it.each([
    [
      "same message on a non-list function",
      0,
      { code: "P0001", message: "solmind_suggested_waypoint_invalid_cursor" },
    ],
    [
      "wrong code on a list function",
      6,
      { code: "22023", message: "solmind_suggested_waypoint_invalid_cursor" },
    ],
    [
      "wrong message on a list function",
      6,
      { code: "P0001", message: "solmind_suggested_waypoint_denied" },
    ],
  ] as const)("keeps %s on the generic value-free failure path", async (_name, caseIndex, error) => {
    const testCase = DISPATCH_CASES[caseIndex];
    const { client } = fakeClient({ data: null, error });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute({
      functionName: testCase.functionName,
      args: testCase.args,
    });

    expect(result).toEqual({
      functionName: null,
      data: null,
      error: SUGGESTED_WAYPOINT_RPC_FAILED,
    });
  });

  it.each([
    ["empty result", []],
    ["multiple rows", [DISPATCH_CASES[0].row, DISPATCH_CASES[0].row]],
    ["non-array result", DISPATCH_CASES[0].row],
    ["extra returned field", [{ ...DISPATCH_CASES[0].row, unexpected: true }]],
    [
      "malformed nested item",
      [
        {
          ...DISPATCH_CASES[6].row,
          items: [{ ...DISPATCH_CASES[6].row.items[0], passive_opened_at: TIMESTAMP }],
        },
      ],
    ],
  ])("fails closed on %s", async (_name, data) => {
    const caseToUse =
      _name === "malformed nested item" ? DISPATCH_CASES[6] : DISPATCH_CASES[0];
    const { client } = fakeClient({ data, error: null });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute({
      functionName: caseToUse.functionName,
      args: caseToUse.args,
    });

    expect(result).toEqual({
      functionName: null,
      data: null,
      error: SUGGESTED_WAYPOINT_RPC_FAILED,
    });
  });

  it.each([
    [
      "a Guide pending row with a non-pending channel",
      6,
      [{
        ...DISPATCH_CASES[6].row,
        items: [{
          ...DISPATCH_CASES[6].row.items[0],
          channel_category: "not_delivered",
        }],
      }],
    ],
    [
      "a Guide delivered detail carrying pending policy",
      7,
      [{
        ...DISPATCH_CASES[7].row,
        policy_key: "suggested_waypoint_send_grace_seconds",
        policy_version: 1,
        effective_seconds: 300,
      }],
    ],
    [
      "an Explorer row with contradictory acknowledgement state",
      8,
      [{
        ...DISPATCH_CASES[8].row,
        items: [{
          ...DISPATCH_CASES[8].row.items[0],
          receipt_acknowledged: false,
          acknowledged_at: TIMESTAMP,
        }],
      }],
    ],
    [
      "an Explorer detail with contradictory read state",
      9,
      [{
        ...DISPATCH_CASES[9].row,
        read: false,
        read_at: TIMESTAMP,
      }],
    ],
    [
      "a list total smaller than its page",
      6,
      [{ ...DISPATCH_CASES[6].row, total_count: 0 }],
    ],
    [
      "an out-of-policy send-grace value",
      1,
      [{ ...DISPATCH_CASES[1].row, effective_seconds: 3601 }],
    ],
    [
      "a delivered version that differs from current version",
      3,
      [{
        ...DISPATCH_CASES[3].row,
        current_version_id: "66666666-6666-4666-8666-666666666666",
      }],
    ],
  ] as const)("fails closed on %s", async (_name, caseIndex, data) => {
    const testCase = DISPATCH_CASES[caseIndex];
    const { client } = fakeClient({ data, error: null });
    const executor =
      testCase.scope === "human"
        ? createSuggestedWaypointHumanRpcExecutor(client)
        : createSuggestedWaypointWorkerRpcExecutor(client);

    const result = await executor.execute({
      functionName: testCase.functionName,
      args: testCase.args,
    });

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
    expect(result.data).toBeNull();
  });

  it.each([
    [
      "a command result for another operation",
      0,
      [{
        ...DISPATCH_CASES[0].row,
        operation_id: "66666666-6666-4666-8666-666666666666",
      }],
    ],
    [
      "a scheduled result for another pending version",
      1,
      [{
        ...DISPATCH_CASES[1].row,
        pending_version_id: "66666666-6666-4666-8666-666666666666",
      }],
    ],
    [
      "a detail result for another suggestion",
      9,
      [{
        ...DISPATCH_CASES[9].row,
        suggested_waypoint_id: "66666666-6666-4666-8666-666666666666",
      }],
    ],
  ] as const)("rejects %s even when its shape is valid", async (_name, caseIndex, data) => {
    const testCase = DISPATCH_CASES[caseIndex];
    const { client } = fakeClient({ data, error: null });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute({
      functionName: testCase.functionName,
      args: testCase.args,
    });

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
    expect(result.data).toBeNull();
  });

  it("redacts RPC errors and thrown failures to one value-free sentinel", async () => {
    const secret = "sbp_service_role_secret_should_never_escape";
    const { client } = fakeClient({
      data: null,
      error: { message: `https://project.supabase.co ${secret}` },
    });
    const result = await createSuggestedWaypointHumanRpcExecutor(client).execute(validHuman);

    expect(result.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
    expect(JSON.stringify(result)).not.toContain("supabase.co");
    expect(JSON.stringify(result)).not.toContain(secret);

    const rejectingClient = {
      rpc: vi.fn(() => Promise.reject(new Error(secret))),
    } as unknown as Parameters<typeof createSuggestedWaypointHumanRpcExecutor>[0];
    const rejected = await createSuggestedWaypointHumanRpcExecutor(
      rejectingClient,
    ).execute(validHuman);
    expect(rejected.error).toBe(SUGGESTED_WAYPOINT_RPC_FAILED);
    expect(JSON.stringify(rejected)).not.toContain(secret);
  });
});
