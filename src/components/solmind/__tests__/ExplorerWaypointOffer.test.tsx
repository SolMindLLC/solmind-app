import { Children, createElement, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExplorerConversationState, ExplorerConversationWaypointOffer } from "../../../lib/solmind/explorerConversationContract";
import { ExplorerWaypointOffer } from "../ExplorerWaypointOffer";

// Offers build, step 4: the box itself, drawn from the state's saved offer alone. Invented content only.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const EARLIER_REPLY = id(11);
const REPLY = id(13);
const OFFER = id(21);
const WAYPOINT = id(41);
const NEXT_WAYPOINT = id(42);
const HISTORY_SENTENCE = '"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.';
const REVISIT_SENTENCE = '"That\'s right" is unavailable because you have 20 active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before bringing back another. This limit does not block other replies or typing what you would change.';
const S1 = "This offer was not saved because the Waypoint changed after the offer was shown. To keep your Waypoint as you last saw it, nothing was changed by this offer.";
const S2 = "Your typed answer did not save this offer because a Waypoint limit applied when you sent it. Nothing was changed by it. That limit no longer applies, so you can choose again here.";
const QUIET = "SolMind could not show this offer for you to confirm because the proposed wording was the same as the saved wording. No change was made by this offer. Check the Waypoint's current wording and status before asking again.";
const CHANGE_WHY = "To make sure the change says what you mean, compare your Waypoint as it is now with the proposed wording before you choose.";
const CHANGE_YES = 'Choosing "That\'s right" saves this as a new version and keeps the earlier wording saved in your private history. Nothing is shared.';
const REVISIT_WHY = "To make sure you are taking up the Waypoint you mean, check its wording and what happened to it before you choose.";
const REVISIT_YES = 'Choosing "That\'s right" makes this Waypoint in progress again. Its earlier Reached evidence and release history stay saved as private history; they do not show that you have reached it this time. Nothing is shared.';
const REACHED_WHY = "To make sure Reached reflects your progress, check the arrival signal and your words below before you choose.";

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
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: id(1), revision: 7, pendingTurn: false,
    turnedDownLimitReached: false, providerState: "available", compassSuggestionReplies: "available", sessionStatus: "active",
    messages: [
      { id: EARLIER_REPLY, role: "virtualGuide", body: "An invented earlier reply.", createdAt: "2026-11-16T09:00:00Z" },
      { id: id(12), role: "explorer", body: "An invented message.", createdAt: "2026-11-16T09:01:00Z" },
      { id: REPLY, role: "virtualGuide", body: "An invented reply.", createdAt: "2026-11-16T09:02:00Z" },
    ], compassItems: [], priorityId: null, attentionId: null, waypoints: [],
    waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 0 },
    waypointDraft: null, waypointOffer: offer(), waypointOfferDrop: null, reachedOfferedWaypointIds: [], ...overrides };
}
type Props = ComponentProps<typeof ExplorerWaypointOffer>;
const props = (next: ExplorerConversationState, overrides: Partial<Props> = {}): Props =>
  ({ state: next, messageId: REPLY, held: false, followUpHeld: false, savingOfferId: null, onCommand: () => {}, ...overrides });
const box = (next: ExplorerConversationState = state(), overrides: Partial<Props> = {}) =>
  renderToStaticMarkup(createElement(ExplorerWaypointOffer, props(next, overrides)));
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'")
  .replaceAll("&quot;", '"').replace(/\s+/g, " ").trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(match => ({ label: plain(match[2]), disabled: /\bdisabled=""/.test(match[1]) }));
const THREE = ["That's right", "Close, not quite", "That's not it"];
const enabled = (labels: readonly string[]) => labels.map(label => ({ label, disabled: false }));
function buttonElements(node: ReactNode): ReactElement<ComponentProps<"button">>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === "button") return [child as ReactElement<ComponentProps<"button">>];
    return buttonElements(child.props.children);
  });
}

