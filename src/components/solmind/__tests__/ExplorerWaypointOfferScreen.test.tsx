import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardState } from "../../../../tests/browser/connectedCardFixture";
import type { ExplorerConversationState, ExplorerConversationWaypointOffer } from "../../../lib/solmind/explorerConversationContract";
import { ExplorerConversationConnectedScreen, type ConnectedConversationView } from "../ExplorerConversationConnectedScreen";

// Offers build, step 4: where the connected screen places the saved offer's box. Invented content only.
// (The box's own words, holds and limits are in ExplorerWaypointOffer.test.tsx.)
const OFFER = "80000000-0000-4000-8000-000000000021";
const WAYPOINT = "60000000-0000-4000-8000-0000000000f1";
const original = cardState();
const EARLIER_REPLY = original.messages[1].id;
const REPLY = original.messages[3].id;
const THREE = ["That's right", "Close, not quite", "That's not it"];
const QUIET = "SolMind could not show this offer for you to confirm because the Waypoint is no longer available for this offer. No change was made by this offer. Check the Waypoint's current wording and status before asking again.";
type Offer = ExplorerConversationWaypointOffer;
const offer = (overrides: Record<string, unknown> = {}) => ({ id: OFFER, kind: "change", status: "proposed", waypointId: WAYPOINT,
  targetBefore: { title: "Walk each morning", destination: "Walk before work", whyItMatters: "I think more clearly after",
    arrivalSignal: "Five walks in one week", stage: "formed" },
  suggestionMessageId: REPLY, resultWaypointId: null, targetCurrent: true, typedAnswerEligible: true, typedAnswerRefusal: null,
  title: "Walk each morning", destination: "Walk before breakfast", whyItMatters: "I think more clearly after",
  arrivalSignal: "Five walks in one week", ...overrides }) as Offer;
const state = (overrides: Partial<ExplorerConversationState> = {}) => cardState({
  providerState: "available", compassSuggestionReplies: "available", compassItems: [],
  priorityId: null, attentionId: null, waypoints: [], waypointDraft: null,
  waypointOffer: offer(), waypointOfferDrop: null, reachedOfferedWaypointIds: [], ...overrides,
});
const actions = { onReload: () => {}, onRetry: () => {}, onDraftChange: () => {}, onSend: () => {},
  onReviewEnd: () => {}, onConfirmEnd: () => {}, onKeepOpen: () => {}, onCommand: () => {}, onReplyChoice: () => {} };
function screen(next = state(), overrides: Partial<ConnectedConversationView> = {}) {
  return renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
    view: { state: next, busy: false, sendSequence: 0, statusText: "", assistance: null, errorMessage: null,
      awaitingReply: false, sendingMessage: null, sendingFromComposer: false,
      signInRequired: false, uncertain: false, reloadAvailable: true, draft: "", draftError: "",
      endReviewOpen: false, staleEndReview: false, ended: false, endBlocked: false, held: false,
      sendUnavailable: false, atMessageCapacity: false, ...overrides }, actions,
    composerRef: createRef<HTMLTextAreaElement>(), headingRef: createRef<HTMLHeadingElement>(),
  }));
}
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'")
  .replaceAll("&quot;", '"').replace(/\s+/g, " ").trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(match => ({ label: plain(match[2]), disabled: /\bdisabled=""/.test(match[1]) }));
