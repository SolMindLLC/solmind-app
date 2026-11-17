import { COMPASS_SUGGESTION_REPLY_LABELS } from "./explorerCompassSuggestionReplies";
import { EXPLORER_CONVERSATION_LIMITS, type ExplorerCompassSuggestionResponse, type ExplorerConversationState,
  type ExplorerConversationWaypointOffer, type ExplorerWaypointOfferOperationResult } from "./explorerConversationContract";
import { waypointOfferCapacityMessage } from "./explorerWaypointCapacity";
import { WAYPOINT_DRAFT_WORDING } from "./explorerWaypointDraft";
import { YOUR_WAYPOINTS_WORDING } from "./explorerYourWaypoints";

// The saved offer's box under a Virtual Guide reply (offers build, step 4). Every sentence here is Paul's approved
// wording, word for word: the Reached sheet (revision 5, Part 2), the Clarify and Revisit sheet (revision 2, Parts 1
// and 2 and the quiet line), the offers decision sheet of 2026-11-16 (decision 4: S1, S2 and the S3 clauses) and the
// sheet "When an offer no longer matches its Waypoint" (revision 3, approved 2026-11-16 21:52:56 CST: the target
// changed sentences, "When offered", "Title:" and the earlier-answer status lines). They change only with his
// approval. The part labels, the three reply labels, "Saving..." and the Reached Saved
// line are the existing ones and are reused, not copied.
export const WAYPOINT_OFFER_WORDING = Object.freeze({
  reachedHeading: "Mark this Waypoint Reached?",
  reachedWhy: "To make sure Reached reflects your progress, check the arrival signal and your words below before you choose.",
  reachedEvidence: "What showed you reached it:",
  reachedYes: "Yes, mark it Reached",
  reachedNotYet: "Not yet",
  changeTag: "Proposed change",
  changeWhy: "To make sure the change says what you mean, compare your Waypoint as it is now with the proposed wording before you choose.",
  changeYes: "Choosing \"That's right\" saves this as a new version and keeps the earlier wording saved in your private history. Nothing is shared.",
  revisitTag: "Take up again",
  revisitWhy: "To make sure you are taking up the Waypoint you mean, check its wording and what happened to it before you choose.",
  revisitYes: "Choosing \"That's right\" makes this Waypoint in progress again. Its earlier Reached evidence and release history stay saved as private history; they do not show that you have reached it this time. Nothing is shared.",
  now: "Now",
  proposed: "Proposed",
  noChange: "No change",
  stageReached: "Reached",
  stageReleased: "Released",
  saving: YOUR_WAYPOINTS_WORDING.saving,
  savedReached: YOUR_WAYPOINTS_WORDING.savedReached,
  savedChange: "Saved. This Waypoint has its new wording.",
  savedRevisit: "Saved. This Waypoint is in progress again.",
  // S1: a typed yes that could not be saved because the Waypoint changed after the offer was shown.
  typedTargetChanged: "This offer was not saved because the Waypoint changed after the offer was shown. To keep your Waypoint as you last saw it, nothing was changed by this offer.",
  // S2: a typed yes that met a limit which no longer applies.
  typedLimitPassed: "Your typed answer did not save this offer because a Waypoint limit applied when you sent it. Nothing was changed by it. That limit no longer applies, so you can choose again here.",
  // Decision 1 of the 21:52:56 sheet: why the yes button is unavailable once the Waypoint changed after the offer was
  // shown, and, only while a message can be sent, what the Explorer can still do.
  targetChangedRight: "This Waypoint changed after this offer was shown. To keep those changes, \"That's right\" is unavailable.",
  targetChangedReached: "This Waypoint changed after this offer was shown. To keep those changes, \"Yes, mark it Reached\" is unavailable.",
  targetChangedDiscuss: "To discuss what you want now, write to the Virtual Guide.",
  // Decisions 2 and 3: the snapshot column's label once it is no longer the Waypoint as it is now. Decision 4: the
  // title pair's label.
  whenOffered: "When offered",
  titleLabel: "Title:",
  // The quiet line for an offer that could not be shown. A known reason (S3) is added to its first sentence.
  dropLead: "SolMind could not show this offer for you to confirm",
  dropRest: "No change was made by this offer. Check the Waypoint's current wording and status before asking again.",
  dropReasons: Object.freeze({
    target_not_available: "because the Waypoint is no longer available for this offer",
    already_offered: "because Reached was already offered for this Waypoint in this conversation",
    evidence_not_found: "because the quoted words were not found in your messages",
    no_change: "because the proposed wording was the same as the saved wording",
  }),
});
const W = WAYPOINT_OFFER_WORDING;

