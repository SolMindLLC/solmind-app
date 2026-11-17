import { describe, expect, it } from "vitest";
import type { ExplorerConversationState, ExplorerConversationWaypointOffer,
  ExplorerWaypointOfferOperationResult } from "./explorerConversationContract";
import { COMPASS_SUGGESTION_REPLY_HOLDS } from "./explorerCompassSuggestionReplies";
import { WAYPOINT_DRAFT_HISTORY_LIMIT_REASON, WAYPOINT_OFFER_REVISIT_ACTIVE_LIMIT_REASON,
  waypointOfferCapacityMessage } from "./explorerWaypointCapacity";
import {
  WAYPOINT_OFFER_WORDING,
  latestVirtualGuideReplyId,
  waypointDraftFollowUpAllowed,
  waypointOfferAnswerAllowed,
  waypointOfferButtons,
  waypointOfferDropLine,
  waypointOfferFollowUpAllowed,
  waypointOfferForMessage,
  waypointOfferLimitReason,
  waypointOfferParts,
  waypointOfferRefusalNotice,
  waypointOfferRightHeld,
  waypointOfferEarlierSavedLine,
  waypointOfferSavedLine,
  waypointOfferSnapshotLabel,
  waypointOfferTargetChangedNotice,
  waypointOfferStageLine,
} from "./explorerWaypointOffer";

// Offers build, step 4. Invented content only.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CONVERSATION = id(1);
const EARLIER_REPLY = id(11);
const EXPLORER_MESSAGE = id(12);
const REPLY = id(13);
const LATER_EXPLORER = id(14);
const LATER_REPLY = id(15);
const OFFER = id(21);
const OTHER_OFFER = id(22);
const DRAFT = id(31);
const OTHER_DRAFT = id(32);
const WAYPOINT = id(41);
const NEXT_WAYPOINT = id(42);
const HISTORY_SENTENCE = '"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.';
const REVISIT_SENTENCE = '"That\'s right" is unavailable because you have 20 active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before bringing back another. This limit does not block other replies or typing what you would change.';
const S1 = "This offer was not saved because the Waypoint changed after the offer was shown. To keep your Waypoint as you last saw it, nothing was changed by this offer.";
const S2 = "Your typed answer did not save this offer because a Waypoint limit applied when you sent it. Nothing was changed by it. That limit no longer applies, so you can choose again here.";

type Offer = ExplorerConversationWaypointOffer;
const BEFORE = { title: "Walk each morning", destination: "Walk before work", whyItMatters: "I think more clearly after",
  arrivalSignal: "Five walks in one week" };
function offer(kind: Offer["kind"] = "change", overrides: Record<string, unknown> = {}): Offer {
  const shared = { id: OFFER, status: "proposed", waypointId: WAYPOINT,
    targetBefore: { ...BEFORE, stage: kind === "revisit" ? "reached" : "formed" },
    suggestionMessageId: REPLY, resultWaypointId: null, targetCurrent: true, typedAnswerEligible: true, typedAnswerRefusal: null };
  return (kind === "reached" ? { ...shared, kind, evidence: "I walked five times this week", ...overrides }
    : { ...shared, kind, ...BEFORE, destination: "Walk before breakfast", ...overrides }) as Offer;
}
const confirmed = (kind: Offer["kind"]) => offer(kind, { status: "confirmed", typedAnswerEligible: false,
  resultWaypointId: kind === "reached" ? WAYPOINT : NEXT_WAYPOINT });
const draft = (overrides: Record<string, unknown> = {}) => ({ id: DRAFT, title: "Rest on Sundays", destination: "Keep Sunday free",
  whyItMatters: "I start the week calmer", arrivalSignal: "Three free Sundays", suggestionMessageId: REPLY,
  typedAnswerEligible: true, ...overrides }) as NonNullable<ExplorerConversationState["waypointDraft"]>;
const MESSAGES: ExplorerConversationState["messages"] = [
  { id: EARLIER_REPLY, role: "virtualGuide", body: "An invented earlier reply.", createdAt: "2026-11-16T09:00:00Z" },
  { id: EXPLORER_MESSAGE, role: "explorer", body: "An invented message.", createdAt: "2026-11-16T09:01:00Z" },
  { id: REPLY, role: "virtualGuide", body: "An invented reply.", createdAt: "2026-11-16T09:02:00Z" },
];
const LATER: ExplorerConversationState["messages"] = [...MESSAGES,
  { id: LATER_EXPLORER, role: "explorer", body: "Another invented message.", createdAt: "2026-11-16T09:03:00Z" },
  { id: LATER_REPLY, role: "virtualGuide", body: "Another invented reply.", createdAt: "2026-11-16T09:04:00Z" }];
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: CONVERSATION, revision: 7, pendingTurn: false,
    turnedDownLimitReached: false, providerState: "available", compassSuggestionReplies: "available", sessionStatus: "active",
    messages: MESSAGES, compassItems: [], priorityId: null, attentionId: null, waypoints: [],
    waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 0 },
    waypointDraft: null, waypointOffer: null, waypointOfferDrop: null, reachedOfferedWaypointIds: [], ...overrides };
}
const capacity = (overrides: Partial<ExplorerConversationState["waypointCapacity"]>) =>
  ({ activeCount: 3, activeLimit: 20, historyRoom: true, conversationRoom: true, ...overrides });

