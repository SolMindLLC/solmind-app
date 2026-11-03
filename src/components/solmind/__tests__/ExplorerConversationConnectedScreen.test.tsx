import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExplorerConversationPage from "../../../app/explorer/conversation/page";
import {
  CONNECTED_INTRO,
  CONNECTED_SHELL,
  CURRENT_TOOLS_HEADING,
  CURRENT_TOOLS_POINTER,
} from "../../../lib/solmind/explorerConversationConnectedScreen";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import {
  CONVERSATION_FOOTER,
  LAYOUT_ONLY_LABEL,
  MIDDLE_DOT,
  NOT_YET_IMPLEMENTED_PREFIX,
  PREVIEW_BAND_TEXT,
  SAMPLE_TAG_LABEL,
  UNNAMED_GUIDE,
  guideLabel,
  guideNotes,
  notYetImplementedNotes,
} from "../../../lib/solmind/explorerConversationScreen";
import { EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU } from "../../../lib/solmind/workspaceMenus";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "../../../lib/solmind/workspaceNavigation";
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";
import { NotConnectedProvider, UnwiredControl } from "../ExplorerConversationScreenNotYetImplemented";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const SCREEN_FILE = "src/components/solmind/ExplorerConversationConnectedScreen.tsx";
const WORDING_FILE = "src/lib/solmind/explorerConversationConnectedScreen.ts";
// The shared menu labels leaf and the signed-in menu data (Paul's 2026-11-02 option A).
const MENU_FILES = ["src/lib/solmind/workspaceNavigation.ts", "src/lib/solmind/workspaceMenus.ts"];
// The grey label exactly as NotConnectedLine draws it.
const GREY_LABEL = `<span class="text-[11px] font-normal text-stone-400">${WORKSPACE_NOT_CONNECTED_LABEL}</span>`;
// The notes that describe an area rather than a control: shown, never hidden.
const AREA_NOTES = ["choiceGroup", "compass", "earlierCompass", "formingPoint", "keyInsight", "latestChange", "needle", "waypointCard"];
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const ALL_NOTES = Object.values(notYetImplementedNotes(UNNAMED_GUIDE));

