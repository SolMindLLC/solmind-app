import {
  EXPLORER_CONVERSATION_LIMITS,
  isExplorerConversationId,
  isExplorerConversationText,
  parseExplorerConversationWaypoint,
  type ExplorerConversationWaypoint,
} from "./explorerConversationContract";
import { parseExplorerWaypointPage, type ExplorerWaypointPortfolioItem } from "./explorerWaypointPortfolioContract";

// Browser-safe contracts for the private "Your Waypoints" section of the Waypoints page (execution/07 item 43;
// Paul's decisions, decision queue 2026-11-06 09:03:09 CST items 1 and 3, and 15:13:41 CST item 2). Every
// identifier here is a selection, never authority: the server derives the Explorer from the sign-in, and SQL
// rechecks current eligibility, the original owner and the ended conversation on every call.

export const EXPLORER_YOUR_WAYPOINTS_VERSION = "explorer-your-waypoints.v1" as const;
// One conversation keeps at most 200 Waypoint versions (the protected SQL policy).
export const EXPLORER_YOUR_WAYPOINTS_HISTORY_LIMIT = 200;
export type ExplorerYourWaypointsError = "denied" | "unavailable";
// conversationEnded is a display fact: SQL's own record of whether the Waypoint's source conversation has ended, in any
// Guide relationship (migration 20261106050000). Only SQL decides whether a closure is allowed.
export type ExplorerYourWaypointItem = ExplorerWaypointPortfolioItem & Readonly<{ conversationEnded: boolean }>;

export type ExplorerYourWaypointsListResult =
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "list"; ok: true;
      items: readonly ExplorerYourWaypointItem[]; hasMore: boolean; nextOffset: number | null; error: null }>
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "list"; ok: false;
      items: null; hasMore: false; nextOffset: null; error: ExplorerYourWaypointsError }>;

// versions: the current Waypoint first, then its earlier versions, the most recent first. complete is false only
// when an earlier version could not be found within the conversation's saved history.
export type ExplorerYourWaypointsHistoryResult =
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "history"; ok: true; waypointId: string;
      versions: readonly ExplorerConversationWaypoint[]; complete: boolean; error: null }>
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "history"; ok: false; waypointId: null;
      versions: null; complete: false; error: ExplorerYourWaypointsError }>;

export type ExplorerYourWaypointsCloseCommand =
  | Readonly<{ kind: "reach_waypoint"; operationId: string; waypointId: string; reachedEvidence: string }>
  | Readonly<{ kind: "release_waypoint"; operationId: string; waypointId: string }>;
export type ExplorerYourWaypointsCloseError = "denied" | "conflict" | "unavailable";
// replay: the server found this exact request already saved (an uncertain earlier attempt had succeeded).
export type ExplorerYourWaypointsCloseResult =
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "close"; ok: true; replay: boolean;
      item: ExplorerYourWaypointItem; error: null }>
  | Readonly<{ version: typeof EXPLORER_YOUR_WAYPOINTS_VERSION; kind: "close"; ok: false; replay: false;
      item: null; error: ExplorerYourWaypointsCloseError }>;

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every(key => typeof key === "string" &&
      Object.getOwnPropertyDescriptor(value, key)?.enumerable === true &&
      "value" in Object.getOwnPropertyDescriptor(value, key)!);
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === expected.length && actual.every(key => typeof key === "string" && expected.includes(key));
}
function plainArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype &&
    Reflect.ownKeys(value).length === value.length + 1;
}

// Splits conversationEnded from a closure item (closure pages never carry it) so the portfolio parser checks every
// other field unchanged.
function splitItems(items: unknown): { fields: Record<string, unknown>[]; ended: boolean[] } | null {
  if (!plainArray(items)) return null;
  const fields: Record<string, unknown>[] = [];
  const ended: boolean[] = [];
  for (let index = 0; index < items.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(items, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor) || !record(descriptor.value)) return null;
    const { conversationEnded, ...rest } = descriptor.value;
    if (typeof conversationEnded !== "boolean") return null;
    fields.push(rest);
    ended.push(conversationEnded);
  }
  return { fields, ended };
}

function withEnded(items: readonly ExplorerWaypointPortfolioItem[], ended: readonly boolean[]): readonly ExplorerYourWaypointItem[] {
  return Object.freeze(items.map((item, index) => Object.freeze({ ...item, conversationEnded: ended[index] })));
}

