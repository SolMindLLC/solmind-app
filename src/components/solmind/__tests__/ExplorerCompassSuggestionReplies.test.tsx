import { Children, createElement, createRef, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import { ExplorerCompassSuggestionReplies, suggestionReplyButtons } from "../ExplorerCompassSuggestionReplies";
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
    awaitingReply: false,
    sendingMessage: null,
    sendingFromComposer: false,
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

describe("retired Compass suggestion replies", () => {
  it.each(["available", "support", "adult_policy", "unavailable", undefined] as const)(
    "renders no Compass controls or reasons when availability is %s", compassSuggestionReplies => {
      for (const turnedDownLimitReached of [false, true]) {
        for (const held of [false, true]) {
          expect(renderRows(state({ compassSuggestionReplies, turnedDownLimitReached }), GUIDE_MESSAGE, held)).toBe("");
        }
      }
    });
  it.each(["forming", "saved", undefined] as const)("keeps %s history without reply rows or a forming card treatment", formation => {
    const current = state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE,
      wordingMessageId: GUIDE_MESSAGE, label: LABEL, formation }] });
    const items = transcriptItems(renderScreen(current));
    expect(items).toHaveLength(2);
    expect(items.every(item => buttons(item).length === 0)).toBe(true);
    expect(renderScreen(current)).not.toContain("Reply to Compass suggestion:");
    expect(renderScreen(current)).not.toContain(">Forming<");
    expect(renderRows(current)).toBe("");
  });
  it("keeps multiple and refined legacy records out of all reply rows", () => {
    const original = state();
    const current = state({ messages: [...original.messages, { id: NEXT_GUIDE_MESSAGE, role: "virtualGuide",
      body: "A later synthetic reply", createdAt: "2026-11-04T18:01:01.000Z" }],
      compassItems: [{ ...original.compassItems[0], wordingMessageId: NEXT_GUIDE_MESSAGE },
        { ...original.compassItems[0], id: OTHER_POINT, label: "Another topic" }] });
    const items = transcriptItems(renderScreen(current));
    expect(items).toHaveLength(3);
    expect(items.every(item => buttons(item).length === 0)).toBe(true);
    expect(renderRows(current)).toBe("");
  });
  it("never dispatches a Compass response, including missing, merged and ended records", () => {
    const original = state();
    for (const current of [original, state({ messages: [] }), state({ sessionStatus: "ended" }),
      state({ compassItems: [{ ...original.compassItems[0], mergedIntoItemId: OTHER_POINT }] }),
      state({ compassItems: [{ ...original.compassItems[0], wordingMessageId: EXPLORER_MESSAGE }] })]) {
      const onCommand = vi.fn();
      expect(ExplorerCompassSuggestionReplies({ state: current, messageId: GUIDE_MESSAGE,
        held: false, followUpHeld: false, onCommand })).toBeNull();
      expect(onCommand).not.toHaveBeenCalled();
    }
  });
  it("keeps the shared Waypoint buttons, gates, exact replies and focus behavior", () => {
    for (const held of [false, true]) {
      for (const followUpHeld of [false, true]) {
        const onReply = vi.fn();
        const tree = suggestionReplyButtons({ held, followUpHeld, onReply });
        expect(buttons(renderToStaticMarkup(tree))).toEqual(LABELS.map((label, index) =>
          ({ label, disabled: held || (index > 0 && followUpHeld) })));
        for (const [index, button] of buttonElements(tree).entries()) {
          const focus = vi.fn();
          button.props.onClick?.({ currentTarget: { closest: () => ({ focus }) } } as unknown as MouseEvent<HTMLButtonElement>);
          expect(onReply).toHaveBeenLastCalledWith(["right", "close", "not_it"][index]);
          expect(focus).toHaveBeenCalledOnce();
        }
      }
    }
  });
});
