import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { CONVERSATION_FOOTER, VIRTUAL_GUIDE_SHORT } from "@/lib/solmind/explorerConversationScreen";
import {
  COMPOSER_LABEL,
  COMPOSER_PLACEHOLDER,
  CONNECTED_GUIDE_NAME,
  CONNECTED_INTRO,
  CONNECTED_SHELL,
  CONNECTED_SPEAKER_LABELS,
  CONNECTED_TITLE,
  CURRENT_TOOLS_HEADING,
  CURRENT_TOOLS_INTRO,
  CURRENT_TOOLS_POINTER,
  CURRENT_TOOLS_REMOVAL_REASON,
  connectedHeaderLabel,
  connectedStatusText,
  type ConnectedConversationStatus,
} from "@/lib/solmind/explorerConversationConnectedScreen";
import {
  CONNECTED_KEY_INSIGHT_HEADING,
  needleHold,
  pointNeedleIntent,
  type CardCompassView,
} from "@/lib/solmind/explorerConnectedCard";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationMessage,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import type { ExplorerPrivateAssistance } from "@/lib/solmind/explorerPrivateConversationResponse";
import { SPEAKER_LABEL_STYLE, speakerLabelClass } from "@/lib/solmind/explorerSpeakerStyle";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";

import { ConnectedCompassCard } from "./ExplorerConnectedCompassCard";
import { ConnectedWaypointCard } from "./ExplorerConnectedWaypointCard";
import {
  ExplorerConversationFormation,
  type ExplorerConversationFormationIntent,
} from "./ExplorerConversationFormation";
import {
  BuildNotesProvider,
  REMOVAL_OUTLINE,
  RemovalTag,
  useBuildNotesShown,
  useBuildNotesState,
} from "./ExplorerConversationScreenBuildNotes";
import { CONVERSATION_HEADING_ID, DRAWER_OPENER_ID, PANEL_TOGGLE_ID } from "./ExplorerConversationScreenHeader";
import { IconArrowUp, IconClipboard, IconEye, IconEyeOff, IconPanelRight, IconPause } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
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
// and choosing a Compass point hands the existing set_attention command to
// onCommand, which ExplorerConversation.tsx sends.
// The only state kept here is layout: whether the wide panel shows, whether
// the narrow drawer is open (it closes, and focus moves to the page's alert,
// when a change made from it leaves no saved state), which Compass view (Full
// or Compact) shows in the panel and in the drawer, whether the narrow-screen Menu is open, which
// "Not connected yet" sentence is shown, and which build notes show. Parts that are not connected yet show
// a blue "Not connected yet" build-note label and, when activated, one sentence directly
// under them saying what they will do (NotConnectedProvider). A note that
// describes an area rather than a control (standalone) is a blue build-note box
// with an X in its upper corner, in the area. The old form tools below the
// conversation, planned for removal (chat-step decision 8), carry the violet
// removal marker. The top bar's "Build notes" toggle hides or shows all of them
// (BuildNotesProvider; Paul's build-note rule, decision queue 2026-11-03
// 17:59:20, 18:00:59 and 18:03:39 CST).

const SPEAKER_STYLE = SPEAKER_LABEL_STYLE;
const CARD_CLASS =
  "rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 shadow-[0_24px_70px_rgba(0,0,0,0.45)]";
const NOTICE_CLASS = "rounded-2xl border border-stone-700 bg-black/40 p-4 text-sm leading-6 text-stone-200";
const ALERT_CLASS = "grid gap-3 rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50";
const LINK_CLASS = joinClasses("font-semibold text-amber-200 underline underline-offset-4 hover:text-amber-100", FOCUS_RING);
const COMPOSER_FIELD_ID = "conversation-message";
const END_HEADING_ID = "conversation-end-heading";
const AVAILABILITY_ID = "conversation-availability";
const CAPACITY_ID = "conversation-capacity";

