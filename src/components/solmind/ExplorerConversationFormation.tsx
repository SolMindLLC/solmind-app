"use client";

import { useId, useState, type FormEvent } from "react";
import {
  EXPLORER_CONVERSATION_LIMITS,
  type ExplorerConversationState,
  type ExplorerCompassAnchor,
  type ExplorerCompassArrangementItem,
} from "@/lib/solmind/explorerConversationContract";
import {
  buildAttentionFormationIntent,
  buildCompassFormationIntent,
  buildCompassArrangementFormationIntent,
  buildCompassCategoryFormationIntent,
  buildReachedFormationIntent,
  buildWaypointReleaseFormationIntent,
  buildWaypointFormationIntent,
  findFormationSource,
  currentCompassHeads,
  compassCategorySources,
  type ExplorerConversationFormationIntent,
  type FormationIntentResult,
} from "@/lib/solmind/explorerConversationFormation";

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
  { anchor: "apex", label: "Top position", className: "col-start-2 row-start-1" },
  { anchor: "upper_left", label: "Upper left", className: "col-start-1 row-start-2" },
  { anchor: "upper_right", label: "Upper right", className: "col-start-3 row-start-2" },
  { anchor: "side_left", label: "Detour — left", className: "col-start-1 row-start-3" },
  { anchor: "side_right", label: "Detour — right", className: "col-start-3 row-start-3" },
  { anchor: "lower_left", label: "Excursion — lower left", className: "col-start-1 row-start-4" },
  { anchor: "lower_center", label: "Excursion — lower center", className: "col-start-2 row-start-4" },
  { anchor: "lower_right", label: "Excursion — lower right", className: "col-start-3 row-start-4" },
];
const emphasisLabels = { 1: "Light", 2: "Regular", 3: "Strong" } as const;
function placementLabel(anchor: ExplorerCompassAnchor | null) {
  return compassPositions.find(position => position.anchor === anchor)?.label ?? "Other paths";
}
type ArrangementDraft = Readonly<{
  conversationId: string | null;
  revision: number;
  priorityId: string | null;
  items: readonly Readonly<{ compassItemId: string; anchor: ExplorerCompassAnchor | null; emphasis: 1 | 2 | 3 | null }>[];
}>;
type CategoryDraft = Readonly<{
  conversationId: string | null;
  revision: number;
  targetItemId: string;
  memberItemIds: readonly string[];
  label: string;
}>;
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

