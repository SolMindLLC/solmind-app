import { Children, createElement, createRef, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cardState, cardStateAtWaypointLimit } from "../../../../tests/browser/connectedCardFixture";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { ExplorerWaypointDraft } from "../ExplorerWaypointDraft";
import { ExplorerConversationConnectedScreen, type ConnectedConversationView } from "../ExplorerConversationConnectedScreen";

const DRAFT_ID = "80000000-0000-4000-8000-000000000001";
const TITLE = "Make room for a calm conversation";
const LABELS = ["That's right", "Close, not quite", "That's not it"];
const LIMIT_REASON = 'Because you already have the most Waypoints SolMind keeps, "That\'s right" is not available here. You can still choose another reply or type what you would change.';
const original = cardState();
const MESSAGE = original.messages[3].id;
const NEXT_MESSAGE = "30000000-0000-4000-8000-000000000099";
const draft = { id: DRAFT_ID, title: TITLE, destination: "Talk with my sister without rushing",
  whyItMatters: "I want us both to feel heard", arrivalSignal: "We finish the talk having heard each other",
  suggestionMessageId: MESSAGE };
const state = (overrides: Partial<ExplorerConversationState> = {}) => cardState({
  providerState: "available", compassSuggestionReplies: "available", compassItems: [],
  priorityId: null, attentionId: null, waypoints: [], waypointDraft: draft, ...overrides,
});
const actions = { onReload: () => {}, onRetry: () => {}, onDraftChange: () => {}, onSend: () => {},
  onReviewEnd: () => {}, onConfirmEnd: () => {}, onKeepOpen: () => {}, onCommand: () => {}, onReplyChoice: () => {} };
function screen(next = state(), overrides: Partial<ConnectedConversationView> = {}) {
  return renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
    view: { state: next, busy: false, sendSequence: 0, statusText: "", assistance: null, errorMessage: null,
      signInRequired: false, uncertain: false, reloadAvailable: true, draft: "", draftError: "",
      endReviewOpen: false, staleEndReview: false, ended: false, endBlocked: false, held: false,
      sendUnavailable: false, atMessageCapacity: false, ...overrides }, actions,
    composerRef: createRef<HTMLTextAreaElement>(), headingRef: createRef<HTMLHeadingElement>(),
  }));
}
function card(next = state(), messageId = MESSAGE, held = false, followUpHeld = false) {
  return renderToStaticMarkup(createElement(ExplorerWaypointDraft,
    { state: next, messageId, held, followUpHeld, onCommand: () => {} }));
}
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'")
  .replaceAll("&quot;", '"').replace(/\s+/g, " ").trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(match => ({ label: plain(match[2]), disabled: /\bdisabled=""/.test(match[1]) }));
function transcript(html: string) {
  const list = /<ol aria-label="Saved conversation"[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
  return [...list.matchAll(/<li\b[\s\S]*?<\/li>/g)].map(match => match[0]);
}
function buttonElements(node: ReactNode): ReactElement<ComponentProps<"button">>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === "button") return [child as ReactElement<ComponentProps<"button">>];
    return buttonElements(child.props.children);
  });
}

