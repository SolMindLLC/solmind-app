"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED,
  parseSuggestedWaypointGuideDetailBrowserResult,
  type SuggestedWaypointGuideDetail as Detail,
} from "@/lib/solmind/suggestedWaypointGuideDetailBrowserContract";
import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  type SuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import {
  beginSuggestedWaypointCommandOperation,
  createIdleSuggestedWaypointCommandOperation,
  markSuggestedWaypointCommandTransportUncertain,
  replaceSuggestedWaypointCommandOperation,
  resolveSuggestedWaypointCommandOperation,
  retrySuggestedWaypointCommandOperation,
  settleSuggestedWaypointCommandByAuthoritativeRead,
  type SuggestedWaypointCommandOperationState,
} from "@/lib/solmind/suggestedWaypointCommandOperation";
import {
  SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES,
  snapshotSuggestedWaypointGuideDraftContent,
} from "@/lib/solmind/suggestedWaypointGuideDraftContentBrowserContract";
import { formatSuggestedWaypointDateTime } from "@/lib/solmind/suggestedWaypointDisplayDate";
import {
  SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES,
  SUGGESTED_WAYPOINT_GUIDE_SAVE_DRAFT_OUTCOMES,
  SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_SEND_OUTCOMES,
  createSuggestedWaypointGuidePullBackCommand,
  createSuggestedWaypointGuideSaveDraftCommand,
  createSuggestedWaypointGuideScheduleSendCommand,
  submitSuggestedWaypointGuideCommand,
  type SuggestedWaypointGuideCommand,
  type SuggestedWaypointGuideSaveDraftCommand,
} from "@/lib/solmind/suggestedWaypointGuideCommandClient";
import {
  getSuggestedWaypointPullBackCountdown,
  type SuggestedWaypointPullBackCountdown,
} from "@/lib/solmind/suggestedWaypointPullBackCountdown";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type ViewState = "loading" | "ready" | "denied" | "failed";
type LoadOutcome = ViewState | "aborted";
type DraftView = "display" | "edit" | "send_review";
type CommandAction = "pull_back" | "save" | "schedule";
type EditableDraft = Readonly<{
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
}>;
type ActiveCommand = Readonly<{
  action: CommandAction;
  command: SuggestedWaypointGuideCommand;
  closeAfterSave: boolean;
}>;

const actionLabel = (action: CommandAction) =>
  action === "pull_back" ? "Pull Back" : action === "save" ? "Save" : "Schedule send";

function commandResultNotice(
  action: CommandAction,
  result: SuggestedWaypointCommandBrowserResult,
): string {
  const label = actionLabel(action);
  if (result.ok) return `${label} was accepted. Refreshing the authoritative suggestion detail.`;
  if (result.error === SUGGESTED_WAYPOINT_COMMAND_DENIED) return `${label} is unavailable in the current Guide workspace.`;
  if (result.error === SUGGESTED_WAYPOINT_COMMAND_FAILED) return `${label} could not be completed. Checking the current suggestion detail.`;
  switch (result.outcome) {
    case "too_late": return "The Pull Back period ended before the command reached the server.";
    case "stale": return `The suggestion changed before ${label} completed. Review the refreshed detail.`;
    case "invalid_transition": return `${label} no longer applies to the current suggestion state.`;
    case "relationship_unavailable": return `${label} is unavailable in the current Guide workspace.`;
    case "operation_conflict": return `A different request already used this ${label} operation. Review the refreshed detail.`;
    case "policy_unavailable": return "Schedule send could not use the current send policy.";
  }
  return `${label} could not be confirmed. Review the authoritative detail.`;
}

function StatusPills({ detail }: { detail: Detail }) {
  if (detail.authoring_mode === "draft") {
    return <><SuggestedWaypointStatusPill tone="private">✎ Draft</SuggestedWaypointStatusPill><SuggestedWaypointStatusPill tone="private">🔒 Guide-only</SuggestedWaypointStatusPill></>;
  }
  if (detail.authoring_mode === "pending") {
    return <><SuggestedWaypointStatusPill tone="attention">⌛ Pending send</SuggestedWaypointStatusPill><SuggestedWaypointStatusPill tone={detail.pull_back_available ? "attention" : "neutral"}>{detail.pull_back_available ? "↩ Pull Back available" : "○ Pull Back period ended"}</SuggestedWaypointStatusPill></>;
  }
  return <><SuggestedWaypointStatusPill tone="positive">✉ Open suggestion</SuggestedWaypointStatusPill>{detail.acknowledged_at === null ? <SuggestedWaypointStatusPill tone="neutral">○ No response</SuggestedWaypointStatusPill> : <SuggestedWaypointStatusPill tone="positive">☑ Receipt acknowledged {formatSuggestedWaypointDateTime(detail.acknowledged_at)}</SuggestedWaypointStatusPill>}</>;
}

