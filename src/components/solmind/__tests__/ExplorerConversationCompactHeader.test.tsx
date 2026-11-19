import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, createRef } from "react";
import type { ComponentType, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONNECTED_INTRO,
  type ConnectedStripExplanation,
} from "../../../lib/solmind/explorerConversationConnectedScreen";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";
import { NotConnectedProvider } from "../ExplorerConversationScreenNotYetImplemented";

// Compact header, step A (Paul's decisions, PRJ01-SPR002 decision record 2026-11-16 17:53:42 and 21:27:10 CST):
// what the screen draws for the strip, the explanations, the chat panel with its title band and the start
// marker, in every state of PROPOSAL_R3.md section 3. Server markup only; the browser suite
// (tests/browser/explorerCompactHeader.pw.ts) covers clicks, focus and scrolling. Invented content only.

type StripProps = { open: ConnectedStripExplanation; onToggle: (chosen: "privacy" | "help") => void };
const captured = vi.hoisted(() => ({ on: false, strip: null as unknown }));
// Capture the strip's element as the screen builds it, so it can be drawn again with an explanation open.
vi.mock("react/jsx-runtime", async original => {
  const actual = await original<typeof import("react/jsx-runtime")>();
  const capture = (element: ReactElement) => {
    if (captured.on && typeof element.type === "function" && element.type.name === "ConversationStrip") captured.strip = element;
    return element;
  };
  return {
    ...actual,
    jsx: (...args: Parameters<typeof actual.jsx>) => capture(actual.jsx(...args)),
    jsxs: (...args: Parameters<typeof actual.jsxs>) => capture(actual.jsxs(...args)),
  };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const actual = await original<typeof import("react/jsx-dev-runtime")>();
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const element = actual.jsxDEV(...args);
      if (captured.on && typeof element.type === "function" && element.type.name === "ConversationStrip") captured.strip = element;
      return element;
    },
  };
});
afterEach(() => { captured.on = false; captured.strip = null; });

const UP_TO_DATE = "Up to date at last check";
const RELOAD_NEEDED = "Reload needed";
const RELOAD = "Reload saved conversation";
const HELP = "This screen checks your saved conversation only when it opens, when you make a change and when you reload it. To see changes made in another tab or on another device, choose Reload saved conversation.";
const REASON_CHANGED = "To continue after your conversation has changed, choose Reload saved conversation.";
const REASON_PENDING = "To check whether your last message has a confirmed result, choose Reload saved conversation.";
const REASON_LOAD = "To try loading your conversation again, choose Reload saved conversation.";
const START = "Start of your conversation";
const LOADING = "Loading your saved conversation...";
const RELOADING = "Checking your saved conversation...";
const CHANGE = "Checking your change...";
const CHANGED_ALERT = "Your conversation has changed. Reload the saved conversation before making another change.";
const LOAD_ALERT = "The conversation could not be loaded. Please try again.";
const DENIED_ALERT = "This conversation is not available in your current session. Sign in again to continue.";
const UNAVAILABLE_ALERT = "The SolMind Virtual Guide is unavailable. No new message or reply has been confirmed saved.";
const CAN_SEE_SENTENCE = "This will explain exactly what your Virtual Guide can see, so you know what stays private.";
const SHARE_SENTENCE = "You will be able to share this whole conversation live with your Guide, until you stop.";
const BLUE_LABEL = '<span class="text-[11px] font-normal text-[#4A86FF]" data-build-note="label">Not connected yet</span>';

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const savedState = (overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState => ({
  waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
  version: EXPLORER_CONVERSATION_VERSION, conversationId: CONVERSATION, revision: 2,
  pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "available",
  messages: [
    { id: "20000000-0000-4000-8000-000000000001", role: "explorer", body: "An invented first message", createdAt: "2026-10-30T14:00:00.000Z" },
    { id: "30000000-0000-4000-8000-000000000001", role: "virtualGuide", body: "An invented saved reply", createdAt: "2026-10-30T14:00:05.000Z" },
  ],
  compassItems: [], priorityId: null, attentionId: null, waypoints: [], route: [], sessionStatus: "active", ending: null,
  ...overrides,
});
const newState = () => savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null });

// A settled view after a confirmed check.
function view(overrides: Partial<ConnectedConversationView> = {}): ConnectedConversationView {
  return { state: savedState(), sendSequence: 0, busy: false, awaitingReply: false, sendingMessage: null, sendingFromComposer: false,
    statusText: "", errorCode: null, lastCheckConfirmed: true, assistance: null, errorMessage: null, signInRequired: false,
    uncertain: false, reloadAvailable: true, draft: "", draftError: "", endReviewOpen: false, staleEndReview: false, ended: false,
    endBlocked: false, held: false, sendUnavailable: false, atMessageCapacity: false, ...overrides };
}
const actions: ConnectedConversationActions = { onReload: () => {}, onRetry: () => {}, onDraftChange: () => {}, onSend: () => {},
  onReviewEnd: () => {}, onConfirmEnd: () => {}, onKeepOpen: () => {}, onCommand: () => {}, onReplyChoice: () => {} };