const savedState = (overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState => ({
  version: EXPLORER_CONVERSATION_VERSION,
  conversationId: CONVERSATION,
  revision: 2,
  pendingTurn: false,
  providerState: "available",
  messages: [
    { id: "20000000-0000-4000-8000-000000000001", role: "explorer", body: "A synthetic first message <script>x</script>", createdAt: "2026-10-30T14:00:00.000Z" },
    { id: "30000000-0000-4000-8000-000000000001", role: "virtualGuide", body: "A synthetic saved reply", createdAt: "2026-10-30T14:00:05.000Z" },
  ],
  compassItems: [],
  priorityId: null,
  attentionId: null,
  waypoints: [],
  route: [],
  sessionStatus: "active",
  ending: null,
  ...overrides,
});

function view(overrides: Partial<ConnectedConversationView> = {}): ConnectedConversationView {
  return {
    state: savedState(),
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
};

function render(next: ConnectedConversationView = view()): string {
  return renderToStaticMarkup(createElement(ExplorerConversationConnectedScreen, {
    actions,
    composerRef: createRef<HTMLTextAreaElement>(),
    headingRef: createRef<HTMLHeadingElement>(),
    view: next,
  }));
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

function unescapeHtml(text: string): string {
  return text.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function textOf(html: string): string {
  return unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
}

type MarkupElement = { name: string; start: number; end: number; parent: MarkupElement | null };

// The rendered elements with their extent and parent, from balanced tags. React
// escapes "<" and ">" inside text and attribute values, so every tag is real.
function markupElements(html: string): MarkupElement[] {
  const all: MarkupElement[] = [];
  const open: MarkupElement[] = [];
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const [whole, closing, name, selfClosing] = match;
    const at = match.index ?? 0;
    if (closing) {
      const element = open.pop();
      if (!element || element.name !== name) throw new Error(`unbalanced_markup_${name}_${at}`);
      element.end = at + whole.length;
      continue;
    }
    const element: MarkupElement = { name, start: at, end: at + whole.length, parent: open.at(-1) ?? null };
    all.push(element);
    if (!selfClosing && !VOID_ELEMENTS.has(name)) open.push(element);
  }
  expect(open).toEqual([]);
  return all;
}

// Each area note shown in the markup, with the markup of the element that directly contains it.
function shownAreaNotes(html: string): { key: string; sentence: string; area: string; noteAt: number }[] {
  const elements = markupElements(html);
  return [...html.matchAll(/<p class="text-xs leading-5 text-stone-300[^"]*" id="nyi-\w+-(\w+)">([^<]*)<\/p>/g)].map((match) => {
    const parent = elements.find((element) => element.start === match.index)?.parent;
    if (!parent) throw new Error(`no_parent_${match[1]}`);
    return {
      key: match[1],
      sentence: unescapeHtml(match[2]),
      area: html.slice(parent.start, parent.end),
      noteAt: (match.index ?? 0) - parent.start,
    };
  });
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
});
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("connected Explorer conversation screen", () => {
  it("CC01 shows the saved messages in order, as plain text, with their speakers and times", () => {
    const html = render();
    const list = /<ol aria-label="Saved conversation"[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
    const items = [...list.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((match) => textOf(match[0]));
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("You");
    expect(items[0]).toContain("A synthetic first message <script>x</script>");
    expect(items[1]).toContain("SolMind Virtual Guide");
    expect(items[1]).toContain("A synthetic saved reply");
    expect(html).not.toContain("<script>");
    expect(html).toContain('dateTime="2026-10-30T14:00:00.000Z"');
  });

  it("CC02 carries none of the preview's extras: no band, Sample tags, layout tags or sample names", () => {
    const html = render();
    expect(html).not.toContain(PREVIEW_BAND_TEXT);
    expect(html).not.toContain(`>${SAMPLE_TAG_LABEL}<`);
    expect(html).not.toContain("data-preview-tag");
    expect(html).not.toContain(LAYOUT_ONLY_LABEL);
    expect(html).not.toContain('data-preview-control="layout"');
    for (const name of ["Mary", "Jordan", "Avery", "Nivan"]) expect(html).not.toContain(name);
    // The unapproved AI-companion draft is not used on the real screen.
    expect(html).not.toContain("is an AI companion");
    // The screen receives no Guide relationship data, so the banner claims none.
    expect(html).not.toContain("part of your journey");
    expect(html).not.toContain("is not reading it");
    expect(html).not.toContain("happen in a separate space");
    expect(html).not.toContain("Direct conversations, a separate space");
    expect(html).toContain("Conversations with a Guide");
  });

  it("CC13 only the saved conversation and composer are marked busy, and End keeps its visible heading", () => {
    const html = render(view({ busy: true, statusText: "Checking your change..." }));
    expect(/<section aria-labelledby="conversation-preview-heading"[^>]*aria-busy/.test(html)).toBe(false);
    const busy = /<div aria-busy="true">([\s\S]*?)<section aria-labelledby="conversation-end-heading"/.exec(html)?.[1] ?? "";
    expect(busy).toContain('aria-label="Saved conversation"');
    expect(busy).toContain("<textarea");
    expect(busy).not.toContain("Checking your change...");
    expect(busy).not.toContain("Reload saved conversation");
    expect(html.indexOf("Checking your change...")).toBeLessThan(html.indexOf('<div aria-busy="true">'));
    expect(/<h2[^>]*id="conversation-end-heading"[^>]*>End Session<\/h2>/.test(html)).toBe(true);
  });

  it("CC14 a loaded conversation with no messages is labelled new", () => {
    const html = render(view({ state: savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null }) }));
    expect(html).toContain(`New conversation ${MIDDLE_DOT} with your Virtual Guide`);
    expect(html).toContain("Not started yet. Private to you");
    expect(html).not.toContain("Open conversation");
  });

  it("CC12 a pending saved turn is announced outside the scrolling transcript, beside the composer", () => {
    const html = render(view({ state: savedState({ pendingTurn: true }), held: true, endBlocked: true }));
    const notice = "A saved message is still awaiting a confirmed result.";
    expect(html).toContain(notice);
    const log = /<div aria-label="Conversation transcript"[\s\S]*?<\/ol><\/div><\/div>/.exec(html)?.[0] ?? "";
    expect(log).toContain('aria-label="Saved conversation"');
    expect(log).not.toContain(notice);
    expect(html.indexOf(notice)).toBeLessThan(html.indexOf("<textarea"));
    expect(html.indexOf(notice)).toBeGreaterThan(html.indexOf('aria-label="Saved conversation"'));
  });

  it("CC03 shows the approved live sentences, and Overview in the menu is the way home", () => {
    const html = render();
    expect(html).toContain(CONVERSATION_FOOTER);
    expect(CONNECTED_INTRO).toBe(
      "Explore with the SolMind Virtual Guide. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.",
    );
    expect(html).toContain(CONNECTED_INTRO);
    const rail = /<nav aria-label="Explorer workspace"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    expect(/<a\b[^>]*href="\/explorer\/home"[^>]*>[\s\S]*?Overview[\s\S]*?<\/a>/.test(rail)).toBe(true);
    // Paul's 2026-11-02 option A: no separate "Explorer home" link in the top bar.
    expect(/>\s*Explorer home\s*</.test(html)).toBe(false);
    expect(html.split('href="/explorer/home"').length - 1).toBe(1);
    expect(/<h1[^>]*tabindex="-1"[^>]*>Your conversation<\/h1>/i.test(html)).toBe(true);
  });

  it("CC04 no review note remains; every control not connected yet says so and explains itself on request", () => {
    const html = render();
    // The current Compass and Waypoint tools below the conversation keep their own dashed
    // empty-slot style, which is not a review mark, so the class checks leave them out.
    const toolsAt = html.indexOf('<section aria-labelledby="conversation-current-tools-heading"');
    const panelAt = html.indexOf('<aside aria-labelledby="conversation-preview-panel-heading"');
    expect(toolsAt).toBeGreaterThan(0);
    expect(panelAt).toBeGreaterThan(toolsAt);
    const screen = html.slice(0, toolsAt) + html.slice(panelAt);
    expect(html).not.toContain(NOT_YET_IMPLEMENTED_PREFIX);
    expect(html).not.toContain("data-preview-");
    // (The real controls keep their own disabled:cursor-not-allowed state style.)
    expect(screen.match(/.{0,80}(?:\bsky-|border-dashed|(?<!disabled:)cursor-not-allowed|aria-disabled).{0,40}/g) ?? []).toEqual([]);
    const sentences = [
      ...ALL_NOTES.map((note) => note.slice(NOT_YET_IMPLEMENTED_PREFIX.length + 1)),
      ...[...EXPLORER_MENU, ...EXPLORER_CONVERSATION_SPACES].flatMap((entry) => (entry.explanation ? [entry.explanation] : [])),
    ];
    const buttons = [...screen.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(
      ([, attrs, body]) => body.includes(WORKSPACE_NOT_CONNECTED_LABEL) || (attribute(attrs, "aria-label") ?? "").endsWith("(not connected yet)"),
    );
    // Menu: Settings, With your Guide, Start a new conversation. Top bar: Notifications, profile.
    // Guide banner. Header: Rename, Share whole conversation, What the Virtual Guide can see.
    // Composer: Pause, Finish & Review, Slow down. After the conversation ends: Continue.
    expect(buttons.length).toBe(13);
    const controlled = new Set<string>();
    for (const [tag, attrs, body] of buttons) {
      // Never disabled: each control stays usable to show its sentence.
      expect(/\sdisabled=""/.test(attrs), tag).toBe(false);
      expect(attribute(attrs, "aria-expanded"), tag).toBe("false");
      const label = attribute(attrs, "aria-label");
      expect(label === null ? body.includes(`>${WORKSPACE_NOT_CONNECTED_LABEL}<`) : label.endsWith("(not connected yet)"), tag).toBe(true);
      const target = attribute(attrs, "aria-controls") ?? "";
      const explanation = new RegExp(`<p class="([^"]*)" hidden="" id="${target}">([^<]*)</p>`).exec(screen);
      expect(explanation, tag).not.toBeNull();
      expect(explanation?.[1]).toContain("text-xs leading-5 text-stone-300");
      expect(sentences).toContain(unescapeHtml(explanation?.[2] ?? ""));
      controlled.add(target);
    }
    expect(controlled.size).toBe(13);
    // Every hidden sentence belongs to one of those controls.
    const hidden = [...screen.matchAll(/<p\b[^>]*\shidden=""[^>]*\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(hidden.sort()).toEqual([...controlled].sort());
    // A sentence describing an area rather than a control stays shown, without the prefix, and
    // sits in an element that also shows the grey "Not connected yet" label (beside the area's
    // heading, or on its own line above the sentence), with no control of its own, so it does not
    // read as a working feature. The empty conversation adds the "Ways to begin" area.
    const empty = render(view({ state: savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null }) }));
    const areaNotes = [...shownAreaNotes(html), ...shownAreaNotes(empty)];
    expect([...new Set(areaNotes.map((note) => note.key))].sort()).toEqual(AREA_NOTES);
    for (const { key, sentence, area, noteAt } of areaNotes) {
      expect(sentences, key).toContain(sentence);
      expect(area.includes(GREY_LABEL), key).toBe(true);
      expect(area.indexOf(GREY_LABEL), key).toBeLessThan(noteAt);
      expect(/<(?:button|a|textarea|input|select)\b/.test(area), key).toBe(false);
    }
    expect(textOf(screen)).toContain("Your Compass will fill in from what you talk about, and you confirm what matters.");
  });

  it("CC18 each control's sentence comes directly after it; the top bar's sit in the row under it", () => {
    const html = render();
    const controls = [...html.matchAll(/<button\b[^>]*\saria-controls="((?:nyi|not-connected)-[\w-]+)"[^>]*>[\s\S]*?<\/button>/g)];
    expect(controls.length).toBe(13);
    for (const match of controls) {
      const id = match[1];
      const after = html.slice((match.index ?? 0) + match[0].length);
      // Only closing tags may stand between a control and its sentence.
      const direct = new RegExp(`^(?:</\\w+>)*<p\\b[^>]*\\sid="${id}"`).test(after);
      expect(direct, id).toBe(!id.startsWith("nyi-top-"));
    }
    // Rename: the button, then its sentence, then the "supports reflection" line.
    const renameAt = html.indexOf('aria-controls="nyi-header-rename"');
    const renameNoteAt = html.indexOf('id="nyi-header-rename"');
    expect(renameAt).toBeGreaterThan(0);
    expect(renameNoteAt).toBeGreaterThan(renameAt);
    expect(html.indexOf(CONVERSATION_FOOTER)).toBeGreaterThan(renameNoteAt);
    // Pause, Finish & Review and Slow down each have their own sentence under them, in order.
    const order = ["pause", "finishReview", "slowDown"].flatMap((key) => [
      html.indexOf(`aria-controls="nyi-composer-${key}"`),
      html.indexOf(`id="nyi-composer-${key}"`),
    ]);
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("CC19 the profile chip's name is its visible role and grey line, with profile for screen readers", () => {
    const html = render();
    const chip = /<button\b([^>]*\saria-controls="nyi-top-profile"[^>]*)>([\s\S]*?)<\/button>/.exec(html);
    expect(chip).not.toBeNull();
    expect(attribute(chip?.[1] ?? "", "aria-label")).toBeNull();
    expect(attribute(chip?.[1] ?? "", "aria-expanded")).toBe("false");
    expect(chip?.[2]).toContain('<span class="sr-only"> profile</span>');
    expect(chip?.[2]).toContain(GREY_LABEL);
    expect(textOf(chip?.[2] ?? "").trim()).toBe("Explorer profile Not connected yet");
  });

  it("CC20 the bell shows the grey line beside its icon, with Notifications for screen readers", () => {
    const html = render();
    const bell = /<button\b([^>]*\saria-controls="nyi-top-notifications"[^>]*)>([\s\S]*?)<\/button>/.exec(html);
    expect(bell).not.toBeNull();
    // Like the menu entries and the profile chip, the visible grey line is part of its name, once.
    expect(attribute(bell?.[1] ?? "", "aria-label")).toBeNull();
    expect(attribute(bell?.[1] ?? "", "aria-expanded")).toBe("false");
    expect(attribute(bell?.[1] ?? "", "type")).toBe("button");
    expect(bell?.[2]).toMatch(new RegExp(`^<svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg><span class="sr-only">Notifications </span>${GREY_LABEL.replaceAll("[", "\\[").replaceAll("]", "\\]")}$`));
    expect(textOf(bell?.[2] ?? "").trim()).toBe("Notifications Not connected yet");
    expect(html).not.toContain("(not connected yet)");
    // The bell keeps its earlier height (h-10), border, colours and hover; the grey line sits beside the icon.
    // tests/browser/explorerConversationScreen.pw.ts measures it against the profile chip.
    const bellClass = attribute(bell?.[1] ?? "", "class") ?? "";
    expect(bellClass).toContain("flex h-10 items-center gap-2 rounded-full border border-amber-200/20");
    expect(bellClass).toContain("text-amber-200 hover:bg-amber-300/10");
    // Its sentence stays hidden in the row under the top bar until the bell is used.
    expect(html).toMatch(/<p class="text-xs leading-5 text-stone-300 pb-2\.5" hidden="" id="nyi-top-notifications">/);
  });

  it("CC16 the menu goes where Paul decided; the rest says it is not connected yet", () => {
    const html = render();
    const rail = /<nav aria-label="Explorer workspace"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, body]) => [
      textOf(body).trim(),
      attribute(attrs, "href"),
      attribute(attrs, "aria-current"),
    ]);
    expect(links).toEqual([
      ["Overview", "/explorer/home", null],
      ["Conversations (current section)", "/explorer/conversations", null],
      ["With your Virtual Guide Waypoint conversations, private to you", "/explorer/conversation", "page"],
      ["Waypoints", "/explorer/waypoints", null],
    ]);
    const notConnected = [...rail.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(([, body]) => textOf(body).trim());
    expect(notConnected).toEqual([
      "With your Guide Not connected yet",
      "Start a new conversation Not connected yet",
      "Settings Not connected yet",
    ]);
    // The phone Menu starts closed; its panel stays in the page so the button always points at it.
    const menuButton = /<button\b[^>]*id="explorer-menu-button"[^>]*>([\s\S]*?)<\/button>/.exec(html);
    expect(attribute(menuButton?.[0] ?? "", "aria-expanded")).toBe("false");
    expect(attribute(menuButton?.[0] ?? "", "aria-controls")).toBe("explorer-menu-panel");
    expect(textOf(menuButton?.[1] ?? "").trim()).toBe("Menu");
    expect(/<div class="[^"]*lg:hidden" hidden="" id="explorer-menu-panel"><\/div>/.test(html)).toBe(true);
    // The old icon strip and its spaces toggle are gone.
    expect(html).not.toContain("conversation spaces");
    expect(html.split('aria-label="Explorer workspace"').length - 1).toBe(1);
  });

  it("CC17 a control not connected yet opens its sentence; without the provider it renders as the review version", () => {
    const control = (
      <UnwiredControl className="x" noteKey="settings" scope="test">
        Settings
      </UnwiredControl>
    );
    const open = renderToStaticMarkup(
      <NotConnectedProvider onToggle={() => {}} openId="nyi-test-settings">
        {control}
      </NotConnectedProvider>,
    );
    expect(open).toContain('aria-controls="nyi-test-settings" aria-expanded="true"');
    expect(open).toContain(`<p class="text-xs leading-5 text-stone-300" id="nyi-test-settings">${escapeHtml(EXPLORER_MENU[3].explanation ?? "")}</p>`);
    const closed = renderToStaticMarkup(
      <NotConnectedProvider onToggle={() => {}} openId={null}>
        {control}
      </NotConnectedProvider>,
    );
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('hidden="" id="nyi-test-settings"');
    const review = renderToStaticMarkup(control);
    expect(review).toContain('aria-disabled="true"');
    expect(review).toContain('data-preview-control="unwired"');
    expect(review).toContain(NOT_YET_IMPLEMENTED_PREFIX);
    expect(review).not.toContain(WORKSPACE_NOT_CONNECTED_LABEL);
  });

  it("CC05 the real controls are not marked unwired and follow the held and unavailable states", () => {
    const open = render();
    const send = /<button\b[^>]*type="submit"[^>]*>/.exec(open)?.[0] ?? "";
    expect(send).not.toContain("data-preview-control");
    expect(/\sdisabled=""/.test(send)).toBe(false);
    const field = /<textarea\b[^>]*>/.exec(open)?.[0] ?? "";
    expect(attribute(field, "id")).toBe("conversation-message");
    expect(field).not.toContain("readOnly");
    expect(field).not.toContain("data-preview-control");
    expect(open).toContain('<label class="text-sm font-semibold text-stone-100" for="conversation-message">Continue the conversation</label>');

    const unavailable = render(view({ sendUnavailable: true }));
    expect(/<button\b[^>]*disabled=""[^>]*type="submit"/.test(unavailable)).toBe(true);
    const heldField = /<textarea\b[^>]*>/.exec(unavailable)?.[0] ?? "";
    expect(attribute(heldField, "aria-describedby")).toBe("conversation-availability");
    expect(unavailable).toContain("The SolMind Virtual Guide is unavailable.");
  });

  it("CC15 a hard-stop pause notice is an alert with the server's text, without the temporary-assistance sentence, and Send stays usable", () => {
    const body = "Synthetic pause notice.\n\nThe message in the box has not been sent or saved.";
    const paused = render(view({ assistance: { kind: "paused", body, persisted: false }, draft: "Synthetic typed message." }));
    const alert = /<div[^>]*role="alert"[^>]*>([\s\S]*?)<\/div>/.exec(paused)?.[1] ?? "";
    expect(unescapeHtml(alert.replace(/<[^>]+>/g, ""))).toBe(body);
    expect(paused).not.toContain("This assistance is temporary and is not a saved conversation reply.");
    const send = /<button\b[^>]*type="submit"[^>]*>/.exec(paused)?.[0] ?? "";
    expect(/\sdisabled=""/.test(send)).toBe(false);
    expect(paused).not.toContain("The SolMind Virtual Guide is unavailable.");
    const support = render(view({ assistance: { kind: "support", body: "Synthetic support.", persisted: false } }));
    expect(support).toContain("This assistance is temporary and is not a saved conversation reply.");
  });

  it("CC06 without a loaded state it shows only the heading, notices and placeholders", () => {
    const html = render(view({ state: null, busy: true, statusText: "Loading your saved conversation...", reloadAvailable: false }));
    expect(html).toContain("Loading your saved conversation...");
    // Nothing is said about the conversation until an authenticated read succeeds.
    expect(html).not.toContain("Not started yet");
    expect(html).not.toContain("Active and private");
    expect(html).not.toContain("Open conversation");
    expect(html).toContain(`Conversation ${MIDDLE_DOT} with your Virtual Guide`);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain('aria-label="Saved conversation"');
    expect(html).not.toContain(CURRENT_TOOLS_HEADING);
    // No tools are shown below, so the panel does not point to them.
    expect(html).not.toContain(CURRENT_TOOLS_POINTER);
    expect(render()).toContain(CURRENT_TOOLS_POINTER);
    expect(html).not.toContain("End this conversation");
  });

  it("CC07 a denied read shows only the sign-in alert, with no history or command controls", () => {
    const html = render(view({ state: null, errorMessage: "This conversation is not available in your current session. Sign in again to continue.", signInRequired: true, reloadAvailable: false }));
    expect(html.split('role="alert"').length - 1).toBe(1);
    expect(html).toContain('href="/login/explorer"');
    expect(html).not.toContain("Not started yet");
    expect(html).not.toContain("Open conversation");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain('type="submit"');
  });

  it("CC08 an ended conversation is read-only and links to ended conversations", () => {
    const html = render(view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }));
    expect(html).not.toContain("<textarea");
    expect(html).toContain("This saved conversation has ended. It is available for read-only review.");
    expect(html).toContain('href="/explorer/conversations"');
    expect(html).not.toContain("End this conversation");
  });

  it("CC09 the current Compass and Waypoint tools stay available and say why", () => {
    const html = render();
    expect(html).toContain(CURRENT_TOOLS_HEADING);
    expect(html).toContain('aria-label="Private Compass and Waypoints"');
    expect(html).toContain("They stay here so your saved Compass and Waypoints remain usable");
  });

  it("CC10 notes that name the Guide say your Guide, without a doubled label", () => {
    expect(guideLabel(UNNAMED_GUIDE)).toBe("your Guide");
    expect(guideLabel("Jordan")).toBe("Jordan, your Guide");
    const notes = guideNotes(UNNAMED_GUIDE);
    expect(notes.guideSpace).toBe("Not yet implemented: This will open your separate conversations with your Guide.");
    expect(notes.guideInput).toBe("Not yet implemented: Your Guide's input on a Waypoint you shared will appear here, marked as theirs.");
    expect(guideNotes("Jordan").guideInput).toBe("Not yet implemented: Jordan's input on a Waypoint you shared will appear here, marked as theirs.");
    const html = render();
    expect(html).not.toContain("your Guide, your Guide");
    expect(CONNECTED_SHELL.guideName).toBe(UNNAMED_GUIDE);
  });

  it("CC11 the screen file is presentation only and the route stays a thin shell", () => {
    const forbidden = [/\bfetch\s*\(/, /supabase/i, /\bcookies\b/, /process\.env/, /localStorage/, /sessionStorage/,
      /["']use server["']/, /@\/lib\/solmind\/auth/, /virtual-guide\//, /explorerConversationScreenSample/, /\bSAMPLE_/];
    for (const file of [SCREEN_FILE, WORDING_FILE, ...MENU_FILES]) {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      for (const pattern of forbidden) expect(pattern.test(source), `${pattern} in ${file}`).toBe(false);
    }
    const route = readFileSync(path.join(appRoot, "src/app/explorer/conversation/page.tsx"), "utf8");
    expect(route).toContain("return <ExplorerConversation />;");
    // The route still renders only the public shell: nothing private before the authenticated read.
    const page = renderToStaticMarkup(createElement(ExplorerConversationPage));
    expect(page).toContain("Loading your saved conversation...");
    expect(page).not.toContain('aria-label="Saved conversation"');
  });
});
