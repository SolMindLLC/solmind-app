import {
  EXPLORER_CONVERSATION_LIMITS, isExplorerConversationId,
  parseExplorerConversationWaypoint, waypointLineageValid,
  type ExplorerConversationWaypoint,
} from "./explorerConversationContract";

// conversationEnded is present only on current-head pages: whether the row's own source conversation has ended
// (migration 20261106050000), across every Guide relationship. History and closure pages never carry it.
export type ExplorerWaypointPortfolioItem = ExplorerConversationWaypoint & Readonly<{ conversationId: string; conversationEnded?: boolean }>;
export type ExplorerWaypointPage = Readonly<{
  kind: "current_heads" | "history" | "closure";
  limit: number;
  items: readonly ExplorerWaypointPortfolioItem[];
  hasMore: boolean;
  nextOffset: number | null;
}>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Reflect.ownKeys(value).every(key => typeof key === "string" &&
      Object.getOwnPropertyDescriptor(value, key)?.enumerable &&
      "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

// A page deliberately does not claim complete lineage or contain transcripts.
// SQL authenticates current eligibility and the original durable owner on each read.
export function parseExplorerWaypointPage(value: unknown): ExplorerWaypointPage | null {
  try {
    if (!record(value) || Reflect.ownKeys(value).length !== 5 ||
        !["kind", "limit", "items", "hasMore", "nextOffset"].every(key => Object.hasOwn(value, key)) ||
        !["current_heads", "history", "closure"].includes(value.kind as string) ||
        value.limit !== EXPLORER_CONVERSATION_LIMITS.waypointPage ||
        !Array.isArray(value.items) || Object.getPrototypeOf(value.items) !== Array.prototype ||
        Reflect.ownKeys(value.items).length !== value.items.length + 1 ||
        value.items.length > value.limit || typeof value.hasMore !== "boolean" ||
        (value.hasMore ? value.items.length !== value.limit || typeof value.nextOffset !== "number" ||
          !Number.isSafeInteger(value.nextOffset) || value.nextOffset < value.limit || value.nextOffset > 2147483647 :
          value.nextOffset !== null)) return null;
    const items: ExplorerWaypointPortfolioItem[] = [];
    const ids = new Set<string>();
    for (let index = 0; index < value.items.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value.items, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor) || !record(descriptor.value)) return null;
      const { conversationId, conversationEnded, ...fields } = descriptor.value;
      if (!isExplorerConversationId(conversationId)) return null;
      if (value.kind === "current_heads" ? typeof conversationEnded !== "boolean" : Object.hasOwn(descriptor.value, "conversationEnded")) return null;
      const waypoint = parseExplorerConversationWaypoint(fields);
      if (waypoint === null || ids.has(waypoint.id) ||
          (value.kind !== "history" && !waypoint.isCurrent)) return null;
      ids.add(waypoint.id);
      items.push(Object.freeze({ ...waypoint, conversationId, ...(value.kind === "current_heads" ? { conversationEnded: conversationEnded as boolean } : {}) }));
    }
    if (value.kind === "closure" && (value.hasMore || items.length !== 1 ||
        (items[0].status !== "reached" && items[0].release === undefined))) return null;
    if (value.kind === "history" && new Set(items.map(item => item.conversationId)).size > 1) return null;
    for (const item of items) {
      const predecessor = items.find(candidate => candidate.id === item.lifecycle?.predecessorWaypointId);
      if (predecessor && (predecessor.conversationId !== item.conversationId || predecessor.isCurrent)) return null;
    }
    if (!waypointLineageValid(items)) return null;
    return Object.freeze({ kind: value.kind as ExplorerWaypointPage["kind"], limit: value.limit,
      items: Object.freeze(items), hasMore: value.hasMore, nextOffset: value.nextOffset as number | null });
  } catch { return null; }
}
