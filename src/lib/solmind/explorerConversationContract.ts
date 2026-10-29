// Browser-safe feature shapes. All identifiers are opaque selections, never authority.
export const EXPLORER_CONVERSATION_VERSION = "explorer-conversation.v1" as const;
export const EXPLORER_COMPASS_ANCHORS = ["apex", "upper_left", "upper_right", "side_left", "side_right", "lower_left", "lower_center", "lower_right"] as const;
export type ExplorerCompassAnchor = typeof EXPLORER_COMPASS_ANCHORS[number];
export type ExplorerCompassArrangementItem = Readonly<{
  compassItemId: string; anchor: ExplorerCompassAnchor | null; emphasis: 1 | 2 | 3;
}>;
export const EXPLORER_CONVERSATION_LIMITS = Object.freeze({
  messageCharacters: 8_192,
  labelCharacters: 160,
  waypointCharacters: 1_000,
  messages: 100,
  compassItems: 24,
  visibleCompassItems: 8,
  waypoints: 20,
});

export type ExplorerConversationMessage = Readonly<{
  id: string;
  role: "explorer" | "virtualGuide";
  body: string;
  createdAt: string;
}>;
export type ExplorerConversationCompassItem = Readonly<{
  id: string;
  sourceMessageId: string;
  label: string;
  anchor?: ExplorerCompassAnchor | null;
  emphasis?: 1 | 2 | 3 | null;
}>;
export type ExplorerConversationWaypoint = Readonly<{
  id: string;
  sourceMessageId: string;
  destination: string;
  meaning: string;
  arrivalSignal: string;
  status: "chosen" | "reached";
  reachedEvidence?: string | null;
  reachedAt?: string | null;
}>;
export type ExplorerConversationRouteEvent = Readonly<{
  operationId: string;
  revision: number;
  kind: "priority_confirmed" | "priority_reoriented" | "attention_changed";
  compassItemId: string;
  label: string;
  recordedAt: string;
}> | Readonly<{
  operationId: string; revision: number; kind: "arrangement_confirmed";
  previousPriorityId: string | null; priorityId: string | null;
  items: readonly (ExplorerCompassArrangementItem & Readonly<{ label: string }>)[];
  recordedAt: string;
}>;
export type ExplorerConversationState = Readonly<{
  version: typeof EXPLORER_CONVERSATION_VERSION;
  conversationId: string | null;
  revision: number;
  pendingTurn: boolean;
  providerState: "unavailable" | "available";
  messages: readonly ExplorerConversationMessage[];
  compassItems: readonly ExplorerConversationCompassItem[];
  priorityId: string | null;
  attentionId: string | null;
  waypoints: readonly ExplorerConversationWaypoint[];
  route?: readonly ExplorerConversationRouteEvent[];
}>;
type CommandBase = Readonly<{ operationId: string; expectedRevision: number }>;
export type ExplorerConversationCommand = CommandBase & (
  | Readonly<{ kind: "send"; body: string }>
  | Readonly<{ kind: "add_compass"; sourceMessageId: string; label: string }>
  | Readonly<{ kind: "confirm_priority"; itemId: string }>
  | Readonly<{ kind: "set_attention"; itemId: string }>
  | Readonly<{ kind: "confirm_compass_arrangement"; priorityId: string | null; items: readonly ExplorerCompassArrangementItem[] }>
  | Readonly<{ kind: "confirm_waypoint"; sourceMessageId: string; destination: string;
      meaning: string; arrivalSignal: string }>
  | Readonly<{ kind: "confirm_reached"; waypointId: string; evidence: string }>
);
export type ExplorerConversationError =
  | "unavailable" | "denied" | "refresh_required" | "provider_unavailable";
