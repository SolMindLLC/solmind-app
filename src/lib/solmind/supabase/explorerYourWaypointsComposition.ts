import "server-only";
import { createHash } from "node:crypto";

import { EXPLORER_CONVERSATION_LIMITS, isExplorerConversationId, type ExplorerConversationWaypoint } from "../explorerConversationContract";
import { parseExplorerWaypointPage, type ExplorerWaypointPortfolioItem } from "../explorerWaypointPortfolioContract";
import {
  EXPLORER_YOUR_WAYPOINTS_HISTORY_LIMIT,
  EXPLORER_YOUR_WAYPOINTS_VERSION,
  parseExplorerYourWaypointsCloseCommand,
  parseExplorerYourWaypointsCloseResult,
  parseExplorerYourWaypointsHistoryResult,
  parseExplorerYourWaypointsListResult,
  type ExplorerYourWaypointsCloseCommand,
  type ExplorerYourWaypointsCloseError,
  type ExplorerYourWaypointsCloseResult,
  type ExplorerYourWaypointsError,
  type ExplorerYourWaypointsHistoryResult,
  type ExplorerYourWaypointsListResult,
} from "../explorerYourWaypointsContract";
import type { ExplorerConversationActor } from "../virtual-guide/explorerConversationComposition";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";

// The private "Your Waypoints" section (execution/07 item 43). Server-only. It uses only the existing owner-private
// repository ports added by the Waypoint-limits migration (20261106000000): the account-wide current-head page (with
// each row's ended fact, 20261106050000), one conversation's history page and the post-End closure. It never reads a
// transcript, the active conversation selector, configuration, context or a provider, and it gives no Guide access.
// The actor comes only from the request's sign-in (and, through the request dependencies, the early-test notice
// check). Every result is checked by the browser contract before it leaves; any failure is value-free.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE = EXPLORER_CONVERSATION_LIMITS.waypointPage;
// A conversation keeps at most 200 versions: ten pages of 20, plus one read that confirms there is nothing more.
const HISTORY_PAGE_READS = EXPLORER_YOUR_WAYPOINTS_HISTORY_LIMIT / PAGE + 1;
export const EXPLORER_YOUR_WAYPOINTS_MAX_OFFSET = 2147483620;

function actorValid(actor: ExplorerConversationActor | null): actor is ExplorerConversationActor {
  return actor !== null && typeof actor.accountId === "string" && UUID.test(actor.accountId) &&
    typeof actor.applicationSessionId === "string" && UUID.test(actor.applicationSessionId);
}
function base(actor: ExplorerConversationActor) {
  return { p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId };
}
function listFailure(error: ExplorerYourWaypointsError = "unavailable"): ExplorerYourWaypointsListResult {
  return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "list", ok: false, items: null,
    hasMore: false, nextOffset: null, error });
}
function historyFailure(error: ExplorerYourWaypointsError = "unavailable"): ExplorerYourWaypointsHistoryResult {
  return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "history", ok: false, waypointId: null,
    versions: null, complete: false, error });
}
function closeFailure(error: ExplorerYourWaypointsCloseError = "unavailable"): ExplorerYourWaypointsCloseResult {
  return Object.freeze({ version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "close", ok: false, replay: false,
    item: null, error });
}
export function isExplorerYourWaypointsOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
    value <= EXPLORER_YOUR_WAYPOINTS_MAX_OFFSET && value % PAGE === 0;
}
// The browser fields only; the page item's conversationId is a selection for the history read.
function waypointFields(item: ExplorerWaypointPortfolioItem): ExplorerConversationWaypoint {
  const fields: Record<string, unknown> = { ...item };
  delete fields.conversationId;
  return Object.freeze(fields) as ExplorerConversationWaypoint;
}

// One page of the Explorer's current Waypoints across every conversation (active first, then Reached and Released,
// the newest first in each group, as SQL orders them), each marked with whether its conversation has ended.
export async function readExplorerYourWaypoints(
  dependencies: ExplorerPrivateConversationDependencies, offset: number,
): Promise<ExplorerYourWaypointsListResult> {
  if (!isExplorerYourWaypointsOffset(offset)) return listFailure("denied");
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return listFailure("denied");
    const { readWaypointHeads } = dependencies.repository;
    if (readWaypointHeads === undefined) return listFailure();
    const heads = await readWaypointHeads({ ...base(actor), p_offset: offset });
    if (heads.outcome === "denied") return listFailure("denied");
    const page = heads.outcome === "ok" ? parseExplorerWaypointPage(heads.waypoint_page) : null;
    if (page === null || page.kind !== "current_heads") return listFailure();
    // Each row carries SQL's own record of whether its source conversation has ended, in any Guide relationship
    // (migration 20261106050000). It is display only: SQL still refuses a closure unless that conversation has ended.
    const result = parseExplorerYourWaypointsListResult({
      version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "list", ok: true,
      items: page.items, hasMore: page.hasMore, nextOffset: page.nextOffset, error: null,
    });
    return result ?? listFailure();
  } catch { return listFailure(); }
}

