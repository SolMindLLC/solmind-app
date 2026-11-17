import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode, type RefObject } from "react";

import { CONVERSATION_FOOTER, notYetImplementedText } from "@/lib/solmind/explorerConversationScreen";
import {
  COMPOSER_KEY_HINT,
  COMPOSER_LABEL,
  COMPOSER_PLACEHOLDER,
  CONNECTED_GUIDE_NAME,
  CONNECTED_INTRO,
  CONNECTED_SHELL,
  CONNECTED_SPEAKER_LABELS,
  CONNECTED_TITLE,
  CONNECTED_WAITING_REPLY_TEXT,
  CONVERSATION_START_MARKER,
  OPENING_GREETING_LABEL,
  OPENING_GREETING_TEXT,
  PRIVACY_CAN_SEE_TITLE,
  PRIVACY_SHARE_TITLE,
  PRIVACY_SHARING_BUTTON,
  RELOAD_BUTTON,
  RELOAD_HELP_BUTTON_NAME,
  RELOAD_HELP_TEXT,
  RELOAD_REASON_TEXT,
  connectedOpenTargetInView,
  connectedSavedStatus,
  connectedStatusText,
  connectedStripFocusTarget,
  connectedTranscriptHeight,
  connectedTranscriptScrollsToEnd,
  connectedWaitingFocusTarget,
  nextStripExplanation,
  type ConnectedConversationStatus,
  type ConnectedSavedStatus,
  type ConnectedStripExplanation,
  type ConnectedStripFocusTarget,
} from "@/lib/solmind/explorerConversationConnectedScreen";
import {
  CONNECTED_KEY_INSIGHT_HEADING,
  needleHold,
  pointNeedleIntent,
  type CardCompassView,
} from "@/lib/solmind/explorerConnectedCard";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationError,
  type ExplorerConversationMessage,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import type { ExplorerPrivateAssistance } from "@/lib/solmind/explorerPrivateConversationResponse";
import { latestReplyChoices, nextCalmReplyPrompt } from "@/lib/solmind/explorerReplyChoices";
import { EXPLORER_TOUR_CHOICE } from "@/lib/solmind/explorerConversationTour";
import { SPEAKER_LABEL_STYLE, speakerLabelClass } from "@/lib/solmind/explorerSpeakerStyle";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";
import { withoutReviewPrefix } from "@/lib/solmind/workspaceNavigation";

import { ConnectedCompassCard } from "./ExplorerConnectedCompassCard";
import { CompassChangeLines, useCompassChangeVisit } from "./ExplorerCompassChangeLines";
import { ExplorerReplyChoices } from "./ExplorerReplyChoices";
import { ExplorerConversationTour } from "./ExplorerConversationTour";
import { ExplorerWaitingIndicator } from "./ExplorerWaitingIndicator";
import { ExplorerWaypointDraft } from "./ExplorerWaypointDraft";
import { ExplorerWaypointOffer } from "./ExplorerWaypointOffer";
import { ConnectedWaypointCard, useConnectedWaypointActions } from "./ExplorerConnectedWaypointCard";
import type { ExplorerConversationFormationIntent } from "./ExplorerConversationFormation";
import {
  BuildNotesProvider,
  useBuildNotesState,
} from "./ExplorerConversationScreenBuildNotes";
import { CONVERSATION_HEADING_ID, DRAWER_OPENER_ID, PANEL_TOGGLE_ID } from "./ExplorerConversationScreenHeader";
import { IconArrowUp, IconChevronDown, IconClipboard, IconEyeOff, IconPanelRight, IconPause } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  NotConnectedLine,
  NotConnectedProvider,
  NotYetImplementedNote,
  PRIMARY_BUTTON,
  PlaceholderSlot,
  QUIET_BUTTON,
  SECONDARY_BUTTON,
  UnwiredButton,
  UnwiredControl,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";
import { ExplorerConversationScreenShell } from "./ExplorerConversationScreenShell";
import { SpeakerBadge } from "./ExplorerConversationScreenSpeaker";
import {
  ConnectedSupportDrawer,
  ConnectedSupportPanel,
  SUPPORT_DRAWER_ID,
  SUPPORT_PANEL_ID,
  type SupportScope,
} from "./ExplorerConversationScreenSupportPanel";

// Paul's designed conversation layout showing the real saved conversation.
//
// This file is presentation only. ExplorerConversation.tsx keeps every fetch,
// authority, retry, pending-turn and End rule and passes the results here as
// read-only props; nothing here requests, stores or sends anything itself.
// The Compass & Waypoint card (ExplorerConnectedCompassCard.tsx and
// ExplorerConnectedWaypointCard.tsx) draws the saved Compass and Waypoints,
// and hands Compass choices and reviewed Reached/Release intents to onCommand,
// which ExplorerConversation.tsx sends.
// The only state kept here is layout: whether the wide panel shows, whether
// the narrow drawer is open (it closes, and focus moves to the page's alert,
// when a change made from it leaves no saved state), which Compass view (Full
// or Compact) shows in the panel and in the drawer, whether the narrow-screen Menu is open, which
// "Not connected yet" sentence is shown, which build notes show, and the local
// reply-choice dismissal and calm prompt (including its last line), which of the
// strip's two explanations is open, which strip control last held keyboard focus, and the
// Waypoint review/outcome display shared with the narrow drawer. Parts that are not connected yet show
// a blue "Not connected yet" build-note label and, when activated, one sentence directly
// under them saying what they will do (NotConnectedProvider). A note that
// describes an area rather than a control (standalone) is a blue build-note box
// with an X in its upper corner, in the area.
// The top bar's "Build notes" toggle hides or shows all of them
// (BuildNotesProvider; Paul's build-note rule, decision queue 2026-11-03
// 17:59:20, 18:00:59 and 18:03:39 CST).

const SPEAKER_STYLE = SPEAKER_LABEL_STYLE;
const CARD_CLASS =
  "rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 shadow-[0_24px_70px_rgba(0,0,0,0.45)]";
const NOTICE_CLASS = "rounded-2xl border border-stone-700 bg-black/40 p-4 text-sm leading-6 text-stone-200";
const ALERT_CLASS = "grid gap-3 rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50";
const LINK_CLASS = joinClasses("font-semibold text-amber-200 underline underline-offset-4 hover:text-amber-100", FOCUS_RING);
const COMPOSER_FIELD_ID = "conversation-message";
const COMPOSER_KEY_HINT_ID = "conversation-message-key-hint";
const END_HEADING_ID = "conversation-end-heading";
const AVAILABILITY_ID = "conversation-availability";
const CAPACITY_ID = "conversation-capacity";
const CALM_PROMPT_ID = "conversation-calm-prompt";

export type ConnectedConversationView = Readonly<{
  state: ExplorerConversationState | null;
  busy: boolean;
  awaitingReply: boolean;
  sendingMessage: string | null;
  sendingFromComposer: boolean;
  // Local display signal for every actual ordinary Send, including a follow-up.
  sendSequence: number;
  // The saved offer whose button answer is in flight (its box shows "Saving..."); absent reads as none.
  savingOfferId?: string | null;
  // The busy sentence while a request runs; otherwise the earlier answer's line (offers build), or "".
  statusText: string;
  // The error code the logic holds, also while the last change is uncertain; the strip's order of precedence reads it.
  errorCode: ExplorerConversationError | null;
  // The last accepted answer confirmed the saved conversation. Required, so no view turns the light green by omission.
  lastCheckConfirmed: boolean;
  assistance: ExplorerPrivateAssistance | null;
  // The error sentence, shown only while the last change is not uncertain.
  errorMessage: string | null;
  signInRequired: boolean;
  uncertain: boolean;
  reloadAvailable: boolean;
  draft: string;
  draftError: string;
  endReviewOpen: boolean;
  staleEndReview: boolean;
  ended: boolean;
  endBlocked: boolean;
  held: boolean;
  sendUnavailable: boolean;
  atMessageCapacity: boolean;
}>;