export type ExplorerConversationResult =
  | Readonly<{ ok: true; state: ExplorerConversationState; error: null }>
  | Readonly<{ ok: false; state: null; error: ExplorerConversationError }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function object(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
function id(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function text(value: unknown, maximum: number, multiline = false): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) return false;
  if ((multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/).test(value)) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
}
function instant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 19) === value.slice(0, 19);
}
function anchor(value: unknown): value is ExplorerCompassAnchor | null {
  return value === null || EXPLORER_COMPASS_ANCHORS.includes(value as ExplorerCompassAnchor);
}
function emphasis(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}
function arrangementValid(items: readonly ExplorerCompassArrangementItem[], priorityId: string | null): boolean {
  const identifiers = new Set(items.map(item => item.compassItemId));
  const visible = items.filter(item => item.anchor !== null);
  return identifiers.size === items.length && visible.length <= EXPLORER_CONVERSATION_LIMITS.visibleCompassItems &&
    new Set(visible.map(item => item.anchor)).size === visible.length &&
    (priorityId === null || items.some(item => item.compassItemId === priorityId && item.anchor === "apex"));
}
export function parseExplorerConversationCommand(value: unknown): ExplorerConversationCommand | null {
  if (!object(value) || !id(value.operationId) || !revision(value.expectedRevision)) return null;
  const base = ["kind", "operationId", "expectedRevision"];
  switch (value.kind) {
    case "send":
      if (!keys(value, [...base, "body"]) || !text(value.body, EXPLORER_CONVERSATION_LIMITS.messageCharacters, true)) return null;
      break;
    case "add_compass":
      if (!keys(value, [...base, "sourceMessageId", "label"]) || !id(value.sourceMessageId) || !text(value.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters)) return null;
      break;
    case "confirm_priority": case "set_attention":
      if (!keys(value, [...base, "itemId"]) || !id(value.itemId)) return null;
      break;
    case "confirm_compass_arrangement": {
      if (!keys(value, [...base, "priorityId", "items"]) || !(value.priorityId === null || id(value.priorityId)) ||
          !Array.isArray(value.items) || value.items.length > EXPLORER_CONVERSATION_LIMITS.compassItems) return null;
      const items: ExplorerCompassArrangementItem[] = [];
      for (const item of value.items) {
        if (!object(item) || !keys(item, ["compassItemId", "anchor", "emphasis"]) || !id(item.compassItemId) ||
            !anchor(item.anchor) || !emphasis(item.emphasis)) return null;
        items.push(Object.freeze({ compassItemId: item.compassItemId, anchor: item.anchor, emphasis: item.emphasis }));
      }
      if (!arrangementValid(items, value.priorityId as string | null)) return null;
      return Object.freeze({ kind: value.kind, operationId: value.operationId, expectedRevision: value.expectedRevision,
        priorityId: value.priorityId as string | null, items: Object.freeze(items) });
    }
    case "confirm_waypoint":
      if (!keys(value, [...base, "sourceMessageId", "destination", "meaning", "arrivalSignal"]) || !id(value.sourceMessageId) ||
          !text(value.destination, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) ||
          !text(value.meaning, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) ||
          !text(value.arrivalSignal, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true)) return null;
      break;
    case "confirm_reached":
      if (!keys(value, [...base, "waypointId", "evidence"]) || !id(value.waypointId) || !text(value.evidence, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true)) return null;
      break;
    default: return null;
  }
  return Object.freeze({ ...value }) as ExplorerConversationCommand;
}

