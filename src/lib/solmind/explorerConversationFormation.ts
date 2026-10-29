import {
  EXPLORER_CONVERSATION_LIMITS,
  EXPLORER_COMPASS_ANCHORS,
  type ExplorerCompassArrangementItem,
  type ExplorerConversationCommand,
  type ExplorerConversationCompassItem,
  type ExplorerConversationMessage,
  type ExplorerConversationState,
} from "./explorerConversationContract";

type FormationCommand = Exclude<ExplorerConversationCommand, { kind: "send" }>;
type WithoutOperation<T> = T extends unknown
  ? Omit<T, "operationId" | "expectedRevision">
  : never;

// The parent browser owner supplies one stable operation identity and revision.
// These selections are never authorization or evidence of a successful write.
export type ExplorerConversationFormationIntent = WithoutOperation<FormationCommand>;
export type FormationIntentResult =
  | Readonly<{ ok: true; command: ExplorerConversationFormationIntent; error: null }>
  | Readonly<{ ok: false; command: null; error: string }>;

export type CompassFormationDraft = Readonly<{
  sourceMessageId: string;
  label: string;
}>;
export type CompassCategoryFormationDraft = Readonly<{
  targetItemId: string;
  memberItemIds: readonly string[];
  label: string;
  confirmed: boolean;
}>;
export type WaypointFormationDraft = Readonly<{
  sourceMessageId: string;
  destination: string;
  meaning: string;
  arrivalSignal: string;
  confirmed: boolean;
}>;

function refuse(error: string): FormationIntentResult {
  return Object.freeze({ ok: false, command: null, error });
}
function accept(command: ExplorerConversationFormationIntent): FormationIntentResult {
  return Object.freeze({ ok: true, command: Object.freeze(command), error: null });
}