export type WaypointOfferResponse = ExplorerCompassSuggestionResponse;

// The offer's own buttons, in order. A Reached offer has two; "Close, not quite" does not exist for it.
export function waypointOfferButtons(offer: ExplorerConversationWaypointOffer): readonly Readonly<{ response: WaypointOfferResponse; label: string }>[] {
  return offer.kind === "reached"
    ? [{ response: "right", label: W.reachedYes }, { response: "not_it", label: W.reachedNotYet }]
    : (["right", "close", "not_it"] as const).map(response => ({ response, label: COMPASS_SUGGESTION_REPLY_LABELS[response] }));
}

// The box shows only under the offer's latest carrying reply, while the offer waits or once it is confirmed.
// A declined or superseded offer shows no box.
export function waypointOfferForMessage(state: ExplorerConversationState, messageId: string): ExplorerConversationWaypointOffer | null {
  const offer = state.waypointOffer;
  return offer != null && (offer.status === "proposed" || offer.status === "confirmed") && offer.suggestionMessageId === messageId &&
    state.messages.some(message => message.id === messageId && message.role === "virtualGuide") ? offer : null;
}

export function latestVirtualGuideReplyId(state: Pick<ExplorerConversationState, "messages">): string | null {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    if (state.messages[index].role === "virtualGuide") return state.messages[index].id;
  }
  return null;
}

// The limit sentence for the yes button, from the current capacity only (never from a receipt): 200 saved versions
// for a change or a revisit, then 20 active Waypoints for a revisit. The five-Waypoint limit never applies here.
export function waypointOfferLimitReason(state: Pick<ExplorerConversationState, "waypointCapacity">,
  offer: ExplorerConversationWaypointOffer): string | null {
  return offer.status === "proposed" ? waypointOfferCapacityMessage(state, offer.kind) : null;
}

// The yes button is off when a limit applies now, or when the Waypoint no longer equals what the offer showed
// (the Executor's decision for step 4: the other answers stay available).
export function waypointOfferRightHeld(state: Pick<ExplorerConversationState, "waypointCapacity">,
  offer: ExplorerConversationWaypointOffer): boolean {
  return !offer.targetCurrent || waypointOfferLimitReason(state, offer) !== null;
}

// A refused typed yes, only from the state's own typedAnswerRefusal (the server gives it only for the presentation
// that was refused, while the offer still waits). A limit that still applies is explained by the limit sentence
// alone; the past-tense sentence shows only when the yes button is available again.
export function waypointOfferRefusalNotice(state: Pick<ExplorerConversationState, "waypointCapacity">,
  offer: ExplorerConversationWaypointOffer): string | null {
  if (offer.status !== "proposed" || offer.typedAnswerRefusal === null) return null;
  if (offer.typedAnswerRefusal === "target_changed") return W.typedTargetChanged;
  return waypointOfferRightHeld(state, offer) ? null : W.typedLimitPassed;
}

export function waypointOfferSavedLine(offer: ExplorerConversationWaypointOffer): string | null {
  if (offer.status !== "confirmed") return null;
  return offer.kind === "reached" ? W.savedReached : offer.kind === "change" ? W.savedChange : W.savedRevisit;
}

