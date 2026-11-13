"use client";

import { useId, useState, type FormEvent } from "react";
import { YOUR_WAYPOINTS_EARLIER_VERSIONS_POINTER } from "@/lib/solmind/explorerYourWaypoints";
import {
  EXPLORER_CONVERSATION_LIMITS,
  waypointHasCapacity,
  type ExplorerConversationState,
  type ExplorerCompassAnchor,
} from "@/lib/solmind/explorerConversationContract";
import {
  buildReachedFormationIntent,
  buildWaypointReleaseFormationIntent,
  buildWaypointFormationIntent,
  findFormationSource,
  currentCompassHeads,
  savedCompassHeads,
  compassCategorySources,
  type ExplorerConversationFormationIntent,
  type FormationIntentResult,
  type WaypointRevisionReview,
} from "@/lib/solmind/explorerConversationFormation";
import { waypointCapacityMessage } from "@/lib/solmind/explorerWaypointCapacity";

import { ExplorerWaypointClarification } from "./ExplorerWaypointClarification";

export type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
export type ExplorerConversationFormationProps = Readonly<{
  state: ExplorerConversationState;
  busy: boolean;
  readOnly?: boolean;
  onCommand: (command: ExplorerConversationFormationIntent) => void;
}>;

const inputClass = "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-slate-100 disabled:opacity-60";
const buttonClass = "rounded-xl border border-cyan-300/60 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-3xl border border-slate-700 bg-slate-950/70 p-5";
const compassPositions: readonly Readonly<{ anchor: ExplorerCompassAnchor; label: string; className: string }>[] = [
  { anchor: "apex", label: "Straight ahead", className: "col-start-2 row-start-1" },
  { anchor: "upper_left", label: "Upper left", className: "col-start-1 row-start-2" },
  { anchor: "upper_right", label: "Upper right", className: "col-start-3 row-start-2" },
  { anchor: "side_left", label: "Detour \u2014 left", className: "col-start-1 row-start-3" },
  { anchor: "side_right", label: "Detour \u2014 right", className: "col-start-3 row-start-3" },
  { anchor: "lower_left", label: "Excursion \u2014 lower left", className: "col-start-1 row-start-4" },
  { anchor: "lower_center", label: "Excursion \u2014 lower center", className: "col-start-2 row-start-4" },
  { anchor: "lower_right", label: "Excursion \u2014 lower right", className: "col-start-3 row-start-4" },
];
const emphasisLabels = { 1: "Light", 2: "Regular", 3: "Strong" } as const;
function placementLabel(anchor: ExplorerCompassAnchor | null) {
  return compassPositions.find(position => position.anchor === anchor)?.label ?? "Other paths";
}
type WaypointReleaseReview = Readonly<{
  conversationId: string | null;
  revision: number;
  waypointId: string;
}>;

const routeLabels = {
  priority_confirmed: "Priority confirmed",
  priority_reoriented: "Priority reoriented",
  attention_changed: "Attention moved",
} as const;

function SavedSource({ state, sourceMessageId }: Readonly<{
  state: ExplorerConversationState; sourceMessageId: string;
}>) {
  const source = findFormationSource(state, sourceMessageId);
  return source ? (
    <blockquote className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-cyan-400 pl-3 text-sm text-slate-300">
      <p className="mb-2 text-xs font-semibold text-cyan-200">Exact saved source {"\u2014"} {source.role === "explorer" ? "You" : "SolMind Virtual Guide"}</p>
      {source.body}
    </blockquote>
  ) : null;
}