function render(next: ConnectedConversationView = view()): string {
  return renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
    actions, composerRef: createRef<HTMLTextAreaElement>(), headingRef: createRef<HTMLHeadingElement>(), view: next }));
}
// The strip drawn again with one explanation open (the screen keeps that state; server markup starts closed).
function stripWith(next: ConnectedConversationView, open: ConnectedStripExplanation): string {
  captured.strip = null; captured.on = true;
  try { render(next); } finally { captured.on = false; }
  const element = captured.strip as ReactElement<StripProps, ComponentType<StripProps>> | null;
  expect(element).not.toBeNull();
  return renderToStaticMarkup(
    <NotConnectedProvider onToggle={() => {}} openId={null}>
      {createElement(element!.type, { ...element!.props, open })}
    </NotConnectedProvider>,
  );
}
const unescapeHtml = (text: string) => text.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const textOf = (html: string) => unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
function stripOf(html: string): string {
  const match = /<header class="[^"]*" data-conversation-strip="">[\s\S]*?<\/header>/.exec(html);
  expect(match).not.toBeNull();
  return match![0];
}
type StripFacts = { light: string | null; status: string; reload: "enabled" | "disabled" | null; help: boolean;
  line: { text: string; hidden: boolean } | null };
// What the strip shows: the light, the status region's text, Reload, "?" and the help or reason line.
function facts(html: string): StripFacts {
  const strip = stripOf(html);
  const status = /<p aria-atomic="true" aria-live="polite" class="[^"]*" id="conversation-saved-status" role="status">([\s\S]*?)<\/p>/.exec(strip);
  expect(status).not.toBeNull();
  const reload = /<button\b[^>]*id="conversation-reload-button"[^>]*>([\s\S]*?)<\/button>/.exec(strip);
  if (reload) {
    // The button keeps its full name in every state and is described by the help or reason line.
    expect(textOf(reload[1])).toBe(RELOAD);
    expect(attribute(reload[0], "aria-describedby")).toBe("conversation-reload-help");
    expect(attribute(reload[0], "type")).toBe("button");
    expect(/\sdisabled=""/.test(reload[0])).toBe(false);
    expect(attribute(reload[0], "aria-disabled") ?? "true").toBe("true");
  }
  const line = /<p class="text-xs leading-5 text-stone-300"( hidden="")? id="conversation-reload-help">([^<]*)<\/p>/.exec(strip);
  // The description exists exactly when Reload is drawn.
  expect(line !== null).toBe(reload !== null);
  return {
    light: /data-saved-light="(\w+)"/.exec(status![1])?.[1] ?? null,
    status: textOf(status![1]),
    // Since REV558 finding 1 a working Reload is aria-disabled and never natively disabled (it keeps focus).
    reload: reload ? (attribute(reload[0], "aria-disabled") === "true" ? "disabled" : "enabled") : null,
    help: strip.includes('id="conversation-reload-help-button"'),
    line: line ? { text: unescapeHtml(line[2]), hidden: line[1] !== undefined } : null,
  };
}
const helpBehind = { text: HELP, hidden: true };
const shown = (text: string) => ({ text, hidden: false });

