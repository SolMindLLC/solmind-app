import { describe, expect, it, vi } from "vitest";

import * as supabaseBarrel from "../index";
import { invokeSuggestedWaypointDelivery } from "../suggestedWaypointDeliveryWorker";
import type { SuggestedWaypointRpcResult } from "../suggestedWaypointRpcExecutor";
import type { SuggestedWaypointWorkerRpcCall } from "../suggestedWaypointRpcContract";

const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const SUGGESTION_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TIMESTAMP = "2026-08-21T20:00:00.000Z";

const JOB = Object.freeze({
  operationId: OPERATION_ID,
  suggestedWaypointId: SUGGESTION_ID,
  expectedPendingVersionId: VERSION_ID,
});

function commandResult(
  outcome:
    | "applied"
    | "idempotent"
    | "invalid_transition"
    | "operation_conflict"
    | "relationship_unavailable"
    | "too_late",
): SuggestedWaypointRpcResult {
  const committed = outcome === "applied" || outcome === "idempotent";
  const relationshipUnavailable = outcome === "relationship_unavailable";
  const operationConflict = outcome === "operation_conflict";
  const preservesCurrentVersion =
    committed || outcome === "invalid_transition" || outcome === "too_late";

  return {
    functionName: "solmind_deliver_suggested_waypoint",
    data: {
      outcome_code: outcome,
      operation_id: OPERATION_ID,
      suggested_waypoint_id: relationshipUnavailable ? null : SUGGESTION_ID,
      authoring_revision:
        relationshipUnavailable || operationConflict ? null : 2,
      current_version_id: preservesCurrentVersion ? VERSION_ID : null,
      committed_at: committed ? TIMESTAMP : null,
      delivered_version_id: committed ? VERSION_ID : null,
      delivered_at: committed ? TIMESTAMP : null,
    },
    error: null,
  } as unknown as SuggestedWaypointRpcResult;
}

