"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  EXPLORER_CONVERSATION_LIMITS,
  waypointHasCapacity,
  type ExplorerConversationCommand,
  type ExplorerConversationError,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import { parseExplorerPrivateConversationResponse, type ExplorerPrivateConversationResponse,
  type ExplorerPrivateAssistance } from "@/lib/solmind/explorerPrivateConversationResponse";
import { ExplorerConversationConnectedScreen } from "./ExplorerConversationConnectedScreen";
import type { ExplorerConversationFormationIntent } from "./ExplorerConversationFormation";
import { COMPASS_SUGGESTION_REPLY_LABELS } from "@/lib/solmind/explorerCompassSuggestionReplies";
import { latestReplyChoices } from "@/lib/solmind/explorerReplyChoices";
import { completeWaypointDraft, waypointLimitReached } from "@/lib/solmind/explorerWaypointDraft";
import { EXPLORER_TOUR_CHOICE } from "@/lib/solmind/explorerConversationTour";
import { useExplorerEarlyTestNoticeRecheck } from "@/lib/solmind/explorerEarlyTestNoticeRecheck";
import { EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS } from "@/lib/solmind/explorerSendScreenLimit";

const STATE_PATH = "/explorer/conversation/state";
const COMMAND_PATH = "/explorer/conversation/commands";
// The state read and the commands other than Send. A Send waits longer, past the server's overall Send deadline
// (correction D-12, 2026-11-09).
const RESPONSE_BUDGET_MS = 70_000;
const RESULT_CHARACTER_LIMIT = 1_200_000;
const REQUEST_BYTE_LIMIT = 16_384;

type CommandIntent = ExplorerConversationFormationIntent | Readonly<{ kind: "send"; body: string }> |
  Readonly<{ kind: "end_conversation"; conversationId: string }> |
  Readonly<{ kind: "suggestion_follow_up"; response: "right" | "close" | "not_it"; wording: string }> |
  Readonly<{ kind: "reply_choice"; label: string }>;
type PendingCommand = Readonly<{ command: ExplorerConversationCommand; body: string; intent: CommandIntent;
  suggestionWording: string | null }>;

function prepareCommand(intent: CommandIntent, expectedRevision: number, suggestionWording: string | null = null): PendingCommand | null {
  const wireIntent = intent.kind === "suggestion_follow_up"
    ? { kind: "send" as const, body: `${COMPASS_SUGGESTION_REPLY_LABELS[intent.response]}: "${intent.wording}"` }
    : intent.kind === "reply_choice" ? { kind: "send" as const, body: intent.label, replyChoice: true as const } : intent;
  const command: ExplorerConversationCommand = Object.freeze({
    ...wireIntent, operationId: crypto.randomUUID(), expectedRevision,
  });
  const body = JSON.stringify(command);
  return new TextEncoder().encode(body).byteLength > REQUEST_BYTE_LIMIT ? null
    : Object.freeze({ command, body, intent, suggestionWording });
}

/** Decode before rendering; a malformed or non-success HTTP success is uncertain. */
async function readResult(response: Response): Promise<ExplorerPrivateConversationResponse | null> {
  if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) return null;
  const text = await response.text();
  if (text.length > RESULT_CHARACTER_LIMIT) return null;
  let result: ExplorerPrivateConversationResponse | null;
  try { result = parseExplorerPrivateConversationResponse(JSON.parse(text) as unknown); }
  catch { return null; }
  if (result?.result.ok && !response.ok) return null;
  return result;
}

function errorCopy(error: ExplorerConversationError): string {
  switch (error) {
    case "denied": return "This conversation is not available in your current session. Sign in again to continue.";
    case "refresh_required": return "Your conversation has changed. Reload the saved conversation before making another change.";
    case "provider_unavailable": return "The SolMind Virtual Guide is unavailable. No new message or reply has been confirmed saved.";
    case "unavailable": return "The conversation could not be loaded. Please try again.";
  }
}

