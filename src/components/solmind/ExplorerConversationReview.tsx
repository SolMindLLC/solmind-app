"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import { parseExplorerConversationReviewResult } from "@/lib/solmind/explorerConversationReviewContract";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";
import { ExplorerConversationFormation } from "./ExplorerConversationFormation";

const STATE_PATH = "/explorer/conversations/state";
const RESPONSE_BUDGET_MS = 70_000;
const RESULT_CHARACTER_LIMIT = 1_200_000;
const buttonClass = "rounded-xl border border-teal-800 px-4 py-2 font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
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
    <header className="rounded-2xl border border-slate-300 bg-white p-5">
      <h2 className="text-2xl font-semibold">Ended conversation</h2>
      <p className="mt-2">This is read-only. Reviewing it does not reopen it, send a message or sign you out.</p>
      {state.ending != null ? <div className="mt-4">
        <h3 className="font-semibold">Saved directions taken</h3>
        <p className="mt-2 whitespace-pre-wrap break-words">{state.ending.directionsTaken}</p>
        <p className="mt-2 text-sm text-slate-700">Ended on <time dateTime={state.ending.endedAt}>{new Date(state.ending.endedAt).toLocaleString("en-US")}</time></p>
      </div> : <p className="mt-4 text-slate-700">No saved ending summary is available.</p>}
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-labelledby="ended-conversation-messages" className="min-w-0 rounded-2xl border border-slate-300 bg-white p-5">
        <h3 id="ended-conversation-messages" className="text-xl font-semibold">Saved conversation</h3>
        {state.messages.length === 0 ? <p className="mt-4 text-slate-700">There are no saved messages in this conversation.</p> : <ol aria-label="Saved ended conversation" className="mt-4 space-y-4">
          {state.messages.map(message => <li key={message.id} className="rounded-xl bg-slate-100 p-4">
            <p className="font-semibold">{message.role === "explorer" ? "You" : SOLMIND_TERMS.virtualGuide}</p>
            <p className="mt-2 whitespace-pre-wrap break-words">{message.body}</p>
            <time dateTime={message.createdAt} className="mt-2 block text-xs text-slate-600">{new Date(message.createdAt).toLocaleString("en-US")}</time>
          </li>)}
        </ol>}
      </section>
      <ExplorerConversationFormation state={state} busy={false} readOnly onCommand={() => undefined} />
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

  return <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
    <a className="font-medium text-teal-800 underline focus-visible:outline-2 focus-visible:outline-offset-4" href="/explorer/home">Explorer home</a>
    <header className="my-6 space-y-2">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold focus:outline-none">Your ended conversations</h1>
      <p>Review saved messages, directions, Compass and Waypoints from your ended conversations. Nothing is shared or changed here.</p>
    </header>
    <p role="status" aria-live="polite" className="min-h-6">{busy ? "Loading your saved ended conversations..." : ""}</p>
    {error !== null ? <div role="alert" className="my-4 rounded-xl border border-amber-500 bg-amber-50 p-4">
      <p>{error === "denied" ? "These conversations are not available in your current session. Sign in again to review them." : "The ended conversations could not be loaded. Please try again."}</p>
      {error === "denied" ? <a className="mt-2 inline-block font-semibold text-teal-900 underline" href="/login/explorer">Sign in</a> : null}
    </div> : null}
    <button type="button" className={buttonClass} disabled={busy} onClick={() => { void load(); }}>Reload ended conversations</button>
    {items !== null ? <section aria-label="Ended conversation list" className="mt-5 rounded-2xl border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold">Choose a conversation to review</h2>
      {items.length === 0 ? <p className="mt-3 text-slate-700">No ended conversations are available in your current session.</p> : <ol className="mt-4 space-y-3">
        {items.map((item, index) => <li key={item.conversationId} className="rounded-xl border border-slate-300 p-4">
          <p className="text-sm text-slate-700">{item.endedAt === null ? "Saved ending time is unavailable." : <>Ended on <time dateTime={item.endedAt}>{new Date(item.endedAt).toLocaleString("en-US")}</time></>}</p>
          <button type="button" className={`${buttonClass} mt-2`} disabled={busy} onClick={() => { void load(item.conversationId); }}>Review ended conversation {index + 1}</button>
        </li>)}
      </ol>}
    </section> : null}
    {selected !== null ? <ExplorerEndedConversationReadback state={selected} /> : null}
  </main>;
}
