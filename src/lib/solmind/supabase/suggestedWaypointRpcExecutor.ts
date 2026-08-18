// PRJ01_V-WS05-WI022-S03 server-only Suggested Waypoint RPC transport.
//
// Human and worker factories are physically distinct at the exported boundary.
// Both use the same exact ten-function contract, but neither can invoke the
// other's functions and the dormant Admin operational query is unreachable.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import {
  type SuggestedWaypointHumanRpcCall,
  type SuggestedWaypointRpcFunction,
  type SuggestedWaypointRpcPayload,
  type SuggestedWaypointWorkerRpcCall,
  isSuggestedWaypointRpcPayloadBoundToCall,
  validateSuggestedWaypointHumanRpcCall,
  validateSuggestedWaypointRpcPayload,
  validateSuggestedWaypointWorkerRpcCall,
} from "./suggestedWaypointRpcContract";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRpcExecutor must not be imported in browser code.",
  );
}

export const SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL =
  "solmind_suggested_waypoint_rpc_unmapped_call";
export const SUGGESTED_WAYPOINT_RPC_FAILED =
  "solmind_suggested_waypoint_rpc_failed";
export const SUGGESTED_WAYPOINT_RPC_DENIED =
  "solmind_suggested_waypoint_rpc_denied";

type SuggestedWaypointDetailRpcFunction =
  | "solmind_get_guide_suggested_waypoint"
  | "solmind_get_explorer_suggested_waypoint";

export type SuggestedWaypointRpcError =
  | typeof SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL
  | typeof SUGGESTED_WAYPOINT_RPC_FAILED
  | typeof SUGGESTED_WAYPOINT_RPC_DENIED;

export type SuggestedWaypointRpcResult =
  | Readonly<{
      functionName: SuggestedWaypointRpcFunction;
      data: SuggestedWaypointRpcPayload;
      error: null;
    }>
  | Readonly<{
      functionName: SuggestedWaypointDetailRpcFunction;
      data: null;
      error: typeof SUGGESTED_WAYPOINT_RPC_DENIED;
    }>
  | Readonly<{
      functionName: null;
      data: null;
      error:
        | typeof SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL
        | typeof SUGGESTED_WAYPOINT_RPC_FAILED;
    }>;

export type SuggestedWaypointHumanRpcExecutor = Readonly<{
  execute(call: SuggestedWaypointHumanRpcCall | unknown): Promise<SuggestedWaypointRpcResult>;
}>;

export type SuggestedWaypointWorkerRpcExecutor = Readonly<{
  execute(call: SuggestedWaypointWorkerRpcCall | unknown): Promise<SuggestedWaypointRpcResult>;
}>;

function isZeroRowDetailDenial(
  functionName: SuggestedWaypointRpcFunction,
  data: unknown,
): functionName is SuggestedWaypointDetailRpcFunction {
  return (
    Array.isArray(data) &&
    data.length === 0 &&
    (functionName === "solmind_get_guide_suggested_waypoint" ||
      functionName === "solmind_get_explorer_suggested_waypoint")
  );
}

async function dispatch(
  client: SupabaseClient,
  call: SuggestedWaypointHumanRpcCall | SuggestedWaypointWorkerRpcCall,
): Promise<SuggestedWaypointRpcResult> {
  try {
    const { data, error } = await client.rpc(call.functionName, call.args);
    if (error !== null && error !== undefined) {
      return Object.freeze({
        functionName: null,
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_FAILED,
      });
    }
    if (isZeroRowDetailDenial(call.functionName, data)) {
      return Object.freeze({
        functionName: call.functionName,
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_DENIED,
      });
    }
    const payload = validateSuggestedWaypointRpcPayload(call.functionName, data);
    if (
      payload === null ||
      !isSuggestedWaypointRpcPayloadBoundToCall(call, payload)
    ) {
      return Object.freeze({
        functionName: null,
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_FAILED,
      });
    }
    return Object.freeze({
      functionName: call.functionName,
      data: payload,
      error: null,
    });
  } catch {
    return Object.freeze({
      functionName: null,
      data: null,
      error: SUGGESTED_WAYPOINT_RPC_FAILED,
    });
  }
}

function unmapped(): SuggestedWaypointRpcResult {
  return Object.freeze({
    functionName: null,
    data: null,
    error: SUGGESTED_WAYPOINT_RPC_UNMAPPED_CALL,
  });
}

export function createSuggestedWaypointHumanRpcExecutor(
  client: SupabaseClient,
): SuggestedWaypointHumanRpcExecutor {
  return Object.freeze({
    async execute(call: unknown): Promise<SuggestedWaypointRpcResult> {
      const validated = validateSuggestedWaypointHumanRpcCall(call);
      return validated === null ? unmapped() : dispatch(client, validated);
    },
  });
}

export function createSuggestedWaypointWorkerRpcExecutor(
  client: SupabaseClient,
): SuggestedWaypointWorkerRpcExecutor {
  return Object.freeze({
    async execute(call: unknown): Promise<SuggestedWaypointRpcResult> {
      const validated = validateSuggestedWaypointWorkerRpcCall(call);
      return validated === null ? unmapped() : dispatch(client, validated);
    },
  });
}
