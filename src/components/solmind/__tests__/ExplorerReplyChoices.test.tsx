import { Children, createElement, createRef, isValidElement, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExplorerReplyChoices } from "../ExplorerReplyChoices";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const POINT = "40000000-0000-4000-8000-000000000001";
const CHOICES = ["Show me around", "I have a question", "Let's begin"];

function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return {
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 3,
    pendingTurn: false,
    turnedDownLimitReached: false,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: "A synthetic first message", createdAt: "2026-11-05T08:00:00.000Z" },
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic reply", createdAt: "2026-11-05T08:00:01.000Z",
        choices: CHOICES.map(label => ({ label })) },
    ],
    compassItems: [],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    waypointDraft: null,
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

function plain(html: string) {
  return html.replace(/<[^>]*>/g, " ").replaceAll("&#x27;", "'").replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replace(/\s+/g, " ").trim();
}

function transcriptItems(html: string) {
  const list = /<ol aria-label="Saved conversation"[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
  return [...list.matchAll(/<li\b[\s\S]*?<\/li>/g)].map(match => match[0]);
}

function choiceGroup(html: string) {
  return /<div aria-label="Suggested replies"[^>]*role="group"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[0] ?? null;
}

function choiceButtons(html: string) {
  const group = choiceGroup(html) ?? "";
  return [...group.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(match => ({ label: plain(match[2]), disabled: /\bdisabled=""/.test(match[1]) }))
    .filter(button => button.label !== "Something else");
}

describe("reply choices as buttons on the connected screen (round r2)", () => {
  it("shows the latest reply's choices as working buttons inside that message's list item", () => {
    const items = transcriptItems(renderScreen());
    expect(items).toHaveLength(2);
    expect(choiceGroup(items[0])).toBeNull();
    expect(choiceButtons(items[1])).toEqual(CHOICES.map(label => ({ label, disabled: false })));
    const group = choiceGroup(items[1]) ?? "";
    expect(group).toContain('data-reply-choices=""');
    expect(group).not.toContain("aria-disabled");
    expect(group).not.toContain("data-build-note");
    expect(group).not.toContain("data-removal-marker");
    expect(group).toContain('type="button"');
  });

  it("uses the existing choice-button look", () => {
    const group = choiceGroup(transcriptItems(renderScreen())[1]) ?? "";
    for (const name of ["rounded-2xl", "border-stone-700", "hover:border-amber-300/40", "flex-wrap"]) expect(group).toContain(name);
  });

  it("shows no choices under an older reply or once an Explorer message follows", () => {
    const original = state();
    const later = state({ messages: [...original.messages,
      { id: "20000000-0000-4000-8000-000000000002", role: "explorer", body: "Show me around", createdAt: "2026-11-05T08:01:00.000Z" }] });
    const html = renderScreen(later);
    expect(choiceGroup(html)).toBeNull();
    expect(transcriptItems(html)).toHaveLength(3);
  });

  it.each([
    ["the conversation is busy or held", { held: true }],
    ["the Virtual Guide is unavailable", { sendUnavailable: true }],
    ["the saved-message capacity is reached", { atMessageCapacity: true }],
  ] as const)("disables every choice when %s", (_name, overrides) => {
    expect(choiceButtons(renderScreen(state(), overrides))).toEqual(CHOICES.map(label => ({ label, disabled: true })));
  });

  it.each(["support", "adult_policy", "unavailable", undefined] as const)("shows no choices when reply availability is %s", availability => {
    expect(choiceGroup(renderScreen(state({ compassSuggestionReplies: availability })))).toBeNull();
  });

  it("shows no choices after the conversation ended or while a turn is pending", () => {
    expect(choiceGroup(renderScreen(state({ sessionStatus: "ended" }), { ended: true, held: true }))).toBeNull();
    expect(choiceGroup(renderScreen(state({ pendingTurn: true }), { held: true }))).toBeNull();
  });

  it("sits after the Compass suggestion replies when the same reply also suggested a point", () => {
    const next = state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
      label: "Making time to rest", formation: "forming" }] });
    const item = transcriptItems(renderScreen(next))[1];
    const replies = item.indexOf('aria-label="Reply to Compass suggestion: Making time to rest"');
    const choices = item.indexOf('aria-label="Suggested replies"');
    expect(replies).toBeGreaterThan(-1);
    expect(choices).toBeGreaterThan(replies);
  });
});

