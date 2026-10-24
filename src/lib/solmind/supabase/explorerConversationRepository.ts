import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExplorerConversationRepository, ExplorerConversationRpcRow } from "../virtual-guide/explorerConversationComposition";

const FAILED = "explorer_conversation_repository_unavailable";
// This feature executor exposes four closed functions, never a generic select/RPC port.
export function createExplorerConversationRepository(client: SupabaseClient): ExplorerConversationRepository {
  async function call(name: string, parameters: Readonly<Record<string, unknown>>): Promise<ExplorerConversationRpcRow> {
    try {
      const { data, error } = await client.rpc(name, parameters).abortSignal(AbortSignal.timeout(12_000));
      if (error?.code === "P0001") {
        if (["solmind_explorer_conversation_denied", "solmind_explorer_conversation_invalid_input"].includes(error.message)) {
          return { outcome: "denied", conversation_state: null };
        }
        if (error.message === "solmind_explorer_conversation_operation_conflict") {
          return { outcome: "operation_conflict", conversation_state: null };
        }
      }
      if (error || !Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object" ||
          typeof data[0].outcome !== "string") throw new Error(FAILED);
      return data[0] as ExplorerConversationRpcRow;
    } catch { throw new Error(FAILED); }
  }
  return Object.freeze({
    read: (actor, operation) => call("solmind_read_explorer_conversation", {
      p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId,
      p_conversation_id: null,
      p_operation_id: operation?.operationId ?? null,
      p_command_fingerprint: operation?.fingerprint ?? null,
    }),
    prepare: (parameters) => call("solmind_prepare_explorer_conversation_turn", parameters),
    complete: (parameters) => call("solmind_complete_explorer_conversation_turn", parameters),
    mutate: (parameters) => call("solmind_mutate_explorer_conversation", parameters),
  });
}