/** Authenticated feature routes own all authority and persistence. No optimistic replies. */
export function ExplorerConversation() {
  const notifyExplorerEarlyTestNoticeRecheck = useExplorerEarlyTestNoticeRecheck();
  const [state, setState] = useState<ExplorerConversationState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<ExplorerConversationError | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const [assistance, setAssistance] = useState<ExplorerPrivateAssistance | null>(null);
  const [endReview, setEndReview] = useState<Readonly<{ conversationId: string; revision: number }> | null>(null);
  const [sendSequence, setSendSequence] = useState(0);
  const stateRef = useRef<ExplorerConversationState | null>(null);
  const busyRef = useRef(true);
  const pendingRef = useRef<PendingCommand | null>(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const activeRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const replaceState = useCallback((next: ExplorerConversationState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(async (initial = false) => {
    if (!initial && (busyRef.current || pendingRef.current !== null)) return;
    const generation = ++generationRef.current;
    const controller = new AbortController();
    activeRef.current?.abort();
    activeRef.current = controller;
    busyRef.current = true;
    setAssistance(null);
    if (!initial) { setBusy(true); setNotice(""); }
    const timer = setTimeout(() => controller.abort(), RESPONSE_BUDGET_MS);
    try {
      const response = await fetch(STATE_PATH, {
        method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json" }, signal: controller.signal,
      });
      const output = await readResult(response);
      const result = output?.result;
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (result && !result.ok && (result.error === "denied" || result.error === "unavailable")) {
        notifyExplorerEarlyTestNoticeRecheck();
      }
      if (result?.ok) {
        replaceState(result.state);
        setError(null);
        setUncertain(false);
        // A screen-open read carries only the hard-stop pause notice.
        setAssistance(output?.assistance?.kind === "paused" ? output.assistance : null);
        if (!initial) setNotice("The saved conversation is up to date.");
      } else {
        replaceState(null);
        setError(result?.error ?? "unavailable");
        if (result?.error === "denied") setDraft("");
      }
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      replaceState(null);
      setError("unavailable");
    } finally {
      clearTimeout(timer);
      if (mountedRef.current && generation === generationRef.current) {
        activeRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [notifyExplorerEarlyTestNoticeRecheck, replaceState]);

  useEffect(() => {
    mountedRef.current = true;
    headingRef.current?.focus();
    const initialLoad = setTimeout(() => { void load(true); }, 0);
    return () => {
      clearTimeout(initialLoad);
      mountedRef.current = false;
      generationRef.current += 1;
      activeRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const leave = () => {
      generationRef.current += 1;
      activeRef.current?.abort();
      busyRef.current = true;
      replaceState(null);
      setDraft("");
      setAssistance(null);
      setBusy(true);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
    };
  }, [replaceState]);

  const dispatch = useCallback(async function dispatchPending(pending: PendingCommand) {
    if (busyRef.current || pendingRef.current !== pending) return;
    // Display signal only: clear local reply prompts for every ordinary Send,
    // including a Compass follow-up or an exact uncertain retry.
    if (pending.command.kind === "send") setSendSequence(sequence => sequence + 1);
    busyRef.current = true;
    setBusy(true);
    setUncertain(false);
    setNotice("");
    setAssistance(null);
    const generation = ++generationRef.current;
    const controller = new AbortController();
    activeRef.current = controller;
    const timer = setTimeout(() => controller.abort(),
      pending.command.kind === "send" ? EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS : RESPONSE_BUDGET_MS);
    let followUp: PendingCommand | null = null;
    try {
      const response = await fetch(COMMAND_PATH, {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: pending.body, signal: controller.signal,
      });
      const output = await readResult(response);
      const result = output?.result ?? null;
      if (!mountedRef.current || generation !== generationRef.current || pendingRef.current !== pending) return;
      if (result && !result.ok && (result.error === "denied" || result.error === "unavailable")) {
        notifyExplorerEarlyTestNoticeRecheck();
      }
      setAssistance(output?.assistance ?? null);
      if (result === null || (!result.ok && result.error === "unavailable")) {
        setUncertain(true);
        return;
      }
      if (result.ok) {
        const previous = stateRef.current;
        if (result.state.revision < pending.command.expectedRevision ||
            (previous !== null && previous.conversationId !== null && previous.conversationId !== result.state.conversationId)) {
          setUncertain(true);
          return;
        }
        if (pending.command.kind === "end_conversation") {
          // A confirmed owned ended projection is sufficient, including an
          // already-ended result from another tab. Unknown outcomes stay pending.
          if (result.state.conversationId !== pending.command.conversationId || result.state.sessionStatus !== "ended") {
            setUncertain(true);
            return;
          }
          replaceState(result.state);
          setError(null);
          setDraft("");
          setEndReview(null);
          pendingRef.current = null;
          window.location.assign("/explorer/home");
          return;
        }
        // A result for any command but Send never checks the Virtual Guide (it
        // always says "unavailable"), and the server checks readiness again on
        // every Send, so after such a command the screen keeps the Virtual
        // Guide state it last had (chat step slice S2, fix round 2, 2026-11-03).
        // A Send refused as unavailable sets that state (fix round 3, below).
        replaceState(pending.command.kind === "send" || previous === null ? result.state
          : Object.freeze({ ...result.state, providerState: previous.providerState }));
        setError(null);
        setNotice(output?.assistance === null ? "Your saved conversation is up to date." : "");
        // A button's ordinary Send has its own intent. It never consumes the
        // Explorer's composer draft, including after an exact uncertain retry.
        if (pending.intent.kind === "send" && output?.assistance === null) setDraft("");
        if ((pending.command.kind === "respond_compass_suggestion" || pending.command.kind === "respond_waypoint_draft") &&
            pending.suggestionWording !== null) {
          const current = stateRef.current;
          if (current !== null && !current.pendingTurn && current.sessionStatus !== "ended" &&
              current.providerState === "available" && current.compassSuggestionReplies === "available" &&
              current.messages.length <= EXPLORER_CONVERSATION_LIMITS.messages - 2) {
            try {
              followUp = prepareCommand({ kind: "suggestion_follow_up", response: pending.command.response,
                wording: pending.suggestionWording }, current.revision);
              if (followUp === null) setDraftError("This change is too long to send. Please shorten the text.");
            } catch {
              setDraftError("This change could not be prepared. Please reload and try again.");
            }
          }
        }
      } else {
        setError(result.error);
        if (result.error === "denied" || result.error === "refresh_required") replaceState(null);
        if (result.error === "denied") setDraft("");
        // A Send refused because the Virtual Guide is unavailable records that
        // as the Virtual Guide state the screen keeps, so a later confirmed
        // command does not enable Send again; a reload reads it afresh (chat
        // step slice S2, fix round 3, 2026-11-03).
        const kept = stateRef.current;
        if (pending.command.kind === "send" && result.error === "provider_unavailable" && kept !== null) {
          replaceState(Object.freeze({ ...kept, providerState: "unavailable" }));
        }
      }
      pendingRef.current = followUp;
    } catch {
      if (mountedRef.current && generation === generationRef.current && pendingRef.current === pending) setUncertain(true);
    } finally {
      clearTimeout(timer);
      if (mountedRef.current && generation === generationRef.current) {
        activeRef.current = null;
        busyRef.current = false;
        setBusy(false);
        // This is the next, separately counted ordinary Send only after a
        // confirmed response command. Uncertain outcomes keep their exact bytes.
        if (followUp !== null) void dispatchPending(followUp);
      }
    }
  }, [notifyExplorerEarlyTestNoticeRecheck, replaceState]);

  const command = useCallback((intent: CommandIntent) => {
    // The fixed tour is local presentation, never an ordinary Send.
    if (intent.kind === "reply_choice" && intent.label === EXPLORER_TOUR_CHOICE) return;
    const current = stateRef.current;
    if (busyRef.current || pendingRef.current !== null || current === null || current.pendingTurn || current.sessionStatus === "ended") return;
    if (intent.kind === "end_conversation" && (current.conversationId === null || intent.conversationId !== current.conversationId)) return;
    if (intent.kind === "send" && current.providerState !== "available") return;
    if ((intent.kind === "confirm_waypoint" || intent.kind === "revisit_waypoint" || intent.kind === "revise_waypoint") &&
        !waypointHasCapacity(current, intent.kind === "confirm_waypoint" ? "new"
          : intent.kind === "revisit_waypoint" ? "revisit" : "revision")) return;
    // A reply choice sends exactly the latest saved choice as an ordinary Send,
    // with its own intent so the Explorer's typed draft is kept across retries.
    if (intent.kind === "reply_choice" && (endReview !== null || current.providerState !== "available" ||
        current.compassSuggestionReplies !== "available" ||
        current.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2 ||
        !(latestReplyChoices(current)?.labels.includes(intent.label) ?? false))) return;
    const suggestion = intent.kind === "respond_compass_suggestion"
      ? current.compassItems.find(item => item.id === intent.itemId && item.formation === "forming" && item.mergedIntoItemId == null)
      : undefined;
    if (intent.kind === "respond_compass_suggestion" &&
        (current.compassSuggestionReplies !== "available" ||
         (intent.response === "not_it" && current.turnedDownLimitReached) ||
         suggestion === undefined ||
         (intent.response !== "right" && (current.providerState !== "available" ||
          current.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2)))) return;
    const waypointDraft = intent.kind === "respond_waypoint_draft" && current.waypointDraft?.id === intent.draftId
      ? current.waypointDraft : null;
    if (intent.kind === "respond_waypoint_draft" &&
        (current.compassSuggestionReplies !== "available" || waypointDraft === null ||
         (intent.response === "right" && (waypointLimitReached(current) || !completeWaypointDraft(waypointDraft))) ||
         (intent.response !== "right" && (waypointDraft.title === null || current.providerState !== "available" ||
          current.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2)))) return;
    try {
      // Keep the displayed wording pinned to this reply's revision, even when
      // rejection removes the point or the exact response needs a later retry.
      const pending = prepareCommand(intent, current.revision, suggestion?.label ?? waypointDraft?.title ?? null);
      if (pending === null) {
        setDraftError("This change is too long to send. Please shorten the text.");
        return;
      }
      pendingRef.current = pending;
      setDraftError("");
      void dispatch(pending);
    } catch {
      setDraftError("This change could not be prepared. Please reload and try again.");
    }
  }, [dispatch, endReview]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (body.length === 0 || body.length > EXPLORER_CONVERSATION_LIMITS.messageCharacters) {
      setDraftError(`Write a message of 1 to ${EXPLORER_CONVERSATION_LIMITS.messageCharacters.toLocaleString("en-US")} characters.`);
      composerRef.current?.focus();
      return;
    }
    command({ kind: "send", body });
  }

  function reviewEnd() {
    const current = stateRef.current;
    if (busyRef.current || pendingRef.current !== null || current === null || current.conversationId === null ||
        current.pendingTurn || current.sessionStatus === "ended") return;
    setEndReview({ conversationId: current.conversationId, revision: current.revision });
    setDraftError("");
  }
  function confirmEnd() {
    const current = stateRef.current;
    if (endReview === null || current === null || endReview.conversationId !== current.conversationId ||
        endReview.revision !== current.revision) {
      setDraftError("Your saved conversation changed. Close this review and review End Session again.");
      return;
    }
    command({ kind: "end_conversation", conversationId: endReview.conversationId });
  }

  const ended = state?.sessionStatus === "ended";
  const endBlocked = busy || uncertain || state?.pendingTurn === true;
  const staleEndReview = endReview !== null && (state === null || endReview.conversationId !== state.conversationId || endReview.revision !== state.revision);
  const held = endBlocked || endReview !== null || ended;
  const sendUnavailable = state?.providerState !== "available" || error === "provider_unavailable";
  const atMessageCapacity = state !== null && state.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2;
  return (
    <ExplorerConversationConnectedScreen
      actions={{
        onReload: () => { void load(); },
        onRetry: () => { const pending = pendingRef.current; if (pending !== null) void dispatch(pending); },
        onDraftChange: (value: string) => { setDraft(value); setDraftError(""); },
        onSend: send,
        onReviewEnd: reviewEnd,
        onConfirmEnd: confirmEnd,
        onKeepOpen: () => { setEndReview(null); setDraftError(""); },
        onCommand: command,
        onReplyChoice: (label: string) => command({ kind: "reply_choice", label }),
      }}
      composerRef={composerRef}
      headingRef={headingRef}
      view={{
        state,
        busy,
        sendSequence,
        statusText: busy ? (state === null ? "Loading your saved conversation..." : "Checking your change...") : notice,
        assistance,
        errorMessage: error !== null && !uncertain ? errorCopy(error) : null,
        signInRequired: error === "denied",
        uncertain,
        reloadAvailable: !uncertain && error !== "denied",
        draft,
        draftError,
        endReviewOpen: endReview !== null,
        staleEndReview,
        ended,
        endBlocked,
        held,
        sendUnavailable,
        atMessageCapacity,
      }}
    />
  );
}
