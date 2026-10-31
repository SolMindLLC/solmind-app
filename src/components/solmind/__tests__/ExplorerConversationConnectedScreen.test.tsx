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
import {
  ExplorerConversationConnectedScreen,
  type ConnectedConversationActions,
  type ConnectedConversationView,
} from "../ExplorerConversationConnectedScreen";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const SCREEN_FILE = "src/components/solmind/ExplorerConversationConnectedScreen.tsx";
const WORDING_FILE = "src/lib/solmind/explorerConversationConnectedScreen.ts";
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

function unescapeHtml(text: string): string {
  return text.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function noteTextById(html: string, id: string): string | null {
  const match = new RegExp(`<p[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</p>`).exec(html);
  return match ? unescapeHtml(match[1].replace(/<[^>]+>/g, "")) : null;
}

function textOf(html: string): string {
  return unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
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

  it("CC03 shows the approved live sentences and the Explorer home link", () => {
    const html = render();
    expect(html).toContain(CONVERSATION_FOOTER);
    expect(CONNECTED_INTRO).toBe(
      "Explore with the SolMind Virtual Guide. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.",
    );
    expect(html).toContain(CONNECTED_INTRO);
    expect(html).toContain('href="/explorer/home"');
    expect(/<h1[^>]*tabindex="-1"[^>]*>Your conversation<\/h1>/i.test(html)).toBe(true);
  });

  it("CC04 every unwired control is aria-disabled, never disabled, and explained by a visible note", () => {
    const html = render();
    const unwired = [...html.matchAll(/<button\b[^>]*data-preview-control="unwired"[^>]*>/g)].map((match) => match[0]);
    expect(unwired.length).toBeGreaterThan(10);
    for (const tag of unwired) {
      expect(attribute(tag, "aria-disabled"), tag).toBe("true");
      expect(/\sdisabled=""/.test(tag), tag).toBe(false);
      const text = noteTextById(html, attribute(tag, "aria-describedby") ?? "");
      expect(text?.startsWith(NOT_YET_IMPLEMENTED_PREFIX), tag).toBe(true);
      expect(ALL_NOTES).toContain(text);
    }
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
    for (const file of [SCREEN_FILE, WORDING_FILE]) {
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