describe("offers build step 4: the approved offer wording", () => {
  it("holds every approved sentence, tag and label word for word", () => {
    expect(WAYPOINT_OFFER_WORDING).toEqual({
      reachedHeading: "Mark this Waypoint Reached?",
      reachedWhy: "To make sure Reached reflects your progress, check the arrival signal and your words below before you choose.",
      reachedEvidence: "What showed you reached it:",
      reachedYes: "Yes, mark it Reached",
      reachedNotYet: "Not yet",
      changeTag: "Proposed change",
      changeWhy: "To make sure the change says what you mean, compare your Waypoint as it is now with the proposed wording before you choose.",
      changeYes: 'Choosing "That\'s right" saves this as a new version and keeps the earlier wording saved in your private history. Nothing is shared.',
      revisitTag: "Take up again",
      revisitWhy: "To make sure you are taking up the Waypoint you mean, check its wording and what happened to it before you choose.",
      revisitYes: 'Choosing "That\'s right" makes this Waypoint in progress again. Its earlier Reached evidence and release history stay saved as private history; they do not show that you have reached it this time. Nothing is shared.',
      now: "Now",
      proposed: "Proposed",
      noChange: "No change",
      stageReached: "Reached",
      stageReleased: "Released",
      saving: "Saving...",
      savedReached: "Saved. This Waypoint is marked Reached.",
      savedChange: "Saved. This Waypoint has its new wording.",
      savedRevisit: "Saved. This Waypoint is in progress again.",
      typedTargetChanged: S1,
      typedLimitPassed: S2,
      targetChangedRight: 'This Waypoint changed after this offer was shown. To keep those changes, "That\'s right" is unavailable.',
      targetChangedReached: 'This Waypoint changed after this offer was shown. To keep those changes, "Yes, mark it Reached" is unavailable.',
      targetChangedDiscuss: "To discuss what you want now, write to the Virtual Guide.",
      whenOffered: "When offered",
      titleLabel: "Title:",
      dropLead: "SolMind could not show this offer for you to confirm",
      dropRest: "No change was made by this offer. Check the Waypoint's current wording and status before asking again.",
      dropReasons: {
        target_not_available: "because the Waypoint is no longer available for this offer",
        already_offered: "because Reached was already offered for this Waypoint in this conversation",
        evidence_not_found: "because the quoted words were not found in your messages",
        no_change: "because the proposed wording was the same as the saved wording",
      },
    });
    expect(WAYPOINT_OFFER_REVISIT_ACTIVE_LIMIT_REASON.replace("{activeCount}", "20").replace("{activeLimit}", "20")).toBe(REVISIT_SENTENCE);
    expect(WAYPOINT_DRAFT_HISTORY_LIMIT_REASON).toBe(HISTORY_SENTENCE);
  });

  it("gives a Reached offer its own two buttons and the other kinds the three existing reply labels", () => {
    expect(waypointOfferButtons(offer("reached"))).toEqual([
      { response: "right", label: "Yes, mark it Reached" }, { response: "not_it", label: "Not yet" }]);
    for (const kind of ["change", "revisit"] as const) {
      expect(waypointOfferButtons(offer(kind))).toEqual([{ response: "right", label: "That's right" },
        { response: "close", label: "Close, not quite" }, { response: "not_it", label: "That's not it" }]);
    }
  });
});