function executorFactory(result: SuggestedWaypointRpcResult | Error) {
  const execute = vi.fn(async (call: SuggestedWaypointWorkerRpcCall) => {
    void call;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
  return {
    factory: () => ({ execute }),
    execute,
  };
}

describe("suggestedWaypointDeliveryWorker", () => {
  it("stays server-only and off the shared Supabase barrel", () => {
    expect("invokeSuggestedWaypointDelivery" in supabaseBarrel).toBe(false);
  });

  it.each(["applied", "idempotent"] as const)(
    "maps the authoritative %s outcome to delivered",
    async (outcome) => {
      const { factory, execute } = executorFactory(commandResult(outcome));

      await expect(invokeSuggestedWaypointDelivery(JOB, factory)).resolves.toBe(
        "delivered",
      );
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith({
        functionName: "solmind_deliver_suggested_waypoint",
        args: {
          p_operation_id: OPERATION_ID,
          p_suggested_waypoint_id: SUGGESTION_ID,
          p_expected_pending_version_id: VERSION_ID,
        },
      });
      const call = execute.mock.calls[0]?.[0];
      expect(Object.isFrozen(call)).toBe(true);
      expect(Object.isFrozen(call.args)).toBe(true);
    },
  );

  it.each([
    "invalid_transition",
    "operation_conflict",
    "relationship_unavailable",
    "too_late",
  ] as const)(
    "maps the authoritative %s outcome to value-free not_delivered",
    async (outcome) => {
      const { factory } = executorFactory(commandResult(outcome));

      await expect(invokeSuggestedWaypointDelivery(JOB, factory)).resolves.toBe(
        "not_delivered",
      );
    },
  );

  it.each([
    null,
    [],
    {},
    { ...JOB, extra: "not allowed" },
    { ...JOB, operationId: "not-a-uuid" },
    { ...JOB, suggestedWaypointId: "not-a-uuid" },
    { ...JOB, expectedPendingVersionId: "not-a-uuid" },
    { ...JOB, operationId: Object(OPERATION_ID) },
    Object.create({ operationId: OPERATION_ID }),
  ])("rejects invalid or hostile input before creating an executor", async (input) => {
    const createExecutor = vi.fn(() => {
      throw new Error("must not run");
    });

    await expect(
      invokeSuggestedWaypointDelivery(input, createExecutor),
    ).resolves.toBe("failed");
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it("rejects accessor input without invoking the getter", async () => {
    const getter = vi.fn(() => OPERATION_ID);
    const input = Object.defineProperty(
      {
        suggestedWaypointId: SUGGESTION_ID,
        expectedPendingVersionId: VERSION_ID,
      },
      "operationId",
      { enumerable: true, get: getter },
    );
    const createExecutor = vi.fn();

    await expect(
      invokeSuggestedWaypointDelivery(input, createExecutor),
    ).resolves.toBe("failed");
    expect(getter).not.toHaveBeenCalled();
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it("fails closed when a hostile proxy rejects descriptor inspection", async () => {
    const input = new Proxy(JOB, {
      ownKeys() {
        throw new Error("private input detail");
      },
    });
    const createExecutor = vi.fn();

    await expect(
      invokeSuggestedWaypointDelivery(input, createExecutor),
    ).resolves.toBe("failed");
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it("retains the immutable operation snapshot across asynchronous completion", async () => {
    let release: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(async (call: SuggestedWaypointWorkerRpcCall) => {
      void call;
      await barrier;
      return commandResult("applied");
    });
    const mutable: {
      operationId: string;
      suggestedWaypointId: string;
      expectedPendingVersionId: string;
    } = { ...JOB };

    const pending = invokeSuggestedWaypointDelivery(mutable, () => ({ execute }));
    mutable.operationId = OTHER_OPERATION_ID;
    mutable.suggestedWaypointId = OTHER_OPERATION_ID;
    mutable.expectedPendingVersionId = OTHER_OPERATION_ID;
    release?.();

    await expect(pending).resolves.toBe("delivered");
    expect(execute.mock.calls[0]?.[0].args).toEqual({
      p_operation_id: OPERATION_ID,
      p_suggested_waypoint_id: SUGGESTION_ID,
      p_expected_pending_version_id: VERSION_ID,
    });
  });

  it("accepts a null-prototype exact data envelope", async () => {
    const input = Object.assign(Object.create(null), JOB);
    const { factory } = executorFactory(commandResult("applied"));

    await expect(invokeSuggestedWaypointDelivery(input, factory)).resolves.toBe(
      "delivered",
    );
  });

  it("rejects symbol-key extension before creating an executor", async () => {
    const input = { ...JOB, [Symbol("private")]: "not allowed" };
    const createExecutor = vi.fn();

    await expect(
      invokeSuggestedWaypointDelivery(input, createExecutor),
    ).resolves.toBe("failed");
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it("reuses the caller-owned operation ID on an exact retry", async () => {
    const { factory, execute } = executorFactory(commandResult("idempotent"));

    await invokeSuggestedWaypointDelivery(JOB, factory);
    await invokeSuggestedWaypointDelivery(JOB, factory);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(
      execute.mock.calls.map((call) => call[0].args.p_operation_id),
    ).toEqual([OPERATION_ID, OPERATION_ID]);
  });

  it.each([
    {
      functionName: null,
      data: null,
      error: "solmind_suggested_waypoint_rpc_failed",
    },
    {
      functionName: "solmind_get_guide_suggested_waypoint",
      data: commandResult("applied").data,
      error: null,
    },
    {
      functionName: "solmind_deliver_suggested_waypoint",
      data: { private_detail: "must not escape" },
      error: null,
    },
    {
      functionName: "solmind_deliver_suggested_waypoint",
      data: {
        ...(commandResult("applied").data as unknown as Record<string, unknown>),
        operation_id: OTHER_OPERATION_ID,
      },
      error: null,
    },
  ] as SuggestedWaypointRpcResult[])(
    "maps malformed, wrong-function, error, or unbound results to failed",
    async (result) => {
      const { factory } = executorFactory(result);

      await expect(invokeSuggestedWaypointDelivery(JOB, factory)).resolves.toBe(
        "failed",
      );
    },
  );

  it("maps executor construction and transport exceptions to failed", async () => {
    await expect(
      invokeSuggestedWaypointDelivery(JOB, () => {
        throw new Error("private configuration detail");
      }),
    ).resolves.toBe("failed");

    const { factory } = executorFactory(
      new Error("private transport detail must not escape"),
    );
    await expect(invokeSuggestedWaypointDelivery(JOB, factory)).resolves.toBe(
      "failed",
    );
  });
});
