"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import { parseExplorerConversationReviewResult } from "@/lib/solmind/explorerConversationReviewContract";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";
import { ExplorerConversationFormation } from "./ExplorerConversationFormation";
import { FOCUS_RING, SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { ExplorerWorkspaceFrame } from "./ExplorerWorkspaceFrame";

const STATE_PATH = "/explorer/conversations/state";
const RESPONSE_BUDGET_MS = 70_000;
const RESULT_CHARACTER_LIMIT = 1_200_000;
const REVIEW_HEADING_ID = "ended-conversations-heading";
// The dark and amber look of the signed-in conversation screen.
const buttonClass = joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50");
const CARD = "rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5";
const LINK = joinClasses("font-semibold text-amber-200 underline underline-offset-4 hover:text-amber-100", FOCUS_RING);
type ReviewItem = Readonly<{ conversationId: string; endedAt: string | null }>;
type ReviewResult = NonNullable<ReturnType<typeof parseExplorerConversationReviewResult>>;

async function readReviewResult(response: Response): Promise<ReviewResult | null> {
  if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) return null;
  const text = await response.text();
  if (text.length > RESULT_CHARACTER_LIMIT) return null;
  try {
    const result = parseExplorerConversationReviewResult(JSON.parse(text) as unknown);
    return result?.ok && !response.ok ? null : result;
  } catch { return null; }
}

/** Presentation only: this receives an already-authorized, parsed ended state. */
export function ExplorerEndedConversationReadback({ state }: Readonly<{ state: ExplorerConversationState }>) {
  if (state.sessionStatus !== "ended") return <p role="alert">This ended conversation is not available for review.</p>;
  return <section aria-label="Ended conversation review" className="mt-6 space-y-6">
    <header className={CARD}>
      <h2 className="font-serif text-2xl text-stone-50">Ended conversation</h2>
      <p className="mt-2 text-stone-300">This is read-only. Reviewing it does not reopen it, send a message or sign you out.</p>
      {state.ending != null ? <div className="mt-4">
        <h3 className="font-semibold text-stone-100">Saved directions taken</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-stone-200">{state.ending.directionsTaken}</p>
        <p className="mt-2 text-sm text-stone-400">Ended on <time dateTime={state.ending.endedAt}>{new Date(state.ending.endedAt).toLocaleString("en-US")}</time></p>
      </div> : <p className="mt-4 text-stone-300">No saved ending summary is available.</p>}
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-labelledby="ended-conversation-messages" className={joinClasses("min-w-0", CARD)}>
        <h3 id="ended-conversation-messages" className="font-serif text-xl text-stone-50">Saved conversation</h3>
        {state.messages.length === 0 ? <p className="mt-4 text-stone-300">There are no saved messages in this conversation.</p> : <ol aria-label="Saved ended conversation" className="mt-4 space-y-4">
          {state.messages.map(message => <li key={message.id} className="rounded-2xl border border-stone-800 bg-black/40 p-4">
            <p className="font-semibold text-amber-200">{message.role === "explorer" ? "You" : SOLMIND_TERMS.virtualGuide}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-stone-100">{message.body}</p>
            <time dateTime={message.createdAt} className="mt-2 block text-xs text-stone-400">{new Date(message.createdAt).toLocaleString("en-US")}</time>
          </li>)}
        </ol>}
      </section>
      {/* min-w-0 lets the Compass keep its own sideways scroll on phones instead of widening the page. */}
      <div className="min-w-0">
        <ExplorerConversationFormation state={state} busy={false} readOnly onCommand={() => undefined} />
      </div>
    </div>
  </section>;
}