describe("offers build step 4: which reply shows the box, and what it shows", () => {
  it.each(["proposed", "confirmed"] as const)("shows a %s offer only under its latest carrying reply", status => {
    const saved = state({ waypointOffer: status === "proposed" ? offer() : confirmed("change") });
    expect(waypointOfferForMessage(saved, REPLY)?.id).toBe(OFFER);
    expect(waypointOfferForMessage(saved, EARLIER_REPLY)).toBeNull();
    expect(waypointOfferForMessage(saved, EXPLORER_MESSAGE)).toBeNull();
  });
  it.each(["declined", "superseded"] as const)("shows no box for a %s offer", status => {
    expect(waypointOfferForMessage(state({ waypointOffer: offer("change", { status, typedAnswerEligible: false }) }), REPLY)).toBeNull();
  });
  it("shows no box without an offer, on a fixture without the offer keys, or under an Explorer message", () => {
    expect(waypointOfferForMessage(state(), REPLY)).toBeNull();
    const retained = { ...state() } as Record<string, unknown>;
    delete retained.waypointOffer; delete retained.waypointOfferDrop; delete retained.reachedOfferedWaypointIds;
    expect(waypointOfferForMessage(retained as ExplorerConversationState, REPLY)).toBeNull();
    expect(waypointOfferDropLine(retained as ExplorerConversationState, REPLY)).toBeNull();
    expect(waypointOfferForMessage(state({ waypointOffer: offer("change", { suggestionMessageId: EXPLORER_MESSAGE }) }), EXPLORER_MESSAGE)).toBeNull();
  });

  it("takes Now from the offer's snapshot and Proposed from its offered values, and marks an unchanged part", () => {
    expect(waypointOfferParts(offer("change", { arrivalSignal: "Five walks in a week, rain or not" }))).toEqual([
      { label: "Where you're heading:", now: "Walk before work", proposed: "Walk before breakfast" },
      { label: "Why it matters:", now: "I think more clearly after", proposed: null },
      { label: "Reached looks like:", now: "Five walks in one week", proposed: "Five walks in a week, rain or not" },
    ]);
    expect(waypointOfferParts(offer("revisit", { destination: BEFORE.destination })).map(part => part.proposed)).toEqual([null, null, null]);
    expect(waypointOfferParts(offer("reached"))).toEqual([]);
  });

  it("says what happened to a Waypoint offered for a revisit, and nothing for the other kinds", () => {
    expect(waypointOfferStageLine(offer("revisit"))).toBe("Now: Reached");
    expect(waypointOfferStageLine(offer("revisit", { targetBefore: { ...BEFORE, stage: "released" } }))).toBe("Now: Released");
    expect(waypointOfferStageLine(offer("change"))).toBeNull();
    expect(waypointOfferStageLine(offer("reached"))).toBeNull();
  });

  it("shows the Saved line of its kind only for a confirmed offer", () => {
    expect(waypointOfferSavedLine(confirmed("reached"))).toBe("Saved. This Waypoint is marked Reached.");
    expect(waypointOfferSavedLine(confirmed("change"))).toBe("Saved. This Waypoint has its new wording.");
    expect(waypointOfferSavedLine(confirmed("revisit"))).toBe("Saved. This Waypoint is in progress again.");
    for (const kind of ["reached", "change", "revisit"] as const) {
      expect(waypointOfferSavedLine(offer(kind))).toBeNull();
      // Never a Saved line for an answer that was refused.
      expect(waypointOfferSavedLine(offer(kind, { typedAnswerRefusal: "target_changed", typedAnswerEligible: false }))).toBeNull();
    }
  });
});

describe("offers build step 4: limits on the yes button", () => {
  it("uses the 200-version sentence for a change and a revisit, and the revisit sentence at 20 active for a revisit only", () => {
    const full = state({ waypointCapacity: capacity({ historyRoom: false }) });
    const active = state({ waypointCapacity: capacity({ activeCount: 20 }) });
    expect(waypointOfferLimitReason(full, offer("change"))).toBe(HISTORY_SENTENCE);
    expect(waypointOfferLimitReason(full, offer("revisit"))).toBe(HISTORY_SENTENCE);
    expect(waypointOfferLimitReason(active, offer("revisit"))).toBe(REVISIT_SENTENCE);
    expect(waypointOfferLimitReason(active, offer("change"))).toBeNull();
    expect(waypointOfferRightHeld(active, offer("revisit"))).toBe(true);
    expect(waypointOfferRightHeld(active, offer("change"))).toBe(false);
    expect(waypointOfferRightHeld(full, offer("change"))).toBe(true);
  });
  it("puts the 200-version sentence first when both limits apply", () => {
    const both = state({ waypointCapacity: capacity({ historyRoom: false, activeCount: 20 }) });
    expect(waypointOfferLimitReason(both, offer("revisit"))).toBe(HISTORY_SENTENCE);
  });
  it("uses the server's own numbers in the revisit sentence", () => {
    expect(waypointOfferCapacityMessage({ waypointCapacity: capacity({ activeCount: 23, activeLimit: 20 }) }, "revisit"))
      .toBe(REVISIT_SENTENCE.replace("you have 20 active", "you have 23 active"));
  });
  it("never applies the five-Waypoint limit to an offer, and no limit to a Reached offer", () => {
    const five = state({ waypointCapacity: capacity({ conversationRoom: false }) });
    for (const kind of ["reached", "change", "revisit"] as const) {
      expect(waypointOfferLimitReason(five, offer(kind))).toBeNull();
      expect(waypointOfferRightHeld(five, offer(kind))).toBe(false);
    }
    const everything = state({ waypointCapacity: capacity({ historyRoom: false, activeCount: 20, conversationRoom: false }) });
    expect(waypointOfferLimitReason(everything, offer("reached"))).toBeNull();
    expect(waypointOfferRightHeld(everything, offer("reached"))).toBe(false);
  });
  it("reads missing capacity as the settings hold and shows no limit sentence for a confirmed offer", () => {
    const unknown = { waypointCapacity: null as unknown as ExplorerConversationState["waypointCapacity"] };
    expect(waypointOfferLimitReason(unknown, offer("change"))).toBe(COMPASS_SUGGESTION_REPLY_HOLDS.unavailable);
    expect(waypointOfferRightHeld(unknown, offer("change"))).toBe(true);
    expect(waypointOfferLimitReason(state({ waypointCapacity: capacity({ historyRoom: false }) }), confirmed("change"))).toBeNull();
  });
  it("turns the yes button off when the Waypoint no longer equals what the offer showed", () => {
    for (const kind of ["reached", "change", "revisit"] as const) {
      expect(waypointOfferRightHeld(state(), offer(kind, { targetCurrent: false, typedAnswerEligible: false }))).toBe(true);
      expect(waypointOfferRightHeld(state(), offer(kind))).toBe(false);
    }
  });
});

