import { Children, createElement, createRef, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import { ExplorerCompassSuggestionReplies } from "../ExplorerCompassSuggestionReplies";
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const NEXT_GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000002";
const POINT = "40000000-0000-4000-8000-000000000001";
const OTHER_POINT = "40000000-0000-4000-8000-000000000002";
const LABEL = "Making time to rest";
const LABELS = ["That's right", "Close, not quite", "That's not it"];
const LIMIT_REASON = 'Because this conversation already keeps the most turned-down suggestions it can, "That\'s not it" is not available here. You can still choose another reply or type what you would change.';

function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 5,
    pendingTurn: false,
    turnedDownLimitReached: false, waypointDraft: null,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: "A synthetic question", createdAt: "2026-11-04T18:00:00.000Z" },
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic suggestion reply", createdAt: "2026-11-04T18:00:01.000Z" },
    ],
    compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
      label: LABEL, formation: "forming" }],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    route: [],
    sessionStatus: "active",
    ending: null,
    ...overrides,
  };
}

function view(next: ExplorerConversationState, overrides: Partial<ConnectedConversationView> = {}): ConnectedConversationView {
  return {
    state: next,
    sendSequence: 0,
    busy: false,
    statusText: "",
    assistance: null,
    errorMessage: null,
    signInRequired: false,
    uncertain: false,
    reloadAvailable: true,
    draft: "",
    draftError: "",
    endReviewOpen: false,
    staleEndReview: false,
    ended: false,
    endBlocked: false,
    held: false,
    sendUnavailable: false,
    atMessageCapacity: false,
    ...overrides,
  };
}

const actions: ConnectedConversationActions = {
  onReload: () => {},
  onRetry: () => {},
  onDraftChange: () => {},
  onSend: () => {},
  onReviewEnd: () => {},
  onConfirmEnd: () => {},
  onKeepOpen: () => {},
  onCommand: () => {},
  onReplyChoice: () => {},
};

function renderScreen(next = state(), overrides: Partial<ConnectedConversationView> = {}) {
  return renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
    view: view(next, overrides), actions,
    composerRef: createRef<HTMLTextAreaElement>(), headingRef: createRef<HTMLHeadingElement>(),
  }));
}

function renderRows(next = state(), messageId = GUIDE_MESSAGE, held = false, followUpHeld = false) {
  return renderToStaticMarkup(createElement(ExplorerCompassSuggestionReplies, {
    state: next, messageId, held, followUpHeld, onCommand: () => {},
  }));
}

function plain(html: string) {
  return html.replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'").replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replace(/\s+/g, " ").trim();
}

function buttons(html: string) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(match => ({ label: plain(match[2]), disabled: /\bdisabled=""/.test(match[1]) }));
}

