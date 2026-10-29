"use client";

import { useId, useState, type FormEvent } from "react";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";
import {
  buildAttentionFormationIntent,
  buildCompassFormationIntent,
  buildPriorityFormationIntent,
  buildReachedFormationIntent,
  buildWaypointFormationIntent,
  findFormationSource,
  type ExplorerConversationFormationIntent,
  type FormationIntentResult,
} from "@/lib/solmind/explorerConversationFormation";

export type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
export type ExplorerConversationFormationProps = Readonly<{
  state: ExplorerConversationState;
  busy: boolean;
  onCommand: (command: ExplorerConversationFormationIntent) => void;
}>;

const inputClass = "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-slate-100 disabled:opacity-60";
const buttonClass = "rounded-xl border border-cyan-300/60 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-3xl border border-slate-700 bg-slate-950/70 p-5";
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
      <p className="mb-2 text-xs font-semibold text-cyan-200">Exact saved source — {source.role === "explorer" ? "You" : "SolMind Virtual Guide"}</p>
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
            {index + 1}. {message.role === "explorer" ? "You" : "SolMind Virtual Guide"}: {message.body.slice(0, 80)}{message.body.length > 80 ? "…" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExplorerConversationFormation({ state, busy, onCommand }: ExplorerConversationFormationProps) {
  const id = useId();
  const [compassSource, setCompassSource] = useState("");
  const [label, setLabel] = useState("");
  const [waypointSource, setWaypointSource] = useState("");
  const [destination, setDestination] = useState("");
  const [meaning, setMeaning] = useState("");
  const [arrivalSignal, setArrivalSignal] = useState("");
  const [waypointConfirmed, setWaypointConfirmed] = useState(false);
  const [priorityReviewId, setPriorityReviewId] = useState<string | null>(null);
  const [reachedReviewId, setReachedReviewId] = useState<string | null>(null);
  const [reachedEvidence, setReachedEvidence] = useState("");
  const [reachedConfirmed, setReachedConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priority = state.compassItems.find(item => item.id === state.priorityId);
  const attention = state.compassItems.find(item => item.id === state.attentionId);
  const priorityReview = state.compassItems.find(item => item.id === priorityReviewId);
  const reachedReview = state.waypoints.find(item => item.id === reachedReviewId && item.status === "chosen");
  const hasSource = state.conversationId !== null && state.messages.length > 0;
  const route = state.route ?? [];

  function submit(result: FormationIntentResult) {
    if (busy) return;
    setError(result.error);
    if (result.ok) onCommand(result.command);
  }
  function addCompass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(buildCompassFormationIntent(state, { sourceMessageId: compassSource, label }));
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
      {error ? <p role="alert" className="rounded-xl border border-amber-500/50 bg-slate-950 p-3 text-sm text-amber-100">{error}</p> : null}

      <section aria-labelledby={`${id}-compass-title`} className={panelClass}>
        <h2 id={`${id}-compass-title`} className="text-xl font-semibold text-slate-100">Session Compass</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Discovery may stay empty. You choose the labels and confirm Priority; current attention can move separately.
        </p>
        <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-300/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Confirmed Priority</p>
          <p className="mt-2 break-words text-slate-100">{priority?.label ?? "No Priority confirmed"}</p>
        </div>
        <p className="mt-3 break-words text-sm text-cyan-200">Current attention: {attention?.label ?? "No attention point chosen"}</p>
        {state.compassItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Discovery mode — no topic or Priority has been invented.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {state.compassItems.map(item => (
              <li key={item.id} className="rounded-2xl border border-slate-700 p-3">
                <p className="break-words font-medium text-slate-100">{item.label}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {state.priorityId === item.id ? "Confirmed Priority. " : ""}
                  {state.attentionId === item.id ? "Current attention." : ""}
                </p>
                <details className="mt-2"><summary className="cursor-pointer text-sm text-cyan-200">Review saved source</summary><SavedSource state={state} sourceMessageId={item.sourceMessageId} /></details>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} disabled={busy || state.priorityId === item.id} onClick={() => { setPriorityReviewId(item.id); setError(null); }}>Review Priority: {item.label}</button>
                  <button type="button" className={buttonClass} disabled={busy || state.attentionId === item.id} onClick={() => submit(buildAttentionFormationIntent(state, item.id))}>Attend to: {item.label}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {priorityReview && state.priorityId !== priorityReview.id ? (
          <div role="group" aria-label="Confirm Priority choice" className="mt-4 rounded-2xl border border-amber-300/50 p-4">
            <p className="break-words text-sm text-slate-100">Make “{priorityReview.label}” your Priority? Current attention will remain separate.</p>
            <SavedSource state={state} sourceMessageId={priorityReview.sourceMessageId} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={busy} onClick={() => submit(buildPriorityFormationIntent(state, priorityReview.id, true))}>Confirm Priority</button>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => setPriorityReviewId(null)}>Keep current Priority</button>
            </div>
          </div>
        ) : null}
        <section aria-labelledby={`${id}-route-title`} className="mt-5 border-t border-slate-700 pt-4">
          <h3 id={`${id}-route-title`} className="font-semibold text-slate-100">Route</h3>
          {route.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">No recorded direction changes are available yet.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-3 pl-5">
              {route.map(entry => (
                <li key={entry.operationId} className="break-words text-sm text-slate-300">
                  <p><span className="font-semibold text-slate-200">{routeLabels[entry.kind]}:</span> {entry.label}</p>
                  <time dateTime={entry.recordedAt} className="mt-1 block text-xs text-slate-400">{new Date(entry.recordedAt).toLocaleString("en-US")}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
        <form onSubmit={addCompass} className="mt-5 border-t border-slate-700 pt-4">
          <fieldset disabled={busy || !hasSource || state.compassItems.length >= EXPLORER_CONVERSATION_LIMITS.compassItems} className="space-y-3">
            <legend className="mb-3 font-semibold text-slate-100">Add a point you choose</legend>
            <SourceSelect id={`${id}-compass-source`} state={state} value={compassSource} onChange={setCompassSource} />
            <SavedSource state={state} sourceMessageId={compassSource} />
            <label htmlFor={`${id}-label`} className="block text-sm text-slate-200">Your short label
              <input id={`${id}-label`} className={inputClass} value={label} onChange={event => setLabel(event.target.value)} maxLength={EXPLORER_CONVERSATION_LIMITS.labelCharacters} required />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClass}>Save Compass point</button>
              <button type="button" className={buttonClass} onClick={() => { setCompassSource(""); setLabel(""); setError(null); }}>Clear point draft</button>
            </div>
          </fieldset>
          {!hasSource ? <p className="mt-3 text-sm text-slate-400">A saved conversation message is needed before adding a point.</p> : null}
          {state.compassItems.length >= EXPLORER_CONVERSATION_LIMITS.compassItems ? <p className="mt-3 text-sm text-slate-400">All eight points are in use. Your conversation remains available without adding another point.</p> : null}
        </form>
      </section>

      <section aria-labelledby={`${id}-waypoints-title`} className={panelClass}>
        <h2 id={`${id}-waypoints-title`} className="text-xl font-semibold text-slate-100">Private Waypoints</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">A Waypoint is a meaningful place you choose to reach. It is optional, and it is not a task or a score.</p>
        {state.waypoints.length === 0 ? <p className="mt-3 text-sm text-slate-300">No Waypoint chosen. You can keep exploring without one.</p> : (
          <ul className="mt-4 space-y-4">{state.waypoints.map(waypoint => (
            <li key={waypoint.id} className="rounded-2xl border border-slate-700 p-4">
              <h3 className="break-words font-semibold text-slate-100">{waypoint.destination}</h3>
              <p className="mt-1 text-xs font-semibold text-cyan-200">{waypoint.status === "reached" ? "Reached — confirmed by you" : "In progress — chosen by you"}</p>
              <dl className="mt-3 space-y-3 text-sm"><div><dt className="font-semibold text-slate-200">Why it matters</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.meaning}</dd></div><div><dt className="font-semibold text-slate-200">Arrival signal</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.arrivalSignal}</dd></div></dl>
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
              {waypoint.status === "chosen" ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setReachedReviewId(waypoint.id); setReachedEvidence(""); setReachedConfirmed(false); setError(null); }}>Review Reached: {waypoint.destination}</button> : <p className="mt-3 text-sm text-slate-300">Meaningful progress does not mean your journey is over.</p>}
            </li>
          ))}</ul>
        )}
        {reachedReview ? (
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
        <form onSubmit={chooseWaypoint} className="mt-5 border-t border-slate-700 pt-4">
          <fieldset disabled={busy || !hasSource || state.waypoints.length >= EXPLORER_CONVERSATION_LIMITS.waypoints} className="space-y-3">
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
              <button type="submit" className={buttonClass} disabled={!waypointConfirmed}>Confirm and save private Waypoint</button>
              <button type="button" className={buttonClass} onClick={() => { setWaypointSource(""); setDestination(""); setMeaning(""); setArrivalSignal(""); setWaypointConfirmed(false); setError(null); }}>Clear Waypoint draft</button>
            </div>
          </fieldset>
          {!hasSource ? <p className="mt-3 text-sm text-slate-400">A saved conversation message is needed before choosing a Waypoint.</p> : null}
          {state.waypoints.length >= EXPLORER_CONVERSATION_LIMITS.waypoints ? <p className="mt-3 text-sm text-slate-400">This conversation has reached its private Waypoint limit.</p> : null}
        </form>
      </section>
    </aside>
  );
}
