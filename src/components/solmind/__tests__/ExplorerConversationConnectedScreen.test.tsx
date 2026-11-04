import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CARD_LABELS, CARD_POINTS, cardState } from "../../../../tests/browser/connectedCardFixture";
import ExplorerConversationPage from "../../../app/explorer/conversation/page";
import {
  CONNECTED_COMPASS_WORDING,
  CONNECTED_WAYPOINT_WORDING,
  DASHED_NEEDLE_WORDING,
  NEEDLE_HOLD_DRAWER_TEXT,
  NEEDLE_HOLD_TEXT,
  type CardCompassView,
  type NeedleHold,
} from "../../../lib/solmind/explorerConnectedCard";
import {
  CONNECTED_INTRO,
  CONNECTED_SHELL,
  CURRENT_TOOLS_HEADING,
  CURRENT_TOOLS_POINTER,
  CURRENT_TOOLS_REMOVAL_REASON,
} from "../../../lib/solmind/explorerConversationConnectedScreen";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import {
  BUILD_NOTE_WORDING,
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
import { ConnectedCompassCard } from "../ExplorerConnectedCompassCard";
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";
import { NotConnectedProvider, UnwiredControl } from "../ExplorerConversationScreenNotYetImplemented";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const SCREEN_FILE = "src/components/solmind/ExplorerConversationConnectedScreen.tsx";
const WORDING_FILE = "src/lib/solmind/explorerConversationConnectedScreen.ts";
// The connected Compass & Waypoint card (chat step slices S1 and S2) and its mapping and wording.
const CARD_FILES = [
  "src/components/solmind/ExplorerConnectedCompassCard.tsx",
  "src/components/solmind/ExplorerConnectedWaypointCard.tsx",
  "src/lib/solmind/explorerConnectedCard.ts",
];
// The shared menu labels leaf and the signed-in menu data (Paul's 2026-11-02 option A).
const MENU_FILES = ["src/lib/solmind/workspaceNavigation.ts", "src/lib/solmind/workspaceMenus.ts"];
// The blue build-note label exactly as NotConnectedLine draws it (Paul's build-note rule, decision queue
// 2026-11-03 17:59:20 and 18:00:59 CST: the September 23 grey line became the same words in the reserved blue).
const BLUE_LABEL = `<span class="text-[11px] font-normal text-[#4A86FF]" data-build-note="label">${WORKSPACE_NOT_CONNECTED_LABEL}</span>`;
// The blue build-note box of an area not built yet: dashed, its lead words, then its sentence, then its X.
const BOX_OPEN =
  '<div class="relative grid gap-0.5 rounded-lg border border-dashed border-[#4A86FF] bg-[#071433] py-1.5 pl-2.5 pr-9 text-left [overflow-wrap:anywhere]" data-build-note="box">' +
  `<p class="text-[11px] font-semibold leading-4 text-[#4A86FF]">${WORKSPACE_NOT_CONNECTED_LABEL}</p>`;
const BOX_SENTENCE_CLASS = "text-xs leading-5 text-[#D6E4FF]";
// The notes that describe an area rather than a control: shown, never hidden. Since chat step
// slices S1 and S2 the Compass and Waypoint card is connected, so its "compass" and "waypointCard"
// notes are gone. Since the chat card redesign (Paul's decision, decision queue 2026-11-03 18:05:33
// CST) the Compass card's "formingPoint" and "needle" notes are gone too, a dated exception to the
// rule that unbuilt areas stay marked; Key Insights keep their marked area.
const AREA_NOTES = ["choiceGroup", "earlierCompass", "keyInsight", "latestChange"];
const REPLACED_AREA_NOTES = ["compass", "waypointCard", "formingPoint", "needle"] as const;
// The card texts the redesign removed (Paul: "there is too much text explaining things"): the
// instruction under "Point the needle", the placement paragraph and the Full view's line about
// the Compact view.
const REMOVED_CARD_TEXTS = [
  "To show what you want to focus on now, choose a point. The needle moves there, and your Priority stays the same.",
  "To point the needle at one of these points, first place it on your Compass with Review Compass arrangement in your current tools below. Once a Compass is arranged, the needle points only to placed points.",
  "not on your Compass, switch to Compact view.",
] as const;
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

// Each area note shown in the markup, with the markup of the element that directly contains it (its build-note box).
function shownAreaNotes(html: string): { id: string; key: string; sentence: string; area: string; noteAt: number }[] {
  const elements = markupElements(html);
  const sentence = new RegExp(`<p class="${BOX_SENTENCE_CLASS.replaceAll("[", "\\[").replaceAll("]", "\\]")}" id="(nyi-\\w+-(\\w+))">([^<]*)</p>`, "g");
  return [...html.matchAll(sentence)].map((match) => {
    const parent = elements.find((element) => element.start === match.index)?.parent;
    if (!parent) throw new Error(`no_parent_${match[2]}`);
    return {
      id: match[1],
      key: match[2],
      sentence: unescapeHtml(match[3]),
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
    // empty-slot style, which is not a review mark, and carry the violet removal marker (CC28),
    // so the class checks leave them out.
    const toolsAt = html.indexOf('<section aria-labelledby="conversation-current-tools-heading"');
    const panelAt = html.indexOf('<aside aria-labelledby="conversation-preview-panel-heading"');
    expect(toolsAt).toBeGreaterThan(0);
    expect(panelAt).toBeGreaterThan(toolsAt);
    const screen = html.slice(0, toolsAt) + html.slice(panelAt);
    expect(html).not.toContain(NOT_YET_IMPLEMENTED_PREFIX);
    expect(html).not.toContain("data-preview-");
    // (The real controls keep their own disabled:cursor-not-allowed state style.)
    expect(screen.match(/.{0,80}(?:\bsky-|(?<!disabled:)cursor-not-allowed|aria-disabled).{0,40}/g) ?? []).toEqual([]);
    // Since Paul's build-note rule (decision queue 2026-11-03 17:59:20 CST) the only dashed edges here are the
    // blue build-note boxes of the areas not built yet, each carrying its marker.
    const dashed = [...screen.matchAll(/<\w+\b[^>]*\bborder-dashed\b[^>]*>/g)].map(([tag]) => tag);
    expect(dashed.length).toBe(2);
    for (const tag of dashed) expect(BOX_OPEN.startsWith(tag), tag).toBe(true);
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
    // A sentence describing an area rather than a control is shown, without the prefix, in a blue
    // build-note box (Paul's build-note rule, decision queue 2026-11-03 17:59:20 CST) that starts with
    // the "Not connected yet" words, so it does not read as a working feature. The box's only control
    // is its X, which hides that box and is described by the sentence. The empty conversation adds the
    // "Ways to begin" area.
    const empty = render(view({ state: savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null }) }));
    const areaNotes = [...shownAreaNotes(html), ...shownAreaNotes(empty)];
    expect([...new Set(areaNotes.map((note) => note.key))].sort()).toEqual(AREA_NOTES);
    for (const { id, key, sentence, area, noteAt } of areaNotes) {
      expect(sentences, key).toContain(sentence);
      expect(area.startsWith(BOX_OPEN), key).toBe(true);
      expect(BOX_OPEN.length, key).toBe(noteAt);
      const controls = [...area.matchAll(/<(?:button|a|textarea|input|select)\b[^>]*>/g)].map(([tag]) => tag);
      expect(controls, key).toEqual([
        `<button aria-describedby="${id}" aria-label="${BUILD_NOTE_WORDING.hide}" class="${attribute(controls[0] ?? "", "class")}" type="button">`,
      ]);
      expect(area.endsWith("</svg></button></div>"), key).toBe(true);
    }
    // The card replaced the Compass and Waypoint area sentences, in both the loaded and the empty conversation;
    // since the redesign the Compass card has no forming-point or needle note either, also with a saved Compass.
    const loaded = render(view({ state: cardState() }));
    expect(textOf(screen)).not.toContain("New points will show as Forming until you confirm them at a natural pause.");
    expect(textOf(screen)).not.toContain("The needle will follow what you are talking about right now. It never changes your Priority.");
    for (const key of REPLACED_AREA_NOTES) {
      const sentence = notYetImplementedNotes(UNNAMED_GUIDE)[key].slice(NOT_YET_IMPLEMENTED_PREFIX.length + 1);
      for (const [name, markup] of [["loaded", html], ["empty", empty], ["card", loaded]] as const) {
        expect(textOf(markup), `${key} ${name}`).not.toContain(sentence);
        expect(markup, `${key} ${name}`).not.toContain(`id="nyi-panel-${key}"`);
        expect(markup, `${key} ${name}`).not.toContain(`id="nyi-drawer-${key}"`);
      }
    }
    // Key Insights are not built yet (Paul's decision 7): their own area, its heading, then its build-note box.
    expect(html).toContain(
      '<section aria-labelledby="panel-connected-key-insight-title" class="grid gap-2 border-b border-stone-800/80 px-4 py-4">' +
      `<h3 class="font-serif text-lg text-stone-50" id="panel-connected-key-insight-title">Key Insight</h3>${BOX_OPEN}` +
      `<p class="${BOX_SENTENCE_CLASS}" id="nyi-panel-keyInsight">`,
    );
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

  it("CC19 the profile chip's name is its visible role and blue label, with profile for screen readers", () => {
    const html = render();
    const chip = /<button\b([^>]*\saria-controls="nyi-top-profile"[^>]*)>([\s\S]*?)<\/button>/.exec(html);
    expect(chip).not.toBeNull();
    expect(attribute(chip?.[1] ?? "", "aria-label")).toBeNull();
    expect(attribute(chip?.[1] ?? "", "aria-expanded")).toBe("false");
    expect(chip?.[2]).toContain('<span class="sr-only"> profile</span>');
    expect(chip?.[2]).toContain(BLUE_LABEL);
    expect(textOf(chip?.[2] ?? "").trim()).toBe("Explorer profile Not connected yet");
  });

  it("CC20 the bell shows the blue label beside its icon, with Notifications for screen readers", () => {
    const html = render();
    const bell = /<button\b([^>]*\saria-controls="nyi-top-notifications"[^>]*)>([\s\S]*?)<\/button>/.exec(html);
    expect(bell).not.toBeNull();
    // Like the menu entries and the profile chip, the visible blue label is part of its name, once.
    expect(attribute(bell?.[1] ?? "", "aria-label")).toBeNull();
    expect(attribute(bell?.[1] ?? "", "aria-expanded")).toBe("false");
    expect(attribute(bell?.[1] ?? "", "type")).toBe("button");
    expect(bell?.[2]).toMatch(new RegExp(`^<svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg><span class="sr-only">Notifications </span>${BLUE_LABEL.replaceAll("[", "\\[").replaceAll("]", "\\]")}$`));
    expect(textOf(bell?.[2] ?? "").trim()).toBe("Notifications Not connected yet");
    expect(html).not.toContain("(not connected yet)");
    // The bell keeps its earlier height (h-10), border, colours and hover; the blue label sits beside the icon.
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
    for (const file of [SCREEN_FILE, WORDING_FILE, ...MENU_FILES, ...CARD_FILES]) {
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

  // Chat step slices S1 and S2 (build spec 2026-11-03): the connected Compass & Waypoint card.
  const panelOf = (html: string) => {
    const at = html.indexOf('<aside aria-labelledby="conversation-preview-panel-heading"');
    expect(at).toBeGreaterThan(0);
    return html.slice(at);
  };
  const pointButtons = (html: string) =>
    [...html.matchAll(/<button\b([^>]*\saria-pressed="(?:true|false)"[^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, body]) => ({
      attrs, text: textOf(body).trim(), disabled: /\sdisabled=""/.test(attrs), pressed: attribute(attrs, "aria-pressed"),
      describedBy: attribute(attrs, "aria-describedby"), style: attribute(attrs, "style"),
    }));
  // Compact and Full views (build spec 2026-11-03): the card on its own, in the view and scope given,
  // inside the provider the screen places.
  type CardOptions = Readonly<{ state?: ExplorerConversationState; hold?: NeedleHold | null; view?: CardCompassView; scope?: string }>;
  const cardMarkup = ({ state = cardState(), hold = null, view: shown = "full", scope = "panel" }: CardOptions = {}) =>
    renderToStaticMarkup(
      <NotConnectedProvider onToggle={() => {}} openId={null}>
        <ConnectedCompassCard hold={hold} onPoint={() => {}} onToggleView={() => {}} scope={scope} state={state} view={shown} />
      </NotConnectedProvider>,
    );
  // The view switch, as it reads under the Compass heading.
  const toggleTag = (scope: string, label: string) =>
    new RegExp(`<button aria-controls="${scope}-connected-compass-view" class="([^"]*)" type="button">${label}<span class="sr-only"> of the Compass</span></button>`);
  // The list's 7 buttons for the fixture: placed points first in position order, then not yet arranged, then
  // Other paths. Since the chat card redesign (Paul's decision, decision queue 2026-11-03 18:05:33 CST) the two
  // without a position can take the needle too, so only the current point is disabled.
  const LIST_BUTTONS = [
    ["Talk with my sister Priority", false, "false", null],
    ["What I need from it Upper left The needle points here", true, "true", null],
    ["Making room to rest after a long work week Upper right", false, "false", null],
    ["Money worries Detour, left", false, "false", null],
    ["Planning what to say Excursion, lower center", false, "false", null],
    ["Asking for help Not yet arranged", false, "false", null],
    ["Avoiding hard talks Other paths", false, "false", null],
  ];
  // The Compass card's section, from its opening tag to its closing tag.
  const compassSection = (html: string, scope = "panel") => {
    const at = html.indexOf(`<section aria-labelledby="${scope}-connected-compass-title"`);
    expect(at).toBeGreaterThanOrEqual(0);
    return html.slice(at, html.indexOf("</section>", at) + "</section>".length);
  };
  // The dial picture's own markup.
  const dialOf = (html: string, scope = "panel") =>
    new RegExp(`<svg aria-describedby="${scope}-connected-compass-dial-desc" aria-labelledby="${scope}-connected-compass-dial-title" class="block h-auto w-full" role="img" viewBox="0 0 360 336">([\\s\\S]*?)</svg>`).exec(html)?.[1] ?? "";
  // Each yellow symbol's centre (a diamond 5 across each way), and the bottom row's: those on its line, y 308.
  const yellowSymbols = (dial: string) =>
    [...dial.matchAll(/<path class="fill-yellow-300" d="M([\d.]+) ([\d.]+)L[^"]*Z"><\/path>/g)].map(([, x, top]) => [Number(x), Math.round((Number(top) + 5) * 100) / 100]);
  const rowSymbols = (dial: string) => yellowSymbols(dial).filter(([, y]) => y === 308);
  const rowLabels = (dial: string) =>
    [...dial.matchAll(/<text class="fill-stone-400 text-\[9px\]" text-anchor="middle" x="([\d.]+)" y="325">([^<]*)<\/text>/g)].map(([, x, text]) => [Number(x), unescapeHtml(text)]);
  const dashedNeedle = (dial: string) =>
    /<line class="stroke-orange-300" stroke-dasharray="8 6" stroke-linecap="butt" stroke-width="3" x1="180" x2="([\d.]+)" y1="150" y2="([\d.]+)"><\/line>/.exec(dial);
  const dashedButton = (html: string, scope = "panel") =>
    new RegExp(`<button aria-controls="${scope}-connected-needle-why" aria-expanded="(true|false)" class="([^"]*)" style="([^"]*)" type="button"><span class="sr-only">${DASHED_NEEDLE_WORDING.button}</span></button>`).exec(html);

  it("CC21 the card shows the saved Compass on its 8 positions and each Waypoint with its stage and earlier versions", () => {
    const panel = panelOf(render(view({ state: cardState() })));
    // The Compass and Waypoints areas are connected now: their headings carry no grey label. Under the Compass
    // heading comes the button that switches views, then the Full view, shown first: since the chat card redesign
    // (Paul's decision, decision queue 2026-11-03 18:05:33 CST) "Point the needle to change topic" with no
    // instruction under it, then the live line, then the dial.
    expect(panel).toMatch(new RegExp(
      '<section aria-labelledby="panel-connected-compass-title"[^>]*><h3[^>]*id="panel-connected-compass-title"><svg aria-hidden="true"[^>]*>[\\s\\S]*?</svg>Compass</h3>' +
      `<div class="flex flex-wrap items-center gap-2">${toggleTag("panel", "Compact view").source}</div>` +
      '<div class="grid gap-3" id="panel-connected-compass-view"><div aria-labelledby="panel-connected-needle-heading" class="grid gap-3" role="group">' +
      '<div class="grid gap-1"><h4 class="text-sm font-semibold text-stone-100" id="panel-connected-needle-heading">Point the needle to change topic</h4>' +
      '<div id="panel-connected-needle-live"></div></div>' +
      '<div class="relative mx-auto w-full max-w-\\[21rem\\]"><svg aria-describedby'));
    expect(panel).toMatch(/<section aria-labelledby="panel-connected-waypoint-title"[^>]*><h3[^>]*id="panel-connected-waypoint-title"><svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>Waypoints<\/h3><ul/);
    // The Compass card has no "Not connected yet" area left: it ends with the Priority and Current attention lines.
    const compassCard = compassSection(panel);
    expect(compassCard).not.toContain(WORKSPACE_NOT_CONNECTED_LABEL);
    expect(compassCard).toMatch(/<\/dl><\/div><\/section>$/);
    for (const removed of REMOVED_CARD_TEXTS) expect(textOf(panel)).not.toContain(removed);
    const dial = dialOf(panel);
    expect(dial).toContain(`<title id="panel-connected-compass-dial-title">${CONNECTED_COMPASS_WORDING.dialTitle}</title>`);
    // The description names the dial's points and the bottom row's.
    expect(unescapeHtml(/<desc id="panel-connected-compass-dial-desc">([^<]*)<\/desc>/.exec(dial)?.[1] ?? "")).toBe(
      "Priority: Talk with my sister. Upper left: What I need from it. Upper right: Making room to rest after a long work week. " +
      "Detour, left: Money worries. Excursion, lower center: Planning what to say. Not yet arranged: Asking for help. " +
      "Other paths: Avoiding hard talks. The needle points to What I need from it.");
    // The bottom row, under EXCURSION (y 292): the 2 points without a position in grey, each with one yellow symbol
    // above its label, in two places; no "+N more" and no ring (the needle is on the dial).
    expect(rowSymbols(dial)).toEqual([[120, 308], [240, 308]]);
    expect(rowLabels(dial)).toEqual([[120, CARD_LABELS.unarranged], [240, CARD_LABELS.otherPath]]);
    expect(dial).toContain('<text class="fill-stone-400 text-[9px] tracking-[0.18em]" text-anchor="middle" x="180" y="292">EXCURSION</text>');
    expect(dial).not.toContain(" more</text>");
    expect(dial).not.toContain('class="fill-none stroke-orange-300"');
    // 8 positions: 5 points and 3 empty rings, the Priority at the top in amber and the orange needle.
    expect(dial.match(/<circle\b[^>]*\sr="28"/g)?.length).toBe(8);
    expect(dial.match(/<circle class="fill-stone-950\/40 stroke-stone-800"/g)?.length).toBe(3);
    // Every bubble's drawn position with its own label lines (each tspan at the bubble's x), its colours
    // and stroke: the Priority in amber at the top, the attention point with the orange stroke.
    const bubbles = [...dial.matchAll(/<g><circle class="([^"]*)" cx="([^"]*)" cy="([^"]*)" r="28" stroke-width="([^"]*)"><\/circle><text class="fill-stone-100 text-\[9px\] font-medium" text-anchor="middle" x="([^"]*)" y="[^"]*">((?:<tspan dy="\d+" x="[^"]*">[^<]*<\/tspan>)+)<\/text><\/g>/g)]
      .map(([, classes, cx, cy, width, textX, spans]) => [cx, cy, classes, width, textX === cx,
        [...spans.matchAll(/<tspan dy="\d+" x="([^"]*)">([^<]*)<\/tspan>/g)].map(([, x, text]) => (x === cx ? text : `misplaced ${text}`))]);
    expect(bubbles).toEqual([
      ["180", "58", "fill-amber-400/25 stroke-amber-300", "2.5", true, ["Talk with", "my sister"]],
      ["114.95", "84.95", "fill-stone-900/90 stroke-orange-300", "2.5", true, ["What I need", "from it"]],
      ["245.05", "84.95", "fill-stone-900/90 stroke-stone-600", "1.2", true, ["Making room", "to rest..."]],
      ["88", "150", "fill-stone-900/90 stroke-stone-600", "1.2", true, ["Money", "worries"]],
      ["180", "242", "fill-stone-900/90 stroke-stone-600", "1.2", true, ["Planning", "what to say"]],
    ]);
    expect(dial.match(/<g>/g)?.length).toBe(5);
    // The 3 empty positions: Detour right, Excursion lower left and lower right.
    expect([...dial.matchAll(/<circle class="fill-stone-950\/40 stroke-stone-800" cx="([^"]*)" cy="([^"]*)" r="28" stroke-width="1"><\/circle>/g)]
      .map(([, cx, cy]) => [cx, cy])).toEqual([["272", "150"], ["114.95", "215.05"], ["245.05", "215.05"]]);
    // The needle's drawn end: from the centre toward the attention point (upper left), stopping just
    // outside its bubble (28 plus a 4 gap from its centre).
    const needle = /<line class="stroke-orange-300" stroke-linecap="round" stroke-width="3" x1="180" x2="([\d.]+)" y1="150" y2="([\d.]+)"><\/line>/.exec(dial);
    expect(needle).not.toBeNull();
    const [needleX, needleY] = [Number(needle?.[1]), Number(needle?.[2])];
    expect(needleX).toBeCloseTo(137.58, 2);
    expect(needleY).toBeCloseTo(107.58, 2);
    expect(Math.hypot(114.95 - needleX, 84.95 - needleY)).toBeCloseTo(32, 2);
    expect(dial.match(/<line class="stroke-orange-300"/g)?.length).toBe(1);
    expect(dial).not.toContain("stroke-dasharray");
    // A combined original is hidden; its category shows once.
    expect(panel).not.toContain(CARD_LABELS.merged);
    expect(textOf(panel)).toContain("Priority: Talk with my sister (confirmed by you)");
    expect(textOf(panel)).toContain("Current attention: What I need from it");
    // Fix round 2: the "Current attention" line can take focus after a confirmed move, and the live
    // line is in place (empty) before any hold or change. Fix round 3: on the wide panel that line is
    // not live (the page's own status line is not hidden there); in the drawer it is polite.
    expect(panel).toMatch(/<div class="flex flex-wrap gap-x-2 rounded-md [^"]*" id="panel-connected-needle-current" tabindex="-1"><dt class="text-stone-400">Current attention:<\/dt>/);
    expect(panel).toContain('id="panel-connected-needle-heading">Point the needle to change topic</h4><div id="panel-connected-needle-live"></div></div>');
    // In the drawer the line is polite, once, in either view.
    for (const shown of ["full", "compact"] as const) {
      const drawerIdle = cardMarkup({ scope: "drawer", view: shown });
      expect(drawerIdle, shown).toContain('id="drawer-connected-needle-heading">Point the needle to change topic</h4><div aria-atomic="true" aria-live="polite" id="drawer-connected-needle-live"></div></div>');
      expect(drawerIdle.match(/aria-live=/g)?.length, shown).toBe(1);
    }
    // The Full view: each point drawn on the dial is a button laid over its bubble, in position order, then each
    // point in the bottom row is a button over its place, with the list's name, rule and reason (the current point
    // is disabled and pressed). The dial is drawn in a 360 by 336 box since the bottom row was added.
    const buttons = pointButtons(panel);
    expect(buttons.map(({ text, disabled, pressed, describedBy, style }) => [text, disabled, pressed, describedBy, style])).toEqual([
      ["Talk with my sister Priority", false, "false", null, "left:50%;top:17.262%;width:15.556%;height:16.667%"],
      ["What I need from it Upper left The needle points here", true, "true", null, "left:31.931%;top:25.283%;width:15.556%;height:16.667%"],
      ["Making room to rest after a long work week Upper right", false, "false", null, "left:68.069%;top:25.283%;width:15.556%;height:16.667%"],
      ["Money worries Detour, left", false, "false", null, "left:24.444%;top:44.643%;width:15.556%;height:16.667%"],
      ["Planning what to say Excursion, lower center", false, "false", null, "left:50%;top:72.024%;width:15.556%;height:16.667%"],
      ["Asking for help Not yet arranged", false, "false", null, "left:33.333%;top:93.75%;width:31.111%;height:8.929%"],
      ["Avoiding hard talks Other paths", false, "false", null, "left:66.667%;top:93.75%;width:31.111%;height:8.929%"],
    ]);
    // Each dial button is centred on its own bubble (its share of the 360 by 336 drawing) and is as wide as it;
    // each row button is centred on its place (its symbol's x, and 315 down) and is 112 by 30.
    const drawn = [...dial.matchAll(/<g><circle class="[^"]*" cx="([^"]*)" cy="([^"]*)" r="28"/g)].map(([, cx, cy]) => [Number(cx), Number(cy)]);
    expect(drawn).toHaveLength(5);
    const places = [...drawn.map(([x, y]) => [x, y, 56, 56]), ...rowSymbols(dial).map(([x]) => [x, 315, 112, 30])];
    expect(places).toHaveLength(buttons.length);
    buttons.forEach(({ style, text }, index) => {
      const share = (name: string) => Number(new RegExp(`(?:^|;)${name}:([\\d.]+)%`).exec(style ?? "")?.[1]);
      const [x, y, width, height] = places[index];
      expect(share("left"), text).toBeCloseTo((x / 360) * 100, 2);
      expect(share("top"), text).toBeCloseTo((y / 336) * 100, 2);
      expect(share("width"), text).toBeCloseTo((width / 360) * 100, 2);
      expect(share("height"), text).toBeCloseTo((height / 336) * 100, 2);
    });
    buttons.forEach(({ attrs }, index) => {
      expect(attribute(attrs, "type")).toBe("button");
      expect(attribute(attrs, "class")).toMatch(index < 5
        ? /^absolute -translate-x-1\/2 -translate-y-1\/2 rounded-full disabled:cursor-not-allowed /
        : /^absolute -translate-x-1\/2 -translate-y-1\/2 rounded-lg disabled:cursor-not-allowed /);
    });
    // The buttons sit beside the picture, never inside it (an image's content is not a control), and say their
    // name to screen readers, since the bubble or the row shows the label. With the needle on the dial there is
    // no dashed needle and no button for it.
    const overlay = /<div class="relative mx-auto w-full max-w-\[21rem\]"><svg\b[\s\S]*?<\/svg>((?:<button\b[\s\S]*?<\/button>)*)<\/div>/.exec(panel)?.[1] ?? "";
    expect(overlay.match(/<button\b/g)?.length).toBe(7);
    expect(dial).not.toContain("<button");
    expect(dashedButton(panel)).toBeNull();
    expect(panel).not.toContain(DASHED_NEEDLE_WORDING.button);
    expect(panel).toContain('<span class="sr-only"><span class="font-medium [overflow-wrap:anywhere]">Talk with my sister</span> <span class="text-[11px] text-stone-300">Priority</span></span></button>');
    expect(panel).toContain('>Upper left</span> <span class="text-[11px] font-semibold text-orange-200">The needle points here</span></span></button>');
    expect(panel).toContain('<span class="sr-only"><span class="font-medium [overflow-wrap:anywhere]">Asking for help</span> <span class="text-[11px] text-stone-300">Not yet arranged</span></span></button>');
    // The dial and the list never show together: no list or groups in the Full view, and no instruction,
    // placement sentence or line about the Compact view anywhere.
    for (const group of ["placed", "unarranged", "other"]) expect(panel).not.toContain(`id="panel-connected-needle-${group}"`);
    expect(panel).not.toContain('id="panel-connected-needle-placement"');
    expect(panel).not.toContain('id="panel-connected-needle-help"');
    expect(panel).not.toContain('id="panel-connected-needle-hold"');
    // Waypoints: one card per Waypoint, in saved order, each stage named, older wording as an Earlier version.
    const cards = [...panel.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => textOf(match[0]).trim());
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatch(/^Waypoint Ask my sister for a calm evening Formed Why it matters So we can talk without rushing Reached looks like We have a day and a time Earlier versions, kept in your private history Earlier version - Formed Ask my sister for a calm hour/);
    expect(cards[1]).toMatch(/^Waypoint Say what I need in one sentence Reached .* Earlier version - Reached Write down what I need/);
    expect(cards[2]).toMatch(/^Waypoint Fix the budget this month Released .* Earlier version - Released Fix the budget this month Why it matters: Money worry keeps me up/);
    expect(textOf(panel)).toContain(CURRENT_TOOLS_POINTER);
    expect(CURRENT_TOOLS_POINTER).toBe(
      "To add, arrange or reword Compass points, or to choose, clarify, reach or release a Waypoint, use your current tools below the conversation.");
  });

  it("CC22 the needle is held, with its reason on screen, only while a change, a reply or End is under way, or after End", () => {
    // Each case with the hold the screen gives it; the screen shows the Full view, and the card on its own is
    // checked in the Compact view with that same hold.
    const held: [ConnectedConversationView, NeedleHold][] = [
      [view({ state: cardState(), busy: true, held: true, endBlocked: true }), "busy"],
      [view({ state: cardState(), busy: true, uncertain: true, held: true, endBlocked: true }), "uncertain"],
      [view({ state: cardState({ pendingTurn: true }), held: true, endBlocked: true }), "pendingTurn"],
      [view({ state: cardState(), endReviewOpen: true, held: true }), "endReview"],
      // Fix round 2: with End review open and an unconfirmed result, or a change being checked, the card
      // never points to "Keep this session open", which is disabled then.
      [view({ state: cardState(), endReviewOpen: true, uncertain: true, held: true, endBlocked: true }), "uncertain"],
      [view({ state: cardState(), endReviewOpen: true, busy: true, held: true, endBlocked: true }), "busy"],
      [view({ state: cardState({ sessionStatus: "ended" }), ended: true, held: true }), "ended"],
    ];
    for (const [next, hold] of held) {
      const reason = NEEDLE_HOLD_TEXT[hold];
      const html = render(next);
      const compact = cardMarkup({ hold, state: next.state ?? undefined, view: "compact" });
      // The Full view's 7: the dial's 5 and the bottom row's 2 (since the redesign); the Compact view's list of 7.
      for (const [shown, panel, count] of [["full", panelOf(html), 7], ["compact", compact, 7]] as const) {
        const label = `${reason} (${shown})`;
        // The reason is shown in the card's line, which on the wide panel is not live (fix round 3): the
        // page's own status line already says when a change, a reply or a reload is under way.
        expect(panel, label).toContain(`<div id="panel-connected-needle-live"><p class="text-xs leading-5 text-amber-200" id="panel-connected-needle-hold">${escapeHtml(reason)}</p></div>`);
        const buttons = pointButtons(panel);
        expect(buttons, label).toHaveLength(count);
        for (const button of buttons) {
          expect(button.disabled, `${label} ${button.text}`).toBe(true);
          expect(button.describedBy, `${label} ${button.text}`).toBe("panel-connected-needle-hold");
        }
        // The view switch is never disabled: switching views changes nothing saved.
        const toggle = toggleTag("panel", shown === "full" ? "Compact view" : "Full view").exec(panel);
        expect(toggle, label).not.toBeNull();
        const group = /<div (?:aria-describedby="([^"]*)" )?aria-labelledby="panel-connected-needle-heading" class="grid gap-3" role="group">/.exec(panel);
        expect(group, label).not.toBeNull();
        // Since the redesign no view has an instruction under the heading, a placement sentence or a line about
        // the Compact view, in any state.
        expect(panel, label).toContain('id="panel-connected-needle-heading">Point the needle to change topic</h4>');
        for (const removed of REMOVED_CARD_TEXTS) expect(textOf(panel), `${label} ${removed}`).not.toContain(removed);
        expect(panel, label).not.toContain('id="panel-connected-needle-help"');
        expect(panel, label).not.toContain('id="panel-connected-needle-placement"');
        if (next.ended) {
          // An ended conversation: the group is described by its one read-only line.
          expect(group?.[1], label).toBe("panel-connected-needle-hold");
        } else {
          expect(group?.[1], label).toBeUndefined();
        }
      }
      if (next.endReviewOpen) {
        // "Keep this session open" is named only while it can be chosen.
        const keepOpen = /<button\b([^>]*)>Keep this session open<\/button>/.exec(html)?.[1] ?? "";
        expect(/\sdisabled=""/.test(keepOpen), reason).toBe(reason !== NEEDLE_HOLD_TEXT.endReview);
      }
      if (next.ended) {
        // No pointer to tools that are read-only now.
        expect(textOf(html)).not.toContain(CURRENT_TOOLS_POINTER);
        expect(textOf(html)).not.toContain("Review Compass arrangement");
      } else {
        expect(textOf(html)).toContain(CURRENT_TOOLS_POINTER);
      }
    }
    // In the narrow drawer the reasons that name a control behind it say where it is, in either view.
    const drawerCard = (hold: NeedleHold, shown: CardCompassView) => cardMarkup({ hold, scope: "drawer", view: shown });
    // There, where the page's status line is behind the modal, the reason is said in the card's polite
    // live line (fix round 3: only there).
    const drawerLive = (text: string) =>
      `<div aria-atomic="true" aria-live="polite" id="drawer-connected-needle-live"><p class="text-xs leading-5 text-amber-200" id="drawer-connected-needle-hold">${escapeHtml(text)}</p></div>`;
    for (const shown of ["full", "compact"] as const) {
      for (const hold of ["uncertain", "pendingTurn", "endReview"] as const) {
        const card = drawerCard(hold, shown);
        expect(card, `${hold} ${shown}`).toContain(drawerLive(NEEDLE_HOLD_DRAWER_TEXT[hold]));
        expect(textOf(card), `${hold} ${shown}`).not.toContain(NEEDLE_HOLD_TEXT[hold]);
        expect(NEEDLE_HOLD_DRAWER_TEXT[hold], hold).toContain("lose this panel, then choose ");
        for (const button of pointButtons(card)) expect(button.describedBy, `${hold} ${shown} ${button.text}`).toBe("drawer-connected-needle-hold");
      }
      expect(drawerCard("busy", shown)).toContain(drawerLive(NEEDLE_HOLD_TEXT.busy));
      expect(drawerCard("ended", shown)).toContain(drawerLive(NEEDLE_HOLD_TEXT.ended));
    }
    // An unavailable Virtual Guide or a full conversation does not hold the needle: the screen says the
    // Compass still works then, from the dial, its bottom row and the list (every point but the current one).
    const open = pointButtons(panelOf(render(view({ state: cardState(), sendUnavailable: true, atMessageCapacity: true }))));
    expect(open.filter((button) => !button.disabled).map((button) => button.text.split(" ")[0])).toEqual(["Talk", "Making", "Money", "Planning", "Asking", "Avoiding"]);
    const openList = pointButtons(cardMarkup({ view: "compact" }));
    expect(openList.filter((button) => !button.disabled).map((button) => button.text.split(" ")[0])).toEqual(["Talk", "Making", "Money", "Planning", "Asking", "Avoiding"]);
    // Every reason says why, and so does the heading and the dashed needle's instruction.
    for (const reason of [...Object.values(NEEDLE_HOLD_TEXT), ...Object.values(NEEDLE_HOLD_DRAWER_TEXT)]) {
      expect(reason).toMatch(/^(?:To |This conversation has ended, so )/);
    }
    expect(CONNECTED_COMPASS_WORDING.chooseHeading).toMatch(/ to change topic$/);
    expect(DASHED_NEEDLE_WORDING.unarranged).toMatch(/ To place it, use Review Compass arrangement in your current tools\.$/);
    expect(DASHED_NEEDLE_WORDING.unarrangedDrawer).toMatch(/ To place it, close this panel, then use Review Compass arrangement in your current tools\.$/);
  });

  it("CC23 before a read, and for a conversation with nothing saved, the card says so and offers no point", () => {
    const loading = panelOf(render(view({ state: null, busy: true, statusText: "Loading your saved conversation...", reloadAvailable: false })));
    expect(loading).toContain(CONNECTED_COMPASS_WORDING.notLoaded);
    expect(loading).toContain(CONNECTED_WAYPOINT_WORDING.notLoaded);
    expect(loading).not.toContain('role="img"');
    expect(pointButtons(loading)).toEqual([]);
    const empty = panelOf(render(view({ state: savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null }) })));
    expect(empty).toContain(`>${CONNECTED_COMPASS_WORDING.emptyLead}</p>`);
    expect(empty).toContain(CONNECTED_COMPASS_WORDING.empty);
    expect(empty).toContain(CONNECTED_WAYPOINT_WORDING.empty);
    expect(empty).not.toContain('role="img"');
    expect(empty).not.toContain("<article");
    expect(pointButtons(empty)).toEqual([]);
    // With nothing to show there is nothing to switch: no view button and no view.
    for (const html of [loading, empty]) {
      expect(html).not.toContain("-connected-compass-view");
      expect(html).not.toContain("of the Compass</span>");
    }
  });

  // Compact and Full views (build spec 2026-11-03; Paul's decisions, decision queue 16:20:29 and 16:24:39 CST).
  it("CC24 the Compact view is the point list, with the two lines and no dial; the unplaced points are grey with the yellow symbol", () => {
    const compact = cardMarkup({ view: "compact" });
    // Under the heading the button names the view it switches to; then the two lines, then "Point the needle to
    // change topic" with no instruction under it (the chat card redesign, decision queue 2026-11-03 18:05:33 CST).
    expect(compact).toMatch(new RegExp(
      `Compass</h3><div class="flex flex-wrap items-center gap-2">${toggleTag("panel", "Full view").source}</div>` +
      '<div class="grid gap-3" id="panel-connected-compass-view"><dl class="grid gap-1 text-sm">'));
    expect(compact).toContain(
      '</dl><div aria-labelledby="panel-connected-needle-heading" class="grid gap-3" role="group">' +
      '<div class="grid gap-1"><h4 class="text-sm font-semibold text-stone-100" id="panel-connected-needle-heading">Point the needle to change topic</h4>' +
      '<div id="panel-connected-needle-live"></div></div>');
    // No dial in this view: no picture, no dial buttons and no bottom row.
    expect(compact).not.toContain('role="img"');
    expect(compact).not.toContain("connected-compass-dial");
    expect(compact).not.toContain("-translate-x-1/2");
    expect(compact).not.toContain(" more points, shown in the Compact view");
    for (const removed of REMOVED_CARD_TEXTS) expect(textOf(compact)).not.toContain(removed);
    expect(textOf(compact)).toContain("Priority: Talk with my sister (confirmed by you)");
    expect(textOf(compact)).toContain("Current attention: What I need from it");
    expect(compact).toMatch(/<div class="flex flex-wrap gap-x-2 rounded-md [^"]*" id="panel-connected-needle-current" tabindex="-1"><dt class="text-stone-400">Current attention:<\/dt>/);
    // Every current point, placed ones first in position order, then not yet arranged, then Other paths; each one
    // but the current point can take the needle.
    const buttons = pointButtons(compact);
    expect(buttons.map(({ text, disabled, pressed, describedBy }) => [text, disabled, pressed, describedBy])).toEqual(LIST_BUTTONS);
    for (const { attrs, style } of buttons) {
      expect(attribute(attrs, "type")).toBe("button");
      expect(style).toBeNull();
    }
    // Real spaces keep the parts of each button's name apart for screen readers.
    expect(compact).toContain('>Talk with my sister</span> <span class="text-[11px] text-stone-300">Priority</span></button>');
    expect(compact).toContain('>Upper left</span> <span class="text-[11px] font-semibold text-orange-200">The needle points here</span></button>');
    // The points without a position are grey, each with the small yellow symbol (hidden from screen readers)
    // before its label; the placed points have neither.
    const symbol = '<svg aria-hidden="true" class="h-2.5 w-2.5 shrink-0 fill-yellow-300" focusable="false" viewBox="0 0 10 10"><path d="M5 0L10 5L5 10L0 5Z"></path></svg>';
    expect(compact.split(symbol).length - 1).toBe(2);
    for (const label of [CARD_LABELS.unarranged, CARD_LABELS.otherPath]) {
      expect(compact).toContain(`<span class="flex items-center gap-1.5">${symbol}<span class="font-medium [overflow-wrap:anywhere]">${label}</span></span>`);
    }
    buttons.forEach(({ attrs, text }, index) => {
      const classes = attribute(attrs, "class") ?? "";
      if (index === 1) expect(classes, text).toContain("text-orange-50");
      else expect(classes.includes(" text-stone-400 "), text).toBe(index >= 5);
    });
    expect(compact).not.toContain('id="panel-connected-needle-placement"');
    expect(compact).not.toContain('id="panel-connected-needle-hold"');
    for (const group of ["On your Compass", "Not yet arranged", "Other paths"]) expect(compact).toContain(`>${group}</p>`);
    // The current point without a position shows that the needle points there, and keeps its symbol.
    const onOther = pointButtons(cardMarkup({ state: cardState({ attentionId: CARD_POINTS.otherPath }), view: "compact" }));
    expect(onOther.map(({ text, disabled, pressed }) => [text, disabled, pressed]).slice(5)).toEqual([
      ["Asking for help Not yet arranged", false, "false"],
      ["Avoiding hard talks Other paths The needle points here", true, "true"],
    ]);
    // The dial's and the bottom row's buttons carry exactly the list's names for the same points.
    const dialNames = pointButtons(cardMarkup({ view: "full" })).map((button) => button.text);
    expect(dialNames).toEqual(LIST_BUTTONS.map(([text]) => text));
    // The forming-point and needle areas are gone from both views (the redesign; AGENTS.md records the exception).
    for (const html of [compact, cardMarkup({ view: "full" })]) {
      expect(textOf(html)).not.toContain("New points will show as Forming until you confirm them at a natural pause.");
      expect(textOf(html)).not.toContain("The needle will follow what you are talking about right now. It never changes your Priority.");
      expect(html).not.toContain(WORKSPACE_NOT_CONNECTED_LABEL);
      expect(html).not.toContain('id="nyi-panel-');
    }
  });

  it("CC25 one view at a time, its own switch per scope, and the bottom row holds the points without a position", () => {
    // The screen starts in the Full view, with one view container that the button controls.
    const html = render(view({ state: cardState() }));
    const panel = panelOf(html);
    expect(toggleTag("panel", "Compact view").test(panel)).toBe(true);
    expect(html.split('id="panel-connected-compass-view"').length - 1).toBe(1);
    expect(html.split('aria-controls="panel-connected-compass-view"').length - 1).toBe(1);
    expect(panel.match(/role="img"/g)?.length).toBe(1);
    // The phone drawer's card has its own button and view.
    for (const [shown, label] of [["full", "Compact view"], ["compact", "Full view"]] as const) {
      const drawer = cardMarkup({ scope: "drawer", view: shown });
      expect(toggleTag("drawer", label).test(drawer), shown).toBe(true);
      expect(drawer.split('id="drawer-connected-compass-view"').length - 1, shown).toBe(1);
      expect(drawer.includes('role="img"'), shown).toBe(shown === "full");
      expect(drawer.includes('id="drawer-connected-needle-placed"'), shown).toBe(shown === "compact");
    }
    // One point without a position: one place, in the middle. None: no row, only the dial's 5 buttons.
    const items = cardState().compassItems;
    const oneOff = cardMarkup({ state: cardState({ compassItems: items.filter((item) => item.id !== CARD_POINTS.unarranged) }) });
    expect(rowSymbols(dialOf(oneOff))).toEqual([[180, 308]]);
    expect(rowLabels(dialOf(oneOff))).toEqual([[180, CARD_LABELS.otherPath]]);
    expect(pointButtons(oneOff).at(-1)?.style).toBe("left:50%;top:93.75%;width:31.111%;height:8.929%");
    const noneOff = cardState({ compassItems: items.filter((item) => item.id !== CARD_POINTS.unarranged && item.id !== CARD_POINTS.otherPath) });
    const allOnDial = cardMarkup({ state: noneOff });
    expect(yellowSymbols(dialOf(allOnDial))).toEqual([]);
    expect(rowLabels(dialOf(allOnDial))).toEqual([]);
    expect(pointButtons(allOnDial)).toHaveLength(5);
    // Before any arrangement the Priority is drawn at the top and the other points are in the row; the needle on
    // one of them is dashed, toward its place (120, 308), and stops 52 from the centre.
    const source = "20000000-0000-4000-8000-000000000001";
    const point = (index: number) => `40000000-0000-4000-8000-00000000000${index}`;
    const before = savedState({
      compassItems: [
        { id: point(1), sourceMessageId: source, label: "First" },
        { id: point(2), sourceMessageId: source, label: "Second" },
        { id: point(3), sourceMessageId: source, label: "Third" },
      ],
      priorityId: point(3),
      attentionId: point(1),
    });
    const beforeFull = cardMarkup({ state: before });
    expect(pointButtons(beforeFull).map(({ text, disabled, pressed, describedBy }) => [text, disabled, pressed, describedBy])).toEqual([
      ["Third Priority", false, "false", null],
      ["First Not yet arranged The needle points here", true, "true", null],
      ["Second Not yet arranged", false, "false", null],
    ]);
    expect(beforeFull).not.toContain('<line class="stroke-orange-300" stroke-linecap="round"');
    const dashed = dashedNeedle(dialOf(beforeFull));
    expect(dashed).not.toBeNull();
    expect(Number(dashed?.[1])).toBeCloseTo(161.54, 2);
    expect(Number(dashed?.[2])).toBeCloseTo(198.61, 2);
    expect(Math.hypot(Number(dashed?.[1]) - 180, Number(dashed?.[2]) - 150)).toBeCloseTo(52, 1);
    expect(textOf(beforeFull)).toContain("Current attention: First");
    expect(pointButtons(cardMarkup({ state: before, view: "compact" })).map(({ text, disabled }) => [text, disabled])).toEqual([
      ["Third Priority", false],
      ["First Not yet arranged The needle points here", true],
      ["Second Not yet arranged", false],
    ]);
    // No point on the dial (no Priority, nothing arranged): the Full view still offers them all, in its row.
    const nothingDrawn = savedState({
      compassItems: [
        { id: point(1), sourceMessageId: source, label: "First" },
        { id: point(2), sourceMessageId: source, label: "Second" },
      ],
    });
    const bare = cardMarkup({ state: nothingDrawn });
    expect(bare).toContain('role="img"');
    expect(bare).toContain('role="group"');
    expect(bare).toContain(">Point the needle to change topic</h4>");
    expect(pointButtons(bare).map(({ text, disabled }) => [text, disabled])).toEqual([["First Not yet arranged", false], ["Second Not yet arranged", false]]);
    expect(rowLabels(dialOf(bare))).toEqual([[120, "First"], [240, "Second"]]);
    expect(textOf(bare)).toContain("Current attention: No point chosen yet");
    const bareList = cardMarkup({ state: nothingDrawn, view: "compact" });
    expect(bareList).toContain(">Point the needle to change topic</h4>");
    expect(pointButtons(bareList).map(({ text, disabled }) => [text, disabled])).toEqual([["First Not yet arranged", false], ["Second Not yet arranged", false]]);
    // A hold is still said in the card's line, and holds the row's points too.
    const bareHeld = cardMarkup({ state: nothingDrawn, hold: "busy" });
    expect(bareHeld).toContain(`<div id="panel-connected-needle-live"><p class="text-xs leading-5 text-amber-200" id="panel-connected-needle-hold">${escapeHtml(NEEDLE_HOLD_TEXT.busy)}</p></div>`);
    expect(pointButtons(bareHeld).map(({ disabled, describedBy }) => [disabled, describedBy])).toEqual([[true, "panel-connected-needle-hold"], [true, "panel-connected-needle-hold"]]);
  });

  it("CC26 more than three points without a position: two places and +N more, which opens the Compact view and is never held", () => {
    const source = "20000000-0000-4000-8000-000000000001";
    const point = (index: number) => `40000000-0000-4000-8000-00000000000${index}`;
    // Five points not yet arranged and an Other paths one, on an arranged Compass with one placed Priority.
    const many = (attention: number | null) => savedState({
      compassItems: [
        { id: point(1), sourceMessageId: source, label: "Placed Priority", anchor: "apex", emphasis: 3 },
        ...[2, 3, 4, 5, 6].map((index) => ({ id: point(index), sourceMessageId: source, label: `Waiting ${index}`, anchor: null, emphasis: null })),
        { id: point(7), sourceMessageId: source, label: "Off path", anchor: null, emphasis: 1 },
      ],
      priorityId: point(1),
      attentionId: attention === null ? point(1) : point(attention),
    });
    const full = cardMarkup({ state: many(null) });
    const dial = dialOf(full);
    expect(rowSymbols(dial)).toEqual([[60, 308], [180, 308]]);
    expect(rowLabels(dial)).toEqual([[60, "Waiting 2"], [180, "Waiting 3"], [300, "+4 more"]]);
    expect(unescapeHtml(/<desc id="panel-connected-compass-dial-desc">([^<]*)<\/desc>/.exec(dial)?.[1] ?? "")).toBe(
      "Priority: Placed Priority. Not yet arranged: Waiting 2. Not yet arranged: Waiting 3. 4 more points are listed in the Compact view. " +
      "The needle points to Placed Priority.");
    // "+4 more" is a button over the third place that controls the view; it has no pressed state and is not a point.
    const more = new RegExp('<button aria-controls="panel-connected-compass-view" class="([^"]*)" style="([^"]*)" type="button"><span class="sr-only">\\+4 more points, shown in the Compact view</span></button>').exec(full);
    expect(more).not.toBeNull();
    expect(more?.[2]).toBe("left:83.333%;top:93.75%;width:31.111%;height:8.929%");
    expect(more?.[1]).toMatch(/^absolute -translate-x-1\/2 -translate-y-1\/2 rounded-lg /);
    expect(pointButtons(full).map(({ text }) => text)).toEqual(["Placed Priority Priority The needle points here", "Waiting 2 Not yet arranged", "Waiting 3 Not yet arranged"]);
    // Held or ended, "+4 more" still works (it changes nothing saved), while the points wait.
    for (const hold of ["busy", "ended"] as const) {
      const held = cardMarkup({ hold, state: many(null) });
      expect(/<button aria-controls="panel-connected-compass-view" class="[^"]*" style="left:83.333%[^"]*" type="button">/.test(held), hold).toBe(true);
      expect(pointButtons(held).every((button) => button.disabled), hold).toBe(true);
    }
    // The needle on a point beyond the first two: that point takes the second place, and the dashed needle points
    // to it (straight down, toward 180, 308), with the yellow symbol at its tip and the orange ring on its place.
    const onSixth = cardMarkup({ state: many(6) });
    const sixthDial = dialOf(onSixth);
    expect(rowLabels(sixthDial)).toEqual([[60, "Waiting 2"], [180, "Waiting 6"], [300, "+4 more"]]);
    const dashed = dashedNeedle(sixthDial);
    expect([Number(dashed?.[1]), Number(dashed?.[2])]).toEqual([180, 202]);
    expect(yellowSymbols(sixthDial)).toEqual([[180, 202], [60, 308], [180, 308]]);
    expect(sixthDial).toContain('<circle class="fill-none stroke-orange-300" cx="180" cy="308" r="8.5" stroke-width="1.5"></circle>');
    expect(sixthDial.split('class="fill-none stroke-orange-300"').length - 1).toBe(1);
    expect(pointButtons(onSixth).map(({ text, pressed }) => [text, pressed])).toEqual([
      ["Placed Priority Priority", "false"], ["Waiting 2 Not yet arranged", "false"], ["Waiting 6 Not yet arranged The needle points here", "true"],
    ]);
    // The dashed needle is a button with an accessible name, controlling its sentence, collapsed at first (the
    // sentence is drawn only once shown); it sits 30 along the needle, a 34 square clear of the bubbles' buttons.
    const button = dashedButton(onSixth);
    expect(button).not.toBeNull();
    expect(button?.[1]).toBe("false");
    expect(button?.[2]).toMatch(/^absolute -translate-x-1\/2 -translate-y-1\/2 rounded-full /);
    expect(button?.[3]).toBe("left:50%;top:53.571%;width:9.444%;height:10.119%");
    expect(onSixth).not.toContain('id="panel-connected-needle-why"');
    // The dashed needle's button follows the dial's buttons and comes before the row's in the reading order.
    expect(onSixth.indexOf(DASHED_NEEDLE_WORDING.button)).toBeGreaterThan(onSixth.indexOf(">Placed Priority</span>"));
    expect(onSixth.indexOf(DASHED_NEEDLE_WORDING.button)).toBeLessThan(onSixth.indexOf(">Waiting 2</span>"));
    // It is never disabled, also while the needle is held or after End.
    for (const hold of ["busy", "ended"] as const) {
      const held = dashedButton(cardMarkup({ hold, state: many(6) }));
      expect(held, hold).not.toBeNull();
      expect(held?.[0], hold).not.toContain("disabled");
    }
    // On an Other paths point (in the row only when it is shown): the same dashed needle, in the drawer too.
    const onOther = cardMarkup({ scope: "drawer", state: cardState({ attentionId: CARD_POINTS.otherPath }) });
    const otherDial = dialOf(onOther, "drawer");
    const otherDashed = dashedNeedle(otherDial);
    expect([Number(otherDashed?.[1]), Number(otherDashed?.[2])]).toEqual([198.46, 198.61]);
    expect(dashedButton(onOther, "drawer")).not.toBeNull();
    expect(otherDial.match(/<line class="stroke-orange-300"/g)?.length).toBe(1);
    // The bubble the solid needle would point at keeps its plain stroke.
    expect(otherDial).not.toContain("stroke-orange-300\" cx=\"114.95\"");
  });

  // Paul's build-note rule (decision queue 2026-11-03 17:59:20, 18:00:59 and 18:03:39 CST; build spec
  // .validation/build-notes-20261103): the page toggle, the blue labels and boxes, and the violet removal marker.
  it("CC27 the screen's build notes: one toggle in the top bar, a blue label on each control, a box per area", () => {
    const html = render();
    const markers = (markup: string) => [...markup.matchAll(/data-(build-note|removal-marker)="(\w+)"/g)].map(([, kind, value]) => `${kind}:${value}`);
    const count = (markup: string, marker: string) => markers(markup).filter((found) => found === marker).length;
    // 13 controls not built yet (CC04), one blue label each; the two area boxes of a saved conversation (the
    // latest-change line and Key Insights); the toggle; the outline and tag on the current tools.
    expect(count(html, "build-note:label")).toBe(13);
    expect(count(html, "build-note:box")).toBe(2);
    expect(count(html, "build-note:toggle")).toBe(1);
    expect(count(html, "removal-marker:outline")).toBe(1);
    expect(count(html, "removal-marker:tag")).toBe(1);
    expect(markers(html)).toHaveLength(13 + 2 + 1 + 2);
    expect(html.split(BLUE_LABEL).length - 1).toBe(13);
    // The empty conversation adds the two "Ways to begin" boxes.
    const empty = render(view({ state: savedState({ conversationId: null, revision: 0, messages: [], sessionStatus: null }) }));
    expect(count(empty, "build-note:box")).toBe(4);
    // The toggle: first in the top bar's right-hand group, before the bell, pressed (the notes show), named
    // "Build notes", announcing nothing and controlling no single element.
    const toggle = /<button aria-pressed="true" class="([^"]*)" data-build-note="toggle" id="build-notes-toggle" type="button">([\s\S]*?)<\/button>/.exec(html);
    expect(toggle).not.toBeNull();
    expect(textOf(toggle?.[2] ?? "").trim()).toBe(BUILD_NOTE_WORDING.toggle);
    expect(toggle?.[1]).toContain("flex h-10 items-center");
    expect(html).toContain('<div class="ml-auto flex flex-wrap items-center justify-end gap-2"><button aria-pressed="true"');
    expect(html.indexOf('id="build-notes-toggle"')).toBeLessThan(html.indexOf('aria-controls="nyi-top-notifications"'));
    // Without data the screen still has its top bar labels and the toggle, and no box outside the header.
    const loading = render(view({ state: null, busy: true, statusText: "Loading your saved conversation...", reloadAvailable: false }));
    expect(count(loading, "build-note:toggle")).toBe(1);
    expect(count(loading, "removal-marker:outline")).toBe(0);
  });

  it("CC28 the old form tools carry the violet Planned for removal outline and tag, the tag controls its hidden reason, and the tools are still rendered inside the outline", () => {
    const tools = (markup: string) => {
      const at = markup.indexOf('<section aria-labelledby="conversation-current-tools-heading"');
      expect(at).toBeGreaterThan(0);
      return markup.slice(at, markup.indexOf('<aside aria-labelledby="conversation-preview-panel-heading"'));
    };
    for (const markup of [render(), render(view({ state: savedState({ sessionStatus: "ended" }), ended: true, held: true }))]) {
      const section = tools(markup);
      expect(section).toMatch(
        /^<section aria-labelledby="conversation-current-tools-heading" class="rounded-3xl border border-stone-800 bg-\[#090807\]\/85 p-4 sm:p-5 outline-2 outline-offset-2 outline-dashed outline-\[#D27BFF\]" data-removal-marker="outline">/,
      );
      expect(section).toContain(
        `<h2 class="font-serif text-xl text-stone-50" id="conversation-current-tools-heading">${CURRENT_TOOLS_HEADING}</h2>` +
        '<div class="grid min-w-0 justify-items-start gap-1" data-removal-marker="tag"><button aria-controls="removal-current-tools" aria-expanded="false"',
      );
      expect(section).toContain(`>${BUILD_NOTE_WORDING.removalTag}</button>`);
      expect(section).toContain(
        `hidden="" id="removal-current-tools">${escapeHtml(CURRENT_TOOLS_REMOVAL_REASON)}</p>`,
      );
      // The tools themselves are unchanged and still there.
      expect(section).toContain('aria-label="Private Compass and Waypoints"');
      expect(section.split("data-removal-marker").length - 1).toBe(2);
    }
    expect(CURRENT_TOOLS_REMOVAL_REASON).toBe("These tools will be removed once the Compass & Waypoint card does everything they do.");
    // Nothing else on the screen is marked for removal.
    const html = render();
    expect(html.split("data-removal-marker").length - 1).toBe(2);
  });
});