export type ConnectedConversationActions = Readonly<{
  onReload: () => void;
  onRetry: () => void;
  onDraftChange: (value: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onReplyChoice: (label: string) => void;
  onReviewEnd: () => void;
  onConfirmEnd: () => void;
  onKeepOpen: () => void;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>;

type ScreenProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  headingRef: RefObject<HTMLHeadingElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}>;

// Until an authenticated read succeeds the state is unknown (loading, denied,
// unavailable or needing a refresh), so nothing is said about the conversation.
function conversationStatus(state: ExplorerConversationState | null, ended: boolean): ConnectedConversationStatus {
  if (state === null) return "unknown";
  if (ended) return "ended";
  return state.conversationId === null ? "notStarted" : "active";
}

type VirtualGuideRowProps = Readonly<{
  panelVisible: boolean;
  drawerOpen: boolean;
  onTogglePanel: () => void;
  onOpenDrawer: () => void;
}>;

// The Virtual Guide's name, the AI marker, Rename and the two panel controls,
// which work here. Wide screens show Show/Hide; narrow screens open the drawer.
function ConnectedVirtualGuideRow({ panelVisible, drawerOpen, onTogglePanel, onOpenDrawer }: VirtualGuideRowProps) {
  const renameNote = noteId("header", "rename");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-3 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SpeakerBadge size="large" speaker="virtualGuide" speakerStyle={SPEAKER_STYLE} />
          <p className="font-serif text-lg text-stone-50 sm:text-xl">{SOLMIND_TERMS.virtualGuide}</p>
          <span className="rounded-full border border-amber-300/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            AI
          </span>
          <UnwiredButton className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteId={renameNote}>
            Rename
          </UnwiredButton>
        </div>
        {/* Rename's sentence comes directly after its button, before the footer line. */}
        <NotYetImplementedNote className="max-w-md" id={renameNote} noteKey="rename" />
        <p className="text-xs leading-5 text-stone-300">{CONVERSATION_FOOTER}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-controls={SUPPORT_PANEL_ID}
          aria-expanded={panelVisible}
          className={joinClasses(SECONDARY_BUTTON, "max-lg:hidden")}
          id={PANEL_TOGGLE_ID}
          onClick={onTogglePanel}
          type="button"
        >
          <IconPanelRight />
          {panelVisible ? "Hide Compass & Waypoint" : "Show Compass & Waypoint"}
        </button>
        <button
          aria-controls={SUPPORT_DRAWER_ID}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          className={joinClasses(SECONDARY_BUTTON, "lg:hidden")}
          id={DRAWER_OPENER_ID}
          onClick={onOpenDrawer}
          type="button"
        >
          <IconPanelRight />
          Show Compass &amp; Waypoint
        </button>
      </div>
    </div>
  );
}

// The compact header strip (Paul's decisions, PRJ01-SPR002 decision record 2026-11-16 17:53:42 and 21:27:10 CST).
const STRIP_BUTTON = joinClasses(
  "inline-flex min-h-8 items-center justify-center gap-2 rounded-full border border-amber-200/25 bg-white/[0.03] px-3 py-[5px] text-xs font-semibold leading-4 text-stone-100 transition-colors hover:border-amber-300/60 hover:bg-amber-300/10",
  FOCUS_RING,
);
const HELP_BUTTON = joinClasses(
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200/25 bg-white/[0.03] text-sm font-bold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-300/10",
  FOCUS_RING,
);
// The light is decoration beside its words: the words carry the meaning.
const LIGHT_CLASS = {
  green: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]",
  yellow: "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]",
} as const;
const TITLE_CLASS = joinClasses("rounded-md font-serif text-xl leading-7 text-stone-50 focus:outline-none", FOCUS_RING);
const PRIVACY_BUTTON_ID = "conversation-privacy-button";
const PRIVACY_EXPLANATION_ID = "conversation-privacy-explanation";
const SAVED_STATUS_ID = "conversation-saved-status";
const RELOAD_BUTTON_ID = "conversation-reload-button";
const RELOAD_HELP_BUTTON_ID = "conversation-reload-help-button";
const RELOAD_HELP_ID = "conversation-reload-help";

type FocusHandlers = Readonly<{
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}>;

// The page's only h1. It stands in the chat panel's band, or in the strip while no saved conversation
// is on screen (there is no chat panel then). It takes focus by script, never by Tab.
function ConversationTitle({ headingRef, focus }: Readonly<{ headingRef: RefObject<HTMLHeadingElement | null>; focus: FocusHandlers }>) {
  return (
    <h1 className={TITLE_CLASS} id={CONVERSATION_HEADING_ID} onBlur={focus.onBlur} onFocus={focus.onFocus} ref={headingRef} tabIndex={-1}>
      {CONNECTED_TITLE}
    </h1>
  );
}

// One titled line inside the "Privacy and sharing" explanation: a part that is not built yet, with
// its blue "Not connected yet" label and its unchanged sentence. It is text, not a control.
function PrivacyLine({ title, text }: Readonly<{ title: string; text: string }>) {
  return (
    <div data-privacy-line="">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-semibold text-stone-100">{title}</span>
        <NotConnectedLine />
      </p>
      <p>{text}</p>
    </div>
  );
}

type StripProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  status: ConnectedConversationStatus;
  saved: ConnectedSavedStatus;
  reloadDrawn: boolean;
  helpDrawn: boolean;
  open: ConnectedStripExplanation;
  onToggle: (chosen: "privacy" | "help") => void;
  // The h1, only while no saved conversation is on screen.
  title: ReactNode;
  reloadRef: RefObject<HTMLButtonElement | null>;
  controlFocus: FocusHandlers;
}>;

