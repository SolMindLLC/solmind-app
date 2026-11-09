"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { EXPLORER_CONVERSATION_LIMITS, type ExplorerConversationWaypoint } from "@/lib/solmind/explorerConversationContract";
import { CONNECTED_WAYPOINT_WORDING, WAYPOINT_STAGE_NAMES, earlierVersionLabel, waypointStage, type CardWaypointStage } from "@/lib/solmind/explorerConnectedCard";
import { useExplorerEarlyTestNoticeRecheck } from "@/lib/solmind/explorerEarlyTestNoticeRecheck";
import { YOUR_WAYPOINTS_WORDING } from "@/lib/solmind/explorerYourWaypoints";
import {
  parseExplorerYourWaypointsCloseResult,
  parseExplorerYourWaypointsHistoryResult,
  parseExplorerYourWaypointsListResult,
  type ExplorerYourWaypointItem,
  type ExplorerYourWaypointsCloseCommand,
} from "@/lib/solmind/explorerYourWaypointsContract";
import { formatSuggestedWaypointDate } from "@/lib/solmind/suggestedWaypointDisplayDate";
import { IconArchive, IconCheck, IconFlag, IconHistory } from "./ExplorerConversationScreenIcons";
import { FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// The private "Your Waypoints" section of the Waypoints page (execution/07 item 43; Paul's decisions, decision queue
// 2026-11-06 09:03:09 CST items 1 and 3). It lists the Explorer's current Waypoints from every conversation, one row
// open at a time, with earlier versions on request. A Waypoint from an ended conversation can be marked Reached or
// released here, after a review; one from the open conversation is changed in that conversation. Identifiers are
// selections only: the server derives the Explorer and SQL rechecks ownership and the ended conversation. Nothing is
// kept in browser storage or the address. An uncertain save keeps the same operation and exact request, so pressing
// the button again is a safe replay, never a second save.

const W = YOUR_WAYPOINTS_WORDING;
const C = CONNECTED_WAYPOINT_WORDING;
const BASE = "/explorer/waypoints/your-waypoints";
const READ_TIMEOUT_MS = 30_000;
const COMMAND_TIMEOUT_MS = 70_000;
const CARD_CLASS = "rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5";
const INPUT_CLASS = joinClasses("mt-1 block w-full rounded-xl border border-amber-200/25 bg-[#0c0a08] px-3 py-2 text-sm text-stone-100", FOCUS_RING);
const STAGE_ICONS: Readonly<Record<CardWaypointStage, (props: Readonly<{ className?: string }>) => ReactNode>> = {
  formed: IconCheck, reached: IconFlag, released: IconArchive,
};

type View = "loading" | "ready" | "denied" | "failed";
type History = Readonly<{ status: "loading" | "failed" } | { status: "ready"; earlier: readonly ExplorerConversationWaypoint[]; complete: boolean }>;
type Review = Readonly<{ kind: "reach_waypoint" | "release_waypoint"; waypointId: string; operationId: string;
  evidence: string; confirmed: boolean; uncertain: boolean }>;

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", signal: controller.signal });
    return await response.json();
  } finally { window.clearTimeout(timer); }
}

// A symbol and the word, never colour alone.
function StageMarker({ stage }: Readonly<{ stage: CardWaypointStage }>) {
  const Icon = STAGE_ICONS[stage];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100">
      <Icon className="h-3.5 w-3.5" />
      {WAYPOINT_STAGE_NAMES[stage]}
    </span>
  );
}

