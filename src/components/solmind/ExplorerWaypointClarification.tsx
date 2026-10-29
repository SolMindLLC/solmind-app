"use client";

import { useId, useState } from "react";
import {
  EXPLORER_CONVERSATION_LIMITS,
  EXPLORER_WAYPOINT_COMPONENTS,
  EXPLORER_WAYPOINT_QUESTION_KEYS,
  type ExplorerConversationState,
  type ExplorerWaypointClarificationAnswer,
} from "@/lib/solmind/explorerConversationContract";
import {
  buildWaypointRevisionFormationIntent,
  type ExplorerConversationFormationIntent,
  type WaypointRevisionReview,
} from "@/lib/solmind/explorerConversationFormation";

type Component = ExplorerWaypointClarificationAnswer["component"];
type ReviewTarget = Omit<WaypointRevisionReview, "answers">;
const questions: Readonly<Record<Component, string>> = {
  destination: "Where do you want to arrive now?",
  meaning: "Why does reaching that place matter to you now?",
  arrivalSignal: "What observable signal would help you recognize arrival now?",
};
const labels: Readonly<Record<Component, string>> = {
  destination: "Destination", meaning: "Why it matters", arrivalSignal: "Arrival signal",
};
const buttonClass = "rounded-xl border border-cyan-300/60 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50";

export type ExplorerWaypointClarificationProps = Readonly<{
  state: ExplorerConversationState;
  busy: boolean;
  readOnly?: boolean;
  review: ReviewTarget;
  onCommand: (command: ExplorerConversationFormationIntent) => void;
  onClose: () => void;
}>;