export function ExplorerConversationFormation({ state, busy, readOnly = false, onCommand }: ExplorerConversationFormationProps) {
  const id = useId();
  const [compassSource, setCompassSource] = useState("");
  const [label, setLabel] = useState("");
  const [waypointSource, setWaypointSource] = useState("");
  const [destination, setDestination] = useState("");
  const [meaning, setMeaning] = useState("");
  const [arrivalSignal, setArrivalSignal] = useState("");
  const [waypointConfirmed, setWaypointConfirmed] = useState(false);
  const [arrangementDraft, setArrangementDraft] = useState<ArrangementDraft | null>(null);
  const [arrangementConfirmed, setArrangementConfirmed] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [reachedReviewId, setReachedReviewId] = useState<string | null>(null);
  const [reachedEvidence, setReachedEvidence] = useState("");
  const [reachedConfirmed, setReachedConfirmed] = useState(false);
  const [releaseReview, setReleaseReview] = useState<WaypointReleaseReview | null>(null);
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPoints = currentCompassHeads(state);
  const priority = currentPoints.find(item => item.id === state.priorityId);
  const attention = currentPoints.find(item => item.id === state.attentionId);
  const hasArrangement = currentPoints.some(item => item.emphasis != null);
  const otherPaths = currentPoints.filter(item => item.anchor == null);
  const staleArrangement = arrangementDraft !== null &&
    (arrangementDraft.conversationId !== state.conversationId || arrangementDraft.revision !== state.revision);
  const draftPriority = currentPoints.find(item => item.id === arrangementDraft?.priorityId);
  const changingPriority = arrangementDraft !== null && arrangementDraft.priorityId !== state.priorityId;
  const arrangementIssues: string[] = [];
  if (arrangementDraft !== null) {
    const usedAnchors = new Set<ExplorerCompassAnchor>();
    let duplicateAnchor = false;
    for (const item of arrangementDraft.items) {
      if (item.anchor !== null) {
        if (usedAnchors.has(item.anchor)) duplicateAnchor = true;
        usedAnchors.add(item.anchor);
      }
    }
    if (duplicateAnchor) arrangementIssues.push("Choose a different location for each visible point; no point will be moved automatically.");
    if (arrangementDraft.items.some(item => item.emphasis === null)) arrangementIssues.push("Choose relative emphasis for every point, including Other paths.");
    if (arrangementDraft.priorityId !== null && arrangementDraft.items.find(item => item.compassItemId === arrangementDraft.priorityId)?.anchor !== "apex") {
      arrangementIssues.push("Place the proposed Priority at the top position before confirming.");
    }
    if (state.attentionId !== null && arrangementDraft.items.find(item => item.compassItemId === state.attentionId)?.anchor == null) {
      arrangementIssues.push("Keep the current attention point in a visible position.");
    }
  }
  const reachedReview = state.waypoints.find(item => item.id === reachedReviewId && item.status === "chosen" && item.release === undefined);
  const releaseWaypoint = state.waypoints.find(item => item.id === releaseReview?.waypointId);
  const staleRelease = releaseReview !== null && (releaseReview.conversationId !== state.conversationId ||
    releaseReview.revision !== state.revision || releaseWaypoint === undefined || releaseWaypoint.status !== "chosen" ||
    releaseWaypoint.release !== undefined || state.sessionStatus !== "active");
  const hasSource = state.conversationId !== null && state.messages.length > 0;
  const route = state.route ?? [];
  const categoryTarget = currentPoints.find(item => item.id === categoryDraft?.targetItemId);
  const staleCategory = categoryDraft !== null &&
    (categoryDraft.conversationId !== state.conversationId || categoryDraft.revision !== state.revision);
  const categoryMembers = categoryDraft === null ? [] : currentPoints.filter(item => categoryDraft.memberItemIds.includes(item.id));
  const categorySources = categoryDraft === null ? [] : state.compassItems.filter(item =>
    categoryMembers.some(member => compassCategorySources(state, member.id).some(source => source.id === item.id)));
  const categorySelectionConflict = categoryDraft !== null &&
    [state.priorityId, state.attentionId].some(selectedId => selectedId !== null &&
      selectedId !== categoryDraft.targetItemId && categoryDraft.memberItemIds.includes(selectedId));
  const categoryUnchanged = categoryDraft !== null && categoryDraft.memberItemIds.length === 1 && categoryDraft.label.trim() === categoryTarget?.label;

  function submit(result: FormationIntentResult) {
    if (busy || readOnly) return;
    setError(result.error);
    if (result.ok) onCommand(result.command);
  }
  function reviewWaypointRelease(waypointId: string) {
    if (busy || readOnly || state.pendingTurn || !state.conversationId || state.sessionStatus !== "active") return;
    const waypoint = state.waypoints.find(item => item.id === waypointId);
    if (!waypoint || waypoint.status !== "chosen" || waypoint.release !== undefined) return;
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
  function addCompass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(buildCompassFormationIntent(state, { sourceMessageId: compassSource, label }));
  }
  function reviewArrangement(priorityId = state.priorityId) {
    if (busy || readOnly) return;
    setArrangementDraft({ conversationId: state.conversationId, revision: state.revision, priorityId,
      items: currentPoints.map(item => ({ compassItemId: item.id,
        anchor: item.anchor ?? null, emphasis: item.emphasis ?? null })) });
    setArrangementConfirmed(false);
    setError(null);
  }
  function editArrangementItem(compassItemId: string, patch: Partial<Pick<ArrangementDraft["items"][number], "anchor" | "emphasis">>) {
    setArrangementDraft(draft => draft === null ? null : { ...draft,
      items: draft.items.map(item => item.compassItemId === compassItemId ? { ...item, ...patch } : item) });
    setArrangementConfirmed(false);
    setError(null);
  }
  function confirmArrangement() {
    if (busy || readOnly || arrangementDraft === null) return;
    if (staleArrangement) {
      setError("Your saved Compass changed. Open a new arrangement review before confirming.");
      return;
    }
    const items: ExplorerCompassArrangementItem[] = [];
    for (const item of arrangementDraft.items) {
      if (item.emphasis === null) {
        setError("Choose relative emphasis for every point, including Other paths, before confirming.");
        return;
      }
      items.push({ compassItemId: item.compassItemId, anchor: item.anchor, emphasis: item.emphasis });
    }
    submit(buildCompassArrangementFormationIntent(state, arrangementDraft.priorityId, items, arrangementConfirmed));
  }
  function reviewCategory(targetItemId: string) {
    if (busy || readOnly) return;
    const target = currentPoints.find(item => item.id === targetItemId);
    if (!target) return;
    setCategoryDraft({ conversationId: state.conversationId, revision: state.revision,
      targetItemId, memberItemIds: [targetItemId], label: target.label });
    setCategoryConfirmed(false);
    setError(null);
  }
  function editCategory(patch: Partial<Pick<CategoryDraft, "memberItemIds" | "label">>) {
    setCategoryDraft(draft => draft === null ? null : { ...draft, ...patch });
    setCategoryConfirmed(false);
    setError(null);
  }
  function confirmCategory() {
    if (busy || readOnly || categoryDraft === null) return;
    if (staleCategory) {
      setError("Your saved Compass changed. Open a new category review before confirming.");
      return;
    }
    submit(buildCompassCategoryFormationIntent(state, {
      targetItemId: categoryDraft.targetItemId, memberItemIds: categoryDraft.memberItemIds,
      label: categoryDraft.label, confirmed: categoryConfirmed,
    }));
  }
  function pointCard(item: ExplorerConversationState["compassItems"][number]) {
    const emphasisClass = item.emphasis === 3 ? "text-lg font-bold" : item.emphasis === 1 ? "text-sm font-medium" : "font-semibold";
    const attentionUnavailable = hasArrangement && item.anchor == null;
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
          <p>{source.label}{source.id === item.id ? " — current category" : " — retained source point"}</p>
          <SavedSource state={state} sourceMessageId={source.sourceMessageId} />
        </li>)}</ul>
      </details> : null}
      {!readOnly ? <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${buttonClass} max-w-full break-words text-left`} disabled={busy || state.priorityId === item.id} onClick={() => reviewArrangement(item.id)}>Review Priority: {item.label}</button>
        <button type="button" className={`${buttonClass} max-w-full break-words text-left`} disabled={busy || state.attentionId === item.id || attentionUnavailable} onClick={() => submit(buildAttentionFormationIntent(state, item.id))}>Attend to: {item.label}</button>
        <button type="button" className={`${buttonClass} max-w-full break-words text-left`} disabled={busy} onClick={() => reviewCategory(item.id)}>Review wording or combine: {item.label}</button>
      </div> : null}
      {!readOnly && attentionUnavailable && state.attentionId !== item.id ? <p className="mt-2 text-xs text-slate-400">Arrange this point visibly before moving attention here.</p> : null}
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
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Higher positions express relative priority. Side positions are Detours; lower positions are Excursions.
          Light, Regular and Strong express your relative emphasis, not a score. Priority stays at the top once confirmed.
        </p>
        {currentPoints.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Discovery mode — no topic or Priority has been invented.</p>
        ) : <>
          <section aria-label="Saved Compass arrangement" className="mt-4 overflow-x-auto">
            <div className="grid min-w-[34rem] grid-cols-3 gap-3">
              {compassPositions.map(position => {
                const item = currentPoints.find(point => point.anchor === position.anchor);
                return <div key={position.anchor} className={`min-w-0 ${position.className}`}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-300">{position.label}</h3>
                  {item ? pointCard(item) : <p className="rounded-2xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">No point placed here</p>}
                  {position.anchor === "apex" && item && state.priorityId === null ? <p className="mt-2 text-xs text-amber-200">No Priority confirmed — placement alone does not confirm it.</p> : null}
                </div>;
              })}
            </div>
          </section>
          <details className="mt-4 rounded-2xl border border-slate-700 p-4">
            <summary className="cursor-pointer font-semibold text-slate-100">Other paths ({otherPaths.length})</summary>
            <p className="mt-2 text-sm text-slate-300">Saved points outside the visible Compass, including points awaiting an arrangement. Every saved source remains reviewable.</p>
            {otherPaths.length === 0 ? <p className="mt-3 text-sm text-slate-400">No other paths are saved.</p> : <ul className="mt-3 space-y-3">{otherPaths.map(item => <li key={item.id}>{pointCard(item)}</li>)}</ul>}
          </details>
          {!readOnly ? <button type="button" className={`${buttonClass} mt-4`} disabled={busy} onClick={() => reviewArrangement()}>Review Compass arrangement</button> : null}
        </>}
        {!readOnly && arrangementDraft ? (
          <fieldset disabled={busy || staleArrangement} className="mt-4 space-y-4 rounded-2xl border border-amber-300/50 p-4">
            <legend className="px-1 font-semibold text-slate-100">Review Compass arrangement</legend>
            <p className="text-sm leading-6 text-slate-300">Choose each location and relative emphasis. Up to eight points can be visible; all remaining points stay in Other paths. No point is moved automatically.</p>
            <p className="break-words text-sm text-cyan-200">Current attention stays on: {attention?.label ?? "No attention point chosen"}. A chosen attention point must remain visible.</p>
            {staleArrangement ? <p role="alert" className="text-sm text-amber-200">Your saved Compass changed. Close this review and open a new one before confirming.</p> : null}
            <label htmlFor={`${id}-arrangement-priority`} className="block text-sm text-slate-200">Priority for this arrangement
              <select id={`${id}-arrangement-priority`} className={inputClass} value={arrangementDraft.priorityId ?? ""} onChange={event => {
                setArrangementDraft({ ...arrangementDraft, priorityId: event.target.value || null });
                setArrangementConfirmed(false); setError(null);
              }}>
                {state.priorityId === null ? <option value="">No Priority confirmed</option> : null}
                {currentPoints.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {changingPriority ? <p className="break-words rounded-xl border border-amber-300/50 p-3 text-sm text-amber-100">Priority will change from “{priority?.label ?? "No Priority confirmed"}” to “{draftPriority?.label ?? "No Priority confirmed"}”. Place the new Priority at the top and explicitly relocate any point already there. Current attention remains separate.</p> : <p className="text-sm text-slate-300">{priority ? "Your existing Priority must remain at the top and cannot be cleared here." : "A point at the top does not become Priority unless you explicitly choose and confirm it."}</p>}
            <ul className="space-y-4">{arrangementDraft.items.map((draftItem, index) => {
              const point = currentPoints.find(item => item.id === draftItem.compassItemId);
              if (!point) return null;
              return <li key={draftItem.compassItemId} className="rounded-xl border border-slate-700 p-3">
                <h3 className="break-words font-semibold text-slate-100">{point.label}</h3>
                <p className="mt-1 text-xs text-slate-300">{point.id === arrangementDraft.priorityId ? "Proposed Priority. " : ""}{point.id === state.attentionId ? "Current attention. " : ""}Preview: {placementLabel(draftItem.anchor)}; {draftItem.emphasis === null ? "relative emphasis not chosen" : emphasisLabels[draftItem.emphasis]}.</p>
                <label htmlFor={`${id}-location-${index}`} className="mt-3 block text-sm text-slate-200">Location for {point.label}
                  <select id={`${id}-location-${index}`} className={inputClass} value={draftItem.anchor ?? ""} onChange={event => editArrangementItem(point.id, { anchor: event.target.value === "" ? null : event.target.value as ExplorerCompassAnchor })}>
                    <option value="">Other paths</option>
                    {compassPositions.map(position => <option key={position.anchor} value={position.anchor}>{position.label}</option>)}
                  </select>
                </label>
                <label htmlFor={`${id}-emphasis-${index}`} className="mt-3 block text-sm text-slate-200">Relative emphasis for {point.label}
                  <select id={`${id}-emphasis-${index}`} className={inputClass} value={draftItem.emphasis ?? ""} onChange={event => editArrangementItem(point.id, { emphasis: event.target.value === "" ? null : Number(event.target.value) as 1 | 2 | 3 })}>
                    <option value="">Choose relative emphasis</option>
                    <option value="1">Light</option><option value="2">Regular</option><option value="3">Strong</option>
                  </select>
                </label>
              </li>;
            })}</ul>
            {arrangementIssues.length > 0 ? <ul aria-label="Arrangement items to resolve" className="list-disc space-y-2 rounded-xl border border-amber-300/50 p-4 pl-8 text-sm text-amber-100">{arrangementIssues.map(issue => <li key={issue}>{issue}</li>)}</ul> : null}
            <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={arrangementConfirmed} onChange={event => setArrangementConfirmed(event.target.checked)} />{changingPriority ? "I reviewed the new Priority, every placement and relative emphasis, and the unchanged current attention." : "I reviewed every placement and relative emphasis, the Priority choice, and the unchanged current attention."}</label>
            <button type="button" className={buttonClass} disabled={!arrangementConfirmed || arrangementIssues.length > 0} onClick={confirmArrangement}>{changingPriority ? "Confirm new Priority and arrangement" : "Confirm arrangement"}</button>
          </fieldset>
        ) : null}
        {!readOnly && arrangementDraft ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setArrangementDraft(null); setArrangementConfirmed(false); setError(null); }}>Close arrangement review</button> : null}
        {!readOnly && categoryDraft ? <fieldset disabled={busy || staleCategory} className="mt-5 space-y-4 rounded-2xl border border-amber-300/50 p-4">
          <legend className="px-1 font-semibold text-slate-100">Review category wording and sources</legend>
          <p className="text-sm leading-6 text-slate-300">Update this point&apos;s wording, or combine selected current points under it. This changes your Compass only; no message is sent and nothing is shared.</p>
          <p className="break-words text-sm text-slate-200">Current wording: {categoryTarget?.label ?? "This saved point is no longer current"}</p>
          <label htmlFor={`${id}-category-label`} className="block text-sm text-slate-200">Wording after this change
            <input id={`${id}-category-label`} className={inputClass} value={categoryDraft.label} onChange={event => editCategory({ label: event.target.value })} maxLength={EXPLORER_CONVERSATION_LIMITS.labelCharacters} required />
          </label>
          <fieldset className="space-y-3 rounded-xl border border-slate-700 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-200">Current points to include</legend>
            {currentPoints.map(item => <label key={item.id} className="flex items-start gap-3 break-words text-sm text-slate-200">
              <input type="checkbox" className="mt-1" checked={categoryDraft.memberItemIds.includes(item.id)} disabled={item.id === categoryDraft.targetItemId} onChange={event => editCategory({ memberItemIds: event.target.checked
                ? [...categoryDraft.memberItemIds, item.id] : categoryDraft.memberItemIds.filter(memberId => memberId !== item.id) })} />
              <span>{item.label}{item.id === categoryDraft.targetItemId ? " — keep this point as the category" : ""}{item.id === state.priorityId ? "; confirmed Priority" : ""}{item.id === state.attentionId ? "; current attention" : ""}</span>
            </label>)}
          </fieldset>
          <p className="break-words rounded-xl border border-cyan-300/40 p-3 text-sm text-cyan-100">Proposed wording: {categoryDraft.label.trim() || "Enter wording above"}. Keep {categoryTarget?.anchor == null ? "Other paths" : placementLabel(categoryTarget.anchor)}; relative emphasis: {categoryTarget?.emphasis == null ? "not recorded" : emphasisLabels[categoryTarget.emphasis]}.</p>
          <p className="break-words text-sm text-slate-300">Priority stays on: {priority?.id === categoryDraft.targetItemId ? categoryDraft.label.trim() || priority.label : priority?.label ?? "No Priority confirmed"}. Current attention stays on: {attention?.id === categoryDraft.targetItemId ? categoryDraft.label.trim() || attention.label : attention?.label ?? "No attention point chosen"}.</p>
          {categoryTarget?.id === state.priorityId || categoryTarget?.id === state.attentionId ? <p className="rounded-xl border border-amber-300/50 p-3 text-sm text-amber-100">You are changing the meaning of a point selected as Priority or current attention. Review the new wording explicitly; the selection will stay on this point.</p> : null}
          {categorySelectionConflict ? <p role="alert" className="rounded-xl border border-amber-300/50 p-3 text-sm text-amber-100">One of the other selected points is Priority or current attention. Move that selection explicitly first, then open a new category review. It will not transfer automatically.</p> : null}
          <details className="rounded-xl border border-slate-700 p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-cyan-200">Review all contributing saved sources ({categorySources.length})</summary>
            <ul className="mt-3 space-y-3">{categorySources.map(item => <li key={item.id} className="break-words text-sm text-slate-200">
              <p>{item.label}{categoryDraft.memberItemIds.includes(item.id) ? " — selected current point" : " — retained source point"}</p>
              <SavedSource state={state} sourceMessageId={item.sourceMessageId} />
            </li>)}</ul>
          </details>
          <p className="text-sm text-slate-300">Original points and sources remain saved. Combining is one-way in this private demo: it does not free a saved-point slot, and there is no split action here.</p>
          {categoryDraft.memberItemIds.length > 1 ? <p className="text-sm text-slate-300">The other selected points will become retained source points of this category, rather than separate points on the Compass or in Other paths. Their saved sources remain reviewable.</p> : null}
          {staleCategory ? <p role="alert" className="text-sm text-amber-200">Your saved Compass changed. Close this review and open a new one before confirming.</p> : null}
          <label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-1" checked={categoryConfirmed} onChange={event => setCategoryConfirmed(event.target.checked)} />I reviewed the wording, all contributing sources, the unchanged placement and emphasis, and the Priority and current attention selections.</label>
          <button type="button" className={buttonClass} disabled={!categoryConfirmed || !categoryDraft.label.trim() || categoryUnchanged || categorySelectionConflict} onClick={confirmCategory}>{categoryDraft.memberItemIds.length > 1 ? "Confirm combined category" : "Confirm category wording"}</button>
        </fieldset> : null}
        {!readOnly && categoryDraft ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setCategoryDraft(null); setCategoryConfirmed(false); setError(null); }}>Close category review</button> : null}
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
                      ? `Priority changed from “${entry.items.find(item => item.compassItemId === entry.previousPriorityId)?.label ?? "No Priority confirmed"}” to “${entry.items.find(item => item.compassItemId === entry.priorityId)?.label ?? "No Priority confirmed"}”.`
                      : entry.priorityId === null ? "No Priority confirmed." : `Priority retained: ${entry.items.find(item => item.compassItemId === entry.priorityId)?.label ?? "Recorded Priority"}.`}</p>
                    <details className="mt-2"><summary className="cursor-pointer text-cyan-200">Review recorded placement and emphasis</summary>
                      <ul className="mt-2 space-y-2">{entry.items.map(item => <li key={item.compassItemId} className="break-words">{item.label} — {placementLabel(item.anchor)}; {emphasisLabels[item.emphasis]}.</li>)}</ul>
                    </details>
                  </> : entry.kind === "category_confirmed" ? <>
                    <p className="font-semibold text-slate-200">{entry.change.memberItemIds.length > 1 ? "Categories combined" : "Category wording updated"}</p>
                    <p className="mt-1">Confirmed wording: {entry.change.label}</p>
                    <details className="mt-2"><summary className="cursor-pointer text-cyan-200">Review recorded wording and sources</summary>
                      <ul className="mt-2 space-y-3">{entry.change.beforeItems.map(item => <li key={item.compassItemId} className="break-words">
                        <p>{item.label}{entry.change.memberItemIds.includes(item.compassItemId) ? " — selected point before this change" : " — retained contributing point"}; {placementLabel(item.anchor)}; {item.emphasis === null ? "relative emphasis not recorded" : emphasisLabels[item.emphasis]}.</p>
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
        {!readOnly ? <form onSubmit={addCompass} className="mt-5 border-t border-slate-700 pt-4">
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
          <p className="mt-3 text-sm text-slate-400">New points stay in Other paths with no recorded placement or emphasis until you confirm an arrangement.</p>
          {!hasSource ? <p className="mt-3 text-sm text-slate-400">A saved conversation message is needed before adding a point.</p> : null}
          {state.compassItems.length >= EXPLORER_CONVERSATION_LIMITS.compassItems ? <p className="mt-3 text-sm text-slate-400">This private demo stores at most {EXPLORER_CONVERSATION_LIMITS.compassItems} points. All saved points remain available; another cannot be added here.</p> : null}
        </form> : null}
      </section>

      <section aria-labelledby={`${id}-waypoints-title`} className={panelClass}>
        <h2 id={`${id}-waypoints-title`} className="text-xl font-semibold text-slate-100">Private Waypoints</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">A Waypoint is a meaningful place you choose to reach. It is optional, and it is not a task or a score.</p>
        {state.waypoints.length === 0 ? <p className="mt-3 text-sm text-slate-300">No Waypoint chosen. You can keep exploring without one.</p> : (
          <ul className="mt-4 space-y-4">{state.waypoints.map(waypoint => (
            <li key={waypoint.id} className="rounded-2xl border border-slate-700 p-4">
              <h3 className="break-words font-semibold text-slate-100">{waypoint.destination}</h3>
              <p className="mt-1 text-xs font-semibold text-cyan-200">{waypoint.release !== undefined ? "Released — kept in your private history" : waypoint.status === "reached" ? "Reached — confirmed by you" : "In progress — chosen by you"}</p>
              <dl className="mt-3 space-y-3 text-sm"><div><dt className="font-semibold text-slate-200">Why it matters</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.meaning}</dd></div><div><dt className="font-semibold text-slate-200">Arrival signal</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-300">{waypoint.arrivalSignal}</dd></div></dl>
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
              {waypoint.status === "chosen" && waypoint.release === undefined ? (!readOnly ? <button type="button" className={`${buttonClass} mt-3`} disabled={busy} onClick={() => { setReachedReviewId(waypoint.id); setReachedEvidence(""); setReachedConfirmed(false); setError(null); }}>Review Reached: {waypoint.destination}</button> : null) : waypoint.status === "reached" ? <p className="mt-3 text-sm text-slate-300">Meaningful progress does not mean your journey is over.</p> : null}
              {!readOnly && state.conversationId !== null && state.sessionStatus === "active" && waypoint.status === "chosen" && waypoint.release === undefined ? <button type="button" className={`${buttonClass} mt-3 ml-2`} disabled={busy || state.pendingTurn} onClick={() => reviewWaypointRelease(waypoint.id)}>Review release: {waypoint.destination}</button> : null}
            </li>
          ))}</ul>
        )}
        {!readOnly && releaseReview !== null ? <fieldset disabled={busy || state.pendingTurn || staleRelease} className="mt-4 space-y-3 rounded-2xl border border-amber-300/50 p-4">
          <legend className="px-1 font-semibold text-slate-100">Review before releasing this Waypoint</legend>
          {releaseWaypoint ? <>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Destination: {releaseWaypoint.destination}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Why it matters: {releaseWaypoint.meaning}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Arrival signal: {releaseWaypoint.arrivalSignal}</p>
            <SavedSource state={state} sourceMessageId={releaseWaypoint.sourceMessageId} />
          </> : null}
          <p className="text-sm leading-6 text-slate-300">Releasing stops treating this Waypoint as in progress. Its definition, saved source and history stay available and private. This does not mark it Reached, end the conversation or share anything.</p>
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
        </form> : null}
      </section>
    </aside>
  );
}