function transcriptItems(html: string) {
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

describe("S6a Compass suggestion replies", () => {
  it("keeps the turned-down reply disabled in its named group with one exact plain-text reason below the buttons", () => {
    const items = transcriptItems(renderScreen(state({ turnedDownLimitReached: true })));
    expect(items).toHaveLength(2);
    expect(buttons(items[1])).toEqual([
      { label: "That's right", disabled: false },
      { label: "Close, not quite", disabled: false },
      { label: "That's not it", disabled: true },
    ]);
    expect(items[1]).toContain(`aria-label="Reply to Compass suggestion: ${LABEL}"`);
    expect(items[1]).toContain('role="group"');
    const descriptionId = /aria-describedby="([^"]+)"/.exec(items[1])?.[1];
    expect(descriptionId).toBeTruthy();
    const description = [...items[1].matchAll(/<p\b[^>]*id="([^"]+)"[^>]*>([^<]*)<\/p>/g)]
      .find(match => match[1] === descriptionId);
    expect(description?.[1]).toBe(descriptionId);
    expect(plain(description?.[2] ?? "")).toBe(LIMIT_REASON);
    expect(plain(items[1]).split(LIMIT_REASON)).toHaveLength(2);
    expect(items[1].indexOf(description?.[0] ?? "")).toBeGreaterThan(items[1].lastIndexOf("</button>"));
    expect(items[1]).not.toContain("data-build-note");
    expect(items[1]).not.toContain("data-removal-marker");
    expect(renderRows()).not.toContain("aria-describedby");
    expect(plain(renderRows())).not.toContain(LIMIT_REASON);
  });

  it.each(["right", "close"] as const)("keeps %s available and dispatches its selected reply at the turned-down limit", response => {
    const onCommand = vi.fn();
    const rows = ExplorerCompassSuggestionReplies({
      state: state({ turnedDownLimitReached: true }), messageId: GUIDE_MESSAGE,
      held: false, followUpHeld: false, onCommand,
    });
    const label = response === "right" ? "That's right" : "Close, not quite";
    const button = buttonElements(rows).find(element => element.props.children === label);
    expect(button?.props.disabled).toBe(false);
    expect(button?.props.onClick).toBeTypeOf("function");
    button?.props.onClick?.({ currentTarget: { closest: () => null } } as unknown as MouseEvent<HTMLButtonElement>);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "respond_compass_suggestion", itemId: POINT, response });
  });

  it("keeps the limit reason separately associated once with each suggestion row", () => {
    const original = state();
    const html = renderRows(state({ turnedDownLimitReached: true, compassItems: [...original.compassItems,
      { ...original.compassItems[0], id: OTHER_POINT, label: "Asking for help" }] }));
    const descriptionIds = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(match => match[1]);
    expect(descriptionIds).toHaveLength(2);
    expect(new Set(descriptionIds).size).toBe(2);
    for (const id of descriptionIds) expect(html.split(`id="${id}"`)).toHaveLength(2);
    expect(plain(html).split(LIMIT_REASON)).toHaveLength(3);
    expect(buttons(html).filter(button => button.disabled).map(button => button.label)).toEqual(["That's not it", "That's not it"]);
  });

  it("preserves existing holds and policy reasons at the turned-down limit", () => {
    const limited = state({ turnedDownLimitReached: true });
    for (const html of [renderRows(limited, GUIDE_MESSAGE, true), renderRows({ ...limited, pendingTurn: true })]) {
      expect(buttons(html)).toEqual(LABELS.map(label => ({ label, disabled: true })));
    }
    expect(buttons(renderRows(limited, GUIDE_MESSAGE, false, true))).toEqual([
      { label: "That's right", disabled: false },
      { label: "Close, not quite", disabled: true },
      { label: "That's not it", disabled: true },
    ]);
    for (const availability of ["support", "adult_policy", "unavailable"] as const) {
      const html = renderRows({ ...limited, compassSuggestionReplies: availability });
      expect(buttons(html)).toEqual([]);
      expect(plain(html)).not.toContain(LIMIT_REASON);
    }
    expect(renderRows({ ...limited, sessionStatus: "ended" })).toBe("");
  });

  it("keeps one row of three replies inside the suggesting message's existing list item", () => {
    const items = transcriptItems(renderScreen());
    expect(items).toHaveLength(2);
    expect(buttons(items[0])).toEqual([]);
    expect(buttons(items[1])).toEqual(LABELS.map(label => ({ label, disabled: false })));
    expect(items[1]).toContain(`aria-label="Reply to Compass suggestion: ${LABEL}"`);
    expect(items[1]).toContain('role="group"');
    expect(items[1]).not.toContain("data-build-note");
    expect(items[1]).not.toContain("data-removal-marker");
  });

  it("puts multiple suggestions in separate groups in the same message without extra list items", () => {
    const original = state();
    const next = state({ compassItems: [...original.compassItems,
      { id: OTHER_POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
        label: "Asking for help", formation: "forming" }] });
    const items = transcriptItems(renderScreen(next));
    expect(items).toHaveLength(2);
    expect(items[1].match(/role="group"/g)).toHaveLength(2);
    expect(buttons(items[1]).map(button => button.label)).toEqual([...LABELS, ...LABELS]);
    expect(items[1]).toContain('aria-label="Reply to Compass suggestion: Asking for help"');
  });

  it("moves a refined point's row only to the latest message supplying its wording", () => {
    const original = state();
    const next = state({
      messages: [...original.messages, { id: NEXT_GUIDE_MESSAGE, role: "virtualGuide",
        body: "A synthetic refinement", createdAt: "2026-11-04T18:01:01.000Z" }],
      compassItems: [{ ...original.compassItems[0], wordingMessageId: NEXT_GUIDE_MESSAGE, label: "Rest without pressure" }],
    });
    const items = transcriptItems(renderScreen(next));
    expect(items).toHaveLength(3);
    expect(buttons(items[1])).toEqual([]);
    expect(buttons(items[2]).map(button => button.label)).toEqual(LABELS);
    expect(items[2]).toContain('aria-label="Reply to Compass suggestion: Rest without pressure"');
    expect(plain(items[1])).not.toContain("Rest without pressure");
  });

  it("keeps each unresolved point on its own latest wording message even after another point is suggested", () => {
    const original = state();
    const next = state({
      messages: [...original.messages, { id: NEXT_GUIDE_MESSAGE, role: "virtualGuide",
        body: "A different synthetic suggestion", createdAt: "2026-11-04T18:01:01.000Z" }],
      compassItems: [...original.compassItems,
        { id: OTHER_POINT, sourceMessageId: NEXT_GUIDE_MESSAGE, wordingMessageId: NEXT_GUIDE_MESSAGE,
          label: "Asking for help", formation: "forming" }],
    });
    const items = transcriptItems(renderScreen(next));
    expect(buttons(items[1]).map(button => button.label)).toEqual(LABELS);
    expect(buttons(items[2]).map(button => button.label)).toEqual(LABELS);
  });

  it.each(["saved", undefined] as const)("shows no reply row for %s point formation", formation => {
    expect(renderRows(state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, label: LABEL, formation }] }))).toBe("");
  });

  it("shows no row for combined-away points, missing wording messages or Explorer wording messages", () => {
    const original = state();
    expect(renderRows(state({ compassItems: [{ ...original.compassItems[0], mergedIntoItemId: OTHER_POINT }] }))).toBe("");
    expect(renderRows(state({ messages: [] }))).toBe("");
    expect(renderRows(state({ compassItems: [{ ...original.compassItems[0], wordingMessageId: EXPLORER_MESSAGE }] }), EXPLORER_MESSAGE)).toBe("");
  });

  it("shows no row for a retained forming point without a wording pointer instead of falling back to its original source", () => {
    const next = state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, label: LABEL, formation: "forming" }] });
    expect(renderRows(next)).toBe("");
    expect(buttons(transcriptItems(renderScreen(next))[1])).toEqual([]);
    expect(renderScreen(next)).toContain("Forming");
  });

  it.each([
    ["support", "To keep this conversation focused on support, suggestion replies are not available in this conversation."],
    ["adult_policy", "Because SolMind is for adults, suggestion replies are unavailable in this conversation."],
    ["unavailable", "To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings."],
  ] as const)("replaces all rows in one message with one reason when availability is %s", (availability, reason) => {
    const original = state();
    const html = renderRows(state({ compassSuggestionReplies: availability,
      compassItems: [...original.compassItems, { ...original.compassItems[0], id: OTHER_POINT, label: "Asking for help" }] }));
    expect(buttons(html)).toEqual([]);
    expect(plain(html)).toBe(reason);
    expect(html).not.toContain("data-build-note");
  });

  it("fails closed without availability and does not invent a reason when there is no suggestion", () => {
    expect(buttons(renderRows(state({ compassSuggestionReplies: undefined })))).toEqual([]);
    expect(plain(renderRows(state({ compassSuggestionReplies: undefined })))).toBe(
      "To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings.",
    );
    expect(renderRows(state({ compassSuggestionReplies: "support", compassItems: [] }))).toBe("");
  });

  it("disables every response during a command hold or saved pending turn", () => {
    for (const html of [renderRows(state(), GUIDE_MESSAGE, true), renderRows(state({ pendingTurn: true }))]) {
      expect(buttons(html)).toEqual(LABELS.map(label => ({ label, disabled: true })));
    }
    for (const overrides of [{ held: true, busy: true }, { held: true, uncertain: true }, { held: true, endReviewOpen: true }]) {
      expect(buttons(transcriptItems(renderScreen(state(), overrides))[1])).toEqual(LABELS.map(label => ({ label, disabled: true })));
    }
  });

  it("allows deterministic confirmation while follow-up Sends are unavailable or at capacity", () => {
    for (const overrides of [{ sendUnavailable: true }, { atMessageCapacity: true }]) {
      expect(buttons(transcriptItems(renderScreen(state(), overrides))[1])).toEqual([
        { label: "That's right", disabled: false },
        { label: "Close, not quite", disabled: true },
        { label: "That's not it", disabled: true },
      ]);
    }
  });

  it("hides every response for an ended conversation", () => {
    expect(renderRows(state({ sessionStatus: "ended" }))).toBe("");
    expect(buttons(transcriptItems(renderScreen(state({ sessionStatus: "ended" }), { ended: true, held: true }))[1])).toEqual([]);
  });

  it("shows confirmation as an ordinary saved card point and removes a rejected point from the card", () => {
    const original = state();
    const forming = renderScreen(original);
    expect(forming).toContain("Forming");
    const confirmed = renderScreen(state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE,
      label: LABEL, formation: "saved" }] }));
    expect(buttons(transcriptItems(confirmed)[1])).toEqual([]);
    expect(plain(confirmed)).toContain(LABEL);
    expect(confirmed).not.toContain(">Forming<");
    const rejected = renderScreen(state({ compassItems: [] }));
    expect(buttons(transcriptItems(rejected)[1])).toEqual([]);
    expect(plain(rejected)).not.toContain(LABEL);
  });

  it("renders suggestion wording as text in both the row label and its accessible name", () => {
    const original = state();
    const html = renderRows(state({ compassItems: [{ ...original.compassItems[0], label: '<script>"quoted" & calm</script>' }] }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;&quot;quoted&quot; &amp; calm&lt;/script&gt;");
    expect(buttons(html).map(button => button.label)).toEqual(LABELS);
  });
});