describe("offers build step 4: each box's words by kind and status", () => {
  it("draws a waiting Reached offer with its heading, reason, the Explorer's own words and its two buttons", () => {
    const html = box(state({ waypointOffer: offer("reached") }));
    expect(html).toContain('data-waypoint-offer="reached"');
    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-labelledby="waypoint-offer-heading-${OFFER} waypoint-offer-title-${OFFER}"`);
    const text = plain(html);
    expect(text).toBe(["Mark this Waypoint Reached?", REACHED_WHY, "Walk each morning", "Reached looks like:", "Five walks in one week",
      "What showed you reached it:", '"I walked five times this week"', "Yes, mark it Reached", "Not yet"].join(" "));
    expect(buttons(html)).toEqual(enabled(["Yes, mark it Reached", "Not yet"]));
    for (const absent of ["Proposed change", "Take up again", "Close, not quite", "Saved.", "Saving..."]) expect(text).not.toContain(absent);
  });

  it("draws a waiting change offer: tag, reason, Now beside Proposed, No change, what a yes does, three buttons", () => {
    const html = box();
    expect(html).toContain('data-waypoint-offer="change"');
    expect(html).toContain(`aria-labelledby="waypoint-offer-title-${OFFER}"`);
    expect(plain(html)).toBe(["Walk each morning", "Proposed change", CHANGE_WHY,
      "Where you're heading:", "Now", "Walk before work", "Proposed", "Walk before breakfast",
      "Why it matters:", "I think more clearly after", "No change",
      "Reached looks like:", "Five walks in one week", "No change", CHANGE_YES, ...THREE].join(" "));
    expect(buttons(html)).toEqual(enabled(THREE));
    // Side by side from the small breakpoint, Now above Proposed on a narrow screen.
    expect(html).toContain('class="grid gap-2 sm:grid-cols-2"');
    expect(html).not.toContain("data-waypoint-offer-title-change");
    for (const absent of ["Take up again", "Mark this Waypoint Reached?", "Saved.", "Saving...", "Nothing is shared and no message is sent"]) expect(plain(html)).not.toContain(absent);
  });

  it.each([["reached", "Now: Reached"], ["released", "Now: Released"]] as const)(
    "draws a waiting revisit offer for a %s Waypoint", (stage, stageLine) => {
      const html = box(state({ waypointOffer: offer("revisit", { targetBefore: { ...BEFORE, stage }, destination: BEFORE.destination }) }));
      expect(html).toContain('data-waypoint-offer="revisit"');
      expect(plain(html)).toBe(["Walk each morning", "Take up again", REVISIT_WHY, stageLine,
        "Where you're heading:", "Walk before work", "Why it matters:", "I think more clearly after",
        "Reached looks like:", "Five walks in one week", REVISIT_YES, ...THREE].join(" "));
      // Fix round 1: a revisit that changes no wording shows its three parts once, with no "No change".
      expect(plain(html)).not.toContain("No change");
      expect(buttons(html)).toEqual(enabled(THREE));
    });

  it("shows a revisit's changed part with Now beside Proposed, and a proposed title beside the saved one", () => {
    const html = box(state({ waypointOffer: offer("revisit", { title: "Walk before breakfast" }) }));
    const text = plain(html);
    expect(text).toContain("Where you're heading: Now Walk before work Proposed Walk before breakfast");
    expect(html).toContain("data-waypoint-offer-title-change");
    // Fix round 1: while the offer waits, the heading beside the tag is the Waypoint's saved title.
    expect(text.startsWith("Walk each morning Take up again")).toBe(true);
    // Decision 4 of 2026-11-16 21:52:56: the title pair carries its "Title:" label.
    expect(text).toContain(`${REVISIT_WHY} Title: Now Walk each morning Proposed Walk before breakfast Now: Reached`);
    // A revisit that also changes wording follows Part 1: unchanged parts once with "No change".
    expect(text).toContain("Why it matters: I think more clearly after No change Reached looks like: Five walks in one week No change");
  });

  it.each(["change", "revisit"] as const)("fix round 1: a waiting %s offer heads its box with the saved title, a confirmed one with the saved new title", kind => {
    const proposedTitle = "Walk before breakfast each day";
    const waiting = box(state({ waypointOffer: offer(kind, { title: proposedTitle }) }));
    const heading = (html: string) => plain(/<h3\b[^>]*>([\s\S]*?)<\/h3>/.exec(html)![1]);
    expect(heading(waiting)).toBe("Walk each morning");
    expect(plain(waiting)).toContain(`Title: Now Walk each morning Proposed ${proposedTitle}`);
    expect(waiting).toContain("data-waypoint-offer-title-change");
    const saved = box(state({ waypointOffer: offer(kind, { title: proposedTitle, status: "confirmed", typedAnswerEligible: false, resultWaypointId: NEXT_WAYPOINT }) }));
    expect(heading(saved)).toBe(proposedTitle);
    // Decision 3: once confirmed, the snapshot column reads "When offered".
    expect(plain(saved)).toContain(`Title: When offered Walk each morning Proposed ${proposedTitle}`);
    // An unchanged title shows once, with no pair.
    const same = box(state({ waypointOffer: offer(kind) }));
    expect(heading(same)).toBe("Walk each morning");
    expect(same).not.toContain("data-waypoint-offer-title-change");
  });

  it("fix round 1: a revisit shows No change only when at least one part changes; a change offer always marks its unchanged parts", () => {
    const count = (html: string) => plain(html).split("No change").length - 1;
    expect(count(box(state({ waypointOffer: offer("revisit", { destination: BEFORE.destination }) })))).toBe(0);
    expect(count(box(state({ waypointOffer: offer("revisit") })))).toBe(2);
    expect(count(box(state({ waypointOffer: offer("revisit", { arrivalSignal: "Five walks, rain or not" }) })))).toBe(1);
    expect(count(box(state({ waypointOffer: offer("change") })))).toBe(2);
    // The same rule after confirmation.
    expect(count(box(state({ waypointOffer: offer("revisit", { destination: BEFORE.destination, status: "confirmed",
      typedAnswerEligible: false, resultWaypointId: NEXT_WAYPOINT }) })))).toBe(0);
  });

  it.each([
    ["reached", "Saved. This Waypoint is marked Reached."],
    ["change", "Saved. This Waypoint has its new wording."],
    ["revisit", "Saved. This Waypoint is in progress again."],
  ] as const)("a confirmed %s box shows its Saved line and no buttons, from a state whose Waypoint list has no earlier version", (kind, saved) => {
    // After a reload the state carries only current versions (here none at all): the snapshot still comes from the
    // offer, labelled "When offered" (decision 3 of 2026-11-16 21:52:56).
    const html = box(state({ waypoints: [], waypointOffer: confirmed(kind) }));
    const text = plain(html);
    expect(buttons(html)).toEqual([]);
    expect(text.endsWith(saved)).toBe(true);
    expect(text.match(/Saved\./g)).toHaveLength(1);
    expect(text).toContain("Walk each morning");
    expect(text).toContain("Five walks in one week");
    if (kind !== "reached") expect(text).toContain("When offered Walk before work Proposed Walk before breakfast");
    if (kind === "revisit") expect(text).toContain("When offered: Reached");
    expect(text.split(" ")).not.toContain("Now");
    if (kind === "reached") expect(text).toContain('What showed you reached it: "I walked five times this week"');
    // The sentences that ask for a choice leave with the buttons.
    for (const absent of [REACHED_WHY, CHANGE_WHY, CHANGE_YES, REVISIT_WHY, REVISIT_YES, "Mark this Waypoint Reached?", "Saving..."]) expect(text).not.toContain(absent);
    expect(html).toContain(`aria-labelledby="waypoint-offer-title-${OFFER}"`);
  });

  it.each(["declined", "superseded"] as const)("draws nothing for a %s offer", status => {
    expect(box(state({ waypointOffer: offer("change", { status, typedAnswerEligible: false }) }))).toBe("");
  });

  it("draws nothing under another message, without an offer, or on a fixture without the offer keys", () => {
    expect(box(state(), { messageId: EARLIER_REPLY })).toBe("");
    expect(box(state({ waypointOffer: null }))).toBe("");
    const retained = { ...state() } as Record<string, unknown>;
    delete retained.waypointOffer; delete retained.waypointOfferDrop; delete retained.reachedOfferedWaypointIds;
    expect(box(retained as ExplorerConversationState)).toBe("");
  });

  it("escapes offered wording as text and keeps its line breaks", () => {
    const html = box(state({ waypointOffer: offer("change", { destination: "<b>Walk</b>\nbefore breakfast" }) }));
    expect(html).toContain("&lt;b&gt;Walk&lt;/b&gt;\nbefore breakfast");
    expect(html).not.toContain("<b>Walk</b>");
    expect(html).toContain("whitespace-pre-wrap");
  });
});

describe("offers build step 4: button enabling and holds", () => {
  it.each(["reached", "change", "revisit"] as const)("disables every button of a %s offer while held or while a turn is pending", kind => {
    for (const html of [box(state({ waypointOffer: offer(kind) }), { held: true }),
      box(state({ waypointOffer: offer(kind), pendingTurn: true }))]) {
      expect(buttons(html).length).toBe(kind === "reached" ? 2 : 3);
      expect(buttons(html).every(button => button.disabled)).toBe(true);
    }
  });

  it("keeps the buttons disabled in an ended conversation and drops the invitation to choose again", () => {
    const html = box(state({ sessionStatus: "ended", waypointOffer: offer("change", { typedAnswerRefusal: "history_limit" }) }), { held: true });
    expect(buttons(html).every(button => button.disabled)).toBe(true);
    expect(plain(html)).not.toContain(S2);
  });

  it.each(["support", "adult_policy", "unavailable"] as const)("shows the %s hold sentence in place of the buttons", availability => {
    const holds = { support: "To keep this conversation focused on support, suggestion replies are not available in this conversation.",
      adult_policy: "Because SolMind is for adults, suggestion replies are unavailable in this conversation.",
      unavailable: "To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings." };
    for (const kind of ["reached", "change", "revisit"] as const) {
      const html = box(state({ waypointOffer: offer(kind), compassSuggestionReplies: availability }));
      expect(buttons(html)).toEqual([]);
      expect(plain(html)).toContain(holds[availability]);
    }
  });
  it("treats a missing availability as the settings hold", () => {
    const html = box(state({ compassSuggestionReplies: undefined }));
    expect(buttons(html)).toEqual([]);
    expect(plain(html)).toContain("suggestion replies wait until SolMind can confirm this conversation's settings.");
  });

  it("holds Close and That's not it of a change or revisit when no follow-up could be sent, never Not yet", () => {
    for (const kind of ["change", "revisit"] as const) {
      expect(buttons(box(state({ waypointOffer: offer(kind) }), { followUpHeld: true }))).toEqual([
        { label: "That's right", disabled: false }, { label: "Close, not quite", disabled: true }, { label: "That's not it", disabled: true }]);
    }
    expect(buttons(box(state({ waypointOffer: offer("reached") }), { followUpHeld: true }))).toEqual(enabled(["Yes, mark it Reached", "Not yet"]));
  });

  it.each(["reached", "change", "revisit"] as const)("turns only the yes button off when the %s offer's Waypoint changed since it was shown", kind => {
    const html = box(state({ waypointOffer: offer(kind, { targetCurrent: false, typedAnswerEligible: false }) }));
    expect(buttons(html).map(button => button.disabled)).toEqual(kind === "reached" ? [true, false] : [true, false, false]);
  });

  it("at 200 saved versions the yes button is unavailable with the forming box's sentence, for a change and a revisit", () => {
    for (const kind of ["change", "revisit"] as const) {
      const html = box(state({ waypointOffer: offer(kind), waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: false, conversationRoom: true } }));
      expect(buttons(html).map(button => button.disabled)).toEqual([true, false, false]);
      expect(plain(html)).toContain(HISTORY_SENTENCE);
      expect(html).toContain(`aria-describedby="waypoint-offer-limit-${OFFER}"`);
      expect(html).toContain(`id="waypoint-offer-limit-${OFFER}"`);
    }
  });
  it("at 20 active Waypoints only a revisit's yes button is unavailable, with the revisit sentence", () => {
    const capacity = { activeCount: 20, activeLimit: 20, historyRoom: true, conversationRoom: true };
    const revisit = box(state({ waypointOffer: offer("revisit"), waypointCapacity: capacity }));
    expect(buttons(revisit).map(button => button.disabled)).toEqual([true, false, false]);
    expect(plain(revisit)).toContain(REVISIT_SENTENCE);
    expect(plain(revisit)).not.toContain("before adding another");
    const change = box(state({ waypointOffer: offer("change"), waypointCapacity: capacity }));
    expect(buttons(change)).toEqual(enabled(THREE));
    expect(plain(change)).not.toContain("is unavailable because");
    expect(change).not.toContain("aria-describedby");
  });
  it("shows the 200-version sentence first, alone, when both limits apply", () => {
    const html = box(state({ waypointOffer: offer("revisit"), waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: false, conversationRoom: true } }));
    expect(plain(html)).toContain(HISTORY_SENTENCE);
    expect(plain(html)).not.toContain("active Waypoints across your conversations");
  });
  it("never disables a box for the five-Waypoint limit", () => {
    const capacity = { activeCount: 3, activeLimit: 20, historyRoom: true, conversationRoom: false };
    for (const kind of ["reached", "change", "revisit"] as const) {
      const html = box(state({ waypointOffer: offer(kind), waypointCapacity: capacity }));
      expect(buttons(html).every(button => !button.disabled)).toBe(true);
      expect(plain(html)).not.toContain("is unavailable because");
      expect(html).not.toContain("aria-describedby");
    }
  });
});

describe("offers build step 4: a refused typed yes in the box", () => {
  it("shows the target-changed sentence, the yes button off and no Saved line", () => {
    const html = box(state({ waypointOffer: offer("change", { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false }) }));
    expect(plain(html)).toContain(S1);
    expect(plain(html)).not.toContain("Saved.");
    expect(buttons(html).map(button => button.disabled)).toEqual([true, false, false]);
  });
  it("refused at 20 active and still at 20: the limit sentence alone", () => {
    const html = box(state({ waypointOffer: offer("revisit", { typedAnswerRefusal: "active_limit" }),
      waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true, conversationRoom: true } }));
    expect(plain(html)).toContain(REVISIT_SENTENCE);
    expect(plain(html)).not.toContain(S2);
    expect(html).not.toContain("data-waypoint-offer-refusal");
    expect(plain(html)).not.toContain("Saved.");
  });
  it("refused at 20 active, capacity restored, no refinement: the past-tense sentence and an available yes", () => {
    const html = box(state({ waypointOffer: offer("revisit", { typedAnswerRefusal: "active_limit" }),
      waypointCapacity: { activeCount: 19, activeLimit: 20, historyRoom: true, conversationRoom: true } }));
    expect(plain(html)).toContain(S2);
    expect(plain(html)).not.toContain("is unavailable because");
    expect(buttons(html)).toEqual(enabled(THREE));
    expect(plain(html)).not.toContain("Saved.");
  });
  it("refused at 20 active, capacity restored, then a refinement: no notice in the new box", () => {
    // The server gives a refusal only for the presentation that was refused; the refined offer carries none.
    const html = box(state({ waypointOffer: offer("revisit", { typedAnswerRefusal: null, destination: "Walk after lunch" }),
      waypointCapacity: { activeCount: 19, activeLimit: 20, historyRoom: true, conversationRoom: true } }));
    expect(html).not.toContain("data-waypoint-offer-refusal");
    expect(plain(html)).not.toContain(S2);
    expect(plain(html)).not.toContain(S1);
    expect(buttons(html)).toEqual(enabled(THREE));
  });
});

describe("offers build step 4, fix round 1: the box names every shown reason for a disabled yes", () => {
  const described = (html: string) => /aria-describedby="([^"]*)"/.exec(html)?.[1] ?? null;
  const LIMIT = `waypoint-offer-limit-${OFFER}`;
  const REFUSAL = `waypoint-offer-refusal-${OFFER}`;
  const full = { activeCount: 3, activeLimit: 20, historyRoom: false, conversationRoom: true };
  it("points to the limit sentence alone at a limit", () => {
    const html = box(state({ waypointCapacity: full }));
    expect(described(html)).toBe(LIMIT);
    expect(html).toContain(`id="${LIMIT}"`);
    expect(html).not.toContain(`id="${REFUSAL}"`);
  });
  it("points to the target-changed sentence when a typed yes was refused for a changed Waypoint", () => {
    const html = box(state({ waypointOffer: offer("change", { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false }) }));
    expect(described(html)).toBe(REFUSAL);
    expect(new RegExp(`<p[^>]*id="${REFUSAL}"[^>]*>([^<]*)</p>`).exec(html)![1]).toBe(S1);
  });
  it("points to both, the limit sentence first, when both show", () => {
    const html = box(state({ waypointCapacity: full,
      waypointOffer: offer("change", { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false }) }));
    expect(described(html)).toBe(`${LIMIT} ${REFUSAL}`);
    expect(html).toContain(`id="${LIMIT}"`);
    expect(html).toContain(`id="${REFUSAL}"`);
    expect(html.indexOf(`id="${LIMIT}"`)).toBeLessThan(html.indexOf(`id="${REFUSAL}"`));
  });
  it("never points to a sentence that is not shown, and not to the past-tense sentence of an available yes", () => {
    expect(described(box())).toBeNull();
    // The Waypoint changed but nothing was refused: the reason sentence of decision 1 (2026-11-16 21:52:56) is
    // named, and no refusal sentence is added.
    const changed = box(state({ waypointOffer: offer("change", { targetCurrent: false, typedAnswerEligible: false }) }));
    expect(described(changed)).toBe(`waypoint-offer-target-changed-${OFFER}`);
    expect(changed).not.toContain("data-waypoint-offer-refusal");
    const passed = box(state({ waypointOffer: offer("change", { typedAnswerRefusal: "history_limit" }) }));
    expect(plain(passed)).toContain(S2);
    expect(described(passed)).toBeNull();
    // The limit sentence is hidden where the buttons are (an ended conversation, a hold); the refusal still shows.
    const ended = box(state({ sessionStatus: "ended", waypointCapacity: full,
      waypointOffer: offer("change", { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false }) }), { held: true });
    expect(described(ended)).toBe(REFUSAL);
    expect(described(box(state({ waypointOffer: confirmed("change"), waypointCapacity: full })))).toBeNull();
  });
});

describe("offers build step 5, fix 2: the yes button itself names the reasons shown for it", () => {
  const yes = (html: string, name = "That\'s right") => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(match => ({ attributes: match[1], label: plain(match[2]) })).find(found => found.label === name)!;
  const describedBy = (attributes: string) => /aria-describedby="([^"]*)"/.exec(attributes)?.[1] ?? null;
  const groupDescribedBy = (html: string) => describedBy(/<div\b([^>]*role="group"[^>]*)>/.exec(html)![1]);
  const LIMIT = `waypoint-offer-limit-${OFFER}`;
  const REFUSAL = `waypoint-offer-refusal-${OFFER}`;
  const full = { activeCount: 3, activeLimit: 20, historyRoom: false, conversationRoom: true };
  const refused = { typedAnswerRefusal: "target_changed", targetCurrent: false, typedAnswerEligible: false };
  it("carries the same list as the box: the limit sentence, the refusal sentence, or both in order", () => {
    for (const [html, expected] of [
      [box(state({ waypointCapacity: full })), LIMIT],
      [box(state({ waypointOffer: offer("change", refused) })), REFUSAL],
      [box(state({ waypointCapacity: full, waypointOffer: offer("revisit", refused) })), `${LIMIT} ${REFUSAL}`],
    ] as const) {
      expect(describedBy(yes(html).attributes)).toBe(expected);
      expect(groupDescribedBy(html)).toBe(expected);
      expect(yes(html).attributes).toContain('disabled=""');
      // Every id named exists once in the box.
      for (const reasonId of expected.split(" ")) expect(html.split(`id="${reasonId}"`)).toHaveLength(2);
    }
  });
  it("is only on the yes button, and absent when no reason sentence shows", () => {
    const html = box(state({ waypointCapacity: full }));
    for (const name of ["Close, not quite", "That\'s not it"]) expect(describedBy(yes(html, name).attributes)).toBeNull();
    expect(yes(box()).attributes).not.toContain("aria-describedby");
    // The Waypoint changed with no refusal: the yes button names the reason sentence of decision 1.
    expect(describedBy(yes(box(state({ waypointOffer: offer("change", { targetCurrent: false, typedAnswerEligible: false }) }))).attributes))
      .toBe(`waypoint-offer-target-changed-${OFFER}`);
    // The past-tense sentence belongs to an available yes and is not a reason.
    expect(yes(box(state({ waypointOffer: offer("change", { typedAnswerRefusal: "history_limit" }) }))).attributes).not.toContain("aria-describedby");
    const reached = box(state({ waypointOffer: offer("reached", refused) }));
    expect(describedBy(yes(reached, "Yes, mark it Reached").attributes)).toBe(REFUSAL);
    expect(describedBy(yes(reached, "Not yet").attributes)).toBeNull();
  });
});

describe("offers build step 4: Saving, the intent sent, and the quiet line", () => {
  it("shows Saving... only while this offer's own answer is in flight", () => {
    expect(plain(box(state(), { savingOfferId: OFFER, held: true }))).toContain("Saving...");
    expect(plain(box(state(), { savingOfferId: id(99), held: true }))).not.toContain("Saving...");
    expect(plain(box(state(), { held: true }))).not.toContain("Saving...");
    const saved = plain(box(state({ waypointOffer: confirmed("change") }), { savingOfferId: OFFER }));
    expect(saved).not.toContain("Saving...");
    expect(saved).toContain("Saved. This Waypoint has its new wording.");
  });

  it.each([
    ["reached", ["right", "not_it"]], ["change", ["right", "close", "not_it"]], ["revisit", ["right", "close", "not_it"]],
  ] as const)("each button of a %s offer hands over exactly the respond_waypoint_offer intent and keeps focus on the message", (kind, responses) => {
    const onCommand = vi.fn();
    const tree = ExplorerWaypointOffer(props(state({ waypointOffer: offer(kind) }), { onCommand }));
    const found = buttonElements(tree);
    expect(found).toHaveLength(responses.length);
    found.forEach((button, index) => {
      const focus = vi.fn();
      button.props.onClick!({ currentTarget: { closest: (selector: string) => selector === "li" ? { focus } : null } } as unknown as MouseEvent<HTMLButtonElement>);
      expect(onCommand).toHaveBeenLastCalledWith({ kind: "respond_waypoint_offer", offerId: OFFER, response: responses[index] });
      expect(focus).toHaveBeenCalledOnce();
      // Step 5 fix 2: focus goes to the reply without the browser scrolling the page to it.
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });
    expect(onCommand).toHaveBeenCalledTimes(responses.length);
  });

  it("draws the quiet line under the latest reply when the state carries a dropped offer, with and without a box", () => {
    const alone = box(state({ waypointOffer: null, waypointOfferDrop: { kind: "change", reason: "no_change" } }));
    expect(plain(alone)).toBe(QUIET);
    expect(alone).toContain("data-waypoint-offer-drop");
    expect(buttons(alone)).toEqual([]);
    expect(box(state({ waypointOffer: null, waypointOfferDrop: { kind: "change", reason: "no_change" } }), { messageId: EARLIER_REPLY })).toBe("");
    const both = box(state({ waypointOfferDrop: { kind: "change", reason: "no_change" } }));
    expect(plain(both).endsWith(QUIET)).toBe(true);
    expect(both).toContain('data-waypoint-offer="change"');
    const unknown = box(state({ waypointOffer: null, waypointOfferDrop: { kind: null, reason: "invalid" } }));
    expect(plain(unknown)).toBe("SolMind could not show this offer for you to confirm. No change was made by this offer. Check the Waypoint's current wording and status before asking again.");
  });
});

// Paul's decisions of 2026-11-16 21:52:56 CST (sheet "When an offer no longer matches its Waypoint", revision 3).
describe("offers build: a waiting offer whose Waypoint changed after it was shown", () => {
  const TC_RIGHT = 'This Waypoint changed after this offer was shown. To keep those changes, "That\'s right" is unavailable.';
  const TC_REACHED = 'This Waypoint changed after this offer was shown. To keep those changes, "Yes, mark it Reached" is unavailable.';
  const DISCUSS = "To discuss what you want now, write to the Virtual Guide.";
  const TARGET = `waypoint-offer-target-changed-${OFFER}`;
  const REFUSAL = `waypoint-offer-refusal-${OFFER}`;
  const changed = (kind: Offer["kind"], overrides: Record<string, unknown> = {}) =>
    offer(kind, { targetCurrent: false, typedAnswerEligible: false, ...overrides });
  const described = (html: string) => /aria-describedby="([^"]*)"/.exec(html)?.[1] ?? null;
  it.each([["change", CHANGE_WHY, CHANGE_YES], ["revisit", REVISIT_WHY, REVISIT_YES]] as const)(
    "a %s box: the reason replaces the why sentence, the invitation follows, the yes sentence goes and Now reads When offered", (kind, why, yesSentence) => {
    const html = box(state({ waypointOffer: changed(kind, { title: "Walk before breakfast each day" }) }));
    const text = plain(html);
    expect(text).toContain(`${TC_RIGHT} ${DISCUSS} Title: When offered Walk each morning Proposed Walk before breakfast each day`);
    for (const absent of [why, yesSentence]) expect(text).not.toContain(absent);
    expect(text.split(" ")).not.toContain("Now");
    if (kind === "revisit") expect(text).toContain("When offered: Reached");
    expect(buttons(html)).toEqual([{ label: "That's right", disabled: true }, { label: "Close, not quite", disabled: false },
      { label: "That's not it", disabled: false }]);
    expect(described(html)).toBe(TARGET);
    expect(new RegExp(`<p[^>]*id="${TARGET}"[^>]*>([^<]*)</p>`).exec(html)![1].replaceAll("&quot;", '"').replaceAll("&#x27;", "'")).toBe(TC_RIGHT);
  });
  it("a Reached box keeps its why sentence and adds the reason and the invitation", () => {
    const html = box(state({ waypointOffer: changed("reached") }));
    const text = plain(html);
    expect(text).toContain(`${REACHED_WHY} ${TC_REACHED} ${DISCUSS} Walk each morning`);
    expect(buttons(html)).toEqual([{ label: "Yes, mark it Reached", disabled: true }, { label: "Not yet", disabled: false }]);
    expect(described(html)).toBe(TARGET);
  });
  it("beside the refused-answer sentence, the reason is not repeated; the invitation follows that sentence", () => {
    const html = box(state({ waypointOffer: changed("change", { typedAnswerRefusal: "target_changed" }) }));
    const text = plain(html);
    expect(text).not.toContain(TC_RIGHT);
    expect(text).not.toContain(CHANGE_WHY);
    expect(text).toContain(`${S1} ${DISCUSS}`);
    expect(text.split(DISCUSS)).toHaveLength(2);
    expect(described(html)).toBe(REFUSAL);
    expect(text).toContain("When offered Walk before work Proposed Walk before breakfast");
  });
  it("shows the invitation only while a message can be sent; the reason stays", () => {
    for (const overrides of [{ held: true }, { followUpHeld: true }] as const) {
      const text = plain(box(state({ waypointOffer: changed("change") }), overrides));
      expect(text).toContain(TC_RIGHT);
      expect(text).not.toContain(DISCUSS);
    }
    const ended = plain(box(state({ sessionStatus: "ended", waypointOffer: changed("reached") }), { held: true }));
    expect(ended).toContain(TC_REACHED);
    expect(ended).not.toContain(DISCUSS);
  });
  it("leaves an unchanged waiting box as approved: why sentence, yes sentence and Now", () => {
    const text = plain(box(state({ waypointOffer: offer("change", { title: "Walk before breakfast each day" }) })));
    expect(text).toContain(`${CHANGE_WHY} Title: Now Walk each morning Proposed Walk before breakfast each day`);
    expect(text).toContain(CHANGE_YES);
    for (const absent of [TC_RIGHT, DISCUSS, "When offered"]) expect(text).not.toContain(absent);
  });
  it("shows the title label only when the offer proposes a new title", () => {
    expect(plain(box(state({ waypointOffer: offer("change") })))).not.toContain("Title:");
    expect(plain(box(state({ waypointOffer: offer("change", { title: "Walk before breakfast each day" }) })))).toContain("Title:");
  });
});