function Term({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="border-l-2 border-amber-300/60 pl-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">{term}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-stone-100 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function title(waypoint: ExplorerConversationWaypoint): string {
  return waypoint.title ?? waypoint.destination;
}

export function ExplorerYourWaypoints() {
  const id = useId();
  const notifyRecheck = useExplorerEarlyTestNoticeRecheck();
  const [view, setView] = useState<View>("loading");
  const [items, setItems] = useState<readonly ExplorerYourWaypointItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // True while every shown page is being read again after a change; Show more waits for it, and so do starting and
  // submitting a review, so a read that began before a save can never put back what the save changed (correction
  // D-2, 2026-11-09).
  const [reloading, setReloading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [closedGroupOpen, setClosedGroupOpen] = useState(false);
  const [histories, setHistories] = useState<Readonly<Record<string, History>>>({});
  const [shownHistory, setShownHistory] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const historyButtons = useRef(new Map<string, HTMLButtonElement>());
  const reviewHeading = useRef<HTMLParagraphElement | null>(null);
  const submitButton = useRef<HTMLButtonElement | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
  // The row a reload should give focus back to if the update loses it (correction D-3, 2026-11-09).
  const reloadFocus = useRef<string | null>(null);
  const loadSequence = useRef(0);
  // The latest list for the asynchronous loaders, which run after renders.
  const itemsRef = useRef<readonly ExplorerYourWaypointItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // One page; null for a failed or unreadable read, "denied" for a refusal.
  const fetchPage = useCallback(async (offset: number) => {
    try {
      const result = parseExplorerYourWaypointsListResult(
        await fetchJson(offset === 0 ? `${BASE}/state` : `${BASE}/state?offset=${offset}`, { method: "GET" }, READ_TIMEOUT_MS));
      if (result?.ok) return result;
      if (result?.error === "denied") { notifyRecheck(); return "denied" as const; }
    } catch { /* A failed read below. */ }
    return null;
  }, [notifyRecheck]);

  const loadFirst = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setView("loading");
    const result = await fetchPage(0);
    if (sequence !== loadSequence.current) return;
    if (result === null || result === "denied") { setView(result === "denied" ? "denied" : "failed"); return; }
    setItems(result.items);
    setNextOffset(result.hasMore ? result.nextOffset : null);
    setView("ready");
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore || reloading || saving || nextOffset === null) return;
    const sequence = ++loadSequence.current;
    setLoadingMore(true);
    const result = await fetchPage(nextOffset);
    // A reload that took over has already cleared loadingMore; this page is then not applied.
    if (sequence !== loadSequence.current) return;
    setLoadingMore(false);
    if (result === null || result === "denied") { setNotice(W.loadMoreFailed); return; }
    const known = new Set(itemsRef.current.map(item => item.id));
    const added = result.items.filter(item => !known.has(item.id));
    pendingFocus.current = added.length > 0 ? added[0].id : "heading";
    setItems([...itemsRef.current, ...added]);
    setNextOffset(result.hasMore ? result.nextOffset : null);
  };

  // A closure moves a Waypoint from the active rows to the closed rows, which shifts every later offset, so after any
  // change every page already shown is read again from the start (offsets stay multiples of 20).
  // keep: the Waypoint just saved stays in view even when its new position is on a page not yet shown.
  // A failed reload keeps the list and adds its sentence after the outcome sentence already shown.
  const reloadShown = async (focusId: string | null, keep?: ExplorerYourWaypointItem) => {
    const sequence = ++loadSequence.current;
    setLoadingMore(false);
    setReloading(true);
    try {
      const wanted = Math.max(itemsRef.current.length, 1);
      const all: ExplorerYourWaypointItem[] = [];
      let offset: number | null = 0;
      let more = false;
      while (offset !== null && all.length < wanted) {
        const result = await fetchPage(offset);
        if (sequence !== loadSequence.current) return;
        if (result === null || result === "denied") {
          setNotice(current => (current ? `${current} ${W.reloadFailed}` : W.reloadFailed));
          return;
        }
        for (const item of result.items) if (!all.some(known => known.id === item.id)) all.push(item);
        more = result.hasMore;
        offset = result.hasMore ? result.nextOffset : null;
      }
      if (keep !== undefined && !all.some(item => item.id === keep.id)) all.push(keep);
      // The row is recorded before the update; whether focus was lost is judged after it, because the update itself
      // can remove or move the focused row (the effect below).
      reloadFocus.current = focusId;
      setItems(all);
      setNextOffset(more ? offset : null);
    } finally {
      if (sequence === loadSequence.current) setReloading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFirst(), 0);
    return () => window.clearTimeout(timer);
  }, [loadFirst]);

  // After a reload has updated the list: restore focus only if the update lost it, so focus never jumps away from where
  // the Explorer moved it. Declared before the effect below, which then places it (correction D-3).
  useEffect(() => {
    const wanted = reloadFocus.current;
    if (wanted === null) return;
    reloadFocus.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body) pendingFocus.current = wanted;
  }, [items]);

  // Focus goes to a control that is rendered: a row in the collapsed group opens the group first; a row that is gone
  // falls back to the section heading.
  useEffect(() => {
    const wanted = pendingFocus.current;
    if (wanted === null) return;
    if (wanted === "heading") { pendingFocus.current = null; sectionHeading.current?.focus(); return; }
    const target = rowButtons.current.get(wanted);
    if (target) { pendingFocus.current = null; target.focus(); return; }
    const item = items.find(entry => entry.id === wanted);
    if (item !== undefined && waypointStage(item) !== "formed" && !closedGroupOpen) { setClosedGroupOpen(true); return; }
    pendingFocus.current = null;
    sectionHeading.current?.focus();
  }, [items, closedGroupOpen, review, openId]);

  useEffect(() => {
    if (review !== null && !review.uncertain) reviewHeading.current?.focus();
  }, [review?.kind, review?.waypointId]); // eslint-disable-line react-hooks/exhaustive-deps

  // After an uncertain answer, focus returns to the button the notice asks the Explorer to press again.
  useEffect(() => {
    if (review?.uncertain === true && !saving) submitButton.current?.focus();
  }, [review?.uncertain, saving]);

  const fetchHistory = useCallback(async (item: ExplorerYourWaypointItem) => {
    setHistories(current => ({ ...current, [item.id]: { status: "loading" } }));
    try {
      const query = new URLSearchParams({ conversationId: item.conversationId, waypointId: item.id });
      const result = parseExplorerYourWaypointsHistoryResult(await fetchJson(`${BASE}/history?${query}`, { method: "GET" }, READ_TIMEOUT_MS));
      if (result?.ok) {
        setHistories(current => ({ ...current, [item.id]: { status: "ready", earlier: result.versions.slice(1), complete: result.complete } }));
        return;
      }
      if (result?.error === "denied") notifyRecheck();
    } catch { /* The failed state below offers another try. */ }
    setHistories(current => ({ ...current, [item.id]: { status: "failed" } }));
  }, [notifyRecheck]);

  const toggleHistory = (item: ExplorerYourWaypointItem) => {
    if (shownHistory === item.id) { setShownHistory(null); return; }
    setShownHistory(item.id);
    if (histories[item.id]?.status !== "ready") void fetchHistory(item);
  };

  const retryHistory = (item: ExplorerYourWaypointItem) => {
    // The retry button goes away while loading; keep focus on the panel's own toggle.
    historyButtons.current.get(item.id)?.focus();
    void fetchHistory(item);
  };

  const startReview = (kind: Review["kind"], waypointId: string) => {
    if (saving || reloading || review?.uncertain === true) return;
    setNotice("");
    setReview({ kind, waypointId, operationId: crypto.randomUUID(), evidence: "", confirmed: false, uncertain: false });
  };

  const closeReview = () => {
    if (saving || review === null) return;
    const wasUncertain = review.uncertain;
    const waypointId = review.waypointId;
    setReview(null);
    pendingFocus.current = waypointId;
    // After an uncertain save, show what the server holds now.
    if (wasUncertain) { setNotice(W.uncertainClosed); void reloadShown(waypointId); }
  };

  const submit = async () => {
    if (review === null || saving || reloading || !review.confirmed) return;
    const evidence = review.evidence.trim();
    if (review.kind === "reach_waypoint" && evidence.length === 0) return;
    const command: ExplorerYourWaypointsCloseCommand = review.kind === "reach_waypoint"
      ? { kind: "reach_waypoint", operationId: review.operationId, waypointId: review.waypointId, reachedEvidence: evidence }
      : { kind: "release_waypoint", operationId: review.operationId, waypointId: review.waypointId };
    const wasUncertain = review.uncertain;
    setSaving(true);
    setNotice(W.saving);
    let result: ReturnType<typeof parseExplorerYourWaypointsCloseResult> = null;
    try {
      result = parseExplorerYourWaypointsCloseResult(await fetchJson(`${BASE}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
      }, COMMAND_TIMEOUT_MS));
    } catch { result = null; }
    setSaving(false);
    if (result?.ok) {
      const saved = result.item;
      setItems(current => current.map(item => (item.id === saved.id ? saved : item)));
      setReview(null);
      setOpenId(saved.id);
      if (waypointStage(saved) !== "formed") setClosedGroupOpen(true);
      pendingFocus.current = saved.id;
      setNotice(review.kind === "reach_waypoint" ? W.savedReached : W.savedReleased);
      if (nextOffset !== null) void reloadShown(saved.id, saved);
      return;
    }
    if (result?.error === "conflict" || result?.error === "denied") {
      if (result.error === "denied") notifyRecheck();
      setReview(null);
      // After an uncertain attempt, a later refusal cannot tell whether the first attempt saved it.
      const message = wasUncertain ? W.uncertainResolved : result.error === "conflict" ? W.conflict : W.denied;
      setNotice(message);
      // The removed review held focus; the row keeps it while the list is read again.
      pendingFocus.current = review.waypointId;
      void reloadShown(review.waypointId);
      return;
    }
    // No answer, an unreadable answer or "unavailable": the save may or may not have happened. Keep the exact request.
    setReview({ ...review, evidence: review.kind === "reach_waypoint" ? evidence : review.evidence, uncertain: true });
    setNotice(W.uncertain);
  };

  const active = items.filter(item => waypointStage(item) === "formed");
  const closed = items.filter(item => waypointStage(item) !== "formed");
  const complete = nextOffset === null;

  const renderItem = (item: ExplorerYourWaypointItem) => {
    const stage = waypointStage(item);
    const open = openId === item.id;
    const panelId = `${id}-waypoint-${item.id}`;
    const history = histories[item.id];
    const reviewing = review !== null && review.waypointId === item.id ? review : null;
    return (
      <li key={item.id} className={joinClasses("rounded-2xl border border-amber-200/15 bg-[#0c0a08]/90", open && "border-amber-300/50")}>
        <button
          type="button"
          ref={node => { if (node === null) rowButtons.current.delete(item.id); else rowButtons.current.set(item.id, node); }}
          className={joinClasses("flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left", FOCUS_RING)}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            if (saving) return;
            setOpenId(open ? null : item.id);
            if (open && review?.waypointId === item.id && !review.uncertain) setReview(null);
          }}
        >
          <span className="min-w-0">
            <span className={joinClasses("block font-serif text-lg leading-6 text-stone-50 [overflow-wrap:anywhere]", !open && "line-clamp-2")}>{title(item)}</span>
            <span className="mt-1 block text-xs text-stone-400">{item.conversationEnded ? W.fromEnded : W.fromOpen}</span>
          </span>
          <StageMarker stage={stage} />
        </button>
        {open ? (
          <div id={panelId} className="grid gap-3 px-4 pb-4">
            <dl className="grid gap-2">
              {item.title === undefined || item.title === item.destination ? null : <Term term={C.destinationTerm}>{item.destination}</Term>}
              <Term term={C.meaningTerm}>{item.meaning}</Term>
              <Term term={C.arrivalTerm}>{item.arrivalSignal}</Term>
              {item.status === "reached" && item.reachedEvidence != null ? <Term term={W.evidenceTerm}>{item.reachedEvidence}</Term> : null}
            </dl>
            <p className="text-xs text-stone-400">
              {W.savedOn(formatSuggestedWaypointDate(item.createdAt))}
              {item.status === "reached" && item.reachedAt != null ? ` · ${W.reachedOn(formatSuggestedWaypointDate(item.reachedAt))}` : null}
              {item.release !== undefined ? ` · ${W.releasedOn(formatSuggestedWaypointDate(item.release.releasedAt))}` : null}
            </p>
            {item.lifecycle !== undefined ? (
              <div>
                <button type="button" className={joinClasses(SECONDARY_BUTTON, "text-xs")} aria-expanded={shownHistory === item.id}
                  ref={node => { if (node === null) historyButtons.current.delete(item.id); else historyButtons.current.set(item.id, node); }}
                  aria-controls={`${panelId}-history`} onClick={() => toggleHistory(item)}>
                  <IconHistory className="h-3.5 w-3.5" />
                  {shownHistory === item.id ? W.earlierHide : W.earlierShow}
                </button>
                {shownHistory === item.id ? (
                  <div id={`${panelId}-history`} className="mt-2 border-t border-stone-800 pt-2" aria-live="polite">
                    {history === undefined || history.status === "loading" ? <p className="text-sm text-stone-300">{W.earlierLoading}</p> : null}
                    {history?.status === "failed" ? (
                      <p className="text-sm text-stone-300">
                        {W.earlierFailed}{" "}
                        <button type="button" className={joinClasses("underline", FOCUS_RING)} onClick={() => retryHistory(item)}>{W.retryEarlier}</button>
                      </p>
                    ) : null}
                    {history?.status === "ready" ? (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{C.earlierHeading}</p>
                        <ul className="mt-1 grid gap-2">
                          {history.earlier.map(version => (
                            <li key={version.id} className="grid gap-0.5 px-1 py-1 text-sm text-stone-400">
                              <p className="text-xs font-semibold text-stone-300">{earlierVersionLabel(waypointStage(version))}</p>
                              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{title(version)}</p>
                              {version.title === undefined || version.title === version.destination ? null
                                : <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{version.destination}</p>}
                              <p className="whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]">{C.meaningTerm}: {version.meaning}</p>
                              <p className="whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]">{C.arrivalTerm}: {version.arrivalSignal}</p>
                            </li>
                          ))}
                        </ul>
                        {history.complete ? null : <p className="mt-1 text-xs text-stone-400">{W.earlierIncomplete}</p>}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {stage === "formed" && !item.conversationEnded ? (
              <p className="text-sm leading-6 text-stone-300">
                {W.openHint}{" "}
                <a href="/explorer/conversation" className={joinClasses("font-semibold text-amber-200 underline hover:text-amber-100", FOCUS_RING)}>{W.openLink}</a>
              </p>
            ) : null}
            {stage === "formed" && item.conversationEnded && reviewing === null ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={SECONDARY_BUTTON} disabled={saving || reloading || review?.uncertain === true}
                    aria-describedby={reloading ? `${panelId}-refreshing` : undefined}
                    onClick={() => startReview("reach_waypoint", item.id)}>{W.reachButton}</button>
                  <button type="button" className={SECONDARY_BUTTON} disabled={saving || reloading || review?.uncertain === true}
                    aria-describedby={reloading ? `${panelId}-refreshing` : undefined}
                    onClick={() => startReview("release_waypoint", item.id)}>{W.releaseButton}</button>
                </div>
                {/* Why the two buttons wait, in place, while the shown pages are read again (correction D-2). */}
                {reloading ? <p id={`${panelId}-refreshing`} className="text-sm leading-6 text-stone-300">{W.reloadingActions}</p> : null}
              </>
            ) : null}
            {reviewing !== null ? (
              <div role="group" aria-labelledby={`${panelId}-review`}
                className={joinClasses("grid gap-3 rounded-2xl border p-4", reviewing.kind === "reach_waypoint" ? "border-cyan-300/50" : "border-amber-300/50")}>
                <p id={`${panelId}-review`} ref={reviewHeading} tabIndex={-1} className={joinClasses("font-semibold text-stone-100", FOCUS_RING)}>
                  {reviewing.kind === "reach_waypoint" ? W.reachedLegend : W.releaseLegend}
                </p>
                {reviewing.kind === "reach_waypoint" ? <p className="text-sm leading-6 text-stone-300">{W.reachedReason}</p> : null}
                {reviewing.kind === "reach_waypoint" ? (
                  <label htmlFor={`${panelId}-evidence`} className="block text-sm text-stone-200">{W.reachedEvidenceLabel}
                    <textarea id={`${panelId}-evidence`} className={INPUT_CLASS} rows={3} required
                      maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} value={reviewing.evidence}
                      readOnly={reviewing.uncertain || saving}
                      onChange={event => setReview({ ...reviewing, evidence: event.target.value, confirmed: false })} />
                  </label>
                ) : (
                  <>
                    <p className="text-sm leading-6 text-stone-300">{W.releaseExplanation}</p>
                    <p className="text-sm leading-6 text-stone-300">{W.releaseReason}</p>
                  </>
                )}
                <label className="flex items-start gap-3 text-sm text-stone-200">
                  <input type="checkbox" className="mt-1" checked={reviewing.confirmed} disabled={reviewing.uncertain || saving}
                    onChange={event => setReview({ ...reviewing, confirmed: event.target.checked })} />
                  {reviewing.kind === "reach_waypoint" ? W.reachedConfirm : W.releaseConfirm}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" ref={submitButton}
                    className={joinClasses(PRIMARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-70")}
                    disabled={!reviewing.confirmed || (reviewing.kind === "reach_waypoint" && reviewing.evidence.trim().length === 0)}
                    aria-disabled={saving || reloading || undefined} onClick={() => void submit()}>
                    {reviewing.kind === "reach_waypoint" ? W.reachedSubmit : W.releaseSubmit}
                  </button>
                  <button type="button" className={SECONDARY_BUTTON} disabled={saving} onClick={closeReview}>
                    {reviewing.uncertain ? W.closeUncertain : W.keep}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-labelledby={`${id}-heading`} aria-busy={view === "loading" || loadingMore || reloading || saving} className="mb-12">
      <h2 id={`${id}-heading`} ref={sectionHeading} tabIndex={-1}
        className={joinClasses("font-serif text-2xl leading-tight text-stone-50 sm:text-3xl", FOCUS_RING)}>{W.heading}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300">{W.intro}</p>
      {/* A polite live region without the status role: the Suggestions section below keeps the page's one status region. */}
      <p className="mt-4 text-sm text-stone-300" aria-live="polite" aria-atomic="true" data-your-waypoints-notice="">{notice}</p>
      {view === "loading" ? <div className={joinClasses("mt-5 text-stone-200", CARD_CLASS)}>{W.loading}</div> : null}
      {view === "denied" ? (
        <div className="mt-5 rounded-2xl border border-amber-400/70 bg-amber-950/60 p-5 text-amber-50">
          <h3 className="font-serif text-xl">{W.unavailableHeading}</h3>
          <p className="mt-2 text-sm leading-6">{W.unavailable}</p>
        </div>
      ) : null}
      {view === "failed" ? (
        <div className="mt-5 rounded-2xl border border-rose-400/60 bg-rose-950/50 p-5 text-rose-50">
          <h3 className="font-serif text-xl">{W.failedHeading}</h3>
          <p className="mt-2 text-sm leading-6">{W.failed}</p>
          <button type="button" className={joinClasses("mt-4", SECONDARY_BUTTON)} onClick={() => void loadFirst()}>{W.retryList}</button>
        </div>
      ) : null}
      {view === "ready" ? (
        items.length === 0 ? (
          <div className={joinClasses("mt-5", CARD_CLASS)}><p className="text-sm text-stone-300">{W.empty}</p></div>
        ) : (
          <div className="mt-5 grid gap-5">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                {complete ? W.activeGroup(active.length) : W.activeGroupPartial}
              </h3>
              {active.length === 0 ? <p className="mt-2 text-sm text-stone-400">{W.activeEmpty}</p>
                : <ul className="mt-2 grid gap-2" aria-label={W.activeListLabel}>{active.map(renderItem)}</ul>}
            </div>
            {closed.length > 0 ? (
              <div>
                <button type="button" className={joinClasses(SECONDARY_BUTTON, "text-xs")} aria-expanded={closedGroupOpen}
                  aria-controls={`${id}-closed`} onClick={() => setClosedGroupOpen(value => !value)}>
                  {complete ? W.closedGroup(closed.length) : W.closedGroupPartial}
                </button>
                {closedGroupOpen ? <ul id={`${id}-closed`} className="mt-2 grid gap-2" aria-label={W.closedListLabel}>{closed.map(renderItem)}</ul> : null}
              </div>
            ) : null}
            {nextOffset !== null ? (
              <div>
                <button type="button" className={joinClasses(SECONDARY_BUTTON, "aria-disabled:cursor-wait aria-disabled:opacity-70")}
                  aria-disabled={loadingMore || reloading || saving || undefined} onClick={() => void loadMore()}>{W.loadMore}</button>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  );
}