function buttonElements(node: ReactNode): ReactElement<ComponentProps<"button">>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === "button") return [child as ReactElement<ComponentProps<"button">>];
    return buttonElements(child.props.children);
  });
}

describe("Something else beside saved reply choices", () => {
  it("shows exactly three sending choices followed by a visually distinct Something else button", () => {
    const group = choiceGroup(renderScreen()) ?? "";
    const buttons = [...group.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(buttons.map(button => plain(button[2]))).toEqual([...CHOICES, "Something else"]);
    const other = buttons.at(-1)!;
    expect(other[1]).toContain('type="button"');
    expect(other[1]).not.toContain("border-stone-700");
    expect(other[1]).not.toContain("rounded-2xl");
    expect(other[1]).not.toContain("aria-disabled");
    expect(group).not.toContain("data-build-note");
    expect(group).not.toContain("data-removal-marker");
    expect(renderScreen()).not.toContain('id="conversation-calm-prompt"');
  });

  it.each([
    ["held", { held: true }],
    ["unavailable", { sendUnavailable: true }],
    ["full", { atMessageCapacity: true }],
  ] as const)("disables Something else alongside the choices when %s", (_name, overrides) => {
    const group = choiceGroup(renderScreen(state(), overrides)) ?? "";
    const other = [...group.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(button => plain(button[2]) === "Something else");
    expect(other).toBeDefined();
    expect(other![1]).toContain('disabled=""');
  });

  it("does not add Something else to a Compass suggestion reply row", () => {
    const original = state();
    const next = state({
      messages: original.messages.map(message => ({ ...message, choices: undefined })),
      compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
        label: "Making time to rest", formation: "forming" }],
    });
    const html = renderScreen(next);
    expect(html).toContain('aria-label="Reply to Compass suggestion: Making time to rest"');
    expect(html).not.toContain("Something else");
    expect(choiceGroup(html)).toBeNull();
  });

  it("keeps Something else outside the Compass row when both kinds of replies appear", () => {
    const next = state({ compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
      label: "Making time to rest", formation: "forming" }] });
    const item = transcriptItems(renderScreen(next))[1];
    const compass = /<div[^>]*aria-label="Reply to Compass suggestion: Making time to rest"[^>]*>[\s\S]*?<\/div>/.exec(item)?.[0] ?? "";
    expect(compass).toContain("That&#x27;s right");
    expect(compass).not.toContain("Something else");
    expect(choiceGroup(item)).toContain("Something else");
  });

  it("dispatches only the local Something else callback, without a send or request", () => {
    const onChoose = vi.fn();
    const onSomethingElse = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_request"); });
    try {
      const tree = ExplorerReplyChoices({ state: state(), messageId: GUIDE_MESSAGE,
        disabled: false, onChoose, onSomethingElse });
      const other = buttonElements(tree).find(button => button.props.children === "Something else");
      expect(other?.props.onClick).toBeTypeOf("function");
      other?.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
      expect(onSomethingElse).toHaveBeenCalledOnce();
      expect(onChoose).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it("dispatches one exact choice label and retains focus on its saved message", () => {
    const onChoose = vi.fn();
    const onSomethingElse = vi.fn();
    const focus = vi.fn();
    const tree = ExplorerReplyChoices({ state: state(), messageId: GUIDE_MESSAGE,
      disabled: false, onChoose, onSomethingElse });
    const choice = buttonElements(tree)[1];
    choice.props.onClick?.({ currentTarget: { closest: () => ({ focus }) } } as unknown as MouseEvent<HTMLButtonElement>);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("I have a question");
    expect(onSomethingElse).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledOnce();
  });
});