describe("compact header: the strip in every state of the state map", () => {
  const pending = savedState({ pendingTurn: true });
  const pause = { kind: "paused" as const, body: "An invented pause notice.", persisted: false as const };
  const support = { kind: "support" as const, body: "An invented support notice.", persisted: false as const };
  const cases: readonly (readonly [string, ConnectedConversationView, StripFacts])[] = [
    ["row 1, first loading", view({ state: null, busy: true, statusText: LOADING, lastCheckConfirmed: false }),
      { light: null, status: LOADING, reload: "disabled", help: true, line: helpBehind }],
    ["row 2, first successful open", view(),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 2, open with a pending result", view({ state: pending, held: true, endBlocked: true }),
      { light: "yellow", status: RELOAD_NEEDED, reload: "enabled", help: false, line: shown(REASON_PENDING) }],
    ["row 2, open with a pending result and a pause notice", view({ state: pending, assistance: pause, held: true, endBlocked: true }),
      { light: "yellow", status: RELOAD_NEEDED, reload: "enabled", help: false, line: shown(REASON_PENDING) }],
    ["row 3, Reload running with a conversation on screen", view({ busy: true, held: true, statusText: RELOADING }),
      { light: null, status: RELOADING, reload: "disabled", help: true, line: helpBehind }],
    ["row 3, Reload running from the pending state", view({ state: pending, busy: true, held: true, statusText: RELOADING }),
      { light: null, status: RELOADING, reload: "disabled", help: false, line: shown(REASON_PENDING) }],
    ["row 4, Reload running after the conversation has changed", view({ state: null, busy: true, statusText: LOADING, errorCode: "refresh_required", errorMessage: CHANGED_ALERT, lastCheckConfirmed: false }),
      { light: null, status: LOADING, reload: "disabled", help: false, line: shown(REASON_CHANGED) }],
    ["row 4, Reload running after could not be loaded", view({ state: null, busy: true, statusText: LOADING, errorCode: "unavailable", errorMessage: LOAD_ALERT, lastCheckConfirmed: false }),
      { light: null, status: LOADING, reload: "disabled", help: false, line: shown(REASON_LOAD) }],
    ["row 5, after a successful Reload that still returns a pending result", view({ state: pending, lastCheckConfirmed: true }),
      { light: "yellow", status: RELOAD_NEEDED, reload: "enabled", help: false, line: shown(REASON_PENDING) }],
    ["row 7, a change that is not a Send is being checked", view({ busy: true, held: true, statusText: CHANGE }),
      { light: null, status: CHANGE, reload: "disabled", help: true, line: helpBehind }],
    ["row 8, waiting for a reply", view({ busy: true, awaitingReply: true, sendingMessage: "An invented message.", held: true }),
      { light: null, status: "", reload: "disabled", help: true, line: helpBehind }],
    ["rows 9, 10 and 13, a change confirmed without a support notice", view({ lastCheckConfirmed: true }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 12, a change confirmed with a support notice", view({ assistance: support, lastCheckConfirmed: false }),
      { light: null, status: "", reload: "enabled", help: true, line: helpBehind }],
    ["row 12, a support notice and a pending result", view({ state: pending, assistance: support, lastCheckConfirmed: false, held: true }),
      { light: "yellow", status: RELOAD_NEEDED, reload: "enabled", help: false, line: shown(REASON_PENDING) }],
    ["row 14, uncertain", view({ uncertain: true, reloadAvailable: false, lastCheckConfirmed: false, held: true, endBlocked: true }),
      { light: null, status: "", reload: null, help: false, line: null }],
    ["row 14, uncertain with a pending result", view({ state: pending, uncertain: true, reloadAvailable: false, lastCheckConfirmed: false, held: true }),
      { light: null, status: "", reload: null, help: false, line: null }],
    ["row 14b, Retry running", view({ busy: true, held: true, statusText: CHANGE, lastCheckConfirmed: false }),
      { light: null, status: CHANGE, reload: "disabled", help: true, line: helpBehind }],
    ["row 15, sign-in required", view({ state: null, errorCode: "denied", errorMessage: DENIED_ALERT, signInRequired: true, reloadAvailable: false, lastCheckConfirmed: false }),
      { light: null, status: "", reload: null, help: false, line: null }],
    ["row 16, the conversation could not be loaded", view({ state: null, errorCode: "unavailable", errorMessage: LOAD_ALERT, lastCheckConfirmed: false }),
      { light: null, status: "", reload: "enabled", help: false, line: shown(REASON_LOAD) }],
    ["row 17, the conversation has changed", view({ state: null, errorCode: "refresh_required", errorMessage: CHANGED_ALERT, lastCheckConfirmed: false }),
      { light: "yellow", status: RELOAD_NEEDED, reload: "enabled", help: false, line: shown(REASON_CHANGED) }],
    ["row 18, the Virtual Guide unavailable, found by a Send", view({ errorCode: "provider_unavailable", errorMessage: UNAVAILABLE_ALERT, sendUnavailable: true, lastCheckConfirmed: false }),
      { light: null, status: "", reload: "enabled", help: true, line: helpBehind }],
    ["row 18b, the Virtual Guide unavailable, found at open or Reload", view({ state: savedState({ providerState: "unavailable" }), sendUnavailable: true }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 19, paused at open", view({ assistance: pause }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 19, a change that returned the pause", view({ assistance: pause, lastCheckConfirmed: false }),
      { light: null, status: "", reload: "enabled", help: true, line: helpBehind }],
    ["row 21, End review open", view({ endReviewOpen: true, held: true }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 23, ended conversation", view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 24, not started", view({ state: newState() }),
      { light: "green", status: UP_TO_DATE, reload: "enabled", help: true, line: helpBehind }],
    ["row 27, leaving the page", view({ state: null, busy: true, statusText: LOADING, lastCheckConfirmed: true }),
      { light: null, status: LOADING, reload: "disabled", help: true, line: helpBehind }],
    ["no confirmed check and nothing else to report", view({ lastCheckConfirmed: false }),
      { light: null, status: "", reload: "enabled", help: true, line: helpBehind }],
  ];

  it.each(cases)("%s", (_name, next, expected) => {
    expect(facts(render(next))).toEqual(expected);
  });

  it("Reload needed never shows without its reason line on screen, and green never beside the pending notice", () => {
    for (const [name, next] of cases) {
      const html = render(next);
      const found = facts(html);
      if (found.status.includes(RELOAD_NEEDED)) {
        expect(found.line, name).not.toBeNull();
        expect(found.line!.hidden, name).toBe(false);
        expect([REASON_CHANGED, REASON_PENDING], name).toContain(found.line!.text);
      }
      if (html.includes("A saved message is still awaiting a confirmed result.")) expect(found.light, name).not.toBe("green");
    }
  });

  it("the earlier answer's saved line (offers build) shares the status region with the light's words", () => {
    const earlier = 'Your earlier answer to change "Walk each morning" was saved.';
    const html = render(view({ statusText: earlier }));
    expect(facts(html)).toMatchObject({ light: "green", status: `${UP_TO_DATE} ${earlier}` });
    // Without a confirmed check (a support notice came with it) the line stands alone.
    expect(facts(render(view({ statusText: earlier, lastCheckConfirmed: false })))).toMatchObject({ light: null, status: earlier });
  });

  it("the alerts keep their words, roles and order under the strip, with Sign in and Retry after the strip's controls", () => {
    const denied = render(view({ state: null, errorCode: "denied", errorMessage: DENIED_ALERT, signInRequired: true, reloadAvailable: false, lastCheckConfirmed: false }));
    expect(denied.indexOf("</header>")).toBeLessThan(denied.indexOf('role="alert"'));
    expect(denied).toContain('href="/login/explorer"');
    const uncertain = render(view({ uncertain: true, reloadAvailable: false, lastCheckConfirmed: false, held: true }));
    expect(textOf(uncertain)).toContain("We could not confirm your last change. Retry the same request before making another change. No new message, reply or saved change is being claimed.");
    expect(uncertain.indexOf("</header>")).toBeLessThan(uncertain.indexOf("Retry the same request</button>"));
    expect(uncertain.indexOf("Retry the same request</button>")).toBeLessThan(uncertain.indexOf('aria-label="Conversation transcript"'));
    const changed = render(view({ state: null, errorCode: "refresh_required", errorMessage: CHANGED_ALERT, lastCheckConfirmed: false }));
    expect(changed).toContain(`<p>${CHANGED_ALERT}</p>`);
    const loadFailed = render(view({ state: null, errorCode: "unavailable", errorMessage: LOAD_ALERT, lastCheckConfirmed: false }));
    expect(loadFailed).toContain(`<p>${LOAD_ALERT}</p>`);
  });
});

describe("compact header: announcements", () => {
  it("one polite status region in the strip, always mounted, first of the page's status regions and before the waiting announcement", () => {
    for (const next of [view(), view({ state: null, busy: true, statusText: LOADING }), view({ uncertain: true, reloadAvailable: false }),
      view({ state: null, errorCode: "denied", errorMessage: DENIED_ALERT, signInRequired: true, reloadAvailable: false }),
      view({ busy: true, awaitingReply: true, held: true })]) {
      const html = render(next);
      expect(html.split('id="conversation-saved-status"').length - 1).toBe(1);
      const first = /<\w+\b[^>]*role="status"[^>]*>/.exec(html)?.[0] ?? "";
      expect(attribute(first, "id")).toBe("conversation-saved-status");
      expect(attribute(first, "aria-live")).toBe("polite");
      expect(attribute(first, "aria-atomic")).toBe("true");
      expect(html.indexOf('id="conversation-saved-status"')).toBeLessThan(html.indexOf('data-waiting-announcement=""'));
      expect(html.split('data-waiting-announcement=""').length - 1).toBe(1);
      // The waiting announcement stays outside the busy transcript.
      if (next.state !== null) expect(html.indexOf('data-waiting-announcement=""')).toBeLessThan(html.indexOf("<div aria-busy="));
    }
  });

  it("the light is hidden from screen readers and always has its words beside it", () => {
    for (const [next, colour, words] of [[view(), "green", UP_TO_DATE], [view({ state: savedState({ pendingTurn: true }) }), "yellow", RELOAD_NEEDED]] as const) {
      const strip = stripOf(render(next));
      const dot = new RegExp(`<span aria-hidden="true" class="([^"]*)" data-saved-light="${colour}"></span><span>${words}</span>`).exec(strip);
      expect(dot, colour).not.toBeNull();
      expect(dot![1]).toContain(colour === "green" ? "bg-green-400" : "bg-yellow-400");
    }
    // No light without words, in any state: the only coloured dot in the strip is the one with words beside it.
    expect(stripOf(render(view({ lastCheckConfirmed: false })))).not.toContain("data-saved-light");
    expect(render()).not.toContain("h-1.5 w-1.5 rounded-full bg-amber-300");
  });

  it("the waiting announcement says the approved sentence only while a reply is awaited", () => {
    const waiting = render(view({ busy: true, awaitingReply: true, held: true }));
    expect(/<p aria-atomic="true" class="sr-only" data-waiting-announcement="" role="status">([^<]*)<\/p>/.exec(waiting)?.[1])
      .toBe("Waiting for your Virtual Guide&#x27;s reply...");
    expect(/<p aria-atomic="true" class="sr-only" data-waiting-announcement="" role="status">([^<]*)<\/p>/.exec(render())?.[1]).toBe("");
  });
});

describe("compact header: the two explanations", () => {
  it("both are closed when the screen opens, and each button says what it controls", () => {
    const strip = stripOf(render());
    const privacy = /<button aria-controls="conversation-privacy-explanation" aria-expanded="false" class="[^"]*" id="conversation-privacy-button" type="button">([\s\S]*?)<\/button>/.exec(strip);
    expect(privacy).not.toBeNull();
    expect(textOf(privacy![1])).toBe("Privacy and sharing");
    const help = /<button aria-controls="conversation-reload-help" aria-expanded="false" aria-label="About Reload saved conversation" class="[^"]*" id="conversation-reload-help-button" type="button"><span aria-hidden="true">\?<\/span><\/button>/.exec(strip);
    expect(help).not.toBeNull();
    expect(strip).toContain('hidden="" id="conversation-privacy-explanation" role="group"');
    expect(strip).toContain(`<p class="text-xs leading-5 text-stone-300" hidden="" id="conversation-reload-help">${HELP}</p>`);
    // Every strip control is a native button of type "button".
    for (const [tag] of strip.matchAll(/<button\b[^>]*>/g)) expect(attribute(tag, "type"), tag).toBe("button");
    // The order in the page is the tab order: Privacy and sharing, the status, Reload, "?".
    const order = ['id="conversation-privacy-button"', 'id="conversation-saved-status"', 'id="conversation-reload-button"', 'id="conversation-reload-help-button"']
      .map(mark => strip.indexOf(mark));
    expect(order.every(at => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(strip).not.toContain("tabindex=\"0\"");
  });

  it("the Privacy and sharing explanation holds the assurance sentence, then the two titled lines with their labels and sentences", () => {
    const html = render();
    const strip = stripOf(html);
    const explanation = /<div aria-labelledby="conversation-privacy-button" class="[^"]*" hidden="" id="conversation-privacy-explanation" role="group">([\s\S]*?)<\/div><p class/.exec(strip)?.[1] ?? "";
    expect(explanation).toBe(
      `<p class="text-sm leading-6 text-stone-200">${CONNECTED_INTRO}</p>` +
      `<div data-privacy-line=""><p class="flex flex-wrap items-center gap-x-2"><span class="font-semibold text-stone-100">What the Virtual Guide can see</span>${BLUE_LABEL}</p><p>${CAN_SEE_SENTENCE}</p></div>` +
      `<div data-privacy-line=""><p class="flex flex-wrap items-center gap-x-2"><span class="font-semibold text-stone-100">Share whole conversation</span>${BLUE_LABEL}</p><p>${SHARE_SENTENCE}</p></div>`,
    );
    // Nothing inside it takes focus, and the two former buttons are gone.
    expect(/<(?:button|a|input|select|textarea)\b/.test(explanation)).toBe(false);
    expect(html).not.toContain('aria-controls="nyi-header-shareConversation"');
    expect(html).not.toContain('aria-controls="nyi-header-virtualGuideCanSee"');
    // The assurance sentence shows nowhere else, in a state with a conversation and in one without.
    expect(html.split(CONNECTED_INTRO).length - 1).toBe(1);
    const loading = render(view({ state: null, busy: true, statusText: LOADING }));
    expect(loading.split(CONNECTED_INTRO).length - 1).toBe(1);
    expect(stripOf(loading)).toContain(CONNECTED_INTRO);
  });

  it("with Privacy and sharing open, the ? text is closed", () => {
    const strip = stripWith(view(), "privacy");
    expect(strip).toContain('aria-controls="conversation-privacy-explanation" aria-expanded="true"');
    expect(strip).toContain('<div aria-labelledby="conversation-privacy-button" class="grid gap-2.5 rounded-2xl border border-stone-700 bg-black/40 px-4 py-3 text-xs leading-5 text-stone-300" id="conversation-privacy-explanation" role="group">');
    expect(strip).toContain('aria-controls="conversation-reload-help" aria-expanded="false"');
    expect(strip).toContain(`hidden="" id="conversation-reload-help">${HELP}</p>`);
    expect(strip).toContain("rotate-180");
  });

  it("with the ? text open, Privacy and sharing is closed", () => {
    const strip = stripWith(view(), "help");
    expect(strip).toContain('aria-controls="conversation-reload-help" aria-expanded="true"');
    expect(strip).toContain(`<p class="text-xs leading-5 text-stone-300" id="conversation-reload-help">${HELP}</p>`);
    expect(strip).toContain('aria-controls="conversation-privacy-explanation" aria-expanded="false"');
    expect(strip).toContain('hidden="" id="conversation-privacy-explanation"');
    expect(strip).not.toContain("rotate-180");
  });

  it("with neither open, neither text shows", () => {
    const strip = stripWith(view(), null);
    expect(strip).toContain('hidden="" id="conversation-privacy-explanation"');
    expect(strip).toContain('hidden="" id="conversation-reload-help"');
    expect(strip.split('aria-expanded="false"').length - 1).toBe(2);
  });

  it("a reason line stays visible while Privacy and sharing is open: it is the instruction that belongs to Reload needed", () => {
    const next = view({ state: savedState({ pendingTurn: true }), held: true });
    for (const open of ["privacy", null] as const) {
      const strip = stripWith(next, open);
      expect(strip).toContain(`<p class="text-xs leading-5 text-stone-300" id="conversation-reload-help">${REASON_PENDING}</p>`);
      expect(strip).not.toContain('id="conversation-reload-help-button"');
      expect(strip).toContain(RELOAD_NEEDED);
    }
  });

  it("the screen starts with no explanation open and hands the strip a toggle", () => {
    captured.on = true;
    render();
    captured.on = false;
    const element = captured.strip as ReactElement<StripProps> | null;
    expect(element).not.toBeNull();
    expect(element!.props.open).toBeNull();
    expect(element!.props.onToggle).toBeTypeOf("function");
  });
});

describe("compact header: the title, the chat panel and the start marker", () => {
  const states: readonly (readonly [string, ConnectedConversationView, "band" | "strip"])[] = [
    ["a saved conversation", view(), "band"],
    ["a new conversation", view({ state: newState() }), "band"],
    ["an ended conversation", view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }), "band"],
    ["busy with a conversation", view({ busy: true, held: true, statusText: CHANGE }), "band"],
    ["uncertain", view({ uncertain: true, reloadAvailable: false, held: true }), "band"],
    ["loading", view({ state: null, busy: true, statusText: LOADING }), "strip"],
    ["sign-in required", view({ state: null, errorCode: "denied", errorMessage: DENIED_ALERT, signInRequired: true, reloadAvailable: false }), "strip"],
    ["the conversation has changed", view({ state: null, errorCode: "refresh_required", errorMessage: CHANGED_ALERT }), "strip"],
    ["could not be loaded", view({ state: null, errorCode: "unavailable", errorMessage: LOAD_ALERT }), "strip"],
  ];

  it.each(states)("exactly one h1 in %s, with tabindex -1 and the heading id", (_name, next, place) => {
    const html = render(next);
    const titles = [...html.matchAll(/<h1\b[^>]*>([^<]*)<\/h1>/g)];
    expect(titles).toHaveLength(1);
    expect(titles[0][1]).toBe("Your conversation");
    expect(attribute(titles[0][0], "tabindex")).toBe("-1");
    expect(attribute(titles[0][0], "id")).toBe("conversation-preview-heading");
    expect(attribute(titles[0][0], "class")).toContain("font-serif text-xl leading-7 text-stone-50");
    expect(html).toContain('<section aria-labelledby="conversation-preview-heading"');
    const inStrip = stripOf(html).includes("<h1");
    expect(inStrip).toBe(place === "strip");
    expect(html.includes("data-chat-panel=")).toBe(place === "band");
    if (place === "band") {
      // In the band: inside the chat panel, before the busy mark and outside the scrolling transcript.
      const band = /<div class="([^"]*)" data-chat-panel-band=""><h1\b[^>]*>Your conversation<\/h1><\/div>/.exec(html);
      expect(band).not.toBeNull();
      expect(html.indexOf("data-chat-panel=")).toBeLessThan(band!.index);
      expect(band!.index).toBeLessThan(html.indexOf("<div aria-busy="));
      expect(band!.index).toBeLessThan(html.indexOf('aria-label="Conversation transcript"'));
      // The strip's controls come before the title in the page, as Paul accepted.
      expect(html.indexOf('id="conversation-privacy-button"')).toBeLessThan(band!.index);
    }
  });

  it("the amber line above the title, the two old sentences and the old header buttons are gone in every state", () => {
    for (const [name, next] of states) {
      const text = textOf(render(next));
      for (const gone of ["with your Virtual Guide", "The saved conversation is up to date.", "Your saved conversation is up to date."]) {
        expect(text.includes(gone), `${name}: ${gone}`).toBe(false);
      }
      expect(render(next), name).not.toContain("uppercase tracking-[0.22em] text-amber-300");
    }
  });

  it("the conversation status and the Private conversation pill stay as they were", () => {
    expect(stripOf(render(view({ state: newState() })))).toContain(">Not started yet. Private to you</span>");
    expect(stripOf(render())).toContain(">Active and private</span>");
    expect(stripOf(render(view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true })))).toContain(">Ended. Read-only and private</span>");
    const loading = stripOf(render(view({ state: null, busy: true, statusText: LOADING })));
    for (const phrase of ["Not started yet", "Active and private", "Ended. Read-only"]) expect(loading).not.toContain(phrase);
    for (const next of [view(), view({ state: null, busy: true, statusText: LOADING })]) {
      expect(textOf(stripOf(render(next)))).toContain("Private conversation");
      expect(stripOf(render(next))).toContain('<span class="inline-flex items-center gap-1.5 rounded-full border border-stone-600 bg-black/30 px-3 py-1 text-xs font-semibold text-stone-200">');
    }
  });

  it("the chat panel carries the c1 colours, and the transcript carries its fallback height classes (step B sizes it by script)", () => {
    const html = render();
    expect(html).toContain('<div class="mx-2 mb-3 mt-3 rounded-2xl border border-amber-300/40 bg-[#12100b]" data-chat-panel="">');
    expect(html).toContain('border-b border-amber-200/20 bg-[#292412] px-3 py-2 sm:px-5" data-chat-panel-band="">');
    expect(/<div class="grid gap-3 rounded-b-\[15px\] border-t border-amber-200\/15 bg-\[#12100b\] px-3 py-3 sm:px-5" data-composer-bar="">/.test(html)).toBe(true);
    expect(html).not.toContain("bg-[#0c0a08]/95");
    const transcript = /<div aria-label="Conversation transcript" class="([^"]*)"/.exec(html)?.[1] ?? "";
    // Step B: before the script runs the transcript is 60vh, never under 14rem (224 px) or over 52rem (832 px);
    // the old 32rem minimum and the desktop clamp are gone. The server markup carries no inline height.
    expect(transcript.startsWith("h-[60vh] min-h-[14rem] max-h-[52rem] overflow-y-auto px-3 py-4 max-lg:scroll-py-2 sm:px-5 focus-visible:")).toBe(true);
    expect(html).not.toContain("min-h-[32rem]");
    expect(html).not.toContain("clamp(36rem,65vh,52rem)");
    const log = /<div aria-label="Conversation transcript"[^>]*>/.exec(html)?.[0] ?? "";
    expect(log).not.toContain("style=");
    // It stays a named, focusable scroll region for keyboard and screen-reader users.
    expect(attribute(log, "role")).toBe("log");
    expect(attribute(log, "tabindex")).toBe("0");
    expect(attribute(log, "aria-label")).toBe("Conversation transcript");
    // The two page-open markers: one at the end of the conversation area, a second after an ended conversation's explanation.
    expect(html.split('data-conversation-end=""').length - 1).toBe(1);
    const endedHtml = render(view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }));
    expect(endedHtml.split('data-conversation-end=""').length - 1).toBe(2);
    expect(endedHtml.lastIndexOf('data-conversation-end=""')).toBeGreaterThan(endedHtml.indexOf("This saved conversation has ended."));
    // The panel holds the transcript, the composer and the end marker; End Session stays outside it.
    const panelAt = html.indexOf("data-chat-panel=");
    expect(panelAt).toBeLessThan(html.indexOf("<textarea"));
    expect(html.indexOf("<textarea")).toBeLessThan(html.indexOf('<section aria-labelledby="conversation-end-heading"'));
  });

  it("the start marker stands once, as plain text, before the welcome in a new conversation", () => {
    const html = render(view({ state: newState() }));
    const marker = /<p class="([^"]*)" data-conversation-start="">([^<]*)<\/p>/g;
    const found = [...html.matchAll(marker)];
    expect(found).toHaveLength(1);
    expect(found[0][2]).toBe(START);
    expect(found[0][1]).toContain("text-[11px] leading-4 text-stone-400");
    expect(html.split(START).length - 1).toBe(1);
    const at = found[0].index;
    expect(at).toBeGreaterThan(html.indexOf('aria-label="Conversation transcript"'));
    expect(at).toBeLessThan(html.indexOf("data-opening-greeting"));
    expect(html.indexOf("data-opening-greeting")).toBeLessThan(html.indexOf("There are no saved messages yet."));
    // It is the first thing inside the transcript's content column.
    expect(html).toContain(`<div class="mx-auto grid max-w-3xl gap-3"><p class="${found[0][1]}" data-conversation-start="">${START}</p>`);
  });

  it("the start marker stands once before the oldest saved message otherwise, also while a reply is awaited and when ended", () => {
    for (const next of [view(), view({ busy: true, awaitingReply: true, sendingMessage: "An invented message.", held: true }),
      view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }),
      view({ state: savedState({ messages: [], sessionStatus: "ended" }), ended: true, held: true })]) {
      const html = render(next);
      expect(html.split(START).length - 1).toBe(1);
      const at = html.indexOf('data-conversation-start=""');
      expect(at).toBeGreaterThan(html.indexOf('aria-label="Conversation transcript"'));
      if (next.state!.messages.length > 0) {
        expect(html).toContain(`data-conversation-start="">${START}</p><ol aria-label="Saved conversation"`);
        expect(at).toBeLessThan(html.indexOf("An invented first message"));
      } else {
        expect(at).toBeLessThan(html.indexOf("There are no saved messages yet."));
      }
    }
  });

  it("the focus keeper is drawn after every control it may focus, and an empty idle conversation is not scrolled to its end", () => {
    // A layout effect runs before the refs of later siblings are set (REV491), so the keeper must come last
    // in the card: after the strip, the alerts, the chat panel with the title, and End Session.
    const source = readFileSync(path.resolve(__dirname, "..", "ExplorerConversationConnectedScreen.tsx"), "utf8");
    const keeperAt = source.indexOf("<StripFocusKeeper\n");
    expect(keeperAt).toBeGreaterThan(0);
    expect(source.indexOf("<StripFocusKeeper\n", keeperAt + 1)).toBe(-1);
    for (const earlier of ["<ConversationStrip\n", "<ConversationAlerts\n", "data-chat-panel-band=\"\"", "<EndSession actions={actions}", "ref={endedEndRef}"]) {
      const at = source.lastIndexOf(earlier);
      expect(at, earlier).toBeGreaterThan(0);
      expect(at, earlier).toBeLessThan(keeperAt);
    }
    expect(source.slice(keeperAt).indexOf("</section>")).toBeLessThan(700);
    // The transcript scrolls itself to its end only with saved messages or while a Send is awaited.
    // (Since step B the same condition is the named rule connectedTranscriptScrollsToEnd, tested with the sizing.)
    expect(source).toContain("if (box && connectedTranscriptScrollsToEnd(count, view.awaitingReply)) box.scrollTop = box.scrollHeight;");
    expect(source).toContain("}, [count, view.awaitingReply, scrollRef]);");
  });

  it("a press outside the remembered control drops the focus memory (REV491b)", () => {
    const source = readFileSync(path.resolve(__dirname, "..", "ExplorerConversationConnectedScreen.tsx"), "utf8");
    const keeper = source.slice(source.indexOf("function StripFocusKeeper("), source.indexOf("type AlertsProps"));
    expect(keeper).toContain('document.addEventListener("pointerdown", forget, true);');
    expect(keeper).toContain('return () => document.removeEventListener("pointerdown", forget, true);');
    expect(keeper).toContain("if (held === null || (event.target instanceof Node && held.element.contains(event.target))) return;");
    expect(keeper).toContain("heldFocusRef.current = null;\n      focusWaitsOnTitleRef.current = false;\n    };");
    // A blur with no destination still keeps the memory (removal, disabling, window blur).
    expect(source).toContain("if (!(event.relatedTarget instanceof Element) || !element.isConnected || document.activeElement === element) return;");
  });

  it("the strip is one wrapping row; the status region, Reload and ? share a group that may take its own line", () => {
    const strip = stripOf(render());
    expect(strip).toContain('<div class="flex flex-wrap items-center gap-x-3 gap-y-2">');
    const group = /<div class="ml-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2">([\s\S]*?)<\/div><\/div>/.exec(strip)?.[1] ?? "";
    for (const mark of ['id="conversation-saved-status"', 'id="conversation-reload-button"', 'id="conversation-reload-help-button"']) expect(group).toContain(mark);
    expect(group).not.toContain('id="conversation-privacy-button"');
    // No part of the strip has a zero flex basis (that kept the controls beside the pill and past the card's edge).
    expect(strip).not.toContain("flex-1");
  });

  it("no start marker without a saved conversation on screen", () => {
    for (const next of [view({ state: null, busy: true, statusText: LOADING }),
      view({ state: null, errorCode: "unavailable", errorMessage: LOAD_ALERT })]) {
      expect(render(next)).not.toContain(START);
    }
  });
});