function isWellFormed(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function validText(value: string, maximum: number, multiline: boolean): boolean {
  if (typeof value !== "string" || value.trim().length === 0 ||
      value.trim().length > maximum || !isWellFormed(value)) return false;
  if ((multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/).test(value)) return false;
  return true;
}

export function findFormationSource(
  state: ExplorerConversationState,
  sourceMessageId: string,
): ExplorerConversationMessage | null {
  if (state.conversationId === null || sourceMessageId.length === 0) return null;
  return state.messages.find(message => message.id === sourceMessageId) ?? null;
}

export function currentCompassHeads(state: ExplorerConversationState): readonly ExplorerConversationCompassItem[] {
  return Object.freeze(state.compassItems.filter(item => item.mergedIntoItemId == null));
}

// Original point/source identities remain reviewable after repeated combination.
// The parser proves the bounded acyclic graph; the visited set also keeps direct
// injected callers from looping while preparing a presentation-only draft.
export function compassCategorySources(
  state: ExplorerConversationState,
  targetItemId: string,
): readonly ExplorerConversationCompassItem[] {
  const byId = new Map(state.compassItems.map(item => [item.id, item]));
  const target = byId.get(targetItemId);
  if (!target || target.mergedIntoItemId != null) return Object.freeze([]);
  return Object.freeze(state.compassItems.filter(item => {
    const visited = new Set<string>();
    let current: ExplorerConversationCompassItem | undefined = item;
    while (current && !visited.has(current.id)) {
      if (current.id === targetItemId) return true;
      visited.add(current.id);
      current = current.mergedIntoItemId == null ? undefined : byId.get(current.mergedIntoItemId);
    }
    return false;
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function buildCompassCategoryFormationIntent(
  state: ExplorerConversationState,
  draft: CompassCategoryFormationDraft,
): FormationIntentResult {
  if (!state.conversationId || state.pendingTurn || state.sessionStatus === "ended") {
    return refuse("Reload the active saved conversation before changing its Compass categories.");
  }
  const heads = currentCompassHeads(state);
  const target = heads.find(item => item.id === draft.targetItemId);
  if (!target || draft.memberItemIds.length < 1 || draft.memberItemIds.length > EXPLORER_CONVERSATION_LIMITS.compassItems ||
      new Set(draft.memberItemIds).size !== draft.memberItemIds.length || !draft.memberItemIds.includes(target.id) ||
      draft.memberItemIds.some(memberId => !heads.some(item => item.id === memberId))) {
    return refuse("Choose current Compass categories, including the category that will remain.");
  }
  if (!validText(draft.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters, false)) {
    return refuse("Enter the reviewed category wording in 1 to 160 characters on one line.");
  }
  if ([state.priorityId, state.attentionId].some(selected => selected !== null && selected !== target.id && draft.memberItemIds.includes(selected))) {
    return refuse("Move Priority or current attention explicitly before combining away its selected category.");
  }
  if (draft.memberItemIds.length === 1 && draft.label.trim() === target.label) {
    return refuse("Change the category wording or choose another category to combine.");
  }
  if (draft.confirmed !== true) {
    return refuse("Review the original sources, wording, placement, emphasis, Priority and current attention, then confirm this category change.");
  }
  return accept({ kind: "confirm_compass_category", targetItemId: target.id,
    memberItemIds: Object.freeze([...draft.memberItemIds].sort()), label: draft.label.trim() });
}

export function buildCompassFormationIntent(
  state: ExplorerConversationState,
  draft: CompassFormationDraft,
): FormationIntentResult {
  if (!findFormationSource(state, draft.sourceMessageId)) {
    return refuse("Choose a saved conversation message for this Compass point.");
  }
  if (state.compassItems.length >= EXPLORER_CONVERSATION_LIMITS.compassItems) {
    return refuse("This conversation has 24 saved points. Your saved conversation remains available without adding another point.");
  }
  if (!validText(draft.label, EXPLORER_CONVERSATION_LIMITS.labelCharacters, false)) {
    return refuse("Enter a Compass label of 1 to 160 characters on one line.");
  }
  return accept({ kind: "add_compass", sourceMessageId: draft.sourceMessageId, label: draft.label.trim() });
}

export function buildPriorityFormationIntent(
  state: ExplorerConversationState,
  itemId: string,
  confirmed: boolean,
): FormationIntentResult {
  const heads = currentCompassHeads(state);
  if (!heads.some(item => item.id === itemId)) {
    return refuse("Choose a saved Compass point before confirming Priority.");
  }
  if (confirmed !== true) return refuse("Confirm this Priority only when it reflects your choice.");
  if (state.priorityId === itemId) return refuse("This point is already your confirmed Priority.");
  if (heads.some(item => item.emphasis != null) &&
      !heads.some(item => item.id === itemId && item.anchor === "apex")) {
    return refuse("Review and confirm the arrangement to place your new Priority at the top.");
  }
  return accept({ kind: "confirm_priority", itemId });
}

export function buildAttentionFormationIntent(
  state: ExplorerConversationState,
  itemId: string,
): FormationIntentResult {
  const heads = currentCompassHeads(state);
  if (!heads.some(item => item.id === itemId)) {
    return refuse("Choose a saved Compass point for current attention.");
  }
  if (state.attentionId === itemId) return refuse("Current attention is already on this point.");
  if (heads.some(item => item.emphasis != null) &&
      !heads.some(item => item.id === itemId && item.anchor != null)) {
    return refuse("Place this point on your Compass before moving current attention to it.");
  }
  return accept({ kind: "set_attention", itemId });
}

export function buildCompassArrangementFormationIntent(
  state: ExplorerConversationState,
  priorityId: string | null,
  items: readonly ExplorerCompassArrangementItem[],
  confirmed: boolean,
): FormationIntentResult {
  if (!state.conversationId || state.pendingTurn) return refuse("Reload the saved conversation before arranging its Compass.");
  const heads = currentCompassHeads(state);
  if (!confirmed) return refuse("Review the placement, emphasis and Priority, then confirm your arrangement.");
  if (state.priorityId !== null && priorityId === null) return refuse("Keep or explicitly choose a Priority; this action does not clear it.");
  if (items.length !== heads.length || items.length > EXPLORER_CONVERSATION_LIMITS.compassItems ||
      new Set(items.map(item => item.compassItemId)).size !== items.length ||
      items.some(item => !heads.some(point => point.id === item.compassItemId) ||
        !(item.anchor === null || EXPLORER_COMPASS_ANCHORS.includes(item.anchor)) ||
        ![1, 2, 3].includes(item.emphasis))) return refuse("Include every saved point once with valid placement and emphasis.");
  const visible = items.filter(item => item.anchor !== null);
  if (visible.length > EXPLORER_CONVERSATION_LIMITS.visibleCompassItems ||
      new Set(visible.map(item => item.anchor)).size !== visible.length) return refuse("Choose a different visible location for each point; Other paths keeps the rest.");
  if (priorityId !== null && !items.some(item => item.compassItemId === priorityId && item.anchor === "apex")) {
    return refuse("Place the Priority you choose at the top of the Compass.");
  }
  if (state.attentionId !== null && !visible.some(item => item.compassItemId === state.attentionId)) {
    return refuse("Keep current attention visible; move attention explicitly before placing that point in Other paths.");
  }
  return accept({ kind: "confirm_compass_arrangement", priorityId,
    items: Object.freeze(items.map(item => Object.freeze({ compassItemId: item.compassItemId, anchor: item.anchor, emphasis: item.emphasis }))) });
}

export function buildWaypointFormationIntent(
  state: ExplorerConversationState,
  draft: WaypointFormationDraft,
): FormationIntentResult {
  if (!findFormationSource(state, draft.sourceMessageId)) {
    return refuse("Choose a saved conversation message for this Waypoint.");
  }
  if (state.waypoints.length >= EXPLORER_CONVERSATION_LIMITS.waypoints) {
    return refuse("This conversation has reached its private Waypoint limit.");
  }
  for (const [field, value] of [
    ["destination", draft.destination],
    ["meaning", draft.meaning],
    ["arrival signal", draft.arrivalSignal],
  ] as const) {
    if (!validText(value, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true)) {
      return refuse(`Enter the ${field} in 1 to 1,000 characters.`);
    }
  }
  if (draft.confirmed !== true) {
    return refuse("Review the destination, meaning and arrival signal, then confirm your choice.");
  }
  return accept({
    kind: "confirm_waypoint", sourceMessageId: draft.sourceMessageId,
    destination: draft.destination.trim(), meaning: draft.meaning.trim(),
    arrivalSignal: draft.arrivalSignal.trim(),
  });
}

export function buildReachedFormationIntent(
  state: ExplorerConversationState,
  waypointId: string,
  evidence: string,
  confirmed: boolean,
): FormationIntentResult {
  const waypoint = state.waypoints.find(item => item.id === waypointId);
  if (!waypoint) return refuse("Choose a saved private Waypoint to review.");
  if (waypoint.status !== "chosen") return refuse("This Waypoint is already Reached.");
  if (!validText(evidence, EXPLORER_CONVERSATION_LIMITS.waypointCharacters, true)) {
    return refuse("Describe the supporting evidence in 1 to 1,000 characters.");
  }
  if (confirmed !== true) {
    return refuse("Review the arrival signal and supporting evidence before confirming Reached.");
  }
  return accept({ kind: "confirm_reached", waypointId, evidence: evidence.trim() });
}
