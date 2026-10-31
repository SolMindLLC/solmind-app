"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationCommand,
  type ExplorerConversationError,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import { parseExplorerPrivateConversationResponse, type ExplorerPrivateConversationResponse,
  type ExplorerPrivateAssistance } from "@/lib/solmind/explorerPrivateConversationResponse";
import { ExplorerConversationConnectedScreen } from "./ExplorerConversationConnectedScreen";
import type { ExplorerConversationFormationIntent } from "./ExplorerConversationFormation";

const STATE_PATH = "/explorer/conversation/state";
const COMMAND_PATH = "/explorer/conversation/commands";
const RESPONSE_BUDGET_MS = 70_000;
const RESULT_CHARACTER_LIMIT = 1_200_000;
const REQUEST_BYTE_LIMIT = 16_384;

type CommandIntent = ExplorerConversationFormationIntent | Readonly<{ kind: "send"; body: string }> |
  Readonly<{ kind: "end_conversation"; conversationId: string }>;
type PendingCommand = Readonly<{ command: ExplorerConversationCommand; body: string }>;

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
  const [state, setState] = useState<ExplorerConversationState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<ExplorerConversationError | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const [assistance, setAssistance] = useState<ExplorerPrivateAssistance | null>(null);
  const [endReview, setEndReview] = useState<Readonly<{ conversationId: string; revision: number }> | null>(null);
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
      if (result?.ok) {
        replaceState(result.state);
        setError(null);
        setUncertain(false);
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
  }, [replaceState]);

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

  const dispatch = useCallback(async (pending: PendingCommand) => {
    if (busyRef.current || pendingRef.current !== pending) return;
    busyRef.current = true;
    setBusy(true);
    setUncertain(false);
    setNotice("");
    setAssistance(null);
    const generation = ++generationRef.current;
    const controller = new AbortController();
    activeRef.current = controller;
    const timer = setTimeout(() => controller.abort(), RESPONSE_BUDGET_MS);
    try {
      const response = await fetch(COMMAND_PATH, {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: pending.body, signal: controller.signal,
      });
      const output = await readResult(response);
      const result = output?.result ?? null;
      if (!mountedRef.current || generation !== generationRef.current || pendingRef.current !== pending) return;
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
        replaceState(result.state);
        setError(null);
        setNotice(output?.assistance === null ? "Your saved conversation is up to date." : "");
        if (pending.command.kind === "send" && output?.assistance === null) setDraft("");
      } else {
        setError(result.error);
        if (result.error === "denied" || result.error === "refresh_required") replaceState(null);
        if (result.error === "denied") setDraft("");
      }
      pendingRef.current = null;
    } catch {
      if (mountedRef.current && generation === generationRef.current && pendingRef.current === pending) setUncertain(true);
    } finally {
      clearTimeout(timer);
      if (mountedRef.current && generation === generationRef.current) {
        activeRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [replaceState]);

  const command = useCallback((intent: CommandIntent) => {
    const current = stateRef.current;
    if (busyRef.current || pendingRef.current !== null || current === null || current.pendingTurn || current.sessionStatus === "ended") return;
    if (intent.kind === "end_conversation" && (current.conversationId === null || intent.conversationId !== current.conversationId)) return;
    if (intent.kind === "send" && current.providerState !== "available") return;
    try {
      const stamped: ExplorerConversationCommand = Object.freeze({
        ...intent, operationId: crypto.randomUUID(), expectedRevision: current.revision,
      });
      const body = JSON.stringify(stamped);
      if (new TextEncoder().encode(body).byteLength > REQUEST_BYTE_LIMIT) {
        setDraftError("This change is too long to send. Please shorten the text.");
        return;
      }
      const pending = Object.freeze({ command: stamped, body });
      pendingRef.current = pending;
      setDraftError("");
      void dispatch(pending);
    } catch {
      setDraftError("This change could not be prepared. Please reload and try again.");
    }
  }, [dispatch]);

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
      }}
      composerRef={composerRef}
      headingRef={headingRef}
      view={{
        state,
        busy,
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
