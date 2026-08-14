// PRJ01_V-WS05-WI022-S03 server-only relationship-selector RPC executor.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import {
  type SuggestedWaypointRelationshipSelectorPage,
  validateSuggestedWaypointRelationshipSelectorPayload,
  validateSuggestedWaypointRelationshipSelectorRpcCall,
} from "./suggestedWaypointRelationshipSelectorContract";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRelationshipSelectorExecutor must not be imported in browser code.",
  );
}

export const SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED =
  "solmind_suggested_waypoint_relationship_selector_rpc_failed" as const;

export type SuggestedWaypointRelationshipSelectorRpcResult =
  | Readonly<{
      data: SuggestedWaypointRelationshipSelectorPage;
      error: null;
    }>
  | Readonly<{
      data: null;
      error: typeof SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED;
    }>;

export type SuggestedWaypointRelationshipSelectorExecutor = Readonly<{
  execute(call: unknown): Promise<SuggestedWaypointRelationshipSelectorRpcResult>;
}>;

function failed(): SuggestedWaypointRelationshipSelectorRpcResult {
  return Object.freeze({
    data: null,
    error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
  });
}

export function createSuggestedWaypointRelationshipSelectorExecutor(
  client: SupabaseClient,
): SuggestedWaypointRelationshipSelectorExecutor {
  return Object.freeze({
    async execute(call: unknown): Promise<SuggestedWaypointRelationshipSelectorRpcResult> {
      let validated;
      try {
        validated = validateSuggestedWaypointRelationshipSelectorRpcCall(call);
      } catch {
        return failed();
      }
      if (validated === null) {
        return failed();
      }

      try {
        const { data, error } = await client.rpc(
          validated.functionName,
          validated.args,
        );
        if (error !== null && error !== undefined) {
          return failed();
        }
        const payload = validateSuggestedWaypointRelationshipSelectorPayload(data);
        return payload === null ||
          payload.items.length > validated.args.p_page_size
          ? failed()
          : Object.freeze({ data: payload, error: null });
      } catch {
        return failed();
      }
    },
  });
}