export type WaypointOfferPart = Readonly<{ label: string; now: string; proposed: string | null }>;
// The three parts of a change or revisit offer: "Now" from the offer's snapshot, "Proposed" from its offered
// values; a part that does not change carries its wording once (proposed is null).
export function waypointOfferParts(offer: ExplorerConversationWaypointOffer): readonly WaypointOfferPart[] {
  if (offer.kind === "reached") return [];
  const before = offer.targetBefore;
  return ([
    [WAYPOINT_DRAFT_WORDING.destination, before.destination, offer.destination],
    [WAYPOINT_DRAFT_WORDING.whyItMatters, before.whyItMatters, offer.whyItMatters],
    [WAYPOINT_DRAFT_WORDING.arrivalSignal, before.arrivalSignal, offer.arrivalSignal],
  ] as const).map(([label, now, proposed]) => ({ label, now, proposed: proposed === now ? null : proposed }));
}

// "Now: Reached" or "Now: Released" for a revisit offer; "When offered: ..." once the snapshot is no longer the
// Waypoint as it is now (decisions 2 and 3 of the 21:52:56 sheet).
export function waypointOfferStageLine(offer: ExplorerConversationWaypointOffer,
  snapshotLabel: string = waypointOfferSnapshotLabel(offer)): string | null {
  if (offer.kind !== "revisit") return null;
  return `${snapshotLabel}: ${offer.targetBefore.stage === "reached" ? W.stageReached : W.stageReleased}`;
}

// The label of the offer's snapshot (its "Now" column and the revisit's stage line). It reads "Now" only while the
// offer waits and its Waypoint still equals the snapshot; a confirmed box, or a waiting one whose Waypoint changed,
// shows "When offered" (decisions 2 and 3).
export function waypointOfferSnapshotLabel(offer: ExplorerConversationWaypointOffer): string {
  return offer.status === "proposed" && offer.targetCurrent ? W.now : W.whenOffered;
}

// Decision 1: why the yes button is unavailable while the offer waits and its Waypoint changed after it was shown.
// The refused-answer sentence S1 says the same in the past tense, so this one shows only when S1 does not.
export function waypointOfferTargetChangedNotice(state: Pick<ExplorerConversationState, "waypointCapacity">,
  offer: ExplorerConversationWaypointOffer): string | null {
  if (offer.status !== "proposed" || offer.targetCurrent) return null;
  if (waypointOfferRefusalNotice(state, offer) === W.typedTargetChanged) return null;
  return offer.kind === "reached" ? W.targetChangedReached : W.targetChangedRight;
}

// Decision 5: the status line after a button "That's right" was confirmed saved while its own box is no longer shown
// (a newer offer took its place, as after a Retry that follows a lost response). It names the Waypoint by the title
// shown in that offer's box and describes the earlier answer, not the Waypoint as it is now.
export function waypointOfferEarlierSavedLine(kind: ExplorerConversationWaypointOffer["kind"], title: string): string {
  return kind === "change" ? `Your earlier answer to change "${title}" was saved.`
    : kind === "revisit" ? `Your earlier answer to take up "${title}" again was saved.`
      : `Your earlier answer to mark "${title}" Reached was saved.`;
}

// The quiet line under the latest Virtual Guide reply when its offer could not be shown.
export function waypointOfferDropLine(state: ExplorerConversationState, messageId: string): string | null {
  const drop = state.waypointOfferDrop;
  if (drop == null || latestVirtualGuideReplyId(state) !== messageId) return null;
  const reason = Object.hasOwn(W.dropReasons, drop.reason) ? W.dropReasons[drop.reason as keyof typeof W.dropReasons] : null;
  return `${W.dropLead}${reason === null ? "" : ` ${reason}`}. ${W.dropRest}`;
}

