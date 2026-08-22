// PRJ01_V-WS05-WI022-S03 server-only local delivery-worker invocation.
//
// This owner accepts one already-authorized exact delivery job. It does not
// discover, schedule, poll, claim, lease, retry, or continuously process work.

import "server-only";

import {
  type SuggestedWaypointRpcResult,
  type SuggestedWaypointWorkerRpcExecutor,
  createSuggestedWaypointWorkerRpcExecutor,
} from "./suggestedWaypointRpcExecutor";
import {
  type SuggestedWaypointWorkerRpcCall,
  isSuggestedWaypointRpcPayloadBoundToCall,
  validateSuggestedWaypointRpcPayload,
} from "./suggestedWaypointRpcContract";
import { createServiceRoleClient } from "./serviceRoleClient";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointDeliveryWorker must not be imported in browser code.",
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INPUT_KEYS = Object.freeze([
  "operationId",
  "suggestedWaypointId",
  "expectedPendingVersionId",
] as const);

const NON_DELIVERY_OUTCOMES = new Set([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
  "too_late",
]);

export const SUGGESTED_WAYPOINT_DELIVERY_RESULTS = Object.freeze([
  "delivered",
  "not_delivered",
  "failed",
] as const);

export type SuggestedWaypointDeliveryResult =
  (typeof SUGGESTED_WAYPOINT_DELIVERY_RESULTS)[number];

export type SuggestedWaypointDeliveryJob = Readonly<{
  operationId: string;
  suggestedWaypointId: string;
  expectedPendingVersionId: string;
}>;

export type SuggestedWaypointDeliveryWorkerExecutorFactory =
  () => SuggestedWaypointWorkerRpcExecutor;

const createDefaultExecutor: SuggestedWaypointDeliveryWorkerExecutorFactory =
  () => createSuggestedWaypointWorkerRpcExecutor(createServiceRoleClient());

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function snapshotDeliveryJob(value: unknown): SuggestedWaypointDeliveryJob | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== INPUT_KEYS.length ||
      !INPUT_KEYS.every((key) => Object.hasOwn(descriptors, key))
    ) {
      return null;
    }

    const values = INPUT_KEYS.map((key) => {
      const descriptor = descriptors[key];
      return descriptor && "value" in descriptor ? descriptor.value : null;
    });

    if (!values.every(isCanonicalUuid)) {
      return null;
    }

    return Object.freeze({
      operationId: values[0],
      suggestedWaypointId: values[1],
      expectedPendingVersionId: values[2],
    });
  } catch {
    return null;
  }
}

function createDeliveryCall(
  job: SuggestedWaypointDeliveryJob,
): SuggestedWaypointWorkerRpcCall {
  return Object.freeze({
    functionName: "solmind_deliver_suggested_waypoint",
    args: Object.freeze({
      p_operation_id: job.operationId,
      p_suggested_waypoint_id: job.suggestedWaypointId,
      p_expected_pending_version_id: job.expectedPendingVersionId,
    }),
  });
}

function projectResult(
  call: SuggestedWaypointWorkerRpcCall,
  result: SuggestedWaypointRpcResult,
): SuggestedWaypointDeliveryResult {
  if (
    result.error !== null ||
    result.functionName !== call.functionName ||
    result.data === null
  ) {
    return "failed";
  }

  const payload = validateSuggestedWaypointRpcPayload(
    call.functionName,
    [result.data],
  );
  if (
    payload === null ||
    !isSuggestedWaypointRpcPayloadBoundToCall(call, payload) ||
    !("outcome_code" in payload)
  ) {
    return "failed";
  }

  if (payload.outcome_code === "applied" || payload.outcome_code === "idempotent") {
    return "delivered";
  }

  return NON_DELIVERY_OUTCOMES.has(payload.outcome_code)
    ? "not_delivered"
    : "failed";
}

export async function invokeSuggestedWaypointDelivery(
  input: unknown,
  createExecutor: SuggestedWaypointDeliveryWorkerExecutorFactory =
    createDefaultExecutor,
): Promise<SuggestedWaypointDeliveryResult> {
  const job = snapshotDeliveryJob(input);
  if (job === null) {
    return "failed";
  }

  const call = createDeliveryCall(job);
  try {
    const executor = createExecutor();
    const result = await executor.execute(call);
    return projectResult(call, result);
  } catch {
    return "failed";
  }
}