function SourceSelect({ id, state, value, onChange }: Readonly<{
  id: string; state: ExplorerConversationState; value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label htmlFor={id} className="block text-sm text-slate-200">
      Saved conversation source
      <select id={id} className={inputClass} value={value} required onChange={event => onChange(event.target.value)}>
        <option value="">Choose a saved message</option>
        {state.messages.map((message, index) => (
          <option key={message.id} value={message.id}>
            {index + 1}. {message.role === "explorer" ? "You" : "SolMind Virtual Guide"}: {message.body.slice(0, 80)}{message.body.length > 80 ? "\u2026" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExplorerConversationFormation({ state, busy, readOnly = false, onCommand }: ExplorerConversationFormationProps) {
  const id = useId();
  const [waypointSource, setWaypointSource] = useState("");
  const [destination, setDestination] = useState("");
  const [meaning, setMeaning] = useState("");
  const [arrivalSignal, setArrivalSignal] = useState("");
  const [waypointConfirmed, setWaypointConfirmed] = useState(false);
  const [reachedReviewId, setReachedReviewId] = useState<string | null>(null);
  const [reachedEvidence, setReachedEvidence] = useState("");
  const [reachedConfirmed, setReachedConfirmed] = useState(false);
  const [releaseReview, setReleaseReview] = useState<WaypointReleaseReview | null>(null);
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [clarificationReview, setClarificationReview] = useState<Omit<WaypointRevisionReview, "answers"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentPoints = savedCompassHeads(state);
  const priority = currentPoints.find(item => item.id === state.priorityId);
  const attention = currentCompassHeads(state).find(item => item.id === state.attentionId);
  const otherPaths = currentPoints.filter(item => item.anchor == null);
  const waypointSuccessors = new Set(state.waypoints.filter(item => item.isCurrent !== true).map(item => item.id));
  const reachedReview = state.waypoints.find(item => item.id === reachedReviewId && item.status === "chosen" && item.release === undefined && !waypointSuccessors.has(item.id));
  const releaseWaypoint = state.waypoints.find(item => item.id === releaseReview?.waypointId);
  const staleRelease = releaseReview !== null && (releaseReview.conversationId !== state.conversationId ||
    releaseReview.revision !== state.revision || releaseWaypoint === undefined || releaseWaypoint.status !== "chosen" ||
    releaseWaypoint.release !== undefined || releaseWaypoint.isCurrent !== true || state.sessionStatus !== "active");
  const hasSource = state.conversationId !== null && state.messages.length > 0;
  const newWaypointCapacityMessage = waypointCapacityMessage(state);
  // A revisit continues an existing Waypoint: history and an active place, never one of the conversation's five.
  const revisitCapacityMessage = waypointCapacityMessage(state, "revisit");
  const revisionCapacityMessage = waypointCapacityMessage(state, "revision");
  const newWaypointCapacityDescription = newWaypointCapacityMessage !== null ? `${id}-waypoint-capacity` : undefined;
  const route = state.route ?? [];
  function submit(result: FormationIntentResult) {
    if (busy || readOnly) return;
    setError(result.error);
    if (result.ok) onCommand(result.command);
  }
  function openWaypointClarification(waypointId: string, kind: WaypointRevisionReview["kind"]) {
    if (busy || readOnly || state.pendingTurn || !state.conversationId || state.sessionStatus !== "active" ||
        !waypointHasCapacity(state, kind === "revisit_waypoint" ? "revisit" : "revision") || waypointSuccessors.has(waypointId)) return;
    const waypoint = state.waypoints.find(item => item.id === waypointId);
    if (!waypoint || (kind === "revise_waypoint" ? waypoint.status !== "chosen" || waypoint.release !== undefined
      : waypoint.status !== "reached" && waypoint.release === undefined)) return;
    setClarificationReview(Object.freeze({ conversationId: state.conversationId, revision: state.revision, waypointId, kind }));
    setError(null);
  }
  function reviewWaypointRelease(waypointId: string) {
    if (busy || readOnly || state.pendingTurn || !state.conversationId || state.sessionStatus !== "active") return;
    const waypoint = state.waypoints.find(item => item.id === waypointId);
    if (!waypoint || waypoint.isCurrent !== true || waypoint.status !== "chosen" || waypoint.release !== undefined) return;
    setReleaseReview({ conversationId: state.conversationId, revision: state.revision, waypointId });
    setReleaseConfirmed(false);
    setError(null);
  }
  function confirmWaypointRelease() {
    if (busy || readOnly || state.pendingTurn || releaseReview === null) return;
    if (staleRelease) {
      setError("Your saved conversation or Waypoint changed. Close this review and open a new one before releasing.");
      return;
    }
    submit(buildWaypointReleaseFormationIntent(state, releaseReview.waypointId, releaseReview.revision, releaseConfirmed));
  }
  function pointCard(item: ExplorerConversationState["compassItems"][number]) {
    const emphasisClass = item.emphasis === 3 ? "text-lg font-bold" : item.emphasis === 1 ? "text-sm font-medium" : "font-semibold";
    // Any current point can take current attention, placed or not (2026-11-03,
    // migration 20261103180000; Paul's decision, decision queue 18:05:33 CST).
    const sources = compassCategorySources(state, item.id);
    return <div className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950 p-3">
      <h4 className={`break-words text-slate-100 ${emphasisClass}`}>{item.label}</h4>
      <p className="mt-1 text-xs text-slate-300">
        {state.priorityId === item.id ? "Confirmed Priority. " : ""}
        {state.attentionId === item.id ? "Current attention. " : ""}
        {item.emphasis == null ? "Placement and relative emphasis have not been recorded." : `Relative emphasis: ${emphasisLabels[item.emphasis]}.`}
      </p>
      <details className="mt-2"><summary className="cursor-pointer text-sm text-cyan-200">Review saved source</summary><SavedSource state={state} sourceMessageId={item.sourceMessageId} /></details>
      {sources.length > 1 ? <details className="mt-2"><summary className="cursor-pointer text-sm text-cyan-200">Combined source points ({sources.length})</summary>
        <p className="mt-2 text-xs text-slate-300">Original points and exact saved sources remain available. The category label describes your current wording.</p>
        <ul className="mt-2 space-y-3">{sources.map(source => <li key={source.id} className="break-words text-sm text-slate-200">
          <p>{source.label}{source.id === item.id ? " \u2014 current category" : " \u2014 retained source point"}</p>
          <SavedSource state={state} sourceMessageId={source.sourceMessageId} />
        </li>)}</ul>
      </details> : null}
    </div>;
  }
  function chooseWaypoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(buildWaypointFormationIntent(state, {
      sourceMessageId: waypointSource, destination, meaning, arrivalSignal, confirmed: waypointConfirmed,
    }));
  }

  return (
    <aside aria-label="Private Compass and Waypoints" className="space-y-5">
      <p className="rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
        Your Compass and Waypoints stay private in this conversation. Choosing a source does not share it.
        Only confirmed saved results appear below; unsaved edits stay on this page.
      </p>
      {!readOnly && error ? <p role="alert" className="rounded-xl border border-amber-500/50 bg-slate-950 p-3 text-sm text-amber-100">{error}</p> : null}

      {readOnly ? <section aria-labelledby={`${id}-compass-title`} className={panelClass}>
        <h2 id={`${id}-compass-title`} className="text-xl font-semibold text-slate-100">Session Compass</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Discovery may stay empty. You choose the labels and confirm Priority; current attention can move separately.
        </p>
        <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-300/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Confirmed Priority</p>
          <p className="mt-2 break-words text-slate-100">{priority?.label ?? "No Priority confirmed"}</p>
        </div>
        <p className="mt-3 break-words text-sm text-cyan-200">Current attention: {attention?.label ?? "No attention point chosen"}</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Higher positions express relative priority. Side positions are Detours; lower positions are Excursions.
          Light, Regular and Strong express your relative emphasis, not a score. Priority stays at the top once confirmed.
        </p>
        {currentPoints.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Discovery mode {"\u2014"} no topic or Priority has been invented.</p>
        ) : <>
          <section aria-label="Saved Compass arrangement" className="mt-4 overflow-x-auto">
            <div className="grid min-w-[34rem] grid-cols-3 gap-3">
              {compassPositions.map(position => {
                const item = currentPoints.find(point => point.anchor === position.anchor);
                return <div key={position.anchor} className={`min-w-0 ${position.className}`}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-300">{position.label}</h3>
                  {item ? pointCard(item) : <p className="rounded-2xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">No point placed here</p>}
                  {position.anchor === "apex" && item && state.priorityId === null ? <p className="mt-2 text-xs text-amber-200">No Priority confirmed {"\u2014"} placement alone does not confirm it.</p> : null}
                </div>;
              })}
            </div>
          </section>
          <details className="mt-4 rounded-2xl border border-slate-700 p-4">
            <summary className="cursor-pointer font-semibold text-slate-100">Other paths ({otherPaths.length})</summary>
            <p className="mt-2 text-sm text-slate-300">Saved points outside the visible Compass, including points awaiting an arrangement. Every saved source remains reviewable.</p>
            {otherPaths.length === 0 ? <p className="mt-3 text-sm text-slate-400">No other paths are saved.</p> : <ul className="mt-3 space-y-3">{otherPaths.map(item => <li key={item.id}>{pointCard(item)}</li>)}</ul>}
          </details>
        </>}
        <section aria-labelledby={`${id}-route-title`} className="mt-5 border-t border-slate-700 pt-4">
          <h3 id={`${id}-route-title`} className="font-semibold text-slate-100">Route</h3>
          {route.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">No recorded direction changes are available yet.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-3 pl-5">
              {route.map(entry => (
                <li key={entry.operationId} className="break-words text-sm text-slate-300">
                  {entry.kind === "arrangement_confirmed" ? <>
                    <p className="font-semibold text-slate-200">Compass arrangement confirmed</p>
                    <p className="mt-1">{entry.previousPriorityId !== entry.priorityId
                      ? `Priority changed from \u201c${entry.items.find(item => item.compassItemId === entry.previousPriorityId)?.label ?? "No Priority confirmed"}\u201d to \u201c${entry.items.find(item => item.compassItemId === entry.priorityId)?.label ?? "No Priority confirmed"}\u201d.`
                      : entry.priorityId === null ? "No Priority confirmed." : `Priority retained: ${entry.items.find(item => item.compassItemId === entry.priorityId)?.label ?? "Recorded Priority"}.`}</p>
                    <details className="mt-2"><summary className="cursor-pointer text-cyan-200">Review recorded placement and emphasis</summary>
                      <ul className="mt-2 space-y-2">{entry.items.map(item => <li key={item.compassItemId} className="break-words">{item.label} {"\u2014"} {placementLabel(item.anchor)}; {emphasisLabels[item.emphasis]}.</li>)}</ul>
                    </details>
                  </> : entry.kind === "category_confirmed" ? <>
                    <p className="font-semibold text-slate-200">{entry.change.memberItemIds.length > 1 ? "Categories combined" : "Category wording updated"}</p>
                    <p className="mt-1">Confirmed wording: {entry.change.label}</p>
                    <details className="mt-2"><summary className="cursor-pointer text-cyan-200">Review recorded wording and sources</summary>
                      <ul className="mt-2 space-y-3">{entry.change.beforeItems.map(item => <li key={item.compassItemId} className="break-words">
                        <p>{item.label}{entry.change.memberItemIds.includes(item.compassItemId) ? " \u2014 selected point before this change" : " \u2014 retained contributing point"}; {placementLabel(item.anchor)}; {item.emphasis === null ? "relative emphasis not recorded" : emphasisLabels[item.emphasis]}.</p>
                        <SavedSource state={state} sourceMessageId={item.sourceMessageId} />
                      </li>)}</ul>
                    </details>
                  </> : <p><span className="font-semibold text-slate-200">{routeLabels[entry.kind]}:</span> {entry.label}</p>}
                  <time dateTime={entry.recordedAt} className="mt-1 block text-xs text-slate-400">{new Date(entry.recordedAt).toLocaleString("en-US")}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section> : null}

      <section aria-labelledby={`${id}-waypoints-title`} className={panelClass}>
        <h2 id={`${id}-waypoints-title`} className="text-xl font-semibold text-slate-100">Private Waypoints</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">A Waypoint is a meaningful place you choose to reach. It is optional, and it is not a task or a score.</p>
        {state.waypoints.length === 0 ? <p className="mt-3 text-sm text-slate-300">No Waypoint chosen. You can keep exploring without one.</p> : (
          <ul className="mt-4 space-y-4">{state.waypoints.map(waypoint => {
            const revisiting = waypoint.status !== "chosen" || waypoint.release !== undefined;
            const capacityMessage = revisiting ? revisitCapacityMessage : revisionCapacityMessage;
            const capacityDescription = capacityMessage !== null ? `${id}-waypoint-capacity-${waypoint.id}` : undefined;
            return (
            <li key={waypoint.id} id={`${id}-waypoint-${waypoint.id}`} className="rounded-2xl border border-slate-700 p-4">
              <h3 className="break-words font-semibold text-slate-100">{waypoint.destination}</h3>
              <p className="mt-1 text-xs font-semibold text-cyan-200">{waypointSuccessors.has(waypoint.id) ? waypoint.release !== undefined ? "Earlier version - Released" : waypoint.status === "reached" ? "Earlier version - Reached" : "Earlier version - Formed" : waypoint.release !== undefined ? "Released \u2014 kept in your private history" : waypoint.status === "reached" ? "Reached \u2014 confirmed by you" : "In progress \u2014 chosen by you"}</p>
              <dl className="mt-3 space-y-3 text-sm"><div><dt className="font-semibold text-slate-200">Why it matters</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.meaning}</dd></div><div><dt className="font-semibold text-slate-200">Arrival signal</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.arrivalSignal}</dd></div></dl>
              {waypoint.lifecycle !== undefined ? <details className="mt-3 rounded-xl border border-slate-700 p-3">
                <summary className="cursor-pointer text-sm text-cyan-200">Review this {waypoint.lifecycle.creationReason === "revision" ? "revision" : "new lifecycle"} and its clarification sources</summary>
                <p className="mt-3 text-sm text-slate-300">{waypoint.lifecycle.creationReason === "revision" ? "You confirmed a revised understanding." : "You confirmed a new current lifecycle. Earlier Reached evidence or release history does not count as current arrival."} The earlier definition stays saved privately. {YOUR_WAYPOINTS_EARLIER_VERSIONS_POINTER}</p>
                {waypoint.lifecycle.clarifications.length === 0 ? <p className="mt-3 text-sm text-slate-300">You deliberately kept the earlier destination, meaning and arrival signal when confirming this new lifecycle.</p> : <ul className="mt-3 space-y-4">{waypoint.lifecycle.clarifications.map(source => <li key={source.component} className="text-sm text-slate-300">
                  <p className="font-semibold text-slate-200">Explorer clarification in this conversation {"\u2014"} {source.component === "arrivalSignal" ? "arrival signal" : source.component}</p>
                  <p className="mt-1">Application question: {source.component === "destination" ? "Where do you want to arrive now?" : source.component === "meaning" ? "Why does reaching that place matter to you now?" : "What observable signal would help you recognize arrival now?"}</p>
                  <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-cyan-400 pl-3">{source.answer}</blockquote>
                  <time dateTime={source.recordedAt} className="mt-1 block text-xs text-slate-400">{new Date(source.recordedAt).toLocaleString("en-US")}</time>
                </li>)}</ul>}
                <p className="mt-3 text-xs text-slate-400">These are your answers to application questions, kept separately from model replies. They are not quotations from an earlier message.</p>
              </details> : null}
              {waypoint.release !== undefined ? <div className="mt-3 text-sm text-slate-300">
                <p>This Waypoint is no longer in progress. Its destination, meaning, arrival signal and saved source remain private and available.</p>
                <p className="mt-1">Released on <time dateTime={waypoint.release.releasedAt}>{new Date(waypoint.release.releasedAt).toLocaleString("en-US")}</time>.</p>
              </div> : null}
              {waypoint.status === "reached" ? (
                waypoint.reachedEvidence != null && waypoint.reachedAt != null ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-cyan-200">Review saved Reached confirmation</summary>
                    <dl className="mt-3 space-y-3 text-sm">
                      <div><dt className="font-semibold text-slate-200">Supporting evidence</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.reachedEvidence}</dd></div>
                      <div><dt className="font-semibold text-slate-200">Confirmed on</dt><dd className="mt-1 text-slate-300"><time dateTime={waypoint.reachedAt}>{new Date(waypoint.reachedAt).toLocaleString("en-US")}</time></dd></div>
                    </dl>
                  </details>
                ) : <p className="mt-3 text-sm text-slate-300">Saved supporting evidence and confirmation time are unavailable for this earlier Waypoint.</p>
              ) : null}
              <details className="mt-3"><summary className="cursor-pointer text-sm text-cyan-200">Review saved source</summary><SavedSource state={state} sourceMessageId={waypoint.sourceMessageId} /></details>
              {waypoint.status === "chosen" && waypoint.release === undefined && !waypointSuccessors.has(waypoint.id) ? (!readOnly ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setReachedReviewId(waypoint.id); setReachedEvidence(""); setReachedConfirmed(false); setError(null); }}>Review Reached: {waypoint.destination}</button> : null) : waypoint.status === "reached" ? <p className="mt-3 text-sm text-slate-300">Meaningful progress does not mean your journey is over.</p> : null}
              {!readOnly && state.conversationId !== null && state.sessionStatus === "active" && waypoint.status === "chosen" && waypoint.release === undefined && !waypointSuccessors.has(waypoint.id) ? <button type="button" className={`${buttonClass} mt-3 ml-2`} disabled={busy || state.pendingTurn} onClick={() => reviewWaypointRelease(waypoint.id)}>Review release: {waypoint.destination}</button> : null}
              {!readOnly && state.sessionStatus === "active" && !waypointSuccessors.has(waypoint.id) ? <>
                <button type="button" className={`${buttonClass} mt-3 ml-2`} disabled={busy || state.pendingTurn || capacityMessage !== null} aria-describedby={capacityDescription} onClick={() => openWaypointClarification(waypoint.id, revisiting ? "revisit_waypoint" : "revise_waypoint")}>{revisiting ? "Revisit this Waypoint in the conversation" : "Clarify this Waypoint in the conversation"}</button>
                {capacityMessage !== null ? <p id={capacityDescription} role="alert" tabIndex={0} className="mt-3 text-sm text-slate-300">{capacityMessage}</p> : null}
              </> : null}
            </li>
          ); })}</ul>
        )}
        {!readOnly && clarificationReview !== null ? <ExplorerWaypointClarification key={`${clarificationReview.conversationId}:${clarificationReview.revision}:${clarificationReview.waypointId}:${clarificationReview.kind}`} state={state} busy={busy} readOnly={readOnly} review={clarificationReview} onCommand={onCommand} onClose={() => setClarificationReview(null)} /> : null}
        {!readOnly && releaseReview !== null ? <fieldset disabled={busy || state.pendingTurn || staleRelease} className="mt-4 space-y-3 rounded-2xl border border-amber-300/50 p-4">
          <legend className="px-1 font-semibold text-slate-100">Review before releasing this Waypoint</legend>
          {releaseWaypoint ? <>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Destination: {releaseWaypoint.destination}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Why it matters: {releaseWaypoint.meaning}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Arrival signal: {releaseWaypoint.arrivalSignal}</p>
            <SavedSource state={state} sourceMessageId={releaseWaypoint.sourceMessageId} />
          </> : null}
          <p className="text-sm leading-6 text-slate-300">Releasing stops treating this Waypoint as in progress. Its definition, saved source and history stay saved and private. This does not mark it Reached, end the conversation or share anything.</p>
          {staleRelease ? <p role="alert" className="text-sm text-amber-200">Your saved conversation or Waypoint changed. Close this review and open a new one before releasing.</p> : null}
          <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={releaseConfirmed} onChange={event => setReleaseConfirmed(event.target.checked)} />I reviewed this Waypoint and its saved source, and I choose to release it while keeping its private history.</label>
          <button type="button" className={buttonClass} disabled={!releaseConfirmed} onClick={confirmWaypointRelease}>Release this Waypoint</button>
        </fieldset> : null}
        {!readOnly && releaseReview !== null ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setReleaseReview(null); setReleaseConfirmed(false); setError(null); }}>Close release review</button> : null}
        {!readOnly && reachedReview ? (
          <fieldset disabled={busy} className="mt-4 space-y-3 rounded-2xl border border-cyan-300/50 p-4">
            <legend className="px-1 font-semibold text-slate-100">Review before confirming Reached</legend>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Destination: {reachedReview.destination}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Why it matters: {reachedReview.meaning}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Arrival signal: {reachedReview.arrivalSignal}</p>
            <SavedSource state={state} sourceMessageId={reachedReview.sourceMessageId} />
            <label htmlFor={`${id}-reached-evidence`} className="block text-sm text-slate-200">What supporting evidence shows arrival?
              <textarea id={`${id}-reached-evidence`} className={inputClass} value={reachedEvidence} onChange={event => { setReachedEvidence(event.target.value); setReachedConfirmed(false); }} maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} required rows={3} />
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={reachedConfirmed} onChange={event => setReachedConfirmed(event.target.checked)} />I have reviewed my arrival signal and supporting evidence, and I confirm meaningful progress to this Waypoint.</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={!reachedConfirmed || !reachedEvidence.trim()} onClick={() => submit(buildReachedFormationIntent(state, reachedReview.id, reachedEvidence, reachedConfirmed))}>Confirm Reached</button>
              <button type="button" className={buttonClass} onClick={() => { setReachedReviewId(null); setReachedEvidence(""); setReachedConfirmed(false); }}>Keep in progress</button>
            </div>
          </fieldset>
        ) : null}
        {!readOnly ? <form onSubmit={chooseWaypoint} className="mt-5 border-t border-slate-700 pt-4">
          <fieldset disabled={busy || !hasSource || newWaypointCapacityMessage !== null} aria-describedby={newWaypointCapacityDescription} className="space-y-3">
            <legend className="mb-3 font-semibold text-slate-100">Choose a private Waypoint</legend>
            <SourceSelect id={`${id}-waypoint-source`} state={state} value={waypointSource} onChange={value => { setWaypointSource(value); setWaypointConfirmed(false); }} />
            <SavedSource state={state} sourceMessageId={waypointSource} />
            <label htmlFor={`${id}-destination`} className="block text-sm text-slate-200">Where do you want to arrive?
              <textarea id={`${id}-destination`} className={inputClass} value={destination} onChange={event => { setDestination(event.target.value); setWaypointConfirmed(false); }} maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} required rows={2} />
            </label>
            <label htmlFor={`${id}-meaning`} className="block text-sm text-slate-200">Why does reaching it matter to you?
              <textarea id={`${id}-meaning`} className={inputClass} value={meaning} onChange={event => { setMeaning(event.target.value); setWaypointConfirmed(false); }} maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} required rows={2} />
            </label>
            <label htmlFor={`${id}-arrival`} className="block text-sm text-slate-200">What observable signal will help you recognize arrival?
              <textarea id={`${id}-arrival`} className={inputClass} value={arrivalSignal} onChange={event => { setArrivalSignal(event.target.value); setWaypointConfirmed(false); }} maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} required rows={2} />
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={waypointConfirmed} onChange={event => setWaypointConfirmed(event.target.checked)} />I choose this private Waypoint with the destination, meaning and arrival signal shown above.</label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClass} disabled={!waypointConfirmed} aria-describedby={newWaypointCapacityDescription}>Confirm and save private Waypoint</button>
              <button type="button" className={buttonClass} onClick={() => { setWaypointSource(""); setDestination(""); setMeaning(""); setArrivalSignal(""); setWaypointConfirmed(false); setError(null); }}>Clear Waypoint draft</button>
            </div>
          </fieldset>
          {!hasSource ? <p className="mt-3 text-sm text-slate-400">A saved conversation message is needed before choosing a Waypoint.</p> : null}
          {newWaypointCapacityMessage !== null ? <p id={newWaypointCapacityDescription} role="alert" tabIndex={0} className="mt-3 text-sm text-slate-400">{newWaypointCapacityMessage}</p> : null}
        </form> : null}
      </section>
    </aside>
  );
}