// The current Waypoint and its earlier versions, the most recent first, from its own conversation's private history.
export async function readExplorerYourWaypointHistory(
  dependencies: ExplorerPrivateConversationDependencies, conversationId: string, waypointId: string,
): Promise<ExplorerYourWaypointsHistoryResult> {
  if (!isExplorerConversationId(conversationId) || !isExplorerConversationId(waypointId)) return historyFailure("denied");
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return historyFailure("denied");
    const { readWaypointHistory } = dependencies.repository;
    if (readWaypointHistory === undefined) return historyFailure();
    const byId = new Map<string, ExplorerConversationWaypoint>();
    let offset = 0;
    let more = true;
    let chain: ExplorerConversationWaypoint[] = [];
    for (let reads = 0; more && reads < HISTORY_PAGE_READS; reads++) {
      const row = await readWaypointHistory({ ...base(actor), p_conversation_id: conversationId, p_offset: offset });
      if (row.outcome === "denied") return historyFailure("denied");
      const page = row.outcome === "ok" ? parseExplorerWaypointPage(row.waypoint_page) : null;
      if (page === null || page.kind !== "history" || page.items.some(item => item.conversationId !== conversationId)) {
        return historyFailure();
      }
      for (const item of page.items) {
        // Each page is its own read: a version saved during the walk shifts later rows, so a row can come twice.
        if (byId.has(item.id)) continue;
        byId.set(item.id, waypointFields(item));
      }
      more = page.hasMore;
      offset = page.nextOffset ?? offset;
      chain = [];
      let next = byId.get(waypointId);
      while (next !== undefined && !chain.some(version => version.id === next!.id)) {
        chain.push(next);
        next = next.lifecycle === undefined ? undefined : byId.get(next.lifecycle.predecessorWaypointId);
      }
      // Stop as soon as the whole lineage is in hand; later pages hold only older, unrelated versions.
      if (chain.length > 0 && chain[chain.length - 1].lifecycle === undefined) break;
    }
    // The requested Waypoint must be a current head of this conversation.
    if (chain.length === 0 || chain[0].isCurrent !== true) return historyFailure("denied");
    const result = parseExplorerYourWaypointsHistoryResult({
      version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "history", ok: true, waypointId,
      versions: chain, complete: chain[chain.length - 1].lifecycle === undefined, error: null,
    });
    return result ?? historyFailure();
  } catch { return historyFailure(); }
}

// The fingerprint binds the exact reviewed request, so an uncertain retry with the same operation is an exact replay
// and any changed field under that operation is a conflict.
export function explorerYourWaypointsCloseFingerprint(command: ExplorerYourWaypointsCloseCommand): string {
  return createHash("sha256").update(JSON.stringify([
    EXPLORER_YOUR_WAYPOINTS_VERSION, "close", command.kind, command.operationId, command.waypointId,
    command.kind === "reach_waypoint" ? command.reachedEvidence : null,
  ]), "utf8").digest("hex").toUpperCase();
}

// Marks a Waypoint from an ended conversation Reached or Released, once, privately. The original conversation,
// its ending and its history stay as they were (one append-only closure fact and one audit event in SQL).
export async function closeExplorerYourWaypoint(
  dependencies: ExplorerPrivateConversationDependencies, input: unknown,
): Promise<ExplorerYourWaypointsCloseResult> {
  const command = parseExplorerYourWaypointsCloseCommand(input);
  if (command === null) return closeFailure("denied");
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return closeFailure("denied");
    const { closeEndedWaypoint } = dependencies.repository;
    if (closeEndedWaypoint === undefined) return closeFailure();
    const row = await closeEndedWaypoint({ ...base(actor), p_waypoint_id: command.waypointId,
      p_operation_id: command.operationId, p_command_fingerprint: explorerYourWaypointsCloseFingerprint(command),
      p_kind: command.kind, p_reached_evidence: command.kind === "reach_waypoint" ? command.reachedEvidence : null });
    if (row.outcome === "denied") return closeFailure("denied");
    if (row.outcome === "operation_conflict") return closeFailure("conflict");
    if (row.outcome !== "ok" && row.outcome !== "exact_replay") return closeFailure();
    const page = parseExplorerWaypointPage(row.waypoint_page);
    if (page === null || page.kind !== "closure" || page.items.length !== 1 || page.items[0].id !== command.waypointId) {
      return closeFailure();
    }
    const result = parseExplorerYourWaypointsCloseResult({
      version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "close", ok: true, replay: row.outcome === "exact_replay",
      item: { ...page.items[0], conversationEnded: true }, error: null,
    });
    return result ?? closeFailure();
  } catch { return closeFailure(); }
}
