"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  availableSuggestedWaypointGuideListPageSizes,
  parseSuggestedWaypointGuideListBrowserResult,
  type SuggestedWaypointGuideListItem,
  type SuggestedWaypointGuideListPage,
  type SuggestedWaypointGuideListPageSize,
} from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { SUGGESTED_WAYPOINT_REFRESH_REQUIRED } from "@/lib/solmind/suggestedWaypointPaginationSharedContract";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type RequestState = Readonly<{
  cursor: string | null;
  cursorHistory: readonly (string | null)[];
  pageSize: SuggestedWaypointGuideListPageSize;
}>;

type ViewState = "loading" | "ready" | "denied" | "failed";

const INITIAL_REQUEST: RequestState = Object.freeze({
  cursor: null,
  cursorHistory: Object.freeze([]),
  pageSize: 10,
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusPills({ item }: { item: SuggestedWaypointGuideListItem }) {
  if (item.authoring_mode === "draft") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="private">✎ Draft</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone="private">🔒 Guide-only</SuggestedWaypointStatusPill>
      </>
    );
  }
  if (item.authoring_mode === "pending") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="attention">⌛ Pending send</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone={item.pull_back_available ? "attention" : "neutral"}>
          {item.pull_back_available ? "↩ Pull Back available" : "○ Pull Back period ended"}
        </SuggestedWaypointStatusPill>
      </>
    );
  }
  return (
    <>
      <SuggestedWaypointStatusPill tone="positive">✉ Open suggestion</SuggestedWaypointStatusPill>
      {item.acknowledged_at === null ? (
        <SuggestedWaypointStatusPill tone="neutral">○ No response</SuggestedWaypointStatusPill>
      ) : (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ Receipt acknowledged {formatDate(item.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

export function GuideSuggestedWaypointRelationshipList({
  relationshipId,
}: Readonly<{ relationshipId: string }>) {
  const searchParams = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [page, setPage] = useState<SuggestedWaypointGuideListPage | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [pending, setPending] = useState(true);
  const [notice, setNotice] = useState("Loading Suggested Waypoints.");
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const pageRef = useRef<SuggestedWaypointGuideListPage | null>(null);
  const rowLinks = useRef(new Map<string, HTMLAnchorElement>());

  const load = useCallback(
    async (nextRequest: RequestState) => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      const sequence = ++requestSequence.current;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 15_000);
      setPending(true);
      if (pageRef.current === null) {
        setViewState("loading");
        setNotice("Loading Suggested Waypoints.");
      } else {
        setNotice("Loading the requested suggestion page.");
      }

      let attemptRequest = nextRequest;
      let refreshAttempted = false;
      try {
        for (;;) {
          const query = new URLSearchParams({
            pageSize: String(attemptRequest.pageSize),
          });
          if (attemptRequest.cursor !== null) {
            query.set("cursor", attemptRequest.cursor);
          }
          const response = await fetch(
            `/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}/suggestions?${query.toString()}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              headers: { Accept: "application/json" },
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            throw new Error("Unexpected Suggested Waypoint list response status.");
          }
          const result = parseSuggestedWaypointGuideListBrowserResult(
            await response.json(),
          );
          if (controller.signal.aborted || sequence !== requestSequence.current) {
            return;
          }

          if (
            result !== null &&
            !result.ok &&
            result.error === SUGGESTED_WAYPOINT_REFRESH_REQUIRED &&
            attemptRequest.cursor !== null &&
            !refreshAttempted
          ) {
            refreshAttempted = true;
            attemptRequest = Object.freeze({
              cursor: null,
              cursorHistory: Object.freeze([]),
              pageSize: attemptRequest.pageSize,
            });
            setNotice("This list changed. Refreshing the first page.");
            continue;
          }

          if (
            result === null ||
            (!result.ok && result.error !== SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED)
          ) {
            setViewState(pageRef.current === null ? "failed" : "ready");
            setNotice(
              pageRef.current === null
                ? "Suggested Waypoints could not be loaded."
                : "The requested page could not be loaded. The current page remains available.",
            );
            return;
          }

          if (!result.ok) {
            pageRef.current = null;
            setPage(null);
            setViewState("denied");
            setNotice("Suggested Waypoints are unavailable for this Explorer relationship.");
            return;
          }

          pageRef.current = result.data;
          setPage(result.data);
          setRequest(attemptRequest);
          setViewState("ready");
          setNotice(
            refreshAttempted
              ? "This list changed, so the first page was refreshed."
              : result.data.items.length === 0
                ? "No Suggested Waypoints are currently available for this Explorer."
                : `Loaded ${result.data.items.length} ${result.data.items.length === 1 ? "suggestion" : "suggestions"}.`,
          );
          return;
        }
      } catch {
        if (
          sequence !== requestSequence.current ||
          (controller.signal.aborted && !timedOut)
        ) {
          return;
        }
        setViewState(pageRef.current === null ? "failed" : "ready");
        setNotice(
          pageRef.current === null
            ? "Suggested Waypoints could not be loaded."
            : "The requested page could not be loaded. The current page remains available.",
        );
      } finally {
        window.clearTimeout(timeout);
        if (sequence === requestSequence.current) {
          setPending(false);
        }
      }
    },
    [relationshipId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(INITIAL_REQUEST), 0);
    return () => {
      window.clearTimeout(timer);
      activeController.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (page !== null && requestedFocus !== null) {
      rowLinks.current.get(requestedFocus)?.focus();
    }
  }, [page, requestedFocus]);

  const pageSizes = useMemo(
    () => availableSuggestedWaypointGuideListPageSizes(page?.total_count ?? 0),
    [page?.total_count],
  );
  const pageStart =
    page === null || page.items.length === 0
      ? 0
      : request.cursorHistory.length * request.pageSize + 1;
  const pageEnd = page === null ? 0 : pageStart + page.items.length - 1;

  const changePageSize = (event: ChangeEvent<HTMLSelectElement>) => {
    const pageSize = Number(event.target.value) as SuggestedWaypointGuideListPageSize;
    void load({ cursor: null, cursorHistory: [], pageSize });
  };

  const goBack = () => {
    const history = [...request.cursorHistory];
    const cursor = history.pop() ?? null;
    void load({ ...request, cursor, cursorHistory: history });
  };

  const goForward = () => {
    if (page?.next_cursor === null || page?.next_cursor === undefined) {
      return;
    }
    void load({
      ...request,
      cursor: page.next_cursor,
      cursorHistory: [...request.cursorHistory, request.cursor],
    });
  };

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-300" role="status" aria-live="polite">
        {notice}
      </p>

      {viewState === "loading" && page === null && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-6">
          <p>Loading Suggested Waypoints...</p>
        </div>
      )}

      {viewState === "denied" && (
        <div className="mt-6 rounded-2xl border border-amber-700/70 bg-amber-950/30 p-6">
          <h2 className="text-xl font-semibold">Suggested Waypoints unavailable</h2>
          <p className="mt-2 text-slate-300">
            This Guide workspace can no longer open this Explorer relationship.
            Return to the Explorer relationship list.
          </p>
        </div>
      )}

      {viewState === "failed" && page === null && (
        <div className="mt-6 rounded-2xl border border-rose-700/70 bg-rose-950/30 p-6">
          <h2 className="text-xl font-semibold">Could not load suggestions</h2>
          <p className="mt-2 text-slate-300">Nothing was changed. Try loading the list again.</p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={() => void load(request)}
          >
            Try again
          </button>
        </div>
      )}

      {viewState === "ready" && page !== null && (
        <section aria-labelledby="guide-suggestion-list-title" aria-busy={pending}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="guide-suggestion-list-title" className="text-2xl font-semibold">
                Waypoint Suggestions
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Drafts, pending sends, and open suggestions for this Explorer.
              </p>
            </div>
            {pageSizes.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                Show
                <select
                  className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
                  value={request.pageSize}
                  onChange={changePageSize}
                  disabled={pending}
                >
                  {pageSizes.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                per page
              </label>
            )}
          </div>

          {page.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-6">
              <h3 className="font-semibold">No suggestions yet</h3>
              <p className="mt-2 text-sm text-slate-400">
                This relationship has no Guide-visible Suggested Waypoints.
                Composition remains a separately bounded next step.
              </p>
            </div>
          ) : (
            <ul className="mt-5 grid gap-3" aria-label="Suggested Waypoints">
              {page.items.map((item) => (
                <li key={item.suggested_waypoint_id}>
                  <Link
                    ref={(node) => {
                      if (node === null) {
                        rowLinks.current.delete(item.suggested_waypoint_id);
                      } else {
                        rowLinks.current.set(item.suggested_waypoint_id, node);
                      }
                    }}
                    href={`/guide/waypoint-suggestions/${relationshipId}/${item.suggested_waypoint_id}`}
                    className="group block rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 transition hover:border-cyan-400 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    <span className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <span>
                        <span className="block text-lg font-semibold text-slate-100">
                          {item.destination_preview}
                        </span>
                        <span className="mt-1 block text-sm text-slate-400">
                          {item.authoring_mode === "delivered" && item.delivered_at !== null
                            ? `Sent ${formatDate(item.delivered_at)}`
                            : item.authoring_mode === "pending" && item.pending_deadline_at !== null
                              ? `Scheduled for ${formatDate(item.pending_deadline_at)}`
                              : `Draft revision ${item.authoring_revision}`}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                        <StatusPills item={item} />
                      </span>
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-cyan-300 group-hover:text-cyan-200">
                      Open suggestion
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {page.total_count > 0 && (
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Showing {pageStart}-{pageEnd} of {page.total_count}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-slate-600 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={goBack}
                  disabled={pending || request.cursorHistory.length === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={goForward}
                  disabled={pending || page.next_cursor === null}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
