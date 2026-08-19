"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED,
  parseSuggestedWaypointExplorerDetailBrowserResult,
  type SuggestedWaypointExplorerDetail as Detail,
} from "@/lib/solmind/suggestedWaypointExplorerDetailBrowserContract";
import { formatSuggestedWaypointDate } from "@/lib/solmind/suggestedWaypointDisplayDate";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type ViewState = "loading" | "ready" | "denied" | "failed";

function StatusPills({ detail }: { detail: Detail }) {
  return (
    <>
      <SuggestedWaypointStatusPill tone={detail.read ? "neutral" : "positive"}>
        {detail.read ? "✓ Read" : "● Unread"}
      </SuggestedWaypointStatusPill>
      {detail.receipt_acknowledged && detail.acknowledged_at !== null && (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ You acknowledged receipt {formatSuggestedWaypointDate(detail.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

export function ExplorerSuggestedWaypointDetail({
  suggestedWaypointId,
}: Readonly<{ suggestedWaypointId: string }>) {
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
        `/explorer/waypoints/${encodeURIComponent(suggestedWaypointId)}/detail`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Unexpected Waypoint Suggestion detail response status.");
      }
      const result = parseSuggestedWaypointExplorerDetailBrowserResult(
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
          result.error === SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED
            ? "denied"
            : "failed",
        );
        setNotice(
          result.error === SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED
            ? "Suggestion detail is unavailable."
            : "Suggestion detail could not be loaded.",
        );
      } else {
        setDetail(result.data);
        setViewState("ready");
        setNotice("Suggestion detail loaded privately.");
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
  }, [suggestedWaypointId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      activeController.current?.abort();
    };
  }, [load]);

  return (
    <div className="mt-6">
      <p className="text-sm text-slate-600" role="status" aria-live="polite">{notice}</p>

      {viewState === "loading" && (
        <div className="mt-5 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">Loading suggestion detail...</div>
      )}

      {viewState === "denied" && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-xl font-semibold">Suggestion unavailable</h2>
          <p className="mt-2 text-slate-700">This Explorer workspace cannot open that suggestion. Return to your inbox.</p>
        </div>
      )}

      {viewState === "failed" && (
        <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-5">
          <h2 className="text-xl font-semibold">Could not load suggestion</h2>
          <p className="mt-2 text-slate-700">Nothing was changed. Try loading the detail again.</p>
          <button type="button" className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768]" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {viewState === "ready" && detail !== null && (
        <div className="grid gap-5">
          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1d6768]">Received {formatSuggestedWaypointDate(detail.received_at)} as a suggestion, not an assignment.</p>
                <h1 className="mt-3 text-3xl font-semibold">{detail.destination}</h1>
              </div>
              <div className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end"><StatusPills detail={detail} /></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Why your Guide suggested this</h2>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{detail.why}</p>
            <h2 className="mt-6 text-xl font-semibold">Possible arrival signals</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              {detail.arrival_signals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </section>

          <aside className="rounded-xl border border-indigo-300 bg-indigo-50 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <SuggestedWaypointStatusPill tone="private">◆ Private Explorer view</SuggestedWaypointStatusPill>
              <h2 className="text-xl font-semibold">You stay in control</h2>
            </div>
            <p className="mt-3 text-slate-700">
              Opening this page and reviewing its content stays private. Your
              Guide sees only a receipt acknowledgement you deliberately send.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Private reflection with ◉ Mary, comparison with your Waypoints,
              read marking, and receipt acknowledgement remain separately
              reviewed next steps and do not execute from this read-only screen.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