function transcript(html: string) {
  const list = /<ol aria-label="Saved conversation"[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
  return [...list.matchAll(/<li\b[\s\S]*?<\/li>/g)].map(match => match[0]);
}

describe("offers build step 4: the saved offer's box in the conversation", () => {
  it("renders the box once, inside the list item of the offer's latest carrying reply, after the reply's words", () => {
    const items = transcript(screen());
    expect(items).toHaveLength(original.messages.length);
    for (const item of items.slice(0, -1)) expect(item).not.toContain("data-waypoint-offer");
    const item = items.at(-1)!;
    expect(item).toContain('data-waypoint-offer="change"');
    expect(item.indexOf(original.messages[3].body.slice(0, 20))).toBeGreaterThan(-1);
    expect(item.indexOf(original.messages[3].body.slice(0, 20))).toBeLessThan(item.indexOf("data-waypoint-offer"));
    expect(plain(item)).toContain("Proposed change");
    expect(buttons(item)).toEqual(THREE.map(label => ({ label, disabled: false })));
    expect(item).not.toContain("data-build-note");
  });

  it("keeps an older offer that still waits under its own earlier reply", () => {
    const items = transcript(screen(state({ waypointOffer: offer({ suggestionMessageId: EARLIER_REPLY, typedAnswerEligible: false }) })));
    expect(items[1]).toContain('data-waypoint-offer="change"');
    expect(items.at(-1)!).not.toContain("data-waypoint-offer");
    expect(buttons(items[1])).toEqual(THREE.map(label => ({ label, disabled: false })));
  });

  it("holds the reply's choices back while the box waits, and shows them again once the offer is confirmed", () => {
    const messages = original.messages.map((message, index) => index === 3 ? { ...message, choices: [{ label: "An invented choice" }] } : message);
    const waiting = transcript(screen(state({ messages }))).at(-1)!;
    expect(waiting).toContain("data-waypoint-offer");
    expect(waiting).not.toContain("data-reply-choices");
    expect(plain(waiting)).not.toContain("An invented choice");
    const saved = transcript(screen(state({ messages, waypointOffer: offer({ status: "confirmed", typedAnswerEligible: false,
      resultWaypointId: "60000000-0000-4000-8000-0000000000f2" }) }))).at(-1)!;
    expect(saved).toContain("data-reply-choices");
    expect(plain(saved)).toContain("Saved. This Waypoint has its new wording.");
    expect(buttons(saved).map(button => button.label)).not.toContain("That's right");
  });

  it("disables the buttons while the screen is held, busy or uncertain, and the follow-up answers when no message can be sent", () => {
    for (const held of [{ held: true }, { held: true, busy: true }, { held: true, uncertain: true }, { held: true, ended: true }]) {
      expect(buttons(transcript(screen(state(), held)).at(-1)!).every(button => button.disabled)).toBe(true);
    }
    for (const followUpHeld of [{ sendUnavailable: true }, { atMessageCapacity: true }]) {
      expect(buttons(transcript(screen(state(), followUpHeld)).at(-1)!).map(button => button.disabled)).toEqual([false, true, true]);
    }
  });

  it("shows Saving... in the box while its own answer is in flight, and nothing when the view names no offer", () => {
    expect(plain(transcript(screen(state(), { busy: true, held: true, savingOfferId: OFFER })).at(-1)!)).toContain("Saving...");
    expect(plain(transcript(screen(state(), { busy: true, held: true, savingOfferId: null })).at(-1)!)).not.toContain("Saving...");
    expect(plain(transcript(screen(state(), { busy: true, held: true })).at(-1)!)).not.toContain("Saving...");
  });

  it("shows the quiet line under the latest reply when the state carries a dropped offer", () => {
    const items = transcript(screen(state({ waypointOffer: null, waypointOfferDrop: { kind: "change", reason: "target_not_available" } })));
    expect(plain(items.at(-1)!)).toContain(QUIET);
    for (const item of items.slice(0, -1)) expect(item).not.toContain("data-waypoint-offer-drop");
    expect(screen(state({ waypointOffer: null }))).not.toContain("data-waypoint-offer-drop");
  });
});

// Decision 1 of 2026-11-16 21:52:56 and REV488 finding 3: the invitation to write shows exactly when the screen's own
// composer can send.
describe("offers build: a changed Waypoint's invitation follows the composer", () => {
  const DISCUSS = "To discuss what you want now, write to the Virtual Guide.";
  const changed = state({ waypointOffer: offer({ targetCurrent: false, typedAnswerEligible: false }) });
  // The composer can send when it is drawn and enabled (an ended conversation draws no composer).
  const composerCanSend = (html: string) => /<textarea\b/.test(html) && !/<textarea\b[^>]*\bdisabled=""/.test(html);
  it.each([
    ["sending possible", {}],
    ["held (busy)", { held: true, busy: true }],
    ["held (uncertain)", { held: true, uncertain: true }],
    ["held (end review open)", { held: true, endReviewOpen: true }],
    ["held (ended)", { held: true, ended: true }],
    ["the Virtual Guide unavailable", { sendUnavailable: true }],
    ["at message capacity", { atMessageCapacity: true }],
  ] as const)("%s", (_name, view) => {
    const html = screen(changed, view);
    const box = transcript(html).at(-1)!;
    expect(plain(box)).toContain("This Waypoint changed after this offer was shown.");
    expect(plain(box).includes(DISCUSS)).toBe(composerCanSend(html));
  });
});
