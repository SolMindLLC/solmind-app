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
import { SOLMIND_TERMS } from "@/lib/solmind/terms";
import {
  ExplorerConversationFormation,
  type ExplorerConversationFormationIntent,
} from "./ExplorerConversationFormation";

const STATE_PATH = "/explorer/conversation/state";
const COMMAND_PATH = "/explorer/conversation/commands";
const RESPONSE_BUDGET_MS = 70_000;
const RESULT_CHARACTER_LIMIT = 1_200_000;
const REQUEST_BYTE_LIMIT = 16_384;
const fieldClass = "w-full rounded-xl border border-slate-500 bg-white p-3 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const buttonClass = "rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

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
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <a className="font-medium text-teal-800 underline focus-visible:outline-2 focus-visible:outline-offset-4" href="/explorer/home">Explorer home</a>
      <header className="my-6 space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold focus:outline-none">Your conversation</h1>
        <p>Explore with the {SOLMIND_TERMS.virtualGuide}. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.</p>
        <p className="text-sm text-slate-700">The {SOLMIND_TERMS.virtualGuide} supports reflection. It is not a therapist or crisis service.</p>
      </header>
      <p role="status" aria-live="polite" aria-atomic="true" className="min-h-6">{busy ? (state === null ? "Loading your saved conversation..." : "Checking your change...") : notice}</p>
      {assistance !== null ? (
        <div role="alert" className="my-4 space-y-2 rounded-xl border border-amber-500 bg-amber-50 p-4">
          <p className="whitespace-pre-wrap">{assistance.body}</p>
          <p>This assistance is temporary and is not a saved conversation reply.</p>
        </div>
      ) : null}
      {error !== null && !uncertain ? (
        <div role="alert" className="my-4 rounded-xl border border-amber-500 bg-amber-50 p-4">
          <p>{errorCopy(error)}</p>
          {error === "denied" ? <a className="mt-2 inline-block font-semibold text-teal-900 underline" href="/login/explorer">Sign in</a> : null}
        </div>
      ) : null}
      {uncertain ? (
        <div role="alert" className="my-4 space-y-3 rounded-xl border border-amber-500 bg-amber-50 p-4">
          <p>We could not confirm your last change. Retry the same request before making another change. No new message, reply or saved change is being claimed.</p>
          <button className={buttonClass} type="button" disabled={busy} onClick={() => { const pending = pendingRef.current; if (pending !== null) void dispatch(pending); }}>Retry the same request</button>
        </div>
      ) : null}
      {!uncertain && error !== "denied" ? (
        <button type="button" className="my-3 rounded-xl border border-teal-800 px-4 py-2 font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={busy} onClick={() => { void load(); }}>Reload saved conversation</button>
      ) : null}
      {state !== null ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section aria-labelledby="conversation-heading" aria-busy={busy} className="min-w-0 rounded-2xl border border-slate-300 bg-white p-4 sm:p-6">
            <h2 id="conversation-heading" className="text-xl font-semibold">Conversation</h2>
            {state.pendingTurn ? <p role="status" className="my-4 rounded-xl bg-amber-50 p-4">A saved message is still awaiting a confirmed result. No reply is being claimed. Reload the saved conversation to check; another send will not be started.</p> : null}
            {state.messages.length === 0 ? <p className="my-4 text-slate-700">There are no saved messages yet.</p> : (
              <ol aria-label="Saved conversation" className="my-5 space-y-4">
                {state.messages.map(message => (
                  <li key={message.id} className="rounded-xl bg-slate-100 p-4">
                    <p className="mb-2 font-semibold">{message.role === "explorer" ? "You" : SOLMIND_TERMS.virtualGuide}</p>
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <time dateTime={message.createdAt} className="mt-2 block text-xs text-slate-600">{new Date(message.createdAt).toLocaleString("en-US")}</time>
                  </li>
                ))}
              </ol>
            )}
            {!ended && sendUnavailable ? <p id="conversation-availability" className="my-4 rounded-xl bg-slate-100 p-4">The {SOLMIND_TERMS.virtualGuide} is unavailable. You can review saved messages and work with your saved Compass and Waypoints.</p> : null}
            {!ended && atMessageCapacity ? <p id="conversation-capacity" className="my-4 rounded-xl bg-slate-100 p-4">This conversation has reached its saved-message limit. You can still review messages and work with your Compass and Waypoints.</p> : null}
            {!ended ? <form onSubmit={send} className="mt-5 space-y-3">
              <label className="block font-semibold" htmlFor="conversation-message">Your message</label>
              <textarea id="conversation-message" ref={composerRef} className={fieldClass} rows={5} value={draft} maxLength={EXPLORER_CONVERSATION_LIMITS.messageCharacters} disabled={held || sendUnavailable || atMessageCapacity} aria-describedby={atMessageCapacity ? "conversation-capacity" : sendUnavailable ? "conversation-availability" : undefined} onChange={event => { setDraft(event.target.value); setDraftError(""); }} />
              {draftError ? <p role="alert" className="text-amber-900">{draftError}</p> : null}
              <button type="submit" className={buttonClass} disabled={held || sendUnavailable || atMessageCapacity}>Send message</button>
            </form> : <p className="my-4 rounded-xl bg-slate-100 p-4">This saved conversation has ended. It is available for read-only review.</p>}
          </section>
          <ExplorerConversationFormation state={state} busy={held} readOnly={ended} onCommand={command} />
        </div>
      ) : null}
      {state !== null ? <section aria-label="End Session" className="mt-6 rounded-2xl border border-slate-300 bg-white p-5">
        {state.conversationId === null ? <>
          <p>No saved conversation has been started. Returning home will not create or end one.</p>
          <a className="mt-3 inline-block font-semibold text-teal-900 underline" href="/explorer/home">Return to Explorer home</a>
        </> : ended ? <a className="font-semibold text-teal-900 underline" href="/explorer/conversations">Review ended conversations</a> : <>
          <h2 className="text-xl font-semibold">End Session</h2>
          <p className="mt-2 text-sm text-slate-700">End this saved conversation when you choose. Your messages, Compass, Route and Waypoints remain available for read-only review; ending does not sign you out.</p>
          <button type="button" className={`${buttonClass} mt-3`} disabled={held} onClick={reviewEnd}>Review End Session</button>
          {endReview !== null ? <div role="group" aria-label="Review End Session" className="mt-4 space-y-3 rounded-xl border border-amber-500 bg-amber-50 p-4">
            <p>End this saved session and return to Explorer home? This closes this conversation; it does not mean your journey is over.</p>
            <p>There are {state.messages.length} saved messages and {(state.route ?? []).length} recorded Route changes. A factual ending will be saved with the existing Route.</p>
            {draft.length > 0 ? <p>Your unsaved message draft will not be saved.</p> : null}
            {staleEndReview ? <p role="alert">Your saved conversation changed. Close this review and review End Session again.</p> : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass} disabled={endBlocked || staleEndReview} onClick={confirmEnd}>End Session and return home</button>
              <button type="button" className={buttonClass} disabled={busy || uncertain} onClick={() => { setEndReview(null); setDraftError(""); }}>Keep this session open</button>
            </div>
          </div> : null}
        </>}
      </section> : null}
    </main>
  );
}