// GPT-6 Astra review REV558, finding 1: a natively disabled button can drop keyboard focus to the page while
// Reload works. Reload now stays focusable (aria-disabled) and its handler does nothing while busy.
describe("REV558 finding 1: Reload keeps keyboard focus while it works", () => {
  const SCREEN_SOURCE = readFileSync(path.resolve(__dirname, "../ExplorerConversationConnectedScreen.tsx"), "utf8");
  type ButtonProps = { id?: string; disabled?: boolean; "aria-disabled"?: boolean; onClick?: () => void; children?: unknown };
  // The Reload button's own props, as the strip builds them for this view.
  function reloadProps(next: ConnectedConversationView, onReload: () => void): ButtonProps {
    captured.strip = null; captured.on = true;
    try {
      renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
        actions: { ...actions, onReload }, composerRef: createRef<HTMLTextAreaElement>(), headingRef: createRef<HTMLHeadingElement>(), view: next }));
    } finally { captured.on = false; }
    const strip = captured.strip as ReactElement<StripProps> | null;
    expect(strip).not.toBeNull();
    const drawn = (strip!.type as (props: StripProps) => ReactElement)(strip!.props);
    const found: ButtonProps[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node === null || typeof node !== "object" || !("props" in node)) return;
      const props = (node as ReactElement<ButtonProps>).props;
      if (props.id === "conversation-reload-button") found.push(props);
      walk(props.children);
    };
    walk(drawn);
    expect(found).toHaveLength(1);
    return found[0];
  }

  it("while a request runs Reload is aria-disabled, never natively disabled, and using it does nothing", () => {
    const onReload = vi.fn();
    const props = reloadProps(view({ busy: true, held: true, statusText: RELOADING }), onReload);
    expect(props["aria-disabled"]).toBe(true);
    expect("disabled" in props).toBe(false);
    props.onClick!();
    props.onClick!();
    expect(onReload).not.toHaveBeenCalled();
    const button = /<button\b[^>]*id="conversation-reload-button"[^>]*>/.exec(render(view({ busy: true, held: true, statusText: RELOADING })))![0];
    expect(attribute(button, "aria-disabled")).toBe("true");
    expect(/\sdisabled=""/.test(button)).toBe(false);
    // It still looks unavailable.
    expect(attribute(button, "class")).toContain("aria-disabled:cursor-not-allowed aria-disabled:opacity-50");
  });

  it("when nothing runs Reload carries no aria-disabled and reloads once per use", () => {
    const onReload = vi.fn();
    const props = reloadProps(view(), onReload);
    expect(props["aria-disabled"]).toBeUndefined();
    expect("disabled" in props).toBe(false);
    props.onClick!();
    expect(onReload).toHaveBeenCalledTimes(1);
    const button = /<button\b[^>]*id="conversation-reload-button"[^>]*>/.exec(render())![0];
    expect(attribute(button, "aria-disabled")).toBeNull();
    expect(/\sdisabled=""/.test(button)).toBe(false);
  });

  it("the focus rules read the same state, and the recovery for controls that disappear is kept", () => {
    expect(SCREEN_SOURCE).toContain('const reloadEnabled = () => reloadRef.current !== null && reloadRef.current.getAttribute("aria-disabled") !== "true";');
    expect(SCREEN_SOURCE).not.toContain("reloadRef.current.disabled");
    expect(SCREEN_SOURCE).not.toContain("disabled={view.busy}\n              id={RELOAD_BUTTON_ID}");
    expect(SCREEN_SOURCE).toContain("if (held !== null && !held.element.isConnected) {");
    expect(SCREEN_SOURCE).toContain("focusOn(target);\n        if (!held.title) focusWaitsOnTitleRef.current = target === \"title\" && busy;");
  });
});