export function parseExplorerConversationResult(value: unknown): ExplorerConversationResult | null {
  if (!object(value) || !keys(value, ["ok", "state", "error"])) return null;
  if (value.ok === false && value.state === null &&
      ["unavailable", "denied", "refresh_required", "provider_unavailable"].includes(value.error as string)) {
    return Object.freeze({ ok: false, state: null, error: value.error as ExplorerConversationError });
  }
  if (value.ok !== true || value.error !== null || !object(value.state)) return null;
  const state = value.state;
  const hasRoute = Object.hasOwn(state, "route");
  if (!keys(state, ["version", "conversationId", "revision", "pendingTurn", "providerState", "messages", "compassItems", "priorityId", "attentionId", "waypoints", ...(hasRoute ? ["route"] : [])]) ||
      state.version !== EXPLORER_CONVERSATION_VERSION || !revision(state.revision) ||
      typeof state.pendingTurn !== "boolean" ||
      !(state.conversationId === null || id(state.conversationId)) ||
      !["available", "unavailable"].includes(state.providerState as string) ||
      !Array.isArray(state.messages) || state.messages.length > EXPLORER_CONVERSATION_LIMITS.messages ||
      !Array.isArray(state.compassItems) || state.compassItems.length > EXPLORER_CONVERSATION_LIMITS.compassItems ||
      !Array.isArray(state.waypoints) || state.waypoints.length > EXPLORER_CONVERSATION_LIMITS.waypoints) return null;
  const messages: ExplorerConversationMessage[] = [];
  const messageIds = new Set<string>();
  for (const message of state.messages) {
    if (!object(message) || !keys(message, ["id", "role", "body", "createdAt"]) || !id(message.id) || messageIds.has(message.id) ||
        !["explorer", "virtualGuide"].includes(message.role as string) || !text(message.body, EXPLORER_CONVERSATION_LIMITS.messageCharacters, true) ||
        !instant(message.createdAt)) return null;
    messageIds.add(message.id);
    messages.push(Object.freeze({ id: message.id, role: message.role as ExplorerConversationMessage["role"], body: message.body, createdAt: message.createdAt }));
  }
  const compassItems: ExplorerConversationCompassItem[] = [];
  const compassIds = new Set<string>();
  const anchors = new Set<ExplorerCompassAnchor>();
  for (const item of state.compassItems) {
    if (!object(item)) return null;
    const hasLayout = Object.hasOwn(item, "anchor") || Object.hasOwn(item, "emphasis");
    if (!keys(item, ["id", "sourceMessageId", "label", ...(hasLayout ? ["anchor", "emphasis"] : [])]) || !id(item.id) || compassIds.has(item.id) ||
        !id(item.sourceMessageId) || !messageIds.has(item.sourceMessageId) || !text(item.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters)) return null;
    if (hasLayout && !(item.anchor === null && item.emphasis === null) &&
        (!anchor(item.anchor) || !emphasis(item.emphasis))) return null;
    if (hasLayout && item.anchor !== null) {
      if (anchors.has(item.anchor as ExplorerCompassAnchor)) return null;
      anchors.add(item.anchor as ExplorerCompassAnchor);
    }
    compassIds.add(item.id);
    compassItems.push(Object.freeze({ id: item.id, sourceMessageId: item.sourceMessageId, label: item.label,
      ...(hasLayout ? { anchor: item.anchor as ExplorerCompassAnchor | null, emphasis: item.emphasis as 1 | 2 | 3 | null } : {}) }));
  }
  if (!(state.priorityId === null || (id(state.priorityId) && compassIds.has(state.priorityId))) ||
      !(state.attentionId === null || (id(state.attentionId) && compassIds.has(state.attentionId)))) return null;
  if (compassItems.some(item => item.emphasis != null) &&
      ((state.priorityId !== null && !compassItems.some(item => item.id === state.priorityId && item.anchor === "apex")) ||
       (state.attentionId !== null && !compassItems.some(item => item.id === state.attentionId && item.anchor != null)))) return null;
  const waypoints: ExplorerConversationWaypoint[] = [];
  const waypointIds = new Set<string>();
  for (const item of state.waypoints) {
    if (!object(item)) return null;
    const hasReached = Object.hasOwn(item, "reachedEvidence") || Object.hasOwn(item, "reachedAt");
    if (!keys(item, ["id", "sourceMessageId", "destination", "meaning", "arrivalSignal", "status", ...(hasReached ? ["reachedEvidence", "reachedAt"] : [])]) ||
        !id(item.id) || waypointIds.has(item.id) || !id(item.sourceMessageId) || !messageIds.has(item.sourceMessageId) ||
        !text(item.destination, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) || !text(item.meaning, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) ||
        !text(item.arrivalSignal, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) || !["chosen", "reached"].includes(item.status as string)) return null;
    if (hasReached && (item.status === "chosen"
      ? item.reachedEvidence !== null || item.reachedAt !== null
      : !text(item.reachedEvidence, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true) || !instant(item.reachedAt))) return null;
    waypointIds.add(item.id);
    waypoints.push(Object.freeze({ id: item.id, sourceMessageId: item.sourceMessageId, destination: item.destination,
      meaning: item.meaning, arrivalSignal: item.arrivalSignal, status: item.status as ExplorerConversationWaypoint["status"],
      ...(hasReached ? { reachedEvidence: item.reachedEvidence as string | null, reachedAt: item.reachedAt as string | null } : {}) }));
  }
  const route: ExplorerConversationRouteEvent[] = [];
  const routeIds = new Set<string>();
  if (hasRoute) {
    if (!Array.isArray(state.route)) return null;
    let previousRevision = 0;
    for (const event of state.route) {
      if (!object(event) || !id(event.operationId) || routeIds.has(event.operationId) || !revision(event.revision) ||
          event.revision <= previousRevision || event.revision > state.revision || !instant(event.recordedAt)) return null;
      if (event.kind === "arrangement_confirmed") {
        if (!keys(event, ["operationId", "revision", "kind", "previousPriorityId", "priorityId", "items", "recordedAt"]) ||
            !(event.previousPriorityId === null || (id(event.previousPriorityId) && compassIds.has(event.previousPriorityId))) ||
            !(event.priorityId === null || (id(event.priorityId) && compassIds.has(event.priorityId))) ||
            (event.previousPriorityId !== null && event.priorityId === null) ||
            !Array.isArray(event.items) || event.items.length > EXPLORER_CONVERSATION_LIMITS.compassItems) return null;
        const items: (ExplorerCompassArrangementItem & Readonly<{ label: string }>)[] = [];
        for (const item of event.items) {
          if (!object(item) || !keys(item, ["compassItemId", "label", "anchor", "emphasis"]) ||
              !id(item.compassItemId) || !compassIds.has(item.compassItemId) ||
              !text(item.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters) || !anchor(item.anchor) || !emphasis(item.emphasis)) return null;
          items.push(Object.freeze({ compassItemId: item.compassItemId, label: item.label, anchor: item.anchor, emphasis: item.emphasis }));
        }
        if (!arrangementValid(items, event.priorityId as string | null) ||
            (event.previousPriorityId !== null && !items.some(item => item.compassItemId === event.previousPriorityId))) return null;
        route.push(Object.freeze({ operationId: event.operationId, revision: event.revision, kind: event.kind,
          previousPriorityId: event.previousPriorityId as string | null, priorityId: event.priorityId as string | null,
          items: Object.freeze(items), recordedAt: event.recordedAt }));
      } else {
        if (!keys(event, ["operationId", "revision", "kind", "compassItemId", "label", "recordedAt"]) ||
          !["priority_confirmed", "priority_reoriented", "attention_changed"].includes(event.kind as string) ||
          !id(event.compassItemId) || !compassIds.has(event.compassItemId) ||
          !text(event.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters)) return null;
      route.push(Object.freeze({ operationId: event.operationId, revision: event.revision,
        kind: event.kind as "priority_confirmed" | "priority_reoriented" | "attention_changed", compassItemId: event.compassItemId,
        label: event.label, recordedAt: event.recordedAt }));
      }
      routeIds.add(event.operationId);
      previousRevision = event.revision;
    }
  }
  if (state.conversationId === null && (state.revision !== 0 || state.pendingTurn || messages.length || compassItems.length || waypoints.length || route.length)) return null;
  return Object.freeze({ ok: true, error: null, state: Object.freeze({ version: EXPLORER_CONVERSATION_VERSION,
    conversationId: state.conversationId as string | null, revision: state.revision,
    pendingTurn: state.pendingTurn,
    providerState: state.providerState as ExplorerConversationState["providerState"], messages: Object.freeze(messages),
    compassItems: Object.freeze(compassItems), priorityId: state.priorityId as string | null,
    attentionId: state.attentionId as string | null, waypoints: Object.freeze(waypoints),
    ...(hasRoute ? { route: Object.freeze(route) } : {}) }) });
}