describe("offers build step 4: a refused typed yes (REV442b finding 4)", () => {
  it("shows the target-changed sentence from the state's refusal", () => {
    for (const kind of ["reached", "change", "revisit"] as const) {
      expect(waypointOfferRefusalNotice(state(), offer(kind, { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false }))).toBe(S1);
    }
  });
  it("adds nothing while the limit that refused still applies: the box already shows the limit sentence", () => {
    const full = state({ waypointCapacity: capacity({ historyRoom: false }) });
    const refusedAtHistory = offer("change", { typedAnswerRefusal: "history_limit" });
    expect(waypointOfferRefusalNotice(full, refusedAtHistory)).toBeNull();
    expect(waypointOfferLimitReason(full, refusedAtHistory)).toBe(HISTORY_SENTENCE);
    const active = state({ waypointCapacity: capacity({ activeCount: 20 }) });
    const refusedAtActive = offer("revisit", { typedAnswerRefusal: "active_limit" });
    expect(waypointOfferRefusalNotice(active, refusedAtActive)).toBeNull();
    expect(waypointOfferLimitReason(active, refusedAtActive)).toBe(REVISIT_SENTENCE);
  });
  it("refused at 20 active, capacity restored, no refinement: the past-tense sentence and an available yes", () => {
    const restored = state({ waypointCapacity: capacity({ activeCount: 19 }), waypointOffer: offer("revisit", { typedAnswerRefusal: "active_limit" }) });
    expect(waypointOfferRefusalNotice(restored, restored.waypointOffer!)).toBe(S2);
    expect(waypointOfferLimitReason(restored, restored.waypointOffer!)).toBeNull();
    expect(waypointOfferRightHeld(restored, restored.waypointOffer!)).toBe(false);
    expect(waypointOfferAnswerAllowed(restored, OFFER, "right")).toBe(true);
  });
  it("refused at 20 active, capacity restored, then a refinement: no notice (the server gives no refusal for the new presentation)", () => {
    const refined = offer("revisit", { suggestionMessageId: LATER_REPLY, typedAnswerRefusal: null });
    const restored = state({ messages: LATER, waypointCapacity: capacity({ activeCount: 19 }), waypointOffer: refined });
    expect(waypointOfferRefusalNotice(restored, refined)).toBeNull();
    expect(waypointOfferLimitReason(restored, refined)).toBeNull();
    expect(waypointOfferAnswerAllowed(restored, OFFER, "right")).toBe(true);
  });
  it("refused at 200 versions, room restored: the past-tense sentence", () => {
    expect(waypointOfferRefusalNotice(state(), offer("change", { typedAnswerRefusal: "history_limit" }))).toBe(S2);
  });
  it("never shows the past-tense sentence while another limit or a changed Waypoint keeps the yes button off", () => {
    const active = state({ waypointCapacity: capacity({ activeCount: 20 }) });
    expect(waypointOfferRefusalNotice(active, offer("revisit", { typedAnswerRefusal: "history_limit" }))).toBeNull();
    expect(waypointOfferRefusalNotice(state(), offer("change", { typedAnswerRefusal: "history_limit", targetCurrent: false, typedAnswerEligible: false }))).toBeNull();
  });
  it("shows no refusal sentence without a refusal in the state", () => {
    expect(waypointOfferRefusalNotice(state(), offer("change"))).toBeNull();
    expect(waypointOfferRefusalNotice(state(), confirmed("change"))).toBeNull();
  });
});