describe("S7a private forming Waypoint card", () => {
  it("shows all four stored fields and one reply row only under its suggesting saved Virtual Guide message", () => {
    const items = transcript(screen());
    expect(items).toHaveLength(original.messages.length);
    for (const item of items.slice(0, -1)) expect(item).not.toContain("Reply to Waypoint suggestion:");
    const item = items.at(-1)!;
    expect(item).toContain(`aria-label="Reply to Waypoint suggestion: ${TITLE}"`);
    expect(item).toContain('role="group"');
    expect(item).toContain("border-dashed");
    for (const text of [TITLE, "Forming", "Where you're heading:", draft.destination,
      "Why it matters:", draft.whyItMatters, "Reached looks like:", draft.arrivalSignal]) expect(plain(item)).toContain(text);
    expect(buttons(item)).toEqual(LABELS.map(label => ({ label, disabled: false })));
    expect(item).not.toContain("data-build-note");
    expect(item).not.toContain("data-removal-marker");
  });

  it("moves refined wording to the latest saved suggestion and never uses the original message as fallback", () => {
    const next = state({ messages: [...original.messages, { id: NEXT_MESSAGE, role: "virtualGuide",
      body: "Synthetic refined wording", createdAt: "2026-11-05T15:00:00Z" }],
    waypointDraft: { ...draft, title: "A calmer talk", suggestionMessageId: NEXT_MESSAGE } });
    const items = transcript(screen(next));
    expect(items[3]).not.toContain("Reply to Waypoint suggestion:");
    expect(items[4]).toContain('aria-label="Reply to Waypoint suggestion: A calmer talk"');
    expect(buttons(items[4])).toHaveLength(3);
    expect(card(state({ waypointDraft: { ...draft, suggestionMessageId: original.messages[0].id } }), original.messages[0].id)).toBe("");
    expect(card(state({ messages: [] }))).toBe("");
    expect(card(state({ waypointDraft: null }))).toBe("");
  });

  it.each(["support", "adult_policy", "unavailable", undefined] as const)("reuses the exact S6a policy sentence for %s", availability => {
    const text = card(state({ compassSuggestionReplies: availability }));
    const reason = availability === "support"
      ? "To keep this conversation focused on support, suggestion replies are not available in this conversation."
      : availability === "adult_policy"
        ? "Because SolMind is for adults, suggestion replies are unavailable in this conversation."
        : "To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings.";
    expect(buttons(text)).toEqual([]);
    expect(plain(text)).toContain(reason);
    expect(plain(text)).toContain(TITLE);
  });

  it("retains the saved forming wording read-only after End", () => {
    const text = card(state({ sessionStatus: "ended" }));
    expect(plain(text)).toContain(TITLE);
    expect(plain(text)).toContain(draft.arrivalSignal);
    expect(buttons(text)).toEqual([]);
    expect(text).not.toContain("suggestion replies are");
  });

  it("holds all replies during pending or busy work and only follow-up replies when Send is unavailable", () => {
    for (const text of [card(state(), MESSAGE, true), card(state({ pendingTurn: true }))]) {
      expect(buttons(text)).toEqual(LABELS.map(label => ({ label, disabled: true })));
    }
    expect(buttons(card(state(), MESSAGE, false, true))).toEqual([
      { label: LABELS[0], disabled: false }, { label: LABELS[1], disabled: true }, { label: LABELS[2], disabled: true },
    ]);
    for (const view of [{ held: true, uncertain: true }, { held: true, endReviewOpen: true }, { held: true, busy: true }]) {
      expect(buttons(transcript(screen(state(), view)).at(-1)!)).toEqual(LABELS.map(label => ({ label, disabled: true })));
    }
    for (const view of [{ sendUnavailable: true }, { atMessageCapacity: true }]) {
      expect(buttons(transcript(screen(state(), view)).at(-1)!).filter(button => button.disabled).map(button => button.label)).toEqual(LABELS.slice(1));
    }
  });

  it("does not confuse Compass rejection capacity with Waypoint capacity and blocks incomplete confirmation", () => {
    expect(buttons(card(state({ turnedDownLimitReached: true })))).toEqual(LABELS.map(label => ({ label, disabled: false })));
    for (const field of ["title", "destination", "whyItMatters", "arrivalSignal"] as const) {
      const result = buttons(card(state({ waypointDraft: { ...draft, [field]: null } })));
      expect(result[0].disabled).toBe(true);
      expect(result.slice(1).every(button => button.disabled)).toBe(field === "title");
    }
  });

  it("holds only confirmation at the stored-row limit and describes the row once after its replies", () => {
    const waypoints = cardStateAtWaypointLimit().waypoints;
    const html = card(state({ waypoints }));
    expect(buttons(html)).toEqual([
      { label: LABELS[0], disabled: true }, { label: LABELS[1], disabled: false }, { label: LABELS[2], disabled: false },
    ]);
    expect(plain(html).split(LIMIT_REASON)).toHaveLength(2);
    expect(html).toContain(`aria-describedby="waypoint-suggestion-limit-${DRAFT_ID}"`);
    expect(html).toContain(`id="waypoint-suggestion-limit-${DRAFT_ID}"`);
    expect(plain(html).indexOf(LIMIT_REASON)).toBeGreaterThan(plain(html).indexOf(LABELS[2]));
    const belowLimit = card(state({ waypoints: waypoints.slice(0, -1) }));
    expect(buttons(belowLimit)).toEqual(LABELS.map(label => ({ label, disabled: false })));
    expect(plain(belowLimit)).not.toContain(LIMIT_REASON);
    for (const overrides of [{ sessionStatus: "ended" as const }, { compassSuggestionReplies: "support" as const }]) {
      const held = card(state({ waypoints, ...overrides }));
      expect(buttons(held)).toEqual([]);
      expect(plain(held)).not.toContain(LIMIT_REASON);
    }
  });

  it.each(["right", "close", "not_it"] as const)("dispatches only the selected %s answer and returns focus to its message", response => {
    const onCommand = vi.fn();
    const focus = vi.fn();
    const result = ExplorerWaypointDraft({ state: state(), messageId: MESSAGE, held: false, followUpHeld: false, onCommand });
    const index = ["right", "close", "not_it"].indexOf(response);
    const button = buttonElements(result)[index];
    button.props.onClick?.({ currentTarget: { closest: () => ({ focus }) } } as unknown as MouseEvent<HTMLButtonElement>);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "respond_waypoint_draft", draftId: DRAFT_ID, response });
    expect(focus).toHaveBeenCalledOnce();
  });

  it("shows an exact confirmed title as a closed row of the compact Waypoint list", () => {
    const html = screen(state({ waypointDraft: null, waypoints: [{ id: DRAFT_ID, title: TITLE,
      sourceMessageId: MESSAGE, destination: draft.destination, meaning: draft.whyItMatters,
      arrivalSignal: draft.arrivalSignal, status: "chosen" }] }));
    expect(html).not.toContain("Reply to Waypoint suggestion:");
    // Lane 8 (Paul's design approval, 2026-11-06 08:59:55 CST): the row shows the exact title and its stage; its
    // wording shows when the row is opened (tests/browser/explorerWaypointList.pw.ts).
    expect(html).toContain(`${TITLE}</span>`);
    expect(plain(html)).toContain("Formed");
    expect(html).toMatch(/aria-expanded="false"/);
  });

  it("escapes every stored field as text", () => {
    const html = card(state({ waypointDraft: { ...draft, title: "<script>title</script>",
      destination: "<script>destination</script>", whyItMatters: "<script>meaning</script>",
      arrivalSignal: "<script>arrival</script>" } }));
    expect(html).not.toContain("<script>");
    for (const field of ["title", "destination", "meaning", "arrival"]) expect(html).toContain(`&lt;script&gt;${field}&lt;/script&gt;`);
  });
});