// The local gate for a button answer, mirroring the forming Waypoint's: a yes needs a current target and room; for
// a change or a revisit the other two answers need the follow-up message to be sendable. A Reached offer sends
// no message, so "Not yet" needs neither.
export function waypointOfferAnswerAllowed(state: ExplorerConversationState, offerId: string, response: WaypointOfferResponse): boolean {
  const offer = state.waypointOffer;
  if (offer == null || offer.id !== offerId || offer.status !== "proposed" || state.compassSuggestionReplies !== "available") return false;
  if (response === "right") return !waypointOfferRightHeld(state, offer);
  if (offer.kind === "reached") return response === "not_it";
  return state.providerState === "available" && state.messages.length <= EXPLORER_CONVERSATION_LIMITS.messages - 2;
}

// The two reply ids pinned with a button answer when it is pressed and kept through every Retry (REV473c):
// the latest Virtual Guide reply at that moment, and the carrying reply of the presentation being answered.
export type WaypointAnswerPins = Readonly<{ latestGuideReplyId: string | null; carryingReplyId: string }>;

// Whether the automatic follow-up message may be prepared after a button answer to a forming Waypoint, judged on
// the state returned with the result. It is skipped, without a notice, when the conversation advanced after the
// press: the revision must be exactly one above the answer's, no reply may have been added, the answered draft must
// be in the state that fits the answer, and no other presentation may be able to take the message as its typed
// answer. That last fact is the server's own (typedAnswerEligible, REV473d) and is never worked out here.
export function waypointDraftFollowUpAllowed(input: Readonly<{ state: ExplorerConversationState; expectedRevision: number;
  draftId: string; response: WaypointOfferResponse; pins: WaypointAnswerPins }>): boolean {
  const { state, pins } = input;
  if (state.revision !== input.expectedRevision + 1) return false;
  if (pins.latestGuideReplyId === null || latestVirtualGuideReplyId(state) !== pins.latestGuideReplyId) return false;
  const draft = state.waypointDraft;
  const stillForming = draft != null && draft.id === input.draftId;
  // "Close, not quite" leaves the same draft waiting under the same reply on purpose; the other two end it.
  if (input.response === "close" ? !(stillForming && draft.suggestionMessageId === pins.carryingReplyId) : stillForming) return false;
  if (draft != null && !stillForming && draft.typedAnswerEligible !== false) return false;
  const offer = state.waypointOffer;
  return !(offer != null && offer.status === "proposed" && offer.typedAnswerEligible);
}

// The same for a button answer to a change or revisit offer, bound to the answer's own stored result. Never for
// a Reached offer: the approved Reached sheet names no message in the Explorer's name.
export function waypointOfferFollowUpAllowed(input: Readonly<{ state: ExplorerConversationState; expectedRevision: number;
  offerId: string; response: WaypointOfferResponse; pins: WaypointAnswerPins;
  result: ExplorerWaypointOfferOperationResult | null }>): boolean {
  const { state, pins, result } = input;
  if (result === null || result.typed || result.kind === "reached" || result.offerId !== input.offerId ||
      result.response !== input.response) return false;
  if (state.revision !== input.expectedRevision + 1) return false;
  if (pins.latestGuideReplyId === null || latestVirtualGuideReplyId(state) !== pins.latestGuideReplyId) return false;
  // Checked apart from the latest reply: an older offer that still waits may be answered after a later reply.
  if (result.suggestionMessageId !== pins.carryingReplyId) return false;
  const offer = state.waypointOffer;
  const status = result.outcome === "confirmed" ? "confirmed" : result.outcome === "declined" ? "declined" : "proposed";
  if (offer == null || offer.id !== input.offerId || offer.kind !== result.kind || offer.status !== status ||
      offer.suggestionMessageId !== pins.carryingReplyId) return false;
  const draft = state.waypointDraft;
  return !(draft != null && draft.typedAnswerEligible !== false);
}