// The strip: status words and the "Private conversation" pill, then the controls ("Privacy and
// sharing", the one polite status region with the light, Reload and its "?"), then the opened
// explanation and Reload's help or reason line. The order here is the tab order.
function ConversationStrip({ view, actions, status, saved, reloadDrawn, helpDrawn, open, onToggle, title, reloadRef, controlFocus }: StripProps) {
  // The earlier answer's line (offers build) shares the status region when nothing is in flight.
  const savedLine = view.busy ? "" : view.statusText;
  return (
    <header className="grid gap-2 border-b border-amber-200/10 px-4 py-2.5 sm:px-5" data-conversation-strip="">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {title}
        {status === "unknown" ? null : <span className="text-xs leading-4 text-stone-300">{connectedStatusText(status)}</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600 bg-black/30 px-3 py-1 text-xs font-semibold text-stone-200">
          <IconEyeOff className="h-3.5 w-3.5" />
          Private conversation
        </span>
        <button
          aria-controls={PRIVACY_EXPLANATION_ID}
          aria-expanded={open === "privacy"}
          className={STRIP_BUTTON}
          id={PRIVACY_BUTTON_ID}
          onClick={() => onToggle("privacy")}
          type="button"
        >
          {PRIVACY_SHARING_BUTTON}
          <IconChevronDown className={open === "privacy" ? "rotate-180" : undefined} />
        </button>
        {/* The status region, Reload and "?" stay together at the right. On a narrow card the group
            takes its own line and wraps inside itself, so nothing runs past the card's edge. */}
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2">
          <p
            aria-atomic="true"
            aria-live="polite"
            className="inline-flex min-h-5 max-w-full flex-wrap items-center gap-x-1.5 text-xs leading-4 text-stone-200"
            id={SAVED_STATUS_ID}
            role="status"
          >
            {saved.light === null ? null : (
              <span aria-hidden="true" className={joinClasses("h-2.5 w-2.5 shrink-0 rounded-full", LIGHT_CLASS[saved.light])} data-saved-light={saved.light} />
            )}
            {saved.words === "" ? null : <span>{saved.words}</span>}
            {saved.words !== "" && savedLine !== "" ? " " : null}
            {savedLine === "" ? null : <span>{savedLine}</span>}
          </p>
          {reloadDrawn ? (
            <button
              aria-describedby={RELOAD_HELP_ID}
              className={joinClasses(STRIP_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
              disabled={view.busy}
              id={RELOAD_BUTTON_ID}
              onBlur={controlFocus.onBlur}
              onClick={actions.onReload}
              onFocus={controlFocus.onFocus}
              ref={reloadRef}
              type="button"
            >
              {RELOAD_BUTTON}
            </button>
          ) : null}
          {helpDrawn ? (
            <button
              aria-controls={RELOAD_HELP_ID}
              aria-expanded={open === "help"}
              aria-label={RELOAD_HELP_BUTTON_NAME}
              className={HELP_BUTTON}
              id={RELOAD_HELP_BUTTON_ID}
              onBlur={controlFocus.onBlur}
              onClick={() => onToggle("help")}
              onFocus={controlFocus.onFocus}
              type="button"
            >
              <span aria-hidden="true">?</span>
            </button>
          ) : null}
        </div>
      </div>
      <div
        aria-labelledby={PRIVACY_BUTTON_ID}
        className="grid gap-2.5 rounded-2xl border border-stone-700 bg-black/40 px-4 py-3 text-xs leading-5 text-stone-300"
        hidden={open !== "privacy"}
        id={PRIVACY_EXPLANATION_ID}
        role="group"
      >
        <p className="text-sm leading-6 text-stone-200">{CONNECTED_INTRO}</p>
        <PrivacyLine text={withoutReviewPrefix(notYetImplementedText("virtualGuideCanSee"))} title={PRIVACY_CAN_SEE_TITLE} />
        <PrivacyLine text={withoutReviewPrefix(notYetImplementedText("shareConversation", CONNECTED_GUIDE_NAME))} title={PRIVACY_SHARE_TITLE} />
      </div>
      {/* Reload's description for screen readers in every state. A reason line is always shown; the
          ordinary help text shows only while "?" is open. */}
      {reloadDrawn ? (
        <p className="text-xs leading-5 text-stone-300" hidden={saved.reasonLine === null && open !== "help"} id={RELOAD_HELP_ID}>
          {saved.reasonLine === null ? RELOAD_HELP_TEXT : RELOAD_REASON_TEXT[saved.reasonLine]}
        </p>
      ) : null}
    </header>
  );
}

type HeldFocus = Readonly<{ element: HTMLElement; title: boolean }>;

type FocusKeeperProps = Readonly<{
  heldFocusRef: RefObject<HeldFocus | null>;
  focusWaitsOnTitleRef: RefObject<boolean>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  reloadRef: RefObject<HTMLButtonElement | null>;
  retryRef: RefObject<HTMLButtonElement | null>;
  signInRef: RefObject<HTMLAnchorElement | null>;
  busy: boolean;
  reasonLineShown: boolean;
}>;

// Focus rules for the strip (BUILD_PLAN_R2.md section 4.8), run after every render and before the
// page-open move. It draws nothing and must be drawn after every control it may focus, because a
// layout effect runs before the refs of later siblings are set. When an answer removes the strip control or title that still
// held keyboard focus, focus moves to the control the Explorer now needs: Reload saved conversation
// when enabled, Retry the same request, Sign in, otherwise the title. A title that moved between the
// strip and the chat panel keeps focus. Retry leaves the screen as soon as it is chosen: focus then
// waits on the title and moves on when the answer arrives. Every move keeps the page and the
// transcript where they are.
function StripFocusKeeper({ heldFocusRef, focusWaitsOnTitleRef, headingRef, reloadRef, retryRef, signInRef, busy, reasonLineShown }: FocusKeeperProps) {
  // A press anywhere outside the remembered control, also on blank space that takes no focus, means the
  // Explorer left it on purpose: the memory is dropped, so focus is not taken back later. (A blur alone cannot
  // tell that apart from the control being removed or disabled, or the window losing focus.)
  useEffect(() => {
    const forget = (event: PointerEvent) => {
      const held = heldFocusRef.current;
      if (held === null || (event.target instanceof Node && held.element.contains(event.target))) return;
      heldFocusRef.current = null;
      focusWaitsOnTitleRef.current = false;
    };
    document.addEventListener("pointerdown", forget, true);
    return () => document.removeEventListener("pointerdown", forget, true);
  }, [heldFocusRef, focusWaitsOnTitleRef]);
  useLayoutEffect(() => {
    const focusOn = (target: ConnectedStripFocusTarget) => {
      const element = target === "reload" ? reloadRef.current : target === "retry" ? retryRef.current
        : target === "signIn" ? signInRef.current : headingRef.current;
      element?.focus({ preventScroll: true });
    };
    const reloadEnabled = () => reloadRef.current !== null && !reloadRef.current.disabled;
    const held = heldFocusRef.current;
    if (held !== null && !held.element.isConnected) {
      heldFocusRef.current = null;
      const active = document.activeElement;
      // Only when focus was not taken somewhere else in the meantime.
      if (active === null || active === document.body || active === held.element) {
        const target = connectedStripFocusTarget({ lost: held.title ? "title" : "control", reloadEnabled: reloadEnabled(),
          retryShown: retryRef.current !== null, signInShown: signInRef.current !== null });
        focusOn(target);
        if (!held.title) focusWaitsOnTitleRef.current = target === "title" && busy;
      } else if (!held.title) {
        focusWaitsOnTitleRef.current = false;
      }
    }
    if (focusWaitsOnTitleRef.current && !busy) {
      focusWaitsOnTitleRef.current = false;
      if (document.activeElement === headingRef.current) {
        const target = connectedWaitingFocusTarget({ retryShown: retryRef.current !== null, signInShown: signInRef.current !== null,
          reloadEnabled: reloadEnabled(), reasonLineShown });
        if (target !== null) focusOn(target);
      }
    }
  });
  return null;
}

// Step B: writes the transcript's height from the sizing rule. Nothing is requested, stored or sent, and the
// transcript's scroll position is never written here.
function fitTranscript(box: HTMLDivElement | null, end: HTMLElement | null) {
  if (box === null || end === null) return;
  const place = box.getBoundingClientRect();
  const height = connectedTranscriptHeight({
    windowHeight: document.documentElement.clientHeight,
    top: place.top + window.scrollY,
    below: end.getBoundingClientRect().bottom - place.bottom,
  });
  const value = `${height}px`;
  if (box.style.height !== value) box.style.height = value;
}

type SizerProps = Readonly<{
  transcriptRef: RefObject<HTMLDivElement | null>;
  conversationEndRef: RefObject<HTMLDivElement | null>;
  endedEndRef: RefObject<HTMLDivElement | null>;
  noticesRef: RefObject<HTMLDivElement | null>;
  // Which parts are drawn: the observed elements are picked again when this changes.
  drawn: string;
}>;

// Sizes the transcript to the window so the message box stays in view (an ended conversation: its read-only
// explanation). It draws nothing and stands after the chat panel, so the refs it reads are set. It runs after
// every render of the screen (an explanation opening, an alert arriving, the Menu opening, the Compass panel
// hidden), when the window is resized, and when the parts above or below the transcript change height without
// a render (the Explorer drags the message box taller, a font loads). For that it observes, each by its border
// box (so that a padding change counts): the page body; the strip-and-alerts area; the area that holds the
// transcript and the message box; an ended conversation's End area; and the earlier siblings of the transcript
// and of each of its ancestors up to the page body. Observer work is deferred to a frame and unchanged heights
// are not rewritten; browser tests check settling after the covered layout changes.
function TranscriptSizer({ transcriptRef, conversationEndRef, endedEndRef, noticesRef, drawn }: SizerProps) {
  useLayoutEffect(() => {
    fitTranscript(transcriptRef.current, endedEndRef.current ?? conversationEndRef.current);
  });
  useEffect(() => {
    const fit = () => fitTranscript(transcriptRef.current, endedEndRef.current ?? conversationEndRef.current);
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    window.addEventListener("resize", fit);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(later) : null;
    if (observer !== null) {
      const box = transcriptRef.current;
      const busyArea = box?.parentElement ?? null;
      const endArea = endedEndRef.current?.previousElementSibling ?? null;
      // Border boxes: a padding or border change moves what follows without changing a content box.
      const watch = (element: Element) => observer.observe(element, { box: "border-box" });
      for (const element of [document.body, noticesRef.current, busyArea, endArea]) {
        if (element !== null) watch(element);
      }
      // What stands above the transcript in the page: the earlier siblings of the transcript and of each of its
      // ancestors. A change there moves the transcript's top even when the page body keeps its size.
      for (let node: Element | null = box; node !== null && node !== document.body; node = node.parentElement) {
        for (let above = node.previousElementSibling; above !== null; above = above.previousElementSibling) watch(above);
      }
    }
    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [transcriptRef, conversationEndRef, endedEndRef, noticesRef, drawn]);
  return null;
}

type AlertsProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  errorRef: RefObject<HTMLDivElement | null>;
  retryRef: RefObject<HTMLButtonElement | null>;
  signInRef: RefObject<HTMLAnchorElement | null>;
  controlFocus: FocusHandlers;
}>;

// The waiting announcement and the alerts, exactly as before, under the strip. The error
// alert can take focus, for when the narrow drawer closes after a refusal.
function ConversationAlerts({ view, actions, errorRef, retryRef, signInRef, controlFocus }: AlertsProps) {
  return (
    <div className="px-4 sm:px-5">
      {/* Keep the waiting announcement mounted and outside the busy transcript. */}
      <p aria-atomic="true" className="sr-only" data-waiting-announcement="" role="status">
        {view.awaitingReply ? CONNECTED_WAITING_REPLY_TEXT : ""}
      </p>
      {view.assistance !== null ? (
        <div className={joinClasses(ALERT_CLASS, "mt-3")} role="alert">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{view.assistance.body}</p>
          {/* Pause and retry notices already explain what happened to the reply. */}
          {view.assistance.kind === "paused" || view.assistance.kind === "reply_failed" ? null : (
            <p>This assistance is temporary and is not a saved conversation reply.</p>
          )}
        </div>
      ) : null}
      {view.errorMessage !== null ? (
        <div className={joinClasses(ALERT_CLASS, "mt-3", FOCUS_RING)} ref={errorRef} role="alert" tabIndex={-1}>
          <p>{view.errorMessage}</p>
          {view.signInRequired ? (
            <a className={LINK_CLASS} href="/login/explorer" ref={signInRef}>
              Sign in
            </a>
          ) : null}
        </div>
      ) : null}
      {view.uncertain ? (
        <div className={joinClasses(ALERT_CLASS, "mt-3")} role="alert">
          <p>
            We could not confirm your last change. Retry the same request before making another change. No new message,
            reply or saved change is being claimed.
          </p>
          <div>
            <button
              className={PRIMARY_BUTTON}
              disabled={view.busy}
              onBlur={controlFocus.onBlur}
              onClick={actions.onRetry}
              onFocus={controlFocus.onFocus}
              ref={retryRef}
              type="button"
            >
              Retry the same request
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ body, speaker, speakerId, createdAt }: Readonly<{
  body: string;
  speaker: ExplorerConversationMessage["role"];
  speakerId: string;
  createdAt?: string;
}>) {
  const isGuide = speaker === "virtualGuide";

  return (
    <article
      aria-labelledby={speakerId}
      className={joinClasses(
        "rounded-2xl border px-4 py-3",
        isGuide
          ? "mr-auto w-full max-w-[94%] border-amber-200/10 bg-[#15110d] text-stone-100"
          : "ml-auto max-w-[90%] border-amber-300/20 bg-[#22190f] text-stone-50",
      )}
    >
      <p className={joinClasses("flex items-center gap-2 text-xs font-semibold", speakerLabelClass(SPEAKER_STYLE, speaker))} id={speakerId}>
        <SpeakerBadge speaker={speaker} speakerStyle={SPEAKER_STYLE} />
        {CONNECTED_SPEAKER_LABELS[speaker]}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{body}</p>
      {createdAt === undefined ? null : (
        <time className="mt-2 block text-[11px] text-stone-400" dateTime={createdAt}>
          {new Date(createdAt).toLocaleString("en-US")}
        </time>
      )}
    </article>
  );
}

// The opening greeting: a fixed welcome drawn like a Virtual Guide message, but
// without a time, because it is not a saved message (Paul's decision, decision
// queue 2026-11-05 19:13:28 CST, wish 1). It makes no request.
function OpeningGreeting() {
  return (
    <article
      aria-label={OPENING_GREETING_LABEL}
      className="mr-auto w-full max-w-[94%] rounded-2xl border border-amber-200/10 bg-[#15110d] px-4 py-3 text-stone-100"
      data-opening-greeting=""
    >
      <p className={joinClasses("flex items-center gap-2 text-xs font-semibold", speakerLabelClass(SPEAKER_STYLE, "virtualGuide"))}>
        <SpeakerBadge speaker="virtualGuide" speakerStyle={SPEAKER_STYLE} />
        {CONNECTED_SPEAKER_LABELS.virtualGuide}
      </p>
      <p className="mt-2 text-sm leading-6">{OPENING_GREETING_TEXT}</p>
    </article>
  );
}

// The pending-turn notice: one copy, placed by the screen beside the message box,
// or above the transcript while another notice stands above the conversation.
function PendingTurnNotice({ markerRef }: Readonly<{ markerRef?: RefObject<HTMLDivElement | null> }>) {
  return (
    <div className="scroll-mb-4 px-4 pt-3 sm:px-5" ref={markerRef}>
      <p className={NOTICE_CLASS} role="status">
        A saved message is still awaiting a confirmed result. No reply is being claimed. Reload the saved
        conversation to check; another send will not be started.
      </p>
    </div>
  );
}

// The saved messages, oldest first, in the designed transcript box. The box
// scrolls to the newest message or the waiting row when either changes. Its
// height is written by TranscriptSizer (step B); the classes below are what
// stands before the script runs.
function SavedTranscript({ state, view, actions, choicesDismissed, onShowTour, onSomethingElse, transcriptRef }: Readonly<{
  transcriptRef: RefObject<HTMLDivElement | null>;
  state: ExplorerConversationState;
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  choicesDismissed: boolean;
  onShowTour: () => void;
  onSomethingElse: () => void;
}>) {
  const scrollRef = transcriptRef;
  const count = state.messages.length;
  const sendingMessage = view.awaitingReply ? view.sendingMessage : null;
  const visit = useCompassChangeVisit(state, view.signInRequired);

  useEffect(() => {
    const box = scrollRef.current;
    // The transcript's own scroll to its end brings the sent words and the
    // waiting row into view inside it; the page itself does not move on a
    // Send (tests/browser/explorerOpenAtNewest.pw.ts, "the page moves once").
    // A conversation with no saved message and nothing being sent stays at its
    // top, so the start marker and the welcome are in view.
    if (box && connectedTranscriptScrollsToEnd(count, view.awaitingReply)) box.scrollTop = box.scrollHeight;
  }, [count, view.awaitingReply, scrollRef]);

  return (
    <>
    <div aria-live="polite" aria-atomic="true" className="sr-only" data-compass-change-announcement="">
      {visit.announcement}
    </div>
    <div
      aria-label="Conversation transcript"
      className={joinClasses(
        "h-[60vh] min-h-[14rem] max-h-[52rem] overflow-y-auto px-3 py-4 max-lg:scroll-py-2 sm:px-5",
        FOCUS_RING,
      )}
      ref={scrollRef}
      role="log"
      tabIndex={0}
    >
      <div className="mx-auto grid max-w-3xl gap-3">
        {/* The true beginning: above the welcome in a new conversation, above the oldest saved
            message otherwise (seen there after scrolling up). Plain text, not a heading. */}
        <p
          className="flex items-center gap-3 text-[11px] leading-4 text-stone-400 before:h-px before:flex-1 before:bg-stone-700 after:h-px after:flex-1 after:bg-stone-700"
          data-conversation-start=""
        >
          {CONVERSATION_START_MARKER}
        </p>
        {count === 0 ? (
          <>
            {view.ended ? null : <OpeningGreeting />}
            {/* A "Show me around" button under the welcome in every new
                conversation (Paul's decision, PRJ01-SPR002 decision queue,
                morning meeting entry of 2026-11-10, items 6 and 14). It opens
                the local tour: no message, no request and no AI call. */}
            {view.ended ? null : (
              <div className="mr-auto" data-opening-tour="">
                <button className={joinClasses(SECONDARY_BUTTON, FOCUS_RING)} onClick={onShowTour} type="button">
                  {EXPLORER_TOUR_CHOICE}
                </button>
              </div>
            )}
            {sendingMessage === null ? <p className="text-sm text-stone-300">There are no saved messages yet.</p> : null}
            {view.ended ? null : (
              <PlaceholderSlot title="Ways to begin">
                <NotYetImplementedNote id={noteId("chat", "choiceGroup")} noteKey="choiceGroup" standalone />
                <NotYetImplementedNote id={noteId("chat", "earlierCompass")} noteKey="earlierCompass" standalone />
              </PlaceholderSlot>
            )}
          </>
        ) : (
          <ol aria-label="Saved conversation" className="grid gap-3">
            {state.messages.map((message) => (
              <li className={joinClasses("grid", FOCUS_RING)} key={message.id} tabIndex={-1}>
                <MessageBubble
                  body={message.body}
                  createdAt={message.createdAt}
                  speaker={message.role}
                  speakerId={`conversation-message-${message.id}-speaker`}
                />
                <CompassChangeLines bundles={visit.visible} messageId={message.id} />
                <ExplorerWaypointDraft
                  followUpHeld={view.sendUnavailable || view.atMessageCapacity}
                  held={view.held}
                  messageId={message.id}
                  onCommand={actions.onCommand}
                  state={state}
                />
                <ExplorerWaypointOffer
                  followUpHeld={view.sendUnavailable || view.atMessageCapacity}
                  held={view.held}
                  messageId={message.id}
                  onCommand={actions.onCommand}
                  savingOfferId={view.savingOfferId ?? null}
                  state={state}
                />
                {choicesDismissed ? null : (
                  <ExplorerReplyChoices
                    disabled={view.held || view.sendUnavailable || view.atMessageCapacity}
                    messageId={message.id}
                    onChoose={actions.onReplyChoice}
                    onSomethingElse={onSomethingElse}
                    state={state}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
        {view.awaitingReply ? (
          <div className="grid gap-3">
            {sendingMessage === null ? null : (
              <div aria-live="off" className="grid" data-sending-message="">
                <MessageBubble body={sendingMessage} speaker="explorer" speakerId="conversation-sending-message-speaker" />
              </div>
            )}
            <ExplorerWaitingIndicator />
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
}

type ComposerProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  calmPrompt: string | null;
}>;

// The real message form, with the designed controls that are not built yet
// beside Send, each with its sentence directly under it.
function ConnectedComposer({ view, actions, composerRef, calmPrompt }: ComposerProps) {
  const disabled = view.held || view.sendUnavailable || view.atMessageCapacity;
  // A tablet with an attached keyboard may report a coarse pointer and behave
  // like a phone; Paul's screen wording sheet says this still needs checking.
  const touchFirst = typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const showKeyHint = !disabled && !touchFirst;
  const lineBreakCaret = useRef<Readonly<{ draft: string; position: number }> | null>(null);
  // Restore the caret after React writes the controlled draft into the box.
  useLayoutEffect(() => {
    const caret = lineBreakCaret.current;
    lineBreakCaret.current = null;
    if (caret !== null && composerRef.current?.value === caret.draft) {
      composerRef.current.setSelectionRange(caret.position, caret.position);
    }
  }, [view.draft, composerRef]);
  const describedBy = [
    view.atMessageCapacity ? CAPACITY_ID : view.sendUnavailable ? AVAILABILITY_ID : null,
    calmPrompt === null ? null : CALM_PROMPT_ID,
    showKeyHint ? COMPOSER_KEY_HINT_ID : null,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-3 rounded-b-[15px] border-t border-amber-200/15 bg-[#12100b] px-3 py-3 sm:px-5" data-composer-bar="">
      {view.sendUnavailable ? (
        <p className={NOTICE_CLASS} id={AVAILABILITY_ID}>
          The {SOLMIND_TERMS.virtualGuide} is unavailable. You can review saved messages and work with your saved Compass and
          Waypoints.
        </p>
      ) : null}
      {view.atMessageCapacity ? (
        <p className={NOTICE_CLASS} id={CAPACITY_ID}>
          This conversation has reached its saved-message limit. You can still review messages and work with your Compass
          and Waypoints.
        </p>
      ) : null}
      <form className="grid gap-2" onSubmit={actions.onSend}>
        <label className="text-sm font-semibold text-stone-100" htmlFor={COMPOSER_FIELD_ID}>
          {COMPOSER_LABEL}
        </label>
        {calmPrompt === null ? null : (
          <p className="text-sm leading-6 text-stone-300" id={CALM_PROMPT_ID} role="status">
            {calmPrompt}
          </p>
        )}
        <textarea
          aria-describedby={describedBy}
          className={joinClasses(
            "min-h-[3.5rem] w-full resize-y rounded-2xl border border-stone-600 bg-black/50 px-4 py-3 text-sm leading-6 text-stone-50 placeholder:text-stone-400 focus:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60",
            FOCUS_RING,
          )}
          disabled={disabled}
          id={COMPOSER_FIELD_ID}
          maxLength={EXPLORER_CONVERSATION_LIMITS.messageCharacters}
          onChange={(event) => actions.onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
                event.shiftKey || event.ctrlKey || event.metaKey) return;
            const field = event.currentTarget;
            if (event.altKey) {
              if (disabled) return;
              event.preventDefault();
              const start = field.selectionStart;
              const nextDraft = field.value.slice(0, start) + "\n" + field.value.slice(field.selectionEnd);
              if (nextDraft.length > field.maxLength) return;
              const position = start + 1;
              if (nextDraft === field.value) {
                // Replacing an existing line feed may leave the draft unchanged.
                field.setSelectionRange(position, position);
              } else {
                lineBreakCaret.current = { draft: nextDraft, position };
              }
              actions.onDraftChange(nextDraft);
              return;
            }
            if (disabled || touchFirst || view.draft.trim().length === 0) return;
            event.preventDefault();
            field.form?.requestSubmit();
          }}
          placeholder={COMPOSER_PLACEHOLDER}
          ref={composerRef}
          rows={3}
          value={view.awaitingReply && view.sendingMessage !== null && view.sendingFromComposer ? "" : view.draft}
        />
        {showKeyHint ? (
          <p className="text-xs leading-5 text-stone-400" id={COMPOSER_KEY_HINT_ID}>
            {COMPOSER_KEY_HINT}
          </p>
        ) : null}
        {view.draftError ? (
          <p className="text-sm text-amber-200" role="alert">
            {view.draftError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <UnwiredControl className={SECONDARY_BUTTON} noteKey="pause" scope="composer" wrapperClassName="max-w-xs">
              <IconPause />
              Pause
            </UnwiredControl>
            <UnwiredControl className={SECONDARY_BUTTON} noteKey="finishReview" scope="composer" wrapperClassName="max-w-xs">
              <IconClipboard />
              Finish &amp; Review
            </UnwiredControl>
            <UnwiredControl
              className={joinClasses(QUIET_BUTTON, "border border-stone-700")}
              noteKey="slowDown"
              scope="composer"
              wrapperClassName="max-w-xs"
            >
              Slow down
            </UnwiredControl>
          </div>
          <button className={joinClasses(PRIMARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")} disabled={disabled} type="submit">
            Send
            <IconArrowUp />
          </button>
        </div>
      </form>
    </div>
  );
}

type EndProps = Readonly<{ state: ExplorerConversationState; view: ConnectedConversationView; actions: ConnectedConversationActions }>;

// Ending, exactly as before: a review first, then a confirmation.
function EndSession({ state, view, actions }: EndProps) {
  if (state.conversationId === null) {
    return (
      <section aria-label="End Session" className="grid gap-3 rounded-b-3xl border-t border-amber-200/10 px-4 py-4 text-sm text-stone-200 sm:px-5">
        <p>No saved conversation has been started. Returning home will not create or end one.</p>
        <a className={LINK_CLASS} href="/explorer/home">
          Return to Explorer home
        </a>
      </section>
    );
  }

  if (view.ended) {
    return (
      <section aria-label="End Session" className="grid gap-3 rounded-b-3xl border-t border-amber-200/10 px-4 py-4 text-sm text-stone-200 sm:px-5">
        <p>This saved conversation has ended. It is available for read-only review.</p>
        <a className={LINK_CLASS} href="/explorer/conversations">
          Review ended conversations
        </a>
      </section>
    );
  }

  // The visible "End Session" heading is what the stale-review sentence
  // ("review End Session again") points to.
  return (
    <section aria-labelledby={END_HEADING_ID} className="grid gap-3 rounded-b-3xl border-t border-amber-200/10 px-4 py-4 text-sm text-stone-200 sm:px-5">
      <h2 className="font-serif text-lg text-stone-50" id={END_HEADING_ID}>
        End Session
      </h2>
      <p className="text-stone-300">
        End this saved conversation when you choose. Your messages, Compass, Route and Waypoints remain available for
        read-only review; ending does not sign you out.
      </p>
      <div>
        <button
          className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
          disabled={view.held}
          onClick={actions.onReviewEnd}
          type="button"
        >
          End this conversation
        </button>
      </div>
      {view.endReviewOpen ? (
        <div aria-label="Review End Session" className={ALERT_CLASS} role="group">
          <p>End this saved session and return to Explorer home? This closes this conversation; it does not mean your journey is over.</p>
          <p>
            There are {state.messages.length} saved messages and {(state.route ?? []).length} recorded Route changes. A
            factual ending will be saved with the existing Route.
          </p>
          {view.draft.length > 0 ? <p>Your unsaved message draft will not be saved.</p> : null}
          {view.staleEndReview ? <p role="alert">Your saved conversation changed. Close this review and review End Session again.</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              className={joinClasses(PRIMARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
              disabled={view.endBlocked || view.staleEndReview}
              onClick={actions.onConfirmEnd}
              type="button"
            >
              End Session and return home
            </button>
            <button
              className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
              disabled={view.busy || view.uncertain}
              onClick={actions.onKeepOpen}
              type="button"
            >
              Keep this session open
            </button>
          </div>
        </div>
      ) : null}
      <PlaceholderSlot title="After the conversation ends">
        <UnwiredControl className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteKey="continueFromThis" scope="composer">
          Continue from this conversation
        </UnwiredControl>
      </PlaceholderSlot>
    </section>
  );
}

type SupportBodyProps = Readonly<{
  scope: SupportScope;
  view: ConnectedConversationView;
  compassView: CardCompassView;
  onToggleCompassView: () => void;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
  waypointActions: ReturnType<typeof useConnectedWaypointActions>;
}>;

// The Compass & Waypoint card (chat step slices S1 and S2): the saved Compass
// on its 8 positions, where the Explorer can point the needle, and the saved
// Waypoints with Reached and Release reviews. Choices use the existing
// commands through onCommand, so ExplorerConversation.tsx keeps its hold,
// retry and expected-revision rules. Key Insights are not built yet (Paul's
// decision 7), so that area keeps its blue build-note box.
// The Compass card shows its Full or Compact
// view as this scope's layout state says (2026-11-03).
function ConnectedSupportBody({ scope, view, compassView, onToggleCompassView, onCommand, waypointActions }: SupportBodyProps) {
  const { state } = view;
  const keyInsightTitle = `${scope}-connected-key-insight-title`;
  const flags = { ended: view.ended, endReviewOpen: view.endReviewOpen, uncertain: view.uncertain, busy: view.busy, held: view.held };
  const hold = state === null ? null : needleHold(state, flags);
  const pointNeedle = (itemId: string) => {
    const intent = state === null ? null : pointNeedleIntent(state, flags, itemId);
    if (intent !== null) onCommand(intent);
  };

  return (
    <>
      <ConnectedCompassCard
        hold={hold}
        onPoint={pointNeedle}
        onToggleView={onToggleCompassView}
        scope={scope}
        state={state}
        view={compassView}
      />
      <ConnectedWaypointCard actions={waypointActions} scope={scope} state={state} />
      <section aria-labelledby={keyInsightTitle} className="grid gap-2 border-b border-stone-800/80 px-4 py-4">
        <h3 className="font-serif text-lg text-stone-50" id={keyInsightTitle}>
          {CONNECTED_KEY_INSIGHT_HEADING}
        </h3>
        <NotYetImplementedNote id={noteId(scope, "keyInsight")} noteKey="keyInsight" standalone />
      </section>
    </>
  );
}

type ReplyPromptState = Readonly<{
  conversationId: string | null;
  messageId: string | null;
  lastPrompt: string | null;
  prompt: string | null;
  dismissed: boolean;
  sendSequence: number;
}>;

export function ExplorerConversationConnectedScreen({ view, actions, headingRef, composerRef }: ScreenProps) {
  const waypointActions = useConnectedWaypointActions({
    state: view.state,
    onCommand: actions.onCommand,
    held: view.held,
    busy: view.busy,
    pendingTurn: view.state?.pendingTurn === true,
    uncertain: view.uncertain,
  });
  const [panelVisible, setPanelVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openExplanation, setOpenExplanation] = useState<string | null>(null);
  const [tour, setTour] = useState<Readonly<{ opener: HTMLElement | null; conversationId: string | null }> | null>(null);
  // Which build notes show (the top bar's toggle and each box's X), never saved.
  const buildNotes = useBuildNotesState();
  // Which Compass view shows, kept separately for the wide panel and the phone
  // drawer and never saved (Paul's decision, 2026-11-03 16:20:29 CST). It is
  // kept here because the drawer's content is removed while it is closed.
  const [compassViews, setCompassViews] = useState<Readonly<Record<SupportScope, CardCompassView>>>({ panel: "full", drawer: "full" });
  const { state } = view;
  const latestMessageId = state?.messages[state.messages.length - 1]?.id ?? null;
  const offeredChoices = state === null ? null : latestReplyChoices(state);
  const [replyPrompt, setReplyPrompt] = useState<ReplyPromptState>({
    conversationId: state?.conversationId ?? null,
    messageId: latestMessageId,
    lastPrompt: null,
    prompt: null,
    dismissed: false,
    sendSequence: view.sendSequence,
  });
  // Clear transient display on a changed saved message or lost eligibility.
  // Retain the last line across replies and temporary reloads in this conversation.
  const conversationChanged = state !== null && state.conversationId !== replyPrompt.conversationId;
  const messageChanged = state !== null && replyPrompt.messageId !== latestMessageId;
  const sendStarted = replyPrompt.sendSequence !== view.sendSequence;
  const signInClearsPrompt = view.signInRequired &&
    (replyPrompt.conversationId !== null || replyPrompt.messageId !== null || replyPrompt.lastPrompt !== null || replyPrompt.dismissed);
  if (signInClearsPrompt) {
    setReplyPrompt({ conversationId: null, messageId: null, lastPrompt: null, prompt: null, dismissed: false, sendSequence: view.sendSequence });
  } else if (!view.signInRequired && (conversationChanged || messageChanged || sendStarted ||
      (offeredChoices === null && replyPrompt.prompt !== null))) {
    setReplyPrompt({
      conversationId: state === null ? replyPrompt.conversationId : state.conversationId,
      messageId: state === null ? replyPrompt.messageId : latestMessageId,
      lastPrompt: conversationChanged ? null : replyPrompt.lastPrompt,
      prompt: null,
      dismissed: conversationChanged || messageChanged ? false : sendStarted || replyPrompt.dismissed,
      sendSequence: view.sendSequence,
    });
  }
  // Focus after the new description is present, so screen readers can read it.
  useEffect(() => {
    if (replyPrompt.prompt !== null) composerRef.current?.focus();
  }, [replyPrompt.prompt, composerRef]);
  // A conversation with saved messages opens at its newest messages (Paul's test
  // comment, PRJ01-SPR002 decision record 2026-11-11 21:03:09 CST). The transcript
  // box scrolls itself to its end; the page did not, so the newest message and
  // the message box sat below the window. Decided once, when the first saved
  // state arrives: with saved messages, the end of the conversation is brought
  // into the window. Focus stays where it is and the move is instant; a
  // conversation with no saved message stays at the top. So does a conversation
  // that opens with a notice above it (a pause or support notice, an error or
  // an unconfirmed change): that notice must stay in view, and the pending-turn
  // notice is then drawn above the transcript with it. Otherwise the pending-turn
  // notice sits beside the message box and comes into view with the move. An
  // ended conversation lands after its read-only explanation and review link.
  // Step B: the transcript was sized so that, with the page at its top, the end of the conversation area
  // already sits inside the window whenever there is room; the move below is then skipped and the page
  // stays at its top. On a small window the transcript is at its smallest height and the page moves as before.
  const transcriptRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const endedEndRef = useRef<HTMLDivElement>(null);
  const pendingAboveRef = useRef<HTMLDivElement>(null);
  const noticesRef = useRef<HTMLDivElement>(null);
  const openedAtNewest = useRef(false);
  const noticeAtOpen = view.assistance !== null || view.errorMessage !== null || view.uncertain;
  useEffect(() => {
    if (openedAtNewest.current || state === null) return;
    openedAtNewest.current = true;
    if (noticeAtOpen) {
      // The page stays at its top for the notice. On a narrow screen the pending-turn notice drawn
      // above the transcript can still be below the window: move only as far as it needs, and never
      // so far that the notices leave the top of the window (they have priority when both cannot fit).
      const pending = pendingAboveRef.current;
      const notices = noticesRef.current;
      if (pending !== null && typeof pending.scrollIntoView === "function") {
        pending.scrollIntoView({ behavior: "instant", block: "nearest" });
        if (notices !== null && notices.getBoundingClientRect().top < 0) {
          notices.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }
      return;
    }
    if (state.messages.length === 0) return;
    const end = (view.ended ? endedEndRef.current : null) ?? conversationEndRef.current;
    if (end === null || typeof end.scrollIntoView !== "function") return;
    const place = typeof end.getBoundingClientRect === "function" ? end.getBoundingClientRect() : null;
    if (place !== null && connectedOpenTargetInView({ top: place.top, bottom: place.bottom, windowHeight: document.documentElement.clientHeight })) return;
    end.scrollIntoView({ behavior: "instant", block: "end" });
  }, [state, noticeAtOpen, view.ended]);
  const repliesDisabled = view.held || view.sendUnavailable || view.atMessageCapacity;
  // Opens the local tour: no message, no request and no AI call.
  const openTour = () => setTour({ opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    conversationId: state?.conversationId ?? null });
  const chooseReply = (label: string) => {
    if (offeredChoices === null || replyPrompt.dismissed || !offeredChoices.labels.includes(label)) return;
    if (label === EXPLORER_TOUR_CHOICE) {
      openTour();
      return;
    }
    if (repliesDisabled) return;
    actions.onReplyChoice(label);
  };
  if (tour !== null && (state === null || view.ended || tour.conversationId !== state.conversationId)) setTour(null);
  const showSomethingElse = () => {
    if (offeredChoices === null || repliesDisabled || replyPrompt.dismissed) return;
    const prompt = nextCalmReplyPrompt(replyPrompt.lastPrompt);
    setReplyPrompt({ ...replyPrompt, lastPrompt: prompt, prompt });
  };
  const errorRef = useRef<HTMLDivElement>(null);
  // A change made from the narrow drawer that leaves no saved state (a refusal
  // or a sign-in problem) closes the drawer, which makes the rest of the page
  // inert, so that the page's alert and its action can be reached; focus then
  // moves to that alert (fix round 2, 2026-11-03). Adjusted during render, as
  // React does for a value that follows a prop; the drawer's own close effect
  // runs first, then the effect below moves focus.
  const [shown, setShown] = useState<Readonly<{ loaded: boolean; alertFocus: number }>>({ loaded: state !== null, alertFocus: 0 });
  if (shown.loaded !== (state !== null)) {
    const lost = state === null && drawerOpen && view.errorMessage !== null;
    setShown({ loaded: state !== null, alertFocus: shown.alertFocus + (lost ? 1 : 0) });
    if (lost) setDrawerOpen(false);
  }
  useEffect(() => {
    if (shown.alertFocus > 0) errorRef.current?.focus();
  }, [shown.alertFocus]);
  const status = conversationStatus(state, view.ended);
  // The strip: the order of precedence decides the light, Reload, "?" and the reason line.
  const saved = connectedSavedStatus({
    errorCode: view.errorCode,
    uncertain: view.uncertain,
    busy: view.busy,
    awaitingReply: view.awaitingReply,
    hasState: state !== null,
    pendingTurn: state?.pendingTurn === true,
    lastCheckConfirmed: view.lastCheckConfirmed,
    busySentence: view.busy ? view.statusText : "",
  });
  const reloadDrawn = saved.reloadShown && view.reloadAvailable;
  const helpDrawn = reloadDrawn && saved.helpButtonShown;
  // Only one of the strip's two explanations is open at a time; its own state, apart from the
  // "Not connected yet" sentences. When "?" leaves the screen its text is closed, so it is not
  // open when "?" returns (adjusted during render, as above).
  const [stripOpen, setStripOpen] = useState<ConnectedStripExplanation>(null);
  if (stripOpen === "help" && !helpDrawn) setStripOpen(null);
  const toggleStrip = (chosen: "privacy" | "help") => setStripOpen((open) => nextStripExplanation(open, chosen));
  // The last strip control or title that took keyboard focus is remembered here; StripFocusKeeper moves
  // focus when an answer removes it from the screen (focus rules, BUILD_PLAN_R2.md section 4.8).
  const reloadRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const heldFocusRef = useRef<HeldFocus | null>(null);
  const focusWaitsOnTitleRef = useRef(false);
  const releaseFocus = (event: FocusEvent<HTMLElement>) => {
    const element = event.currentTarget;
    // Drop the memory only when focus really went to another element. A blur with no destination (the control
    // is leaving the screen or was disabled by a request, or only the window lost focus) keeps it; the keeper
    // then moves focus only if nothing else holds it.
    if (!(event.relatedTarget instanceof Element) || !element.isConnected || document.activeElement === element) return;
    if (heldFocusRef.current?.element === element) {
      heldFocusRef.current = null;
      focusWaitsOnTitleRef.current = false;
    }
  };
  const titleFocus: FocusHandlers = {
    onFocus: (event) => { heldFocusRef.current = { element: event.currentTarget, title: true }; },
    onBlur: releaseFocus,
  };
  const controlFocus: FocusHandlers = {
    onFocus: (event) => {
      heldFocusRef.current = { element: event.currentTarget, title: false };
      focusWaitsOnTitleRef.current = false;
    },
    onBlur: releaseFocus,
  };
  const reasonLineShown = reloadDrawn && saved.reasonLine !== null;
  const title = <ConversationTitle focus={titleFocus} headingRef={headingRef} />;
  const toggleCompassView = (scope: SupportScope) =>
    setCompassViews((views) => ({ ...views, [scope]: views[scope] === "full" ? "compact" : "full" }));
  const renderSupportBody = (scope: SupportScope) => (
    <ConnectedSupportBody
      compassView={compassViews[scope]}
      onCommand={actions.onCommand}
      onToggleCompassView={() => toggleCompassView(scope)}
      scope={scope}
      view={view}
      waypointActions={waypointActions}
    />
  );

  const toggleExplanation = (id: string) => setOpenExplanation((open) => (open === id ? null : id));

  return (
    <BuildNotesProvider state={buildNotes}>
      <NotConnectedProvider onToggle={toggleExplanation} openId={openExplanation}>
        <ExplorerConversationScreenShell
          connected
          drawer={<ConnectedSupportDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} renderBody={renderSupportBody} />}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          onSkip={() => headingRef.current?.focus()}
          shell={CONNECTED_SHELL}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <ConnectedVirtualGuideRow
              drawerOpen={drawerOpen}
              onOpenDrawer={() => setDrawerOpen(true)}
              onTogglePanel={() => setPanelVisible((visible) => !visible)}
              panelVisible={panelVisible}
            />
            <div className="flex min-h-0 flex-1 items-start gap-5 px-3 pb-6 pt-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 flex-col gap-5">
                <section aria-labelledby={CONVERSATION_HEADING_ID} className={CARD_CLASS}>
                  {/* The strip and the alerts together are "the notices" for the page-open rule above. */}
                  <div ref={noticesRef}>
                    <ConversationStrip
                      actions={actions}
                      controlFocus={controlFocus}
                      helpDrawn={helpDrawn}
                      onToggle={toggleStrip}
                      open={stripOpen}
                      reloadDrawn={reloadDrawn}
                      reloadRef={reloadRef}
                      saved={saved}
                      status={status}
                      title={state === null ? title : null}
                      view={view}
                    />
                    <ConversationAlerts
                      actions={actions}
                      controlFocus={controlFocus}
                      errorRef={errorRef}
                      retryRef={retryRef}
                      signInRef={signInRef}
                      view={view}
                    />
                  </div>
                  {state !== null ? (
                    <>
                      {/* The chat panel: the title band, the saved conversation and the message box in
                          one bordered, slightly warmer surface (round 4 variants c1 and l3). The band
                          is outside the scrolling transcript, so the title stays in view. */}
                      <div className="mx-2 mb-3 mt-3 rounded-2xl border border-amber-300/40 bg-[#12100b]" data-chat-panel="">
                        <div
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-[15px] border-b border-amber-200/20 bg-[#292412] px-3 py-2 sm:px-5"
                          data-chat-panel-band=""
                        >
                          {title}
                        </div>
                        {/* As on the earlier screen, only the saved conversation and
                            the composer are marked busy; the strip, the title, alerts,
                            Reload, Retry and End stay outside it. */}
                        <div aria-busy={view.busy}>
                          {state.pendingTurn && noticeAtOpen ? <PendingTurnNotice markerRef={pendingAboveRef} /> : null}
                          <SavedTranscript
                            actions={{ ...actions, onReplyChoice: chooseReply }}
                            choicesDismissed={replyPrompt.dismissed}
                            onShowTour={openTour}
                            onSomethingElse={showSomethingElse}
                            state={state}
                            transcriptRef={transcriptRef}
                            view={view}
                          />
                          {/* Outside the scrolling transcript, beside the composer, so it
                              stays in view however long the saved history is. While a notice
                              stands above the conversation it is drawn above the transcript
                              instead (see below), so both are in view together. */}
                          {state.pendingTurn && !noticeAtOpen ? <PendingTurnNotice /> : null}
                          {view.ended ? null : (
                            <ConnectedComposer actions={actions} calmPrompt={replyPrompt.prompt} composerRef={composerRef} view={view} />
                          )}
                          {/* An empty marker at the end of the conversation area: where the page
                              lands when a saved conversation opens (see conversationEndRef). */}
                          <div aria-hidden="true" className="scroll-mb-4" data-conversation-end="" ref={conversationEndRef} />
                        </div>
                      </div>
                      <EndSession actions={actions} state={state} view={view} />
                      {view.ended ? <div aria-hidden="true" className="scroll-mb-4" data-conversation-end="" ref={endedEndRef} /> : null}
                    </>
                  ) : (
                    <div className="pb-4" />
                  )}
                  {/* After the chat panel, so the refs it measures are set (step B). */}
                  <TranscriptSizer
                    conversationEndRef={conversationEndRef}
                    drawn={state === null ? "none" : view.ended ? "ended" : "open"}
                    endedEndRef={endedEndRef}
                    noticesRef={noticesRef}
                    transcriptRef={transcriptRef}
                  />
                  {/* Last in the card, after the strip, the alerts and the chat panel: its effect runs once
                      every newly drawn focus target (the title, Reload, Retry, Sign in) has its ref. */}
                  <StripFocusKeeper
                    busy={view.busy}
                    focusWaitsOnTitleRef={focusWaitsOnTitleRef}
                    headingRef={headingRef}
                    heldFocusRef={heldFocusRef}
                    reasonLineShown={reasonLineShown}
                    reloadRef={reloadRef}
                    retryRef={retryRef}
                    signInRef={signInRef}
                  />
                </section>
              </div>
              <ConnectedSupportPanel renderBody={renderSupportBody} visible={panelVisible} />
            </div>
          </div>
        </ExplorerConversationScreenShell>
        {tour !== null ? <ExplorerConversationTour opener={tour.opener} onClose={() => setTour(null)} /> : null}
      </NotConnectedProvider>
    </BuildNotesProvider>
  );
}