describe("offers build step 4: the quiet line for an offer that could not be shown", () => {
  const REST = "No change was made by this offer. Check the Waypoint's current wording and status before asking again.";
  it.each([
    ["target_not_available", "because the Waypoint is no longer available for this offer"],
    ["already_offered", "because Reached was already offered for this Waypoint in this conversation"],
    ["evidence_not_found", "because the quoted words were not found in your messages"],
    ["no_change", "because the proposed wording was the same as the saved wording"],
  ] as const)("adds the reason clause for %s", (reason, clause) => {
    const dropped = state({ waypointOfferDrop: { kind: "change", reason } });
    expect(waypointOfferDropLine(dropped, REPLY)).toBe(`SolMind could not show this offer for you to confirm ${clause}. ${REST}`);
  });
  it.each(["invalid", "not_allowed_now"] as const)("adds no clause for %s", reason => {
    expect(waypointOfferDropLine(state({ waypointOfferDrop: { kind: null, reason } }), REPLY))
      .toBe(`SolMind could not show this offer for you to confirm. ${REST}`);
  });
  it("shows it only under the latest Virtual Guide reply, and not at all without a dropped offer", () => {
    const dropped = state({ waypointOfferDrop: { kind: "reached", reason: "already_offered" } });
    expect(waypointOfferDropLine(dropped, EARLIER_REPLY)).toBeNull();
    expect(waypointOfferDropLine(dropped, EXPLORER_MESSAGE)).toBeNull();
    expect(waypointOfferDropLine(state(), REPLY)).toBeNull();
    const later = state({ messages: [...MESSAGES, LATER[3]], waypointOfferDrop: { kind: "reached", reason: "already_offered" } });
    expect(latestVirtualGuideReplyId(later)).toBe(REPLY);
    expect(waypointOfferDropLine(later, REPLY)).not.toBeNull();
    expect(latestVirtualGuideReplyId(state({ messages: [] }))).toBeNull();
  });
});

describe("offers build step 4: the local gate for a button answer", () => {
  it("allows each button of a waiting offer, and never Close for a Reached offer", () => {
    for (const kind of ["change", "revisit"] as const) {
      for (const response of ["right", "close", "not_it"] as const) {
        expect(waypointOfferAnswerAllowed(state({ waypointOffer: offer(kind) }), OFFER, response)).toBe(true);
      }
    }
    const reached = state({ waypointOffer: offer("reached") });
    expect(waypointOfferAnswerAllowed(reached, OFFER, "right")).toBe(true);
    expect(waypointOfferAnswerAllowed(reached, OFFER, "not_it")).toBe(true);
    expect(waypointOfferAnswerAllowed(reached, OFFER, "close")).toBe(false);
  });
  it("refuses another offer id, an offer that no longer waits, and held suggestion replies", () => {
    expect(waypointOfferAnswerAllowed(state({ waypointOffer: offer() }), OTHER_OFFER, "right")).toBe(false);
    expect(waypointOfferAnswerAllowed(state(), OFFER, "right")).toBe(false);
    for (const status of ["confirmed", "declined", "superseded"] as const) {
      expect(waypointOfferAnswerAllowed(state({ waypointOffer: offer("change", { status, typedAnswerEligible: false,
        resultWaypointId: status === "confirmed" ? NEXT_WAYPOINT : null }) }), OFFER, "not_it")).toBe(false);
    }
    for (const compassSuggestionReplies of ["support", "adult_policy", "unavailable", undefined] as const) {
      expect(waypointOfferAnswerAllowed(state({ waypointOffer: offer(), compassSuggestionReplies }), OFFER, "right")).toBe(false);
    }
  });
  it("refuses a yes at a limit or for a changed Waypoint, and keeps the other answers", () => {
    const full = state({ waypointOffer: offer(), waypointCapacity: capacity({ historyRoom: false }) });
    expect(waypointOfferAnswerAllowed(full, OFFER, "right")).toBe(false);
    expect(waypointOfferAnswerAllowed(full, OFFER, "close")).toBe(true);
    expect(waypointOfferAnswerAllowed(full, OFFER, "not_it")).toBe(true);
    const changed = state({ waypointOffer: offer("change", { targetCurrent: false, typedAnswerEligible: false }) });
    expect(waypointOfferAnswerAllowed(changed, OFFER, "right")).toBe(false);
    expect(waypointOfferAnswerAllowed(changed, OFFER, "close")).toBe(true);
    expect(waypointOfferAnswerAllowed(changed, OFFER, "not_it")).toBe(true);
  });
  it("holds Close and That's not it of a change or revisit when no follow-up message could be sent, but never Not yet", () => {
    const full = Array.from({ length: 99 }, (_, index) => ({ ...MESSAGES[2], id: index === 0 ? REPLY : id(index + 500) }));
    for (const held of [{ providerState: "unavailable" as const }, { messages: full }]) {
      for (const kind of ["change", "revisit"] as const) {
        const saved = state({ waypointOffer: offer(kind), ...held });
        expect(waypointOfferAnswerAllowed(saved, OFFER, "close")).toBe(false);
        expect(waypointOfferAnswerAllowed(saved, OFFER, "not_it")).toBe(false);
        expect(waypointOfferAnswerAllowed(saved, OFFER, "right")).toBe(true);
      }
      const reached = state({ waypointOffer: offer("reached"), ...held });
      expect(waypointOfferAnswerAllowed(reached, OFFER, "not_it")).toBe(true);
      expect(waypointOfferAnswerAllowed(reached, OFFER, "right")).toBe(true);
    }
  });
});

