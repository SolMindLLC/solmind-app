import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationCommand,
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

export function buildCompassFormationIntent(
  state: ExplorerConversationState,
  draft: CompassFormationDraft,
): FormationIntentResult {
  if (!findFormationSource(state, draft.sourceMessageId)) {
    return refuse("Choose a saved conversation message for this Compass point.");
  }
  if (state.compassItems.length >= EXPLORER_CONVERSATION_LIMITS.compassItems) {
    return refuse("Your Compass has eight points. You can keep exploring without adding another point.");
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
  if (!state.compassItems.some(item => item.id === itemId)) {
    return refuse("Choose a saved Compass point before confirming Priority.");
  }
  if (confirmed !== true) return refuse("Confirm this Priority only when it reflects your choice.");
  if (state.priorityId === itemId) return refuse("This point is already your confirmed Priority.");
  return accept({ kind: "confirm_priority", itemId });
}

export function buildAttentionFormationIntent(
  state: ExplorerConversationState,
  itemId: string,
): FormationIntentResult {
  if (!state.compassItems.some(item => item.id === itemId)) {
    return refuse("Choose a saved Compass point for current attention.");
  }
  if (state.attentionId === itemId) return refuse("Current attention is already on this point.");
  return accept({ kind: "set_attention", itemId });
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