function ContentCard({ title, destination, why, arrivalSignals, tone }: Readonly<{
  title: string;
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
  tone: "private" | "delivered";
}>) {
  return (
    <section className={`rounded-2xl border p-6 ${tone === "private" ? "border-violet-700/70 bg-violet-950/25" : "border-cyan-700/70 bg-cyan-950/25"}`} aria-labelledby={`${tone}-content-title`}>
      <h2 id={`${tone}-content-title`} className="text-xl font-semibold">{title}</h2>
      <dl className="mt-5 grid gap-5">
        <div><dt className="text-sm font-semibold text-slate-400">Possible Waypoint destination</dt><dd className="mt-1 text-lg text-slate-100">{destination}</dd></div>
        <div><dt className="text-sm font-semibold text-slate-400">Why this may help</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{why}</dd></div>
        <div><dt className="text-sm font-semibold text-slate-400">Possible arrival signals</dt><dd className="mt-2"><ul className="list-disc space-y-1 pl-5 text-slate-200">{arrivalSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul></dd></div>
      </dl>
    </section>
  );
}

function draftFromDetail(detail: Detail): EditableDraft | null {
  return detail.authoring_mode === "draft" && detail.draft_or_pending_destination !== null && detail.draft_or_pending_why !== null && detail.draft_or_pending_arrival_signals !== null
    ? Object.freeze({ destination: detail.draft_or_pending_destination, why: detail.draft_or_pending_why, arrivalSignals: Object.freeze([...detail.draft_or_pending_arrival_signals]) })
    : null;
}

function sameDraft(left: EditableDraft | null, right: EditableDraft | null): boolean {
  return left !== null && right !== null && left.destination === right.destination && left.why === right.why && left.arrivalSignals.length === right.arrivalSignals.length && left.arrivalSignals.every((signal, index) => signal === right.arrivalSignals[index]);
}

export function GuideSuggestedWaypointDetail({ relationshipId, suggestedWaypointId }: Readonly<{ relationshipId: string; suggestedWaypointId: string }>) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [notice, setNotice] = useState("Loading suggestion detail.");
  const [actionNotice, setActionNotice] = useState("");
  const [countdown, setCountdown] = useState<SuggestedWaypointPullBackCountdown | null>(null);
  const [draftView, setDraftView] = useState<DraftView>("display");
  const [draftInput, setDraftInput] = useState<EditableDraft | null>(null);
  const [baseline, setBaseline] = useState<EditableDraft | null>(null);
  const [activeAction, setActiveAction] = useState<CommandAction | null>(null);
  const [operation, setOperation] = useState<SuggestedWaypointCommandOperationState>(createIdleSuggestedWaypointCommandOperation);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const commandController = useRef<AbortController | null>(null);
  const activeCommandRef = useRef<ActiveCommand | null>(null);
  const operationRef = useRef(operation);
  const lastLoadOutcomeRef = useRef<LoadOutcome>("loading");
  const mountedRef = useRef(true);
  const initiatingButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionStatusRef = useRef<HTMLParagraphElement | null>(null);

  const contentResult = useMemo(() => snapshotSuggestedWaypointGuideDraftContent(draftInput), [draftInput]);
  const dirty = !sameDraft(draftInput, baseline);
  const updateOperation = useCallback((next: SuggestedWaypointCommandOperationState) => { operationRef.current = next; setOperation(next); }, []);
  const focusActionStatus = useCallback(() => { window.requestAnimationFrame(() => { if (mountedRef.current) actionStatusRef.current?.focus(); }); }, []);

  const load = useCallback(async (): Promise<Detail | null> => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++requestSequence.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    setViewState("loading");
    lastLoadOutcomeRef.current = "loading";
    setNotice("Loading suggestion detail.");
    try {
      const response = await fetch(`/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}/${encodeURIComponent(suggestedWaypointId)}/detail`, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error("Unexpected Suggested Waypoint detail response status.");
      const result = parseSuggestedWaypointGuideDetailBrowserResult(await response.json());
      if (controller.signal.aborted || sequence !== requestSequence.current) { if (sequence === requestSequence.current) lastLoadOutcomeRef.current = "aborted"; return null; }
      if (result === null) { lastLoadOutcomeRef.current = "failed"; setDetail(null); setViewState("failed"); setNotice("Suggestion detail could not be loaded."); return null; }
      if (!result.ok) {
        const denied = result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED;
        lastLoadOutcomeRef.current = denied ? "denied" : "failed";
        setDetail(null); setViewState(denied ? "denied" : "failed"); setNotice(denied ? "Suggestion detail is unavailable." : "Suggestion detail could not be loaded."); return null;
      }
      const nextDraft = draftFromDetail(result.data);
      lastLoadOutcomeRef.current = "ready";
      setDetail(result.data); setViewState("ready"); setNotice("Suggestion detail loaded."); setBaseline(nextDraft); setDraftInput(nextDraft); setDraftView("display");
      return result.data;
    } catch {
      if (sequence !== requestSequence.current || (controller.signal.aborted && !timedOut)) { if (sequence === requestSequence.current) lastLoadOutcomeRef.current = "aborted"; return null; }
      lastLoadOutcomeRef.current = "failed"; setDetail(null); setViewState("failed"); setNotice("Suggestion detail could not be loaded."); return null;
    } finally { window.clearTimeout(timeout); }
  }, [relationshipId, suggestedWaypointId]);

  useEffect(() => { mountedRef.current = true; const timer = window.setTimeout(() => void load(), 0); return () => { mountedRef.current = false; window.clearTimeout(timer); activeController.current?.abort(); commandController.current?.abort(); }; }, [load]);
  useEffect(() => {
    if (detail?.authoring_mode !== "pending" || detail.pending_deadline_at === null) { const timer = window.setTimeout(() => setCountdown(null), 0); return () => window.clearTimeout(timer); }
    const update = () => setCountdown(getSuggestedWaypointPullBackCountdown(detail.pending_deadline_at as string, Date.now()));
    const initialTimer = window.setTimeout(update, 0); const intervalTimer = window.setInterval(update, 1_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(intervalTimer); };
  }, [detail]);
  useEffect(() => { if (operation.focusIntent === "initiator") { if (initiatingButtonRef.current?.disabled === false) initiatingButtonRef.current.focus(); else actionStatusRef.current?.focus(); } else if (operation.focusIntent === "updated_status") actionStatusRef.current?.focus(); }, [operation]);

  const permittedOutcomes = (action: CommandAction): readonly SuggestedWaypointCommandExpectedOutcome[] => action === "pull_back" ? SUGGESTED_WAYPOINT_GUIDE_PULL_BACK_OUTCOMES : action === "save" ? SUGGESTED_WAYPOINT_GUIDE_SAVE_DRAFT_OUTCOMES : SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_SEND_OUTCOMES;

  const settleAfterConclusive = useCallback(async (active: ActiveCommand, result: SuggestedWaypointCommandBrowserResult) => {
    const current = await load();
    if (!mountedRef.current || !result.ok) return;
    if (active.action === "pull_back") {
      setActionNotice(current?.authoring_mode === "draft" ? "Pull Back completed. The Guide-only draft is ready to review and edit." : current === null ? "Pull Back was accepted, but current detail could not be refreshed. Load the detail again; do not submit Pull Back again." : "Pull Back was accepted. Refresh the detail again if the current state has not appeared yet.");
    } else if (active.action === "save") {
      const saved = active.command as SuggestedWaypointGuideSaveDraftCommand;
      const authoritative = current === null ? null : draftFromDetail(current);
      if (current?.authoring_mode === "draft" && current.authoring_revision > saved.expectedRevision && sameDraft(authoritative, saved.content)) {
        setActionNotice("Draft changes saved and confirmed from the authoritative detail.");
        if (active.closeAfterSave) window.location.assign(`/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}`);
      } else if (current === null) setActionNotice("Save was accepted, but current detail could not be confirmed. Load the detail again; do not submit Save again.");
      else setActionNotice("Save was accepted, but the refreshed detail differs. Review the current Guide-only draft before another action.");
    } else {
      setActionNotice(current?.authoring_mode === "pending" || current?.authoring_mode === "delivered" ? "Schedule send completed. The authoritative suggestion status is updated." : current === null ? "Schedule send was accepted, but current status could not be confirmed. Load the detail again; do not submit Schedule send again." : "Schedule send was accepted, but the pending state is not visible yet. Refresh the authoritative detail again.");
    }
  }, [load, relationshipId]);

  const runCommand = useCallback(async (active: ActiveCommand, nextOperation: SuggestedWaypointCommandOperationState) => {
    commandController.current?.abort();
    const controller = new AbortController(); commandController.current = controller;
    const generation = nextOperation.generation;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const submission = await submitSuggestedWaypointGuideCommand(active.command, permittedOutcomes(active.action), controller.signal);
    window.clearTimeout(timeout);
    if (!mountedRef.current || operationRef.current.generation !== generation) return;
    if (submission.kind === "transport_uncertain") {
      const currentOperation = operationRef.current;
      const uncertain = markSuggestedWaypointCommandTransportUncertain(currentOperation, generation);
      if (uncertain === currentOperation) return;
      updateOperation(uncertain); setActionNotice(`SolMind could not confirm whether ${actionLabel(active.action)} completed. Check current status before retrying the exact same request.`); return;
    }
    const result = submission.result;
    const currentOperation = operationRef.current;
    const resolved = resolveSuggestedWaypointCommandOperation(currentOperation, generation, result.ok ? "success" : "expected_non_success");
    if (resolved === currentOperation) return;
    updateOperation(resolved); setActionNotice(commandResultNotice(active.action, result)); if (!result.ok) focusActionStatus();
    await settleAfterConclusive(active, result);
  }, [focusActionStatus, settleAfterConclusive, updateOperation]);

  const beginCommand = useCallback((active: ActiveCommand) => {
    const current = operationRef.current;
    const next = current.phase === "idle" ? beginSuggestedWaypointCommandOperation(current, active.command.snapshot, () => active.command.operationId) : replaceSuggestedWaypointCommandOperation(current, active.command.snapshot, () => active.command.operationId);
    if (next === current) { setActionNotice(`${actionLabel(active.action)} could not be started. Nothing was changed.`); return; }
    activeCommandRef.current = active; setActiveAction(active.action); updateOperation(next); setActionNotice(`Submitting ${actionLabel(active.action)}.`); void runCommand(active, next);
  }, [runCommand, updateOperation]);

  const startSave = useCallback((closeAfterSave: boolean) => {
    if (detail?.authoring_mode !== "draft" || !dirty || !contentResult.ok || operationRef.current.busy) return;
    const operationId = crypto.randomUUID();
    const command = createSuggestedWaypointGuideSaveDraftCommand({ ...contentResult.data, expectedRevision: detail.authoring_revision, operationId, relationshipId, suggestedWaypointId });
    if (command === null) { setActionNotice("Draft content could not be prepared. Nothing was changed."); return; }
    beginCommand(Object.freeze({ action: "save", command, closeAfterSave }));
  }, [beginCommand, contentResult, detail, dirty, relationshipId, suggestedWaypointId]);

  const startSchedule = useCallback(() => {
    if (detail?.authoring_mode !== "draft" || dirty || draftView !== "send_review" || operationRef.current.busy) return;
    const operationId = crypto.randomUUID();
    const command = createSuggestedWaypointGuideScheduleSendCommand({ expectedRevision: detail.authoring_revision, operationId, relationshipId, suggestedWaypointId });
    if (command === null) { setActionNotice("Schedule send could not be prepared. Nothing was changed."); return; }
    beginCommand(Object.freeze({ action: "schedule", command, closeAfterSave: false }));
  }, [beginCommand, detail, dirty, draftView, relationshipId, suggestedWaypointId]);

  const startPullBack = useCallback(() => {
    if (detail?.authoring_mode !== "pending" || detail.pending_version_id === null || !detail.pull_back_available || operationRef.current.busy || operationRef.current.phase === "transport_uncertain") return;
    const operationId = crypto.randomUUID();
    const command = createSuggestedWaypointGuidePullBackCommand({ expectedPendingVersionId: detail.pending_version_id, expectedRevision: detail.authoring_revision, operationId, relationshipId, suggestedWaypointId });
    if (command === null) { setActionNotice("Pull Back could not be prepared. Nothing was changed."); return; }
    beginCommand(Object.freeze({ action: "pull_back", command, closeAfterSave: false }));
  }, [beginCommand, detail, relationshipId, suggestedWaypointId]);

  const retryCommand = useCallback(() => {
    const active = activeCommandRef.current; if (active === null) return;
    const current = operationRef.current; const next = retrySuggestedWaypointCommandOperation(current); if (next === current) return;
    updateOperation(next); setActionNotice(`Retrying the exact same ${actionLabel(active.action)} request.`); focusActionStatus(); void runCommand(active, next);
  }, [focusActionStatus, runCommand, updateOperation]);

  const checkCommandStatus = useCallback(async () => {
    const active = activeCommandRef.current; const currentOperation = operationRef.current;
    if (active === null || currentOperation.phase !== "transport_uncertain") return;
    setActionNotice("Checking the authoritative suggestion detail.");
    const current = await load(); if (!mountedRef.current) return;
    let observed = false; let retryable = false;
    if (active.action === "pull_back") { observed = current?.authoring_mode === "draft"; retryable = current?.authoring_mode === "pending"; }
    else if (active.action === "save") {
      const saved = active.command as SuggestedWaypointGuideSaveDraftCommand; const authoritative = current === null ? null : draftFromDetail(current);
      observed = current?.authoring_mode === "draft" && current.authoring_revision > saved.expectedRevision && sameDraft(authoritative, saved.content);
      retryable = current?.authoring_mode === "draft" && current.authoring_revision === saved.expectedRevision && sameDraft(authoritative, baseline);
    } else { observed = current?.authoring_mode === "pending" || current?.authoring_mode === "delivered"; retryable = current?.authoring_mode === "draft" && current.authoring_revision === active.command.expectedRevision; }
    if (observed) { updateOperation(settleSuggestedWaypointCommandByAuthoritativeRead(operationRef.current, currentOperation.generation, true)); setActionNotice(`${actionLabel(active.action)} completed and is confirmed by the authoritative detail.`); }
    else if (retryable) setActionNotice(active.action === "pull_back"
      ? "The suggestion is still pending. You may retry the exact same Pull Back request."
      : `The requested state is not present. You may retry the exact same ${actionLabel(active.action)} request.`);
    else if (lastLoadOutcomeRef.current === "denied") {
      updateOperation(resolveSuggestedWaypointCommandOperation(operationRef.current, currentOperation.generation, "expected_non_success"));
      setActionNotice(active.action === "pull_back"
        ? "The current Guide workspace cannot confirm this suggestion. Do not retry Pull Back."
        : `The current Guide workspace cannot confirm this suggestion. Do not retry ${actionLabel(active.action)}.`);
    }
    else if (current === null) setActionNotice(`Current status could not be confirmed. Retry only the exact same ${actionLabel(active.action)} request.`);
    else { updateOperation(resolveSuggestedWaypointCommandOperation(operationRef.current, currentOperation.generation, "expected_non_success")); setActionNotice("The authoritative detail changed. Review it before starting another action."); }
  }, [baseline, load, updateOperation]);

  const updateSignal = (index: number, value: string) => { if (draftInput !== null) setDraftInput({ ...draftInput, arrivalSignals: draftInput.arrivalSignals.map((signal, signalIndex) => signalIndex === index ? value : signal) }); };

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-300" role="status" aria-live="polite">{notice}</p>
      {actionNotice !== "" && <p ref={actionStatusRef} className="mt-3 rounded-xl border border-cyan-800/70 bg-cyan-950/25 p-3 text-sm text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" role="status" aria-live="polite" tabIndex={-1}>{actionNotice}</p>}

      {operation.phase === "transport_uncertain" && activeAction !== null && (
        <section className="mt-4 rounded-2xl border border-cyan-700/70 bg-cyan-950/25 p-5" aria-labelledby="command-recovery-title">
          <h2 id="command-recovery-title" className="text-lg font-semibold">{actionLabel(activeAction)} status needs confirmation</h2>
          <p className="mt-2 text-sm text-cyan-100">Check the authoritative suggestion first. Retry only the exact same request if SolMind confirms the requested state is not present.</p>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-100 hover:bg-cyan-950" onClick={() => void checkCommandStatus()}>Check current status</button><button type="button" className="rounded-xl border border-slate-500 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-800" onClick={retryCommand}>Retry same request</button></div>
        </section>
      )}

      {viewState === "loading" && <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-6">Loading suggestion detail...</div>}
      {viewState === "denied" && <div className="mt-6 rounded-2xl border border-amber-700/70 bg-amber-950/30 p-6"><h2 className="text-xl font-semibold">Suggestion unavailable</h2><p className="mt-2 text-slate-300">This Guide workspace cannot open that suggestion through the active Explorer relationship. Return to the suggestion list.</p></div>}
      {viewState === "failed" && <div className="mt-6 rounded-2xl border border-rose-700/70 bg-rose-950/30 p-6"><h2 className="text-xl font-semibold">Could not load suggestion</h2><p className="mt-2 text-slate-300">Nothing was changed. Try loading the detail again.</p><button type="button" className="mt-4 rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-950" onClick={() => void load()}>Try again</button></div>}

      {viewState === "ready" && detail !== null && (
        <div className="grid gap-5">
          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm text-slate-400">Suggestion overview</p><h2 className="mt-2 text-2xl font-semibold">{detail.destination_preview}</h2><p className="mt-2 text-sm text-slate-400">Authoring revision {detail.authoring_revision}{detail.delivered_at === null ? "" : ` · Sent ${formatSuggestedWaypointDateTime(detail.delivered_at)}`}</p></div><div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end"><StatusPills detail={detail} /></div></div></section>

          {detail.authoring_mode === "draft" && draftInput !== null && draftView === "edit" ? (
            <section className="rounded-2xl border border-violet-700/70 bg-violet-950/25 p-6" aria-labelledby="edit-draft-title">
              <h2 id="edit-draft-title" className="text-xl font-semibold">Edit Guide-only draft</h2>
              <div className="mt-5 grid gap-5">
                <label className="grid gap-2 font-semibold">Possible Waypoint destination<input value={draftInput.destination} maxLength={320} aria-describedby="destination-help" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 font-normal" onChange={(event) => setDraftInput({ ...draftInput, destination: event.target.value })} /><span id="destination-help" className="text-sm font-normal text-slate-400">One line, 1–160 characters.</span>{!contentResult.ok && contentResult.issues.includes(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.destination) && <span className="text-sm font-normal text-rose-200">Use one normalized line between 1 and 160 characters.</span>}</label>
                <label className="grid gap-2 font-semibold">Why this may help<textarea value={draftInput.why} rows={6} maxLength={2000} aria-describedby="why-help" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 font-normal" onChange={(event) => setDraftInput({ ...draftInput, why: event.target.value })} /><span id="why-help" className="text-sm font-normal text-slate-400">1–1000 characters; ordinary line breaks are allowed.</span>{!contentResult.ok && contentResult.issues.includes(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.why) && <span className="text-sm font-normal text-rose-200">Use normalized text between 1 and 1000 characters.</span>}</label>
                <fieldset className="grid gap-3"><legend className="font-semibold">Possible arrival signals</legend>{draftInput.arrivalSignals.map((signal, index) => <div key={index} className="flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor={`arrival-signal-${index}`}>Arrival signal {index + 1}</label><input id={`arrival-signal-${index}`} value={signal} maxLength={480} className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" onChange={(event) => updateSignal(index, event.target.value)} />{draftInput.arrivalSignals.length > 1 && <button type="button" className="rounded-xl border border-slate-500 px-3 py-2" onClick={() => setDraftInput({ ...draftInput, arrivalSignals: draftInput.arrivalSignals.filter((_, signalIndex) => signalIndex !== index) })}>Remove signal {index + 1}</button>}</div>)}{draftInput.arrivalSignals.length < 8 && <button type="button" className="w-fit rounded-xl border border-slate-500 px-3 py-2" onClick={() => setDraftInput({ ...draftInput, arrivalSignals: [...draftInput.arrivalSignals, ""] })}>Add arrival signal</button>}{!contentResult.ok && contentResult.issues.includes(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.arrivalSignals) && <span className="text-sm text-rose-200">Use 1–8 unique signals, each between 1 and 240 characters.</span>}</fieldset>
              </div>
              <div className="mt-6 flex flex-wrap gap-3"><button ref={initiatingButtonRef} type="button" className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600 disabled:opacity-60" disabled={!dirty || !contentResult.ok || operation.busy} onClick={() => startSave(false)}>{operation.busy ? "Saving..." : "Save changes"}</button><button type="button" className="rounded-xl border border-cyan-500 px-4 py-2 font-semibold disabled:opacity-60" disabled={!dirty || !contentResult.ok || operation.busy} onClick={() => startSave(true)}>Save and close</button><button type="button" className="rounded-xl border border-slate-500 px-4 py-2 font-semibold disabled:opacity-60" disabled={operation.busy} onClick={() => { setDraftInput(baseline); setDraftView("display"); }}>Cancel editing</button></div>
            </section>
          ) : detail.draft_or_pending_destination !== null && detail.draft_or_pending_why !== null && detail.draft_or_pending_arrival_signals !== null ? (
            <>
              <ContentCard title={draftView === "send_review" ? "Review before sending" : detail.authoring_mode === "pending" ? "Pending version" : "Guide-only draft"} destination={detail.draft_or_pending_destination} why={detail.draft_or_pending_why} arrivalSignals={detail.draft_or_pending_arrival_signals} tone="private" />
              {detail.authoring_mode === "draft" && draftView === "display" && <div className="flex flex-wrap gap-3"><button ref={initiatingButtonRef} type="button" className="rounded-xl border border-cyan-400 px-4 py-2 font-semibold" disabled={operation.busy} onClick={() => setDraftView("edit")}>Edit draft</button><button type="button" className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600" disabled={operation.busy} onClick={() => setDraftView("send_review")}>Review before sending</button><a className="rounded-xl border border-slate-500 px-4 py-2 font-semibold" href={`/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}`}>Close</a></div>}
              {detail.authoring_mode === "draft" && draftView === "send_review" && <section className="rounded-2xl border border-amber-700/70 bg-amber-950/25 p-6" aria-labelledby="schedule-review-title"><h2 id="schedule-review-title" className="text-xl font-semibold">Ready to schedule?</h2><p className="mt-2 text-slate-200">Schedule send starts the configured pending-send grace period. The Explorer will not see the suggestion immediately.</p><div className="mt-5 flex flex-wrap gap-3"><button ref={initiatingButtonRef} type="button" className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600 disabled:opacity-60" disabled={operation.busy} onClick={startSchedule}>{operation.busy ? "Scheduling..." : "Schedule send"}</button><button type="button" className="rounded-xl border border-slate-500 px-4 py-2 font-semibold disabled:opacity-60" disabled={operation.busy} onClick={() => setDraftView("display")}>Back to draft</button></div></section>}
            </>
          ) : null}

          {detail.delivered_destination !== null && detail.delivered_why !== null && detail.delivered_arrival_signals !== null && <ContentCard title={detail.authoring_mode === "delivered" ? "Version sent to Explorer" : "Last version sent to Explorer"} destination={detail.delivered_destination} why={detail.delivered_why} arrivalSignals={detail.delivered_arrival_signals} tone="delivered" />}
          {detail.authoring_mode === "pending" && detail.pending_deadline_at !== null && detail.effective_seconds !== null && <section className="rounded-2xl border border-amber-700/70 bg-amber-950/25 p-6"><h2 className="text-xl font-semibold">Pending-send window</h2><p className="mt-2 text-slate-200">Explorer visibility is scheduled after {formatSuggestedWaypointDateTime(detail.pending_deadline_at)}. The applied grace setting is {detail.effective_seconds} seconds.</p>{countdown !== null && <p className="mt-2 text-sm font-semibold text-amber-100" role="timer" aria-live="off">{countdown.label}</p>}<p className="mt-2 text-sm text-slate-400">The countdown is a browser estimate only. The server decides whether Pull Back is still available.</p>{detail.pull_back_available ? <button ref={initiatingButtonRef} type="button" className="mt-5 rounded-xl border border-amber-400 bg-amber-950 px-4 py-2 font-semibold text-amber-100 disabled:opacity-60" disabled={operation.busy || operation.phase === "transport_uncertain"} onClick={startPullBack}>{operation.busy ? "Pulling Back..." : "Pull Back"}</button> : <p className="mt-5 font-semibold text-amber-100">Pull Back is not available for the current authoritative detail.</p>}<p className="mt-3 text-sm text-slate-300">Pull Back returns the pending version to the Guide-only draft state. It does not delete the suggestion.</p></section>}
          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6"><h2 className="text-xl font-semibold">Privacy boundary</h2><p className="mt-2 text-slate-300">Explorer-private open and read activity is not shown here. The Guide sees only an explicit receipt acknowledgement and its date, when the Explorer chooses to send one.</p></section>
        </div>
      )}
    </div>
  );
}