// The follow-up's binding (REV473 finding 1, REV473b, REV473c, REV473d). The check is a pure function of the
// returned state and of what was pinned at the button press, so a first result and a Retry in an unchanged
// conversation are the same call; ExplorerWaypointOfferFollowUp.test.tsx proves both through the screen's owner.
const RESPONSES = ["right", "close", "not_it"] as const;
type Response = typeof RESPONSES[number];
const OUTCOME = { right: "confirmed", close: "kept_open", not_it: "declined" } as const;
function result(kind: "change" | "revisit" | "reached", response: Response, overrides: Partial<ExplorerWaypointOfferOperationResult> = {}): ExplorerWaypointOfferOperationResult {
  return { offerId: OFFER, kind, waypointId: WAYPOINT, suggestionMessageId: REPLY, response, typed: false,
    outcome: OUTCOME[response], resultWaypointId: response === "right" ? (kind === "reached" ? WAYPOINT : NEXT_WAYPOINT) : null, ...overrides };
}
// The answered offer as the state shows it after each answer.
function answeredOffer(kind: "change" | "revisit", response: Response, overrides: Record<string, unknown> = {}): Offer {
  return response === "right" ? offer(kind, { status: "confirmed", typedAnswerEligible: false, resultWaypointId: NEXT_WAYPOINT, ...overrides })
    : response === "not_it" ? offer(kind, { status: "declined", typedAnswerEligible: false, ...overrides })
      : offer(kind, { typedAnswerEligible: false, ...overrides });
}
const PINS = { latestGuideReplyId: REPLY, carryingReplyId: REPLY };

