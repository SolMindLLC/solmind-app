"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED,
  parseSuggestedWaypointGuideDetailBrowserResult,
  type SuggestedWaypointGuideDetail as Detail,
} from "@/lib/solmind/suggestedWaypointGuideDetailBrowserContract";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type ViewState = "loading" | "ready" | "denied" | "failed";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function StatusPills({ detail }: { detail: Detail }) {
  if (detail.authoring_mode === "draft") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="private">✎ Draft</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone="private">🔒 Guide-only</SuggestedWaypointStatusPill>
      </>
    );
  }
  if (detail.authoring_mode === "pending") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="attention">⌛ Pending send</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone={detail.pull_back_available ? "attention" : "neutral"}>
          {detail.pull_back_available ? "↩ Pull Back available" : "○ Pull Back period ended"}
        </SuggestedWaypointStatusPill>
      </>
    );
  }
  return (
    <>
      <SuggestedWaypointStatusPill tone="positive">✉ Open suggestion</SuggestedWaypointStatusPill>
      {detail.acknowledged_at === null ? (
        <SuggestedWaypointStatusPill tone="neutral">○ No response</SuggestedWaypointStatusPill>
      ) : (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ Receipt acknowledged {formatDateTime(detail.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

function ContentCard({
  title,
  destination,
  why,
  arrivalSignals,
  tone,
}: Readonly<{
  title: string;
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
  tone: "private" | "delivered";
}>) {
  return (
    <section
      className={`rounded-2xl border p-6 ${
        tone === "private"
          ? "border-violet-700/70 bg-violet-950/25"
          : "border-cyan-700/70 bg-cyan-950/25"
      }`}
      aria-labelledby={`${tone}-content-title`}
    >
      <h2 id={`${tone}-content-title`} className="text-xl font-semibold">{title}</h2>
      <dl className="mt-5 grid gap-5">
        <div>
          <dt className="text-sm font-semibold text-slate-400">Possible Waypoint destination</dt>
          <dd className="mt-1 text-lg text-slate-100">{destination}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Why this may help</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-200">{why}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Possible arrival signals</dt>
          <dd className="mt-2">
            <ul className="list-disc space-y-1 pl-5 text-slate-200">
              {arrivalSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function GuideSuggestedWaypointDetail({
  relationshipId,
  suggestedWaypointId,
}: Readonly<{ relationshipId: string; suggestedWaypointId: string }>) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [notice, setNotice] = useState("Loading suggestion detail.");
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++requestSequence.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    setViewState("loading");
    setNotice("Loading suggestion detail.");

    try {
      const response = await fetch(
        `/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}/${encodeURIComponent(suggestedWaypointId)}/detail`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Unexpected Suggested Waypoint detail response status.");
      }
      const result = parseSuggestedWaypointGuideDetailBrowserResult(
        await response.json(),
      );
      if (controller.signal.aborted || sequence !== requestSequence.current) {
        return;
      }
      if (result === null) {
        setDetail(null);
        setViewState("failed");
        setNotice("Suggestion detail could not be loaded.");
      } else if (!result.ok) {
        setDetail(null);
        setViewState(
          result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
            ? "denied"
            : "failed",
        );
        setNotice(
          result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
            ? "Suggestion detail is unavailable."
            : "Suggestion detail could not be loaded.",
        );
      } else {
        setDetail(result.data);
        setViewState("ready");
        setNotice("Suggestion detail loaded.");
      }
    } catch {
      if (
        sequence !== requestSequence.current ||
        (controller.signal.aborted && !timedOut)
      ) {
        return;
      }
      setDetail(null);
      setViewState("failed");
      setNotice("Suggestion detail could not be loaded.");
    } finally {
      window.clearTimeout(timeout);
    }
  }, [relationshipId, suggestedWaypointId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      activeController.current?.abort();
    };
  }, [load]);

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-300" role="status" aria-live="polite">
        {notice}
      </p>

      {viewState === "loading" && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-6">
          Loading suggestion detail...
        </div>
      )}

      {viewState === "denied" && (
        <div className="mt-6 rounded-2xl border border-amber-700/70 bg-amber-950/30 p-6">
          <h2 className="text-xl font-semibold">Suggestion unavailable</h2>
          <p className="mt-2 text-slate-300">
            This Guide workspace cannot open that suggestion through the active
            Explorer relationship. Return to the suggestion list.
          </p>
        </div>
      )}

      {viewState === "failed" && (
        <div className="mt-6 rounded-2xl border border-rose-700/70 bg-rose-950/30 p-6">
          <h2 className="text-xl font-semibold">Could not load suggestion</h2>
          <p className="mt-2 text-slate-300">Nothing was changed. Try loading the detail again.</p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {viewState === "ready" && detail !== null && (
        <div className="grid gap-5">
          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-slate-400">Suggestion overview</p>
                <h2 className="mt-2 text-2xl font-semibold">{detail.destination_preview}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Authoring revision {detail.authoring_revision}
                  {detail.delivered_at === null
                    ? ""
                    : ` · Sent ${formatDateTime(detail.delivered_at)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                <StatusPills detail={detail} />
              </div>
            </div>
          </section>

          {detail.draft_or_pending_destination !== null &&
            detail.draft_or_pending_why !== null &&
            detail.draft_or_pending_arrival_signals !== null && (
              <ContentCard
                title={detail.authoring_mode === "pending" ? "Pending version" : "Guide-only draft"}
                destination={detail.draft_or_pending_destination}
                why={detail.draft_or_pending_why}
                arrivalSignals={detail.draft_or_pending_arrival_signals}
                tone="private"
              />
            )}

          {detail.delivered_destination !== null &&
            detail.delivered_why !== null &&
            detail.delivered_arrival_signals !== null && (
              <ContentCard
                title={detail.authoring_mode === "delivered" ? "Version sent to Explorer" : "Last version sent to Explorer"}
                destination={detail.delivered_destination}
                why={detail.delivered_why}
                arrivalSignals={detail.delivered_arrival_signals}
                tone="delivered"
              />
            )}

          {detail.authoring_mode === "pending" &&
            detail.pending_deadline_at !== null &&
            detail.effective_seconds !== null && (
              <section className="rounded-2xl border border-amber-700/70 bg-amber-950/25 p-6">
                <h2 className="text-xl font-semibold">Pending-send window</h2>
                <p className="mt-2 text-slate-200">
                  Explorer visibility is scheduled after {formatDateTime(detail.pending_deadline_at)}.
                  The applied grace setting is {detail.effective_seconds} seconds.
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  This screen is read-only. Pull Back remains a separately bounded command.
                </p>
              </section>
            )}

          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">Privacy boundary</h2>
            <p className="mt-2 text-slate-300">
              Explorer-private open and read activity is not shown here. The
              Guide sees only an explicit receipt acknowledgement and its date,
              when the Explorer chooses to send one.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