export function parseExplorerYourWaypointsListResult(value: unknown): ExplorerYourWaypointsListResult | null {
  try {
    if (!record(value) || !keys(value, ["version", "kind", "ok", "items", "hasMore", "nextOffset", "error"]) ||
        value.version !== EXPLORER_YOUR_WAYPOINTS_VERSION || value.kind !== "list") return null;
    if (value.ok === false) {
      if (value.items !== null || value.hasMore !== false || value.nextOffset !== null ||
          (value.error !== "denied" && value.error !== "unavailable")) return null;
      return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "list", ok: false, items: null,
        hasMore: false, nextOffset: null, error: value.error });
    }
    if (value.ok !== true || value.error !== null) return null;
    // A current-head page item carries its own conversationEnded fact; the portfolio parser requires it.
    const page = parseExplorerWaypointPage({ kind: "current_heads", limit: EXPLORER_CONVERSATION_LIMITS.waypointPage,
      items: value.items, hasMore: value.hasMore, nextOffset: value.nextOffset });
    if (page === null || page.items.some(item => typeof item.conversationEnded !== "boolean")) return null;
    return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "list", ok: true,
      items: page.items as readonly ExplorerYourWaypointItem[], hasMore: page.hasMore, nextOffset: page.nextOffset, error: null });
  } catch { return null; }
}

export function parseExplorerYourWaypointsHistoryResult(value: unknown): ExplorerYourWaypointsHistoryResult | null {
  try {
    if (!record(value) || !keys(value, ["version", "kind", "ok", "waypointId", "versions", "complete", "error"]) ||
        value.version !== EXPLORER_YOUR_WAYPOINTS_VERSION || value.kind !== "history") return null;
    if (value.ok === false) {
      if (value.waypointId !== null || value.versions !== null || value.complete !== false ||
          (value.error !== "denied" && value.error !== "unavailable")) return null;
      return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "history", ok: false, waypointId: null,
        versions: null, complete: false, error: value.error });
    }
    if (value.ok !== true || value.error !== null || !isExplorerConversationId(value.waypointId) ||
        typeof value.complete !== "boolean" || !plainArray(value.versions) || value.versions.length === 0 ||
        value.versions.length > EXPLORER_YOUR_WAYPOINTS_HISTORY_LIMIT) return null;
    const versions: ExplorerConversationWaypoint[] = [];
    for (let index = 0; index < value.versions.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value.versions, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)) return null;
      const version = parseExplorerConversationWaypoint(descriptor.value);
      if (version === null) return null;
      // The first is the requested current Waypoint; each later one is the predecessor of the one before it.
      if (index === 0 ? version.id !== value.waypointId || version.isCurrent !== true
        : version.isCurrent !== false || versions[index - 1].lifecycle?.predecessorWaypointId !== version.id) return null;
      versions.push(version);
    }
    if (new Set(versions.map(version => version.id)).size !== versions.length ||
        value.complete !== (versions[versions.length - 1].lifecycle === undefined)) return null;
    return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "history", ok: true,
      waypointId: value.waypointId, versions: Object.freeze(versions), complete: value.complete, error: null });
  } catch { return null; }
}

// Reached evidence follows the conversation's existing Reached rule (1 to 1,000 characters, line breaks allowed)
// and must already be trimmed, so the bytes the server fingerprints are the bytes the Explorer reviewed.
export function parseExplorerYourWaypointsCloseCommand(value: unknown): ExplorerYourWaypointsCloseCommand | null {
  try {
    if (!record(value)) return null;
    if (value.kind === "release_waypoint") {
      if (!keys(value, ["kind", "operationId", "waypointId"]) || !isExplorerConversationId(value.operationId) ||
          !isExplorerConversationId(value.waypointId)) return null;
      return Object.freeze({ kind: "release_waypoint", operationId: value.operationId, waypointId: value.waypointId });
    }
    if (value.kind === "reach_waypoint") {
      if (!keys(value, ["kind", "operationId", "waypointId", "reachedEvidence"]) ||
          !isExplorerConversationId(value.operationId) || !isExplorerConversationId(value.waypointId) ||
          !isExplorerConversationText(value.reachedEvidence, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) ||
          value.reachedEvidence !== value.reachedEvidence.trim()) return null;
      return Object.freeze({ kind: "reach_waypoint", operationId: value.operationId, waypointId: value.waypointId,
        reachedEvidence: value.reachedEvidence });
    }
    return null;
  } catch { return null; }
}

export function parseExplorerYourWaypointsCloseResult(value: unknown): ExplorerYourWaypointsCloseResult | null {
  try {
    if (!record(value) || !keys(value, ["version", "kind", "ok", "replay", "item", "error"]) ||
        value.version !== EXPLORER_YOUR_WAYPOINTS_VERSION || value.kind !== "close") return null;
    if (value.ok === false) {
      if (value.replay !== false || value.item !== null ||
          (value.error !== "denied" && value.error !== "conflict" && value.error !== "unavailable")) return null;
      return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "close", ok: false, replay: false,
        item: null, error: value.error });
    }
    if (value.ok !== true || value.error !== null || typeof value.replay !== "boolean") return null;
    const split = splitItems([value.item]);
    // A closure is only ever recorded for a Waypoint from an ended conversation.
    if (split === null || split.ended[0] !== true) return null;
    const page = parseExplorerWaypointPage({ kind: "closure", limit: EXPLORER_CONVERSATION_LIMITS.waypointPage,
      items: split.fields, hasMore: false, nextOffset: null });
    if (page === null) return null;
    return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "close", ok: true, replay: value.replay,
      item: withEnded(page.items, split.ended)[0], error: null });
  } catch { return null; }
}