describe.each(["change", "revisit"] as const)("offers build step 4: the follow-up after a button answer to a %s offer", kind => {
  const allowed = (response: Response, after: ExplorerConversationState, overrides: Partial<Parameters<typeof waypointOfferFollowUpAllowed>[0]> = {}) =>
    waypointOfferFollowUpAllowed({ state: after, expectedRevision: 7, offerId: OFFER, response, pins: PINS, result: result(kind, response), ...overrides });
  const after = (response: Response, overrides: Partial<ExplorerConversationState> = {}) =>
    state({ revision: 8, waypointOffer: answeredOffer(kind, response), ...overrides });

  it.each(RESPONSES)("is sent when the answer (%s) is the only change since the press", response => {
    expect(allowed(response, after(response))).toBe(true);
  });
  it.each(RESPONSES)("is not sent after %s when the revision is not exactly one above the answer's", response => {
    expect(allowed(response, after(response, { revision: 9 }))).toBe(false);
    expect(allowed(response, after(response, { revision: 7 }))).toBe(false);
  });
  it.each(RESPONSES)("is not sent after %s when a reply was added after the press", response => {
    expect(allowed(response, after(response, { messages: LATER }))).toBe(false);
  });
  it.each(RESPONSES)("is not sent after %s when the state holds a newer offer, also one with the same title", response => {
    const newer = offer(kind, { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    expect(newer.kind !== "reached" && newer.title).toBe(BEFORE.title);
    expect(allowed(response, after(response, { messages: LATER, waypointOffer: newer }))).toBe(false);
    expect(allowed(response, after(response, { waypointOffer: offer(kind, { id: OTHER_OFFER }) }))).toBe(false);
  });
  it.each(RESPONSES)("is not sent after %s when the answered offer is not in the status that fits the answer", response => {
    for (const other of RESPONSES.filter(candidate => candidate !== response)) {
      expect(allowed(response, after(response, { waypointOffer: answeredOffer(kind, other) }))).toBe(false);
    }
    expect(allowed(response, after(response, { waypointOffer: null }))).toBe(false);
    expect(allowed(response, after(response, { waypointOffer: offer(kind, { status: "superseded", typedAnswerEligible: false }) }))).toBe(false);
  });
  it.each(RESPONSES)("is not sent after %s without the answer's own stored result, or with one for another answer", response => {
    expect(allowed(response, after(response), { result: null })).toBe(false);
    expect(allowed(response, after(response), { result: result(kind, response, { offerId: OTHER_OFFER }) })).toBe(false);
    expect(allowed(response, after(response), { result: result(kind, response, { suggestionMessageId: EARLIER_REPLY }) })).toBe(false);
    const other = RESPONSES.find(candidate => candidate !== response)!;
    expect(allowed(response, after(response), { result: result(kind, other) })).toBe(false);
    expect(allowed(response, after(response), { result: result(kind, response, { typed: true }) })).toBe(false);
  });
  it.each(RESPONSES)("REV473c case 1, %s: is sent while an older forming Waypoint still waits under an earlier reply", response => {
    const older = draft({ suggestionMessageId: EARLIER_REPLY, typedAnswerEligible: false });
    expect(allowed(response, after(response, { waypointDraft: older }))).toBe(true);
    // A reply added after the press sends none; a forming Waypoint that can take a typed answer sends none.
    expect(allowed(response, after(response, { waypointDraft: older, messages: LATER }))).toBe(false);
    expect(allowed(response, after(response, { waypointDraft: draft({ typedAnswerEligible: true }) }))).toBe(false);
    expect(allowed(response, after(response, { waypointDraft: draft({ typedAnswerEligible: undefined }) }))).toBe(false);
  });
  it.each(RESPONSES)("REV473c case 2, %s: is sent for an older offer answered after a later ordinary reply", response => {
    const pins = { latestGuideReplyId: LATER_REPLY, carryingReplyId: REPLY };
    expect(allowed(response, after(response, { messages: LATER }), { pins })).toBe(true);
    // A reply added after the press sends none.
    const again = [...LATER, { id: id(16), role: "virtualGuide" as const, body: "A third invented reply.", createdAt: "2026-11-16T09:05:00Z" }];
    expect(allowed(response, after(response, { messages: again }), { pins })).toBe(false);
    // Another waiting presentation carried by the latest reply sends none.
    expect(allowed(response, after(response, { messages: LATER, waypointDraft: draft({ suggestionMessageId: LATER_REPLY }) }), { pins })).toBe(false);
    // The answer was applied to another presentation than the one the Explorer saw.
    expect(allowed(response, after(response, { messages: LATER }), { pins, result: result(kind, response, { suggestionMessageId: LATER_REPLY }) })).toBe(false);
    expect(allowed(response, after(response, { messages: LATER, waypointOffer: answeredOffer(kind, response, { suggestionMessageId: LATER_REPLY }) }), { pins })).toBe(false);
  });
});

describe("offers build step 4: no follow-up after a Reached answer", () => {
  it.each(["right", "not_it"] as const)("is never sent after %s", response => {
    const after = state({ revision: 8, waypointOffer: response === "right" ? confirmed("reached")
      : offer("reached", { status: "declined", typedAnswerEligible: false }) });
    expect(waypointOfferFollowUpAllowed({ state: after, expectedRevision: 7, offerId: OFFER, response, pins: PINS,
      result: result("reached", response) })).toBe(false);
  });
});

describe("offers build step 4: the same protection for the forming Waypoint's follow-up", () => {
  const allowed = (response: Response, after: ExplorerConversationState, pins = PINS) =>
    waypointDraftFollowUpAllowed({ state: after, expectedRevision: 7, draftId: DRAFT, response, pins });
  // "Close, not quite" leaves the draft waiting on purpose (with an answer receipt, so no typed answer); the others end it.
  const after = (response: Response, overrides: Partial<ExplorerConversationState> = {}) =>
    state({ revision: 8, waypointDraft: response === "close" ? draft({ typedAnswerEligible: false }) : null, ...overrides });

  it.each(RESPONSES)("is sent when the answer (%s) is the only change since the press", response => {
    expect(allowed(response, after(response))).toBe(true);
  });
  it.each(RESPONSES)("is sent after %s on a retained fixture without the server's eligibility fact or the offer keys", response => {
    const retained = { ...after(response, response === "close" ? { waypointDraft: draft({ typedAnswerEligible: undefined }) } : {}) } as Record<string, unknown>;
    delete retained.waypointOffer; delete retained.waypointOfferDrop; delete retained.reachedOfferedWaypointIds;
    expect(allowed(response, retained as ExplorerConversationState)).toBe(true);
  });
  it.each(RESPONSES)("is not sent after %s when the revision moved further or a reply was added", response => {
    expect(allowed(response, after(response, { revision: 9 }))).toBe(false);
    expect(allowed(response, after(response, { messages: LATER }))).toBe(false);
  });
  it.each(RESPONSES)("is not sent after %s when the state holds a newer forming Waypoint, also one with the same title", response => {
    const newer = draft({ id: OTHER_DRAFT, suggestionMessageId: LATER_REPLY });
    expect(newer.title).toBe(draft().title);
    expect(allowed(response, after(response, { messages: LATER, waypointDraft: newer }))).toBe(false);
    expect(allowed(response, after(response, { waypointDraft: draft({ id: OTHER_DRAFT }) }))).toBe(false);
  });
  it("is not sent when the answered draft is not in the state that fits the answer", () => {
    expect(allowed("right", after("right", { waypointDraft: draft() }))).toBe(false);
    expect(allowed("not_it", after("not_it", { waypointDraft: draft() }))).toBe(false);
    expect(allowed("close", after("close", { waypointDraft: null }))).toBe(false);
    // Close: the same draft, but now carried by another reply than the one the Explorer saw.
    expect(allowed("close", after("close", { messages: LATER, waypointDraft: draft({ suggestionMessageId: LATER_REPLY, typedAnswerEligible: false }) }),
      { latestGuideReplyId: LATER_REPLY, carryingReplyId: REPLY })).toBe(false);
  });
  it.each(RESPONSES)("%s: an older forming Waypoint answered after a later ordinary reply still gets its follow-up", response => {
    const pins = { latestGuideReplyId: LATER_REPLY, carryingReplyId: REPLY };
    expect(allowed(response, after(response, { messages: LATER }), pins)).toBe(true);
  });
  it.each(RESPONSES)("REV473d, %s: an offer already answered since its carrying reply does not block; one that can take a typed answer does", response => {
    // The read's example: an older forming Waypoint waits beside a newer change offer; the offer was answered
    // "Close, not quite" and its follow-up failed, so it still waits under the latest reply but with an answer
    // receipt. The Explorer then answers the older forming Waypoint.
    const pins = { latestGuideReplyId: LATER_REPLY, carryingReplyId: REPLY };
    const answeredBefore = offer("change", { suggestionMessageId: LATER_REPLY, typedAnswerEligible: false });
    expect(allowed(response, after(response, { messages: LATER, waypointOffer: answeredBefore }), pins)).toBe(true);
    const competing = offer("change", { suggestionMessageId: LATER_REPLY, typedAnswerEligible: true });
    expect(allowed(response, after(response, { messages: LATER, waypointOffer: competing }), pins)).toBe(false);
    // An offer that no longer waits never blocks.
    expect(allowed(response, after(response, { messages: LATER, waypointOffer: confirmed("change") }), pins)).toBe(true);
  });
  it("is never sent without a pinned latest reply", () => {
    expect(allowed("right", after("right"), { latestGuideReplyId: null as unknown as string, carryingReplyId: REPLY })).toBe(false);
  });
});

// Paul's decisions of 2026-11-16 21:52:56 CST (sheet "When an offer no longer matches its Waypoint", revision 3).
describe("offers build: an offer whose Waypoint changed, the snapshot label and the earlier-answer line", () => {
  const changed = (kind: Offer["kind"], overrides: Record<string, unknown> = {}) =>
    offer(kind, { targetCurrent: false, typedAnswerEligible: false, ...overrides });
  it("labels the snapshot Now only while the offer waits and its Waypoint is unchanged", () => {
    for (const kind of ["change", "revisit", "reached"] as const) {
      expect(waypointOfferSnapshotLabel(offer(kind))).toBe("Now");
      expect(waypointOfferSnapshotLabel(changed(kind))).toBe("When offered");
      expect(waypointOfferSnapshotLabel(confirmed(kind))).toBe("When offered");
    }
    expect(waypointOfferStageLine(changed("revisit"))).toBe("When offered: Reached");
    expect(waypointOfferStageLine(confirmed("revisit"))).toBe("When offered: Reached");
    expect(waypointOfferStageLine(offer("revisit"), "When offered")).toBe("When offered: Reached");
  });
  it("gives the reason only for a waiting offer whose Waypoint changed, by kind, and not beside the refused-answer sentence", () => {
    const s = state();
    expect(waypointOfferTargetChangedNotice(s, offer("change"))).toBeNull();
    expect(waypointOfferTargetChangedNotice(s, changed("change"))).toBe(WAYPOINT_OFFER_WORDING.targetChangedRight);
    expect(waypointOfferTargetChangedNotice(s, changed("revisit"))).toBe(WAYPOINT_OFFER_WORDING.targetChangedRight);
    expect(waypointOfferTargetChangedNotice(s, changed("reached"))).toBe(WAYPOINT_OFFER_WORDING.targetChangedReached);
    expect(waypointOfferTargetChangedNotice(s, changed("change", { typedAnswerRefusal: "target_changed" }))).toBeNull();
    // A typed answer refused at a limit that has since passed: the past-tense limit sentence is held back while yes
    // is off, so the reason shows.
    expect(waypointOfferTargetChangedNotice(s, changed("change", { typedAnswerRefusal: "history_limit" })))
      .toBe(WAYPOINT_OFFER_WORDING.targetChangedRight);
    expect(waypointOfferTargetChangedNotice(s, confirmed("change"))).toBeNull();
    expect(waypointOfferTargetChangedNotice(s, changed("change", { status: "declined" }))).toBeNull();
  });
  it("names the earlier answer and the Waypoint, by kind, word for word", () => {
    expect(waypointOfferEarlierSavedLine("change", "Walk each morning")).toBe('Your earlier answer to change "Walk each morning" was saved.');
    expect(waypointOfferEarlierSavedLine("revisit", "Walk each morning")).toBe('Your earlier answer to take up "Walk each morning" again was saved.');
    expect(waypointOfferEarlierSavedLine("reached", "Walk each morning")).toBe('Your earlier answer to mark "Walk each morning" Reached was saved.');
  });
});
