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
  connectedHeaderLabel,
  connectedStatusText,
  type ConnectedConversationStatus,
} from "@/lib/solmind/explorerConversationConnectedScreen";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationMessage,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import type { ExplorerPrivateAssistance } from "@/lib/solmind/explorerPrivateConversationResponse";
import { SPEAKER_LABEL_STYLE, speakerLabelClass } from "@/lib/solmind/explorerSpeakerStyle";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";

import {
  ExplorerConversationFormation,
  type ExplorerConversationFormationIntent,
} from "./ExplorerConversationFormation";
import { CONVERSATION_HEADING_ID, DRAWER_OPENER_ID, PANEL_TOGGLE_ID } from "./ExplorerConversationScreenHeader";
import { IconArrowUp, IconClipboard, IconEye, IconEyeOff, IconPanelRight, IconPause } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
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
// The only state kept here is layout: whether the wide panel shows, whether
// the narrow drawer is open and whether the narrow conversation spaces show.
// Parts that are not connected yet keep their "Not yet implemented:" notes.

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
        <p className="text-xs leading-5 text-stone-300">{CONVERSATION_FOOTER}</p>
        <NotYetImplementedNote className="max-w-md" id={renameNote} noteKey="rename" />
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

type NoticesProps = Readonly<{ view: ConnectedConversationView; actions: ConnectedConversationActions }>;

// The live status line, the alerts and Reload, exactly as before.
function ConversationNotices({ view, actions }: NoticesProps) {
  return (
    <div className="grid gap-3 px-4 pt-3 sm:px-5">
      <p aria-atomic="true" aria-live="polite" className="min-h-6 text-sm text-stone-200" role="status">
        {view.statusText}
      </p>
      {view.assistance !== null ? (
        <div className={ALERT_CLASS} role="alert">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{view.assistance.body}</p>
          <p>This assistance is temporary and is not a saved conversation reply.</p>
        </div>
      ) : null}
      {view.errorMessage !== null ? (
        <div className={ALERT_CLASS} role="alert">
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
                <NotYetImplementedNote id={noteId("chat", "choiceGroup")} noteKey="choiceGroup" />
                <NotYetImplementedNote id={noteId("chat", "earlierCompass")} noteKey="earlierCompass" />
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
// beside Send, and the notes that explain them.
function ConnectedComposer({ view, actions, composerRef }: ComposerProps) {
  const disabled = view.held || view.sendUnavailable || view.atMessageCapacity;
  const describedBy = view.atMessageCapacity ? CAPACITY_ID : view.sendUnavailable ? AVAILABILITY_ID : undefined;
  const pauseNote = noteId("composer", "pause");
  const finishNote = noteId("composer", "finishReview");
  const slowNote = noteId("composer", "slowDown");

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
          <div className="flex flex-wrap gap-2">
            <UnwiredButton className={SECONDARY_BUTTON} noteId={pauseNote}>
              <IconPause />
              Pause
            </UnwiredButton>
            <UnwiredButton className={SECONDARY_BUTTON} noteId={finishNote}>
              <IconClipboard />
              Finish &amp; Review
            </UnwiredButton>
            <UnwiredButton className={joinClasses(QUIET_BUTTON, "border border-stone-700")} noteId={slowNote}>
              Slow down
            </UnwiredButton>
          </div>
          <button className={joinClasses(PRIMARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")} disabled={disabled} type="submit">
            Send
            <IconArrowUp />
          </button>
        </div>
      </form>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <NotYetImplementedNote id={pauseNote} noteKey="pause" />
        <NotYetImplementedNote id={finishNote} noteKey="finishReview" />
        <NotYetImplementedNote id={slowNote} noteKey="slowDown" />
        <NotYetImplementedNote id={noteId("composer", "latestChange")} noteKey="latestChange" />
      </div>
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

// The Compass & Waypoint card is not built yet: it says what it will do and,
// when the current tools are shown, where the saved Compass and Waypoints are
// meanwhile.
function ConnectedSupportBody({ scope, toolsShown }: Readonly<{ scope: SupportScope; toolsShown: boolean }>) {
  const compassTitle = `${scope}-connected-compass-title`;
  const waypointTitle = `${scope}-connected-waypoint-title`;

  return (
    <>
      <section aria-labelledby={compassTitle} className="grid gap-2 border-b border-stone-800/80 px-4 py-4">
        <h3 className="font-serif text-lg text-stone-50" id={compassTitle}>
          Compass
        </h3>
        <NotYetImplementedNote id={noteId(scope, "compass")} noteKey="compass" />
        <NotYetImplementedNote id={noteId(scope, "formingPoint")} noteKey="formingPoint" />
        <NotYetImplementedNote id={noteId(scope, "needle")} noteKey="needle" />
      </section>
      <section aria-labelledby={waypointTitle} className="grid gap-2 border-b border-stone-800/80 px-4 py-4">
        <h3 className="font-serif text-lg text-stone-50" id={waypointTitle}>
          Waypoint
        </h3>
        <NotYetImplementedNote id={noteId(scope, "waypointCard")} noteKey="waypointCard" />
        <NotYetImplementedNote id={noteId(scope, "keyInsight")} noteKey="keyInsight" />
      </section>
      {toolsShown ? <p className="px-4 py-4 text-xs leading-5 text-stone-300">{CURRENT_TOOLS_POINTER}</p> : null}
    </>
  );
}

type ToolsProps = Readonly<{
  state: ExplorerConversationState;
  view: ConnectedConversationView;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>;

// The existing Compass and Waypoint tools, unchanged, until the conversation
// forms them (rebuild steps 4 and 5).
function CurrentTools({ state, view, onCommand }: ToolsProps) {
  const headingId = "conversation-current-tools-heading";

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border border-stone-800 bg-[#090807]/85 p-4 sm:p-5">
      <h2 className="font-serif text-xl text-stone-50" id={headingId}>
        {CURRENT_TOOLS_HEADING}
      </h2>
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
  const [spacesOpen, setSpacesOpen] = useState(false);
  const { state } = view;
  const status = conversationStatus(state, view.ended);
  const renderSupportBody = (scope: SupportScope) => <ConnectedSupportBody scope={scope} toolsShown={state !== null} />;

  return (
    <ExplorerConversationScreenShell
      connected
      drawer={<ConnectedSupportDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} renderBody={renderSupportBody} />}
      onSkip={() => headingRef.current?.focus()}
      onToggleSpaces={() => setSpacesOpen((open) => !open)}
      shell={CONNECTED_SHELL}
      spacesOpen={spacesOpen}
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
              <ConversationNotices actions={actions} view={view} />
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
  );
}
