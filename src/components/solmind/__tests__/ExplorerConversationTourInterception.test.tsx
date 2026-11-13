import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversationConnectedScreen, type ConnectedConversationActions,
  type ConnectedConversationView } from "../ExplorerConversationConnectedScreen";
import { ExplorerConversationTour } from "../ExplorerConversationTour";
import { cardState } from "../../../../tests/browser/connectedCardFixture";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[index], (next: unknown) => {
      hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next;
    }];
  },
  useRef: () => ({ current: null }),
  useEffect: () => {},
}));
type Props = { children?: ReactNode; choicesDismissed?: boolean; actions?: ConnectedConversationActions;
  onClose?: () => void; opener?: HTMLElement | null; onShowTour?: () => void };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("HTMLElement", class Element {});
  vi.stubGlobal("document", { activeElement: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("Fixed tour choice interception", () => {
  function setup(overrides: Partial<ConnectedConversationView> = {},
    stateOverrides: Partial<NonNullable<ConnectedConversationView["state"]>> = {}) {
    const saved = cardState({ providerState: "available", compassSuggestionReplies: "available" });
    const state = { ...saved, messages: [...saved.messages.slice(0, -1), {
      ...saved.messages.at(-1)!, choices: [{ label: "Show me around" }, { label: "I have a question" }],
    }], ...stateOverrides };
    const view: ConnectedConversationView = { state, sendSequence: 0, busy: false, statusText: "", assistance: null,
      awaitingReply: false,
      sendingMessage: null,
      sendingFromComposer: false,
      errorMessage: null, signInRequired: false, uncertain: false, reloadAvailable: true, draft: "My draft", draftError: "",
      endReviewOpen: false, staleEndReview: false, ended: false, endBlocked: false, held: false, sendUnavailable: false,
      atMessageCapacity: false, ...overrides };
    const actions: ConnectedConversationActions = { onReload: vi.fn(), onRetry: vi.fn(), onDraftChange: vi.fn(),
      onSend: vi.fn(), onReviewEnd: vi.fn(), onConfirmEnd: vi.fn(), onKeepOpen: vi.fn(), onCommand: vi.fn(), onReplyChoice: vi.fn() };
    const render = () => {
      hooks.cursor = 0;
      return ExplorerConversationConnectedScreen({ view, actions, composerRef: { current: null }, headingRef: { current: null } });
    };
    const choose = (label: string) => elements(render()).find(element => element.props.choicesDismissed !== undefined)!
      .props.actions!.onReplyChoice(label);
    return { render, choose, actions, view };
  }

  it("opens locally before Send, preserves its opener and draft, and closes with no request", () => {
    class Element { isConnected = true; focus = vi.fn(); }
    const opener = new Element();
    vi.stubGlobal("HTMLElement", Element);
    vi.stubGlobal("document", { activeElement: opener });
    const f = setup();
    f.choose("Show me around");
    const tour = elements(f.render()).find(element => element.type === ExplorerConversationTour);
    expect(tour).toBeDefined();
    expect(tour!.props.opener).toBe(opener);
    tour!.props.onClose!();
    expect(elements(f.render()).some(element => element.type === ExplorerConversationTour)).toBe(false);
    expect(f.view.draft).toBe("My draft");
    expect(f.view.sendSequence).toBe(0);
    for (const action of Object.values(f.actions)) expect(action).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([{ held: true }, { sendUnavailable: true }, { atMessageCapacity: true }])(
    "opens the shown local tour despite Send gates while other choices stay gated: %j", overrides => {
      const f = setup(overrides);
      f.choose("I have a question");
      expect(elements(f.render()).some(element => element.type === ExplorerConversationTour)).toBe(false);
      f.choose("Show me around");
      expect(elements(f.render()).some(element => element.type === ExplorerConversationTour)).toBe(true);
      expect(f.view.draft).toBe("My draft");
      expect(f.view.sendSequence).toBe(0);
      for (const action of Object.values(f.actions)) expect(action).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

  it.each(["support", "adult_policy", "unavailable"] as const)("does not invent a tour offer when choices are hidden: %s", availability => {
    const f = setup({}, { compassSuggestionReplies: availability });
    f.choose("Show me around");
    expect(elements(f.render()).some(element => element.type === ExplorerConversationTour)).toBe(false);
    for (const action of Object.values(f.actions)) expect(action).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens from the welcome's Show me around button in a new conversation, with no message, request or AI call", () => {
    class Element { isConnected = true; focus = vi.fn(); }
    const opener = new Element();
    vi.stubGlobal("HTMLElement", Element);
    vi.stubGlobal("document", { activeElement: opener });
    const f = setup({ sendUnavailable: true }, { conversationId: null, revision: 0, messages: [], sessionStatus: null });
    elements(f.render()).find(element => element.props.onShowTour !== undefined)!.props.onShowTour!();
    const tour = elements(f.render()).find(element => element.type === ExplorerConversationTour);
    expect(tour).toBeDefined();
    expect(tour!.props.opener).toBe(opener);
    expect(f.view.draft).toBe("My draft");
    expect(f.view.sendSequence).toBe(0);
    for (const action of Object.values(f.actions)) expect(action).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still sends another exact offered choice through the controller", () => {
    const f = setup();
    f.choose("I have a question");
    expect(f.actions.onReplyChoice).toHaveBeenCalledExactlyOnceWith("I have a question");
    expect(elements(f.render()).some(element => element.type === ExplorerConversationTour)).toBe(false);
  });
});
