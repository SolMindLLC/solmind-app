import {
  isExplorerConversationId,
  isExplorerConversationInstant,
  parseExplorerConversationState,
  type ExplorerConversationState,
} from "./explorerConversationContract";

// Browser-safe, read-only history projection. Selectors are never authority.
export const EXPLORER_CONVERSATION_REVIEW_VERSION = "explorer-conversation-review.v1" as const;
export type ExplorerConversationReviewItem = Readonly<{
  conversationId: string;
  endedAt: string | null;
}>;
export type ExplorerConversationReviewError = "denied" | "unavailable";
export type ExplorerConversationReviewResult =
  | Readonly<{
      version: typeof EXPLORER_CONVERSATION_REVIEW_VERSION;
      ok: true;
      items: readonly ExplorerConversationReviewItem[];
      state: ExplorerConversationState | null;
      error: null;
    }>
  | Readonly<{
      version: typeof EXPLORER_CONVERSATION_REVIEW_VERSION;
      ok: false;
      items: null;
      state: null;
      error: ExplorerConversationReviewError;
    }>;

function object(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === expected.length && actual.every(key => typeof key === "string" && expected.includes(key));
}

export function parseExplorerConversationReviewResult(value: unknown): ExplorerConversationReviewResult | null {
  try {
    if (!object(value) || !keys(value, ["version", "ok", "items", "state", "error"]) ||
        value.version !== EXPLORER_CONVERSATION_REVIEW_VERSION) return null;
    if (value.ok === false) {
      if (value.items !== null || value.state !== null ||
          (value.error !== "denied" && value.error !== "unavailable")) return null;
      return Object.freeze({ version: EXPLORER_CONVERSATION_REVIEW_VERSION,
        ok: false, items: null, state: null, error: value.error });
    }
    if (value.ok !== true || value.error !== null || !Array.isArray(value.items)) return null;
    const items: ExplorerConversationReviewItem[] = [];
    const identifiers = new Set<string>();
    for (const item of value.items) {
      if (!object(item) || !keys(item, ["conversationId", "endedAt"]) ||
          !isExplorerConversationId(item.conversationId) || identifiers.has(item.conversationId) ||
          !(item.endedAt === null || isExplorerConversationInstant(item.endedAt))) return null;
      identifiers.add(item.conversationId);
      items.push(Object.freeze({ conversationId: item.conversationId, endedAt: item.endedAt }));
    }
    const state = value.state === null ? null : parseExplorerConversationState(value.state);
    if (value.state !== null && (state === null || state.sessionStatus !== "ended" ||
        state.pendingTurn || state.providerState !== "unavailable" ||
        state.conversationId === null || !identifiers.has(state.conversationId))) return null;
    return Object.freeze({ version: EXPLORER_CONVERSATION_REVIEW_VERSION,
      ok: true, items: Object.freeze(items), state, error: null });
  } catch {
    return null;
  }
}