// Application-authored questions are local interaction, never model messages.
// No write occurs until the Explorer confirms the exact full review below.
export function ExplorerWaypointClarification({ state, busy, readOnly = false, review, onCommand, onClose }: ExplorerWaypointClarificationProps) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Partial<Record<Component, string>>>({});
  const [answers, setAnswers] = useState<Partial<Record<Component, string>>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waypoint = state.waypoints.find(item => item.id === review.waypointId);
  const hasSuccessor = state.waypoints.some(item => item.lifecycle?.predecessorWaypointId === review.waypointId);
  const stale = waypoint === undefined || review.conversationId !== state.conversationId || review.revision !== state.revision ||
    state.sessionStatus !== "active" || hasSuccessor || (review.kind === "revise_waypoint"
      ? waypoint.status !== "chosen" || waypoint.release !== undefined
      : waypoint.status !== "reached" && waypoint.release === undefined);
  const atLimit = state.waypoints.length >= EXPLORER_CONVERSATION_LIMITS.waypoints;
  const blocked = busy || readOnly || state.pendingTurn || stale || atLimit;
  const component = EXPLORER_WAYPOINT_COMPONENTS[step];
  const questionKey = component === undefined ? null : EXPLORER_WAYPOINT_QUESTION_KEYS[component];
  const changedAnswers: readonly ExplorerWaypointClarificationAnswer[] = Object.freeze(EXPLORER_WAYPOINT_COMPONENTS.flatMap(key =>
    answers[key] === undefined ? [] : [Object.freeze({ component: key, answer: answers[key] as string })]));

  function keepCurrent() {
    if (blocked || component === undefined) return;
    setAnswers(current => { const next = { ...current }; delete next[component]; return next; });
    setConfirmed(false); setError(null); setStep(value => value + 1);
  }
  function useAnswer() {
    if (blocked || component === undefined || waypoint === undefined) return;
    const answer = (drafts[component] ?? "").trim();
    if (!answer || answer.length > EXPLORER_CONVERSATION_LIMITS.waypointCharacters) {
      setError("Enter your answer in 1 to 1,000 characters, or keep the saved understanding.");
      return;
    }
    setAnswers(current => { const next = { ...current }; if (answer === waypoint[component]) delete next[component]; else next[component] = answer; return next; });
    setConfirmed(false); setError(null); setStep(value => value + 1);
  }
  function confirm() {
    if (blocked || step !== EXPLORER_WAYPOINT_COMPONENTS.length) return;
    const result = buildWaypointRevisionFormationIntent(state, Object.freeze({ ...review, answers: changedAnswers }), confirmed);
    setError(result.error);
    if (result.ok) onCommand(result.command);
  }

  return <section aria-labelledby={`${id}-title`} className="mt-5 space-y-4 rounded-2xl border border-cyan-300/50 bg-slate-950 p-4">
    <h3 id={`${id}-title`} className="font-semibold text-slate-100">Waypoint clarification — application prompt</h3>
    <p className="text-sm leading-6 text-slate-300">These are fixed application questions, not a SolMind Virtual Guide reply. No AI request is made. Your answers stay in this draft until you review and confirm the complete understanding.</p>
    <p className="text-sm leading-6 text-amber-100">This draft is kept only on this page. Closing it, navigating away or reloading discards it and leaves the saved Waypoint unchanged.</p>
    {waypoint ? <p className="break-words text-sm text-slate-300">Saved Waypoint: {waypoint.destination}</p> : null}
    {stale ? <p role="alert" className="text-sm text-amber-200">Your saved conversation or Waypoint changed. Close this draft and open a new clarification before confirming.</p> : null}
    {atLimit ? <p role="alert" className="text-sm text-amber-200">This conversation already stores 20 Waypoint versions. Earlier versions remain available; another cannot be saved here.</p> : null}
    {error ? <p role="alert" className="text-sm text-amber-200">{error}</p> : null}
    {component !== undefined && waypoint ? <fieldset disabled={blocked} className="space-y-3 rounded-xl border border-slate-700 p-3">
      <legend data-question-key={questionKey ?? undefined} className="px-1 text-sm font-semibold text-cyan-100">Question {step + 1} of {EXPLORER_WAYPOINT_COMPONENTS.length}</legend>
      <p className="font-semibold text-slate-100">{questions[component]}</p>
      <p className="text-sm text-slate-300">Your saved {labels[component].toLowerCase()}:</p>
      <blockquote className="whitespace-pre-wrap break-words border-l-2 border-slate-500 pl-3 text-sm text-slate-300">{waypoint[component]}</blockquote>
      <label htmlFor={`${id}-answer-${component}`} className="block text-sm text-slate-200">Your answer
        <textarea id={`${id}-answer-${component}`} value={drafts[component] ?? ""} onChange={event => { setDrafts(current => ({ ...current, [component]: event.target.value })); setConfirmed(false); }} maxLength={EXPLORER_CONVERSATION_LIMITS.waypointCharacters} rows={3} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-slate-100 disabled:opacity-60" />
      </label>
      <p className="text-xs text-slate-400">Keep is the default: opening a question does not change the saved understanding.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={keepCurrent}>Keep this understanding</button>
        <button type="button" className={buttonClass} onClick={useAnswer} disabled={!(drafts[component] ?? "").trim()}>Use my answer</button>
      </div>
    </fieldset> : waypoint ? <fieldset disabled={blocked} className="space-y-4 rounded-xl border border-cyan-300/50 p-3">
      <legend className="px-1 font-semibold text-slate-100">Review the complete understanding</legend>
      <dl className="space-y-4">{EXPLORER_WAYPOINT_COMPONENTS.map(key => <div key={key}>
        <dt className="font-semibold text-slate-200">{labels[key]}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-100">{answers[key] ?? waypoint[key]}</dd>
        {answers[key] === undefined ? <dd className="mt-1 text-xs text-slate-400">Kept from the saved understanding.</dd> : <dd className="mt-2 space-y-1 text-sm text-slate-300">
          <p className="font-semibold">Explorer clarification in this conversation</p>
          <p>Application question: {questions[key]}</p>
          <p className="whitespace-pre-wrap break-words">Your answer: {answers[key]}</p>
          <p className="text-xs text-slate-400">Earlier understanding: {waypoint[key]}</p>
        </dd>}
      </div>)}</dl>
      <details className="text-sm text-slate-300"><summary className="cursor-pointer text-cyan-200">Review the earlier saved source</summary>
        {state.messages.filter(message => message.id === waypoint.sourceMessageId).map(message => <blockquote key={message.id} className="mt-3 whitespace-pre-wrap break-words border-l-2 border-cyan-400 pl-3"><p className="mb-2 text-xs font-semibold">Exact saved source — {message.role === "explorer" ? "You" : "SolMind Virtual Guide"}</p>{message.body}</blockquote>)}
      </details>
      <p className="text-sm leading-6 text-slate-300">{review.kind === "revise_waypoint" ? "Confirmation saves a new version and keeps the earlier definition and sources in private history." : "Confirmation starts a new chosen lifecycle. Earlier Reached evidence and release history remain historical; they do not show current arrival."} Nothing is shared and no message is sent to an AI provider.</p>
      {review.kind === "revise_waypoint" && changedAnswers.length === 0 ? <p className="text-sm text-amber-200">You kept every component. Return to a question to clarify it, or close the draft without changing your saved Waypoint.</p> : null}
      <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed the complete understanding and its sources, and I confirm this {review.kind === "revise_waypoint" ? "revision" : "new current lifecycle"}.</label>
      <button type="button" className={buttonClass} disabled={!confirmed || (review.kind === "revise_waypoint" && changedAnswers.length === 0)} onClick={confirm}>{review.kind === "revise_waypoint" ? "Confirm revised Waypoint" : "Confirm new lifecycle"}</button>
    </fieldset> : null}
    <div className="flex flex-wrap gap-2">
      {step > 0 ? <button type="button" className={buttonClass} disabled={blocked} onClick={() => { setStep(value => value - 1); setConfirmed(false); setError(null); }}>Back to the previous question</button> : null}
      <button type="button" className={buttonClass} disabled={busy} onClick={onClose}>Close clarification without saving</button>
    </div>
  </section>;
}