export type ConnectedConversationView = Readonly<{
  state: ExplorerConversationState | null;
  busy: boolean;
  statusText: string;
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

type HeaderProps = Readonly<{ status: ConnectedConversationStatus; headingRef: RefObject<HTMLHeadingElement | null> }>;

// Label, title, privacy line and status, and the sharing controls (not built).
function ConnectedConversationHeader({ status, headingRef }: HeaderProps) {
  return (
    <header className="border-b border-amber-200/10 px-4 py-3 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">{connectedHeaderLabel(status)}</p>
      <h1
        className={joinClasses("mt-1 rounded-md font-serif text-2xl leading-tight text-stone-50 focus:outline-none sm:text-3xl", FOCUS_RING)}
        id={CONVERSATION_HEADING_ID}
        ref={headingRef}
        tabIndex={-1}
      >
        {CONNECTED_TITLE}
      </h1>
      <p className="mt-1 text-sm text-stone-400">{CONNECTED_INTRO}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600 bg-black/30 px-3 py-1 text-xs font-semibold text-stone-200">
          <IconEyeOff className="h-3.5 w-3.5" />
          Private conversation
        </span>
        {status === "unknown" ? null : (
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            {connectedStatusText(status)}
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <UnwiredControl
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          guideName={CONNECTED_GUIDE_NAME}
          noteKey="shareConversation"
          scope="header"
        >
          <IconEye />
          Share whole conversation
        </UnwiredControl>
        <UnwiredControl
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          noteKey="virtualGuideCanSee"
          scope="header"
        >
          <IconEye />
          What the {VIRTUAL_GUIDE_SHORT} can see
        </UnwiredControl>
      </div>
    </header>
  );
}

type NoticesProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  errorRef: RefObject<HTMLDivElement | null>;
}>;

// The live status line, the alerts and Reload, exactly as before. The error
// alert can take focus, for when the narrow drawer closes after a refusal.
function ConversationNotices({ view, actions, errorRef }: NoticesProps) {
  return (
    <div className="grid gap-3 px-4 pt-3 sm:px-5">
      <p aria-atomic="true" aria-live="polite" className="min-h-6 text-sm text-stone-200" role="status">
        {view.statusText}
      </p>
      {view.assistance !== null ? (
        <div className={ALERT_CLASS} role="alert">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{view.assistance.body}</p>
          {/* A pause notice already says what was not sent or saved. */}
          {view.assistance.kind === "paused" ? null : (
            <p>This assistance is temporary and is not a saved conversation reply.</p>
          )}
        </div>
      ) : null}
      {view.errorMessage !== null ? (
        <div className={joinClasses(ALERT_CLASS, FOCUS_RING)} ref={errorRef} role="alert" tabIndex={-1}>
          <p>{view.errorMessage}</p>
          {view.signInRequired ? (
            <a className={LINK_CLASS} href="/login/explorer">
              Sign in
            </a>
          ) : null}
        </div>
      ) : null}
      {view.uncertain ? (
        <div className={ALERT_CLASS} role="alert">
          <p>
            We could not confirm your last change. Retry the same request before making another change. No new message,
            reply or saved change is being claimed.
          </p>
          <div>
            <button className={PRIMARY_BUTTON} disabled={view.busy} onClick={actions.onRetry} type="button">
              Retry the same request
            </button>
          </div>
        </div>
      ) : null}
      {view.reloadAvailable ? (
        <div>
          <button
            className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
            disabled={view.busy}
            onClick={actions.onReload}
            type="button"
          >
            Reload saved conversation
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: Readonly<{ message: ExplorerConversationMessage }>) {
  const speaker = message.role;
  const isGuide = speaker === "virtualGuide";
  const speakerId = `conversation-message-${message.id}-speaker`;

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
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
      <time className="mt-2 block text-[11px] text-stone-400" dateTime={message.createdAt}>
        {new Date(message.createdAt).toLocaleString("en-US")}
      </time>
    </article>
  );
}

// The saved messages, oldest first, in the designed transcript box. The box
// scrolls to the newest message whenever the saved count changes.
function SavedTranscript({ state, ended }: Readonly<{ state: ExplorerConversationState; ended: boolean }>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = state.messages.length;

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count]);

  return (
    <div
      aria-label="Conversation transcript"
      className={joinClasses(
        "h-[60vh] min-h-[32rem] max-h-[52rem] overflow-y-auto px-3 py-4 max-lg:scroll-py-2 sm:px-5 lg:h-[clamp(36rem,65vh,52rem)]",
        FOCUS_RING,
      )}
      ref={scrollRef}
      role="log"
      tabIndex={0}
    >
      <div className="mx-auto grid max-w-3xl gap-3">
        {count === 0 ? (
          <>
            <p className="text-sm text-stone-300">There are no saved messages yet.</p>
            {ended ? null : (
              <PlaceholderSlot title="Ways to begin">
                <NotYetImplementedNote id={noteId("chat", "choiceGroup")} noteKey="choiceGroup" standalone />
                <NotYetImplementedNote id={noteId("chat", "earlierCompass")} noteKey="earlierCompass" standalone />
              </PlaceholderSlot>
            )}
          </>
        ) : (
          <ol aria-label="Saved conversation" className="grid gap-3">
            {state.messages.map((message) => (
              <li className="grid" key={message.id}>
                <MessageBubble message={message} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

type ComposerProps = Readonly<{
  view: ConnectedConversationView;
  actions: ConnectedConversationActions;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}>;

// The real message form, with the designed controls that are not built yet
// beside Send, each with its sentence directly under it, and the marked
// latest-change line.
function ConnectedComposer({ view, actions, composerRef }: ComposerProps) {
  const disabled = view.held || view.sendUnavailable || view.atMessageCapacity;
  const describedBy = view.atMessageCapacity ? CAPACITY_ID : view.sendUnavailable ? AVAILABILITY_ID : undefined;

  return (
    <div className="grid gap-3 border-t border-amber-200/15 bg-[#0c0a08]/95 px-3 py-3 sm:px-5" data-composer-bar="">
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
          placeholder={COMPOSER_PLACEHOLDER}
          ref={composerRef}
          rows={3}
          value={view.draft}
        />
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
      {/* The latest-change line is not built yet: its build-note box. */}
      <NotYetImplementedNote id={noteId("composer", "latestChange")} noteKey="latestChange" standalone />
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
}>;

// The Compass & Waypoint card (chat step slices S1 and S2): the saved Compass
// on its 8 positions, where the Explorer can point the needle, and the saved
// Waypoints, read-only. Choosing a point sends the existing set_attention
// command through onCommand, so ExplorerConversation.tsx keeps its hold,
// retry and expected-revision rules. Key Insights are not built yet (Paul's
// decision 7), so that area keeps its blue build-note box. When the
// current tools are shown for an open conversation, the panel says what they
// are still for; after End they show the saved record read-only, so it does
// not (fix round 2, 2026-11-03). The Compass card shows its Full or Compact
// view as this scope's layout state says (2026-11-03).
function ConnectedSupportBody({ scope, view, compassView, onToggleCompassView, onCommand }: SupportBodyProps) {
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
      <ConnectedWaypointCard scope={scope} state={state} />
      <section aria-labelledby={keyInsightTitle} className="grid gap-2 border-b border-stone-800/80 px-4 py-4">
        <h3 className="font-serif text-lg text-stone-50" id={keyInsightTitle}>
          {CONNECTED_KEY_INSIGHT_HEADING}
        </h3>
        <NotYetImplementedNote id={noteId(scope, "keyInsight")} noteKey="keyInsight" standalone />
      </section>
      {state !== null && !view.ended ? <p className="px-4 py-4 text-xs leading-5 text-stone-300">{CURRENT_TOOLS_POINTER}</p> : null}
    </>
  );
}

type ToolsProps = Readonly<{
  state: ExplorerConversationState;
  view: ConnectedConversationView;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>;

// The existing Compass and Waypoint tools, unchanged, until the conversation
// forms them (rebuild steps 4 and 5). They are planned for removal once the
// Compass & Waypoint card does everything they do (Paul's chat-step decision
// 8), so while the build notes show they carry the violet removal marker: a
// dashed violet outline and the "Planned for removal" tag with its sentence.
// The tools keep working.
function CurrentTools({ state, view, onCommand }: ToolsProps) {
  const headingId = "conversation-current-tools-heading";
  const marked = useBuildNotesShown();

  return (
    <section
      aria-labelledby={headingId}
      className={joinClasses("rounded-3xl border border-stone-800 bg-[#090807]/85 p-4 sm:p-5", marked && REMOVAL_OUTLINE)}
      data-removal-marker={marked ? "outline" : undefined}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <h2 className="font-serif text-xl text-stone-50" id={headingId}>
          {CURRENT_TOOLS_HEADING}
        </h2>
        <RemovalTag id="removal-current-tools" reason={CURRENT_TOOLS_REMOVAL_REASON} />
      </div>
      <p className="mt-1 text-sm leading-6 text-stone-300">{CURRENT_TOOLS_INTRO}</p>
      <div className="mt-4">
        <ExplorerConversationFormation busy={view.held} onCommand={onCommand} readOnly={view.ended} state={state} />
      </div>
    </section>
  );
}

export function ExplorerConversationConnectedScreen({ view, actions, headingRef, composerRef }: ScreenProps) {
  const [panelVisible, setPanelVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openExplanation, setOpenExplanation] = useState<string | null>(null);
  // Which build notes show (the top bar's toggle and each box's X), never saved.
  const buildNotes = useBuildNotesState();
  // Which Compass view shows, kept separately for the wide panel and the phone
  // drawer and never saved (Paul's decision, 2026-11-03 16:20:29 CST). It is
  // kept here because the drawer's content is removed while it is closed.
  const [compassViews, setCompassViews] = useState<Readonly<Record<SupportScope, CardCompassView>>>({ panel: "full", drawer: "full" });
  const { state } = view;
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
  const toggleCompassView = (scope: SupportScope) =>
    setCompassViews((views) => ({ ...views, [scope]: views[scope] === "full" ? "compact" : "full" }));
  const renderSupportBody = (scope: SupportScope) => (
    <ConnectedSupportBody
      compassView={compassViews[scope]}
      onCommand={actions.onCommand}
      onToggleCompassView={() => toggleCompassView(scope)}
      scope={scope}
      view={view}
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
                  <ConnectedConversationHeader headingRef={headingRef} status={status} />
                  <ConversationNotices actions={actions} errorRef={errorRef} view={view} />
                  {state !== null ? (
                    <>
                      {/* As on the earlier screen, only the saved conversation and
                          the composer are marked busy; the status line, alerts,
                          Reload, Retry and End stay outside it. */}
                      <div aria-busy={view.busy}>
                        <SavedTranscript ended={view.ended} state={state} />
                        {/* Outside the scrolling transcript, beside the composer, so it
                            stays in view however long the saved history is. */}
                        {state.pendingTurn ? (
                          <div className="px-4 pt-3 sm:px-5">
                            <p className={NOTICE_CLASS} role="status">
                              A saved message is still awaiting a confirmed result. No reply is being claimed. Reload the saved
                              conversation to check; another send will not be started.
                            </p>
                          </div>
                        ) : null}
                        {view.ended ? null : <ConnectedComposer actions={actions} composerRef={composerRef} view={view} />}
                      </div>
                      <EndSession actions={actions} state={state} view={view} />
                    </>
                  ) : (
                    <div className="pb-4" />
                  )}
                </section>
                {state !== null ? <CurrentTools onCommand={actions.onCommand} state={state} view={view} /> : null}
              </div>
              <ConnectedSupportPanel renderBody={renderSupportBody} visible={panelVisible} />
            </div>
          </div>
        </ExplorerConversationScreenShell>
      </NotConnectedProvider>
    </BuildNotesProvider>
  );
}