/** Public shell; all metadata and content come only from authenticated GETs. */
export function ExplorerConversationReview() {
  const [items, setItems] = useState<readonly ReviewItem[] | null>(null);
  const [selected, setSelected] = useState<ExplorerConversationState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<"denied" | "unavailable" | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const activeRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async (conversationId?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(null); setSelected(null);
    const generation = ++generationRef.current;
    const controller = new AbortController();
    activeRef.current?.abort(); activeRef.current = controller;
    const timer = setTimeout(() => controller.abort(), RESPONSE_BUDGET_MS);
    try {
      const response = await fetch(conversationId === undefined ? STATE_PATH : `${STATE_PATH}?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json" }, signal: controller.signal,
      });
      const result = await readReviewResult(response);
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (!result?.ok) {
        setItems(null); setSelected(null); setError(result?.error ?? "unavailable");
      } else if (conversationId === undefined ? result.items === null || result.state !== null
        : result.state === null || result.state.conversationId !== conversationId || result.state.sessionStatus !== "ended") {
        setItems(null); setSelected(null); setError("unavailable");
      } else {
        if (result.items !== null) setItems(result.items);
        setSelected(result.state); setError(null);
      }
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setItems(null); setSelected(null); setError("unavailable");
    } finally {
      clearTimeout(timer);
      if (mountedRef.current && generation === generationRef.current) {
        activeRef.current = null; busyRef.current = false; setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    headingRef.current?.focus();
    const initial = setTimeout(() => { void load(); }, 0);
    const leave = () => {
      generationRef.current += 1; activeRef.current?.abort(); busyRef.current = true;
      setItems(null); setSelected(null); setError(null); setBusy(true);
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", leave); window.addEventListener("pageshow", restore);
    return () => {
      clearTimeout(initial); mountedRef.current = false; generationRef.current += 1;
      activeRef.current?.abort(); busyRef.current = false;
      window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore);
    };
  }, [load]);

  // In the Explorer workspace frame with Conversations current (Paul's
  // 2026-11-02 decisions). Overview in the menu is the way home, so the page's
  // own "Explorer home" link is gone.
  return <ExplorerWorkspaceFrame page="conversations" skipTargetId={REVIEW_HEADING_ID}>
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 pt-5 sm:px-6 lg:px-8">
    <header className="mb-6 space-y-2">
      <h1 id={REVIEW_HEADING_ID} ref={headingRef} tabIndex={-1} className="font-serif text-3xl leading-tight text-stone-50 focus:outline-none sm:text-4xl">Your ended conversations</h1>
      <p className="text-sm leading-6 text-stone-300">Review saved messages, directions, Compass and Waypoints from your ended conversations. Nothing is shared or changed here.</p>
    </header>
    <p role="status" aria-live="polite" className="min-h-6 text-sm text-stone-300">{busy ? "Loading your saved ended conversations..." : ""}</p>
    {error !== null ? <div role="alert" className="my-4 rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50">
      <p>{error === "denied" ? "These conversations are not available in your current session. Sign in again to review them." : "The ended conversations could not be loaded. Please try again."}</p>
      {error === "denied" ? <a className={joinClasses("mt-2 inline-block", LINK)} href="/login/explorer">Sign in</a> : null}
    </div> : null}
    <button type="button" className={buttonClass} disabled={busy} onClick={() => { void load(); }}>Reload ended conversations</button>
    {items !== null ? <section aria-label="Ended conversation list" className={joinClasses("mt-5", CARD)}>
      <h2 className="font-serif text-xl text-stone-50">Choose a conversation to review</h2>
      {items.length === 0 ? <p className="mt-3 text-stone-300">No ended conversations are available in your current session.</p> : <ol className="mt-4 space-y-3">
        {items.map((item, index) => <li key={item.conversationId} className="rounded-2xl border border-stone-800 bg-black/40 p-4">
          <p className="text-sm text-stone-300">{item.endedAt === null ? "Saved ending time is unavailable." : <>Ended on <time dateTime={item.endedAt}>{new Date(item.endedAt).toLocaleString("en-US")}</time></>}</p>
          <button type="button" className={`${buttonClass} mt-2`} disabled={busy} onClick={() => { void load(item.conversationId); }}>Review ended conversation {index + 1}</button>
        </li>)}
      </ol>}
    </section> : null}
    {selected !== null ? <ExplorerEndedConversationReadback state={selected} /> : null}
    </div>
  </ExplorerWorkspaceFrame>;
}
