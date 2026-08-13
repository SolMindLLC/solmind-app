"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  createGuideSuggestedWaypointFixtures,
  GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
} from "../../lib/solmind/guideSuggestedWaypointFixtures";
import {
  projectSuggestedWaypointForGuide,
  pullBackSuggestedWaypoint,
  scheduleSuggestedWaypointSend,
  withdrawSuggestedWaypoint,
  type SuggestedWaypointResult,
  type SuggestedWaypointState,
} from "../../lib/solmind/suggestedWaypoints";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type RecordKey = "draft" | "pending" | "open" | "acknowledged";
type WorkspaceView = "list" | "detail";

const RECORD_ORDER: readonly RecordKey[] = [
  "draft",
  "pending",
  "open",
  "acknowledged",
];

const applyResult = (
  result: SuggestedWaypointResult,
  onApplied: (state: SuggestedWaypointState) => void,
  setNotice: (notice: string) => void,
) => {
  if (result.kind === "rejected") {
    setNotice(`That action is no longer available (${result.code}). No outward effect occurred.`);
    return false;
  }
  onApplied(result.state);
  return true;
};

export function GuideSuggestedWaypointWorkspace() {
  const [records, setRecords] = useState(createGuideSuggestedWaypointFixtures);
  const [view, setView] = useState<WorkspaceView>("list");
  const [selectedKey, setSelectedKey] = useState<RecordKey>("draft");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [withdrawalConfirming, setWithdrawalConfirming] = useState(false);
  const [notice, setNotice] = useState(
    "This is a deterministic local review surface. Refreshing resets it.",
  );
  const selected = records[selectedKey];
  const selectedProjection = useMemo(
    () =>
      projectSuggestedWaypointForGuide(
        selected,
        GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 32_000,
      ),
    [selected],
  );

  const updateSelected = (state: SuggestedWaypointState) => {
    setRecords((current) => ({ ...current, [selectedKey]: state }));
  };

  const openRecord = (key: RecordKey) => {
    setSelectedKey(key);
    setView("detail");
    setWithdrawalConfirming(false);
    setNotice("Opened the selected local preview. No message or notification was sent.");
  };

  const showDestination = (label: string) => {
    setNavigationOpen(false);
    setNotice(`${label} will open its Guide workspace destination when that route is implemented.`);
  };

  const sendSelected = () => {
    if (selected.authoring.mode !== "draft") {
      setNotice("Only an editable draft can enter the Pull Back grace period.");
      return;
    }
    const result = scheduleSuggestedWaypointSend(selected, {
      operationId: `preview-schedule-${selected.suggestionId}-${selected.authoring.revision}`,
      versionId: `${selected.suggestionId}-preview-v${selected.authoring.revision}`,
      expectedRevision: selected.authoring.revision,
      nowMs: GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
      policyVersion: "guide-preview-policy-v1",
      timing: {
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
      },
    });
    if (applyResult(result, updateSelected, setNotice)) {
      setView("list");
      setNotice("Preview scheduled. Avery cannot see it during the five-minute Pull Back period. No real send occurred.");
    }
  };

  const pullBackSelected = () => {
    const result = pullBackSuggestedWaypoint(
      selected,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 32_000,
    );
    if (applyResult(result, updateSelected, setNotice)) {
      setView("detail");
      setNotice("Pulled back before delivery. The normal editable detail is open; Avery never saw this preview.");
    }
  };

  const confirmWithdrawal = () => {
    const result = withdrawSuggestedWaypoint(
      selected,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 900_000,
    );
    if (applyResult(result, updateSelected, setNotice)) {
      setWithdrawalConfirming(false);
      setNotice("Preview withdrawn. The response channel is closed; history remains and no Explorer-owned Waypoint changed.");
    }
  };

  const renderPills = (state: SuggestedWaypointState) => {
    const projection = projectSuggestedWaypointForGuide(
      state,
      GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 32_000,
    );
    if (projection.authoringMode === "pending") {
      return (
        <>
          <SuggestedWaypointStatusPill tone="attention">⌛ Pending send</SuggestedWaypointStatusPill>
          <SuggestedWaypointStatusPill tone="attention">↩ Pull Back available</SuggestedWaypointStatusPill>
        </>
      );
    }
    if (projection.channelStatus === "withdrawn") {
      return <SuggestedWaypointStatusPill tone="neutral">⊘ Withdrawn</SuggestedWaypointStatusPill>;
    }
    if (projection.channelStatus === "open") {
      return (
        <>
          <SuggestedWaypointStatusPill tone="positive">✉ Open suggestion</SuggestedWaypointStatusPill>
          {projection.receipts.length ? (
            <SuggestedWaypointStatusPill tone="positive">☑ Receipt acknowledged Aug 12</SuggestedWaypointStatusPill>
          ) : (
            <SuggestedWaypointStatusPill tone="neutral">○ No response</SuggestedWaypointStatusPill>
          )}
        </>
      );
    }
    return (
      <>
        <SuggestedWaypointStatusPill tone="private">✎ Draft</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone="positive">✓ Autosaved</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone="private">🔒 Guide-only</SuggestedWaypointStatusPill>
      </>
    );
  };

  const selectedContent =
    selected.authoring.mode === "pending"
      ? selected.authoring.lockedContent
      : selectedProjection.currentVersion?.content ?? selected.authoring.content;

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-slate-900">
      <button
        type="button"
        className="fixed left-3 top-3 z-30 rounded-md bg-[#174b4d] px-3 py-2 text-sm font-semibold text-white shadow lg:hidden"
        aria-expanded={navigationOpen}
        aria-controls="guide-suggestion-navigation"
        onClick={() => setNavigationOpen((current) => !current)}
      >
        {navigationOpen ? "Close menu" : "Open menu"}
      </button>

      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside
          id="guide-suggestion-navigation"
          className={`${navigationOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-20 w-64 flex-col bg-[#174b4d] px-4 pb-6 pt-16 text-white shadow-xl lg:static lg:flex lg:w-64 lg:pt-5 lg:shadow-none`}
        >
          <Image
            src="/solmind-light-logo.png"
            alt="SolMind"
            width={185}
            height={134}
            className="mb-6 h-auto w-full max-w-[185px] rounded-md bg-white object-contain"
            priority
          />
          <p className="mb-4 text-sm text-teal-50">Guide workspace</p>
          <nav aria-label="Guide navigation" className="space-y-2">
            <a className="block rounded-lg px-4 py-2 hover:bg-white/15" href="/guide">Dashboard</a>
            <button type="button" className="w-full rounded-lg bg-white/15 px-4 py-2 text-left font-semibold" onClick={() => { setView("list"); setNavigationOpen(false); }}>Explorers</button>
            <button type="button" className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" onClick={() => showDestination("Chat with Steve")}>Chat with Steve</button>
            <button type="button" className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" onClick={() => showDestination("Appointments")}>Appointments</button>
            <button type="button" className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" onClick={() => showDestination("Archive")}>Archive</button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-16 pt-20 sm:px-8 lg:px-12 lg:pt-8">
          <div className="mb-8 border-b border-slate-300 pb-5">
            <p className="font-medium">Morgan Lee · Guide workspace</p>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600" aria-label="Breadcrumb">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 hover:bg-teal-50" onClick={() => showDestination("Explorers")}>Explorers</button>
            <span aria-hidden="true">/</span>
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 hover:bg-teal-50" onClick={() => { setView("list"); setNavigationOpen(false); }}>Avery Chen</button>
            <span aria-hidden="true">/</span>
            <span>Waypoint Suggestions</span>
          </div>

          {view === "list" ? (
            <section aria-labelledby="guide-suggestion-list-title">
              <p className="text-sm font-semibold text-[#1d6768]">Avery Chen</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 id="guide-suggestion-list-title" className="text-3xl font-semibold">Waypoint Suggestions</h1>
                  <p className="mt-2 text-slate-600">Drafts, pending sends, open suggestions, and history for Avery.</p>
                </div>
                <button type="button" className="rounded-lg bg-[#176a6c] px-4 py-2.5 font-semibold text-white hover:bg-[#125456]" onClick={() => openRecord("draft")}>Compose suggestion</button>
              </div>

              <div className="mt-7 space-y-3">
                {RECORD_ORDER.map((key) => {
                  const state = records[key];
                  const projection = projectSuggestedWaypointForGuide(
                    state,
                    GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 32_000,
                  );
                  const content = state.authoring.mode === "pending" ? state.authoring.lockedContent : projection.currentVersion?.content ?? state.authoring.content;
                  return (
                    <button
                      key={key}
                      type="button"
                      className="w-full rounded-xl border border-slate-300 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#227a7c] hover:bg-teal-50/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#227a7c]"
                      onClick={() => openRecord(key)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl">
                          <p className="font-semibold">{content.destination}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {projection.authoringMode === "pending"
                              ? "Avery cannot see it until the grace period ends."
                              : projection.channelStatus === "open"
                                ? "Sent Aug 12"
                                : "Avery cannot see this draft. Open to review, edit, send, or delete."}
                          </p>
                        </div>
                        <div className="flex max-w-md flex-wrap justify-end gap-2">{renderPills(state)}</div>
                      </div>
                      {projection.authoringMode === "pending" && (
                        <p className="mt-3 text-right text-sm font-semibold text-amber-800">Avery can see it in 4:28</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section aria-labelledby="guide-suggestion-detail-title" className="max-w-5xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1d6768]">Waypoint Suggestion for Avery</p>
                  <h1 id="guide-suggestion-detail-title" className="mt-2 text-3xl font-semibold">{selectedContent.destination}</h1>
                </div>
                <div className="flex flex-wrap gap-2">{renderPills(selected)}</div>
              </div>

              {selectedProjection.authoringMode === "pending" ? (
                <div className="mt-7 rounded-xl border-2 border-amber-500 bg-amber-50 p-6">
                  <h2 className="text-xl font-semibold">Pull Back period · 4:28 remaining</h2>
                  <p className="mt-3 text-slate-700">Avery cannot see this version yet. Pull Back returns it to the normal editable detail.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className="rounded-lg bg-amber-700 px-4 py-2.5 font-semibold text-white hover:bg-amber-800" onClick={pullBackSelected}>Pull Back</button>
                    <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => setNotice("Expedited delivery will open a separate certification step: ‘I certify that Avery is the correct recipient and this suggestion is correct and appropriate.’")}>Why not send immediately?</button>
                  </div>
                </div>
              ) : (
                <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <article className="rounded-xl border border-slate-300 bg-white p-5">
                    <h2 className="font-semibold">Possible Waypoint destination</h2>
                    <p className="mt-2 text-slate-700">{selectedContent.destination}</p>
                    <h2 className="mt-5 font-semibold">Why this may help</h2>
                    <p className="mt-2 text-slate-700">{selectedContent.why}</p>
                    <h2 className="mt-5 font-semibold">Possible arrival signal</h2>
                    <p className="mt-2 text-slate-700">{selectedContent.arrivalSignals[0]}</p>
                  </article>
                  <aside className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                    <h2 className="font-semibold">What Avery would receive</h2>
                    <p className="mt-3 font-semibold">{selectedContent.destination}</p>
                    <p className="mt-2 text-sm text-slate-700">A suggestion from Morgan, not an assignment.</p>
                    <p className="mt-4 text-sm text-slate-700">Avery’s private viewing, comparison, questions, and Waypoints never appear here.</p>
                  </aside>
                </div>
              )}

              {selectedProjection.channelStatus === "not-delivered" && selectedProjection.authoringMode === "draft" && (
                <>
                  <div className="mt-5 rounded-xl border border-slate-300 bg-white p-5">
                    <h2 className="font-semibold">Work with Steve (SolMind Virtual Assistant)</h2>
                    <p className="mt-2 text-sm text-slate-600">Steve cannot access information Avery chose to keep private. Any inserted text remains your suggestion to review.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {[
                        "Suggest possibilities",
                        "Help me draft",
                        "Review my draft",
                      ].map((label) => (
                        <button key={label} type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => setNotice(`${label} will open a bounded conversation with Steve when that route is implemented.`)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
                    <h2 className="font-semibold">Please review before sending to Avery</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                      <li>Avery is the intended recipient.</li>
                      <li>The wording and arrival signal are correct and appropriate.</li>
                      <li>This is a suggestion, not an assignment.</li>
                    </ul>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button type="button" className="rounded-lg bg-[#176a6c] px-4 py-2.5 font-semibold text-white hover:bg-[#125456]" onClick={sendSelected}>Send suggestion</button>
                    <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => { setView("list"); setNotice("Draft saved locally in this preview. No real save or send occurred."); }}>Save and close</button>
                    <button type="button" className="ml-auto rounded-lg border border-rose-400 bg-white px-4 py-2.5 font-semibold text-rose-800 hover:bg-rose-50" onClick={() => setNotice("Delete draft will start a separate recoverable five-minute pending-deletion period; no deletion occurred in this preview.")}>Delete draft</button>
                  </div>
                </>
              )}

              {selectedProjection.channelStatus === "open" && (
                <div className="mt-6 rounded-xl border border-slate-300 bg-white p-5">
                  <h2 className="font-semibold">Status Avery deliberately shared</h2>
                  <p className="mt-2 text-slate-700">
                    {selectedProjection.receipts.length
                      ? "Avery acknowledged receipt on Aug 12. This does not imply agreement."
                      : "No response. SolMind does not report passive opens or guess why Avery has not responded."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => setNotice("A linked correction draft will open beside this immutable delivered version when correction authoring is implemented.")}>Send corrected version</button>
                    <button type="button" className="rounded-lg border border-rose-400 bg-white px-4 py-2.5 font-semibold text-rose-800 hover:bg-rose-50" onClick={() => { setWithdrawalConfirming(true); setNotice("Review the withdrawal effect before confirming. Nothing has changed yet."); }}>Withdraw suggestion</button>
                    <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => { setView("list"); setNotice("Archive will change only Morgan’s list when Guide-only archive persistence is implemented."); }}>Archive in my Guide list</button>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Withdrawal closes the response channel and preserves history. Archive changes only Morgan’s list. Neither action changes an Avery-owned Waypoint.</p>
                  {withdrawalConfirming && (
                    <div className="mt-5 rounded-lg border-2 border-rose-400 bg-rose-50 p-4" role="group" aria-label="Confirm withdrawal">
                      <p className="font-semibold">Withdraw this suggestion?</p>
                      <p className="mt-2 text-sm text-slate-700">Avery will see that the suggestion was withdrawn, the response channel will close, and both people keep the history. Any Avery-owned Waypoint remains unchanged.</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" className="rounded-lg bg-rose-700 px-4 py-2.5 font-semibold text-white hover:bg-rose-800" onClick={confirmWithdrawal}>Confirm withdrawal</button>
                        <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => { setWithdrawalConfirming(false); setNotice("Withdrawal cancelled. The suggestion remains open."); }}>Keep suggestion open</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedProjection.channelStatus === "withdrawn" && (
                <div className="mt-6 rounded-xl border border-slate-300 bg-white p-5">
                  <h2 className="font-semibold">Suggestion withdrawn</h2>
                  <p className="mt-2 text-slate-700">The response channel is closed. Avery sees the withdrawn state, both people keep the history, and no Avery-owned Waypoint changed.</p>
                </div>
              )}

              <button type="button" className="mt-6 rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => { setView("list"); setNotice("Returned to Avery’s Waypoint Suggestions list."); }}>Back to suggestions</button>
            </section>
          )}

          <div className="mt-10 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700" role="status" aria-live="polite">{notice}</div>
        </main>
      </div>
    </div>
  );
}
