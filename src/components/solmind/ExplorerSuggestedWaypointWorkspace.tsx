"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  acknowledgeSuggestedWaypoint,
  markSuggestedWaypointRead,
  projectSuggestedWaypointForExplorer,
  savePrivateSuggestedWaypointDraft,
  sendExactSuggestedWaypointResponse,
  type SuggestedWaypointResult,
  type SuggestedWaypointState,
} from "../../lib/solmind/suggestedWaypoints";
import {
  createExplorerSuggestedWaypointFixture,
  SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
} from "../../lib/solmind/suggestedWaypointFixtures";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type WorkspaceView = "inbox" | "detail" | "compare";

const applyResult = (
  result: SuggestedWaypointResult,
  setState: (state: SuggestedWaypointState) => void,
  setNotice: (notice: string) => void,
) => {
  if (result.kind === "rejected") {
    setNotice("That action is no longer available. Your private work was kept.");
    return false;
  }
  setState(result.state);
  return true;
};

export function ExplorerSuggestedWaypointWorkspace() {
  const [fixture] = useState(createExplorerSuggestedWaypointFixture);
  const [state, setState] = useState(fixture.state);
  const [view, setView] = useState<WorkspaceView>("inbox");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState(
    "This is a deterministic local review surface. Refreshing resets it.",
  );
  const projection = useMemo(
    () => projectSuggestedWaypointForExplorer(state),
    [state],
  );

  if (!projection) {
    return null;
  }

  const versionId = projection.currentVersion.id;
  const openSuggestion = () => {
    const result = markSuggestedWaypointRead(state, versionId);
    if (applyResult(result, setState, setNotice)) {
      setView("detail");
      setNotice("Opened privately. Morgan is not notified that you viewed this.");
    }
  };

  const acknowledge = () => {
    const result = acknowledgeSuggestedWaypoint(state, {
      versionId,
      nowMs: SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 600_000,
    });
    if (applyResult(result, setState, setNotice)) {
      setNotice("Preview updated: receipt acknowledged. No real message was sent.");
    }
  };

  const sendQuestion = () => {
    const exactText = question.trim();
    if (!exactText) {
      setNotice("Write the exact question you want Morgan to receive first.");
      return;
    }
    const drafted = savePrivateSuggestedWaypointDraft(state, versionId, exactText);
    if (drafted.kind === "rejected") {
      setNotice("Your question could not be saved. Nothing was sent.");
      return;
    }
    const sent = sendExactSuggestedWaypointResponse(drafted.state, {
      versionId,
      nowMs: SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 900_000,
      exactText,
    });
    if (applyResult(sent, setState, setNotice)) {
      setNotice("Preview updated: the exact question is shown as sent. No real message was sent.");
    }
  };

  const showDestination = (label: string) => {
    setNavigationOpen(false);
    setNotice(`${label} will open its Explorer workspace destination when that route is implemented.`);
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-slate-900">
      <button
        type="button"
        className="fixed left-3 top-3 z-30 rounded-md bg-[#174b4d] px-3 py-2 text-sm font-semibold text-white shadow lg:hidden"
        aria-expanded={navigationOpen}
        aria-controls="explorer-suggestion-navigation"
        onClick={() => setNavigationOpen((current) => !current)}
      >
        {navigationOpen ? "Close menu" : "Open menu"}
      </button>

      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside
          id="explorer-suggestion-navigation"
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
          <p className="mb-4 text-sm text-teal-50">Explorer workspace</p>
          <nav aria-label="Explorer navigation" className="space-y-2">
            <a className="block rounded-lg px-4 py-2 hover:bg-white/15" href="/explorer">
              Home
            </a>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => showDestination("Talk with Mary")}>Talk with ◉ Mary</button>
            <button className="w-full rounded-lg bg-white/15 px-4 py-2 text-left font-semibold" type="button" onClick={() => { setView("inbox"); setNavigationOpen(false); }}>Waypoints</button>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => showDestination("Appointments")}>Appointments</button>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => showDestination("History")}>History</button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-16 pt-20 sm:px-8 lg:px-12 lg:pt-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-5">
            <p className="font-medium">◉ Mary (SolMind Virtual Guide)</p>
            <SuggestedWaypointStatusPill tone="private">◆ Private Explorer view</SuggestedWaypointStatusPill>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600" aria-label="Breadcrumb">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 hover:bg-teal-50" onClick={() => setView("inbox")}>Waypoints</button>
            <span aria-hidden="true">/</span>
            <span>{view === "inbox" ? "Waypoint Suggestions" : view === "detail" ? "Suggestion detail" : "Private comparison"}</span>
          </div>

          {view === "inbox" && (
            <section aria-labelledby="suggestion-inbox-title">
              <p className="text-sm font-semibold text-[#1d6768]">Waypoints</p>
              <h1 id="suggestion-inbox-title" className="mt-2 text-3xl font-semibold">Waypoint Suggestions</h1>
              <p className="mt-3 max-w-3xl text-slate-600">Suggestions from Morgan remain suggestions, not assignments. You decide what to do with them.</p>

              <button
                type="button"
                className="mt-7 w-full rounded-xl border border-slate-300 border-l-4 border-l-[#227a7c] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#227a7c] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#227a7c]"
                onClick={openSuggestion}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-lg border border-slate-300 px-3 py-2 font-semibold">{projection.currentVersion.content.destination}</span>
                    <p className="mt-2 text-slate-600">From Morgan</p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <p>Received Aug 12</p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <SuggestedWaypointStatusPill tone={projection.read ? "neutral" : "positive"}>{projection.read ? "✓ Read" : "● Unread"}</SuggestedWaypointStatusPill>
                      {projection.receipt && <SuggestedWaypointStatusPill tone="positive">☑ Receipt acknowledged Aug 12</SuggestedWaypointStatusPill>}
                      {projection.responded && <SuggestedWaypointStatusPill tone="positive">↗ Response sent</SuggestedWaypointStatusPill>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                  <SuggestedWaypointStatusPill tone="attention">◇ Possible connection to review</SuggestedWaypointStatusPill>
                  <span className="text-sm text-slate-600">◉ {fixture.possibleConnection.assistantDisplayName} found {fixture.possibleConnection.candidateWaypointIds.length} possible related Waypoints.</span>
                  <span className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-[#1d6768]">Open suggestion</span>
                </div>
              </button>

              <p className="mt-5 text-sm text-slate-500">1 suggestion. Pagination appears only when more than five suggestions exist.</p>
            </section>
          )}

          {view === "detail" && (
            <section aria-labelledby="suggestion-detail-title" className="max-w-4xl">
              <p className="text-sm font-semibold text-[#1d6768]">Received Aug 12 as a suggestion, not an assignment.</p>
              <h1 id="suggestion-detail-title" className="mt-2 text-3xl font-semibold">{projection.currentVersion.content.destination}</h1>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <article className="rounded-xl border border-slate-300 bg-white p-5">
                  <h2 className="font-semibold">Why Morgan suggested this</h2>
                  <p className="mt-3 text-slate-700">{projection.currentVersion.content.why}</p>
                  <h2 className="mt-5 font-semibold">Possible arrival signal</h2>
                  <p className="mt-3 text-slate-700">{projection.currentVersion.content.arrivalSignals[0]}</p>
                </article>
                <aside className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                  <h2 className="font-semibold">You stay in control</h2>
                  <p className="mt-3 text-slate-700">Opening, reflecting on, or comparing this suggestion remains private. Morgan sees only a receipt acknowledgement or exact response you deliberately send.</p>
                </aside>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="rounded-lg bg-[#176a6c] px-4 py-2.5 font-semibold text-white hover:bg-[#125456]" onClick={() => setView("compare")}>Compare privately</button>
                <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={acknowledge}>Acknowledge receipt</button>
                <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => setNotice("A private conversation with ◉ Mary will open here in the implemented conversation route.")}>Reflect privately with ◉ Mary</button>
              </div>
              <div className="mt-7 rounded-xl border border-slate-300 bg-white p-5">
                <label htmlFor="guide-question" className="font-semibold">Optional question for Morgan</label>
                <p className="mt-1 text-sm text-slate-600">Only the exact text you send crosses to Morgan. ◉ Mary can help you form it when conversation integration is added.</p>
                <textarea id="guide-question" value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-3 min-h-28 w-full rounded-lg border border-slate-400 p-3 focus:border-[#227a7c] focus:outline-none focus:ring-2 focus:ring-teal-200" placeholder="Write the exact question you want Morgan to receive." />
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" className="rounded-lg bg-[#176a6c] px-4 py-2.5 font-semibold text-white hover:bg-[#125456]" onClick={sendQuestion}>Preview sending exact question</button>
                  <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 hover:bg-slate-50" onClick={() => { setView("inbox"); setNotice("Kept private. Your local draft remains available until this preview is refreshed."); }}>Keep private and close</button>
                </div>
              </div>
            </section>
          )}

          {view === "compare" && (
            <section aria-labelledby="private-comparison-title" className="max-w-5xl">
              <SuggestedWaypointStatusPill tone="private">◆ Private comparison</SuggestedWaypointStatusPill>
              <h1 id="private-comparison-title" className="mt-3 text-3xl font-semibold">◉ Mary noticed that parts of these may be related</h1>
              <p className="mt-3 text-slate-600">You decide what the connection means. SolMind has not changed either Waypoint.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <article className="rounded-xl border border-[#227a7c] bg-white p-5">
                  <p className="text-sm font-semibold text-[#1d6768]">Morgan&apos;s suggestion</p>
                  <h2 className="mt-2 text-xl font-semibold">{projection.currentVersion.content.destination}</h2>
                  <p className="mt-3 text-slate-600">{projection.currentVersion.content.why}</p>
                </article>
                <article className="rounded-xl border border-indigo-400 bg-white p-5">
                  <p className="text-sm font-semibold text-indigo-700">Your private Waypoint in progress</p>
                  <h2 className="mt-2 text-xl font-semibold">Protect Tuesday evening for recovery</h2>
                  <p className="mt-3 text-slate-600">Formed privately in a conversation with ◉ Mary. Morgan cannot see it.</p>
                </article>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="rounded-lg bg-[#176a6c] px-4 py-2.5 font-semibold text-white hover:bg-[#125456]" onClick={() => setNotice("A private combined-Waypoint draft will open with both source lineages preserved.")}>Explore a combined Waypoint</button>
                <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50" onClick={() => { setView("detail"); setNotice("No Waypoint changed. You can return to this private comparison later."); }}>Decide later</button>
              </div>
            </section>
          )}

          <div className="mt-10 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700" role="status" aria-live="polite">{notice}</div>
        </main>
      </div>
    </div>
  );
}
