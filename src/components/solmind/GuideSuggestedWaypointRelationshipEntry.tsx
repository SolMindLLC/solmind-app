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
  SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED,
  availableSuggestedWaypointRelationshipPageSizes,
  isSuggestedWaypointRelationshipId,
  parseSuggestedWaypointRelationshipBrowserResult,
  type SuggestedWaypointRelationshipBrowserPage,
  type SuggestedWaypointRelationshipPageSize,
} from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";
import { SUGGESTED_WAYPOINT_REFRESH_REQUIRED } from "@/lib/solmind/suggestedWaypointPaginationSharedContract";

type RequestState = Readonly<{
  cursor: string | null;
  cursorHistory: readonly (string | null)[];
  pageSize: SuggestedWaypointRelationshipPageSize;
}>;

type ViewState = "loading" | "ready" | "denied" | "failed";

const INITIAL_REQUEST: RequestState = Object.freeze({
  cursor: null,
  cursorHistory: Object.freeze([]),
  pageSize: 10,
});

export function GuideSuggestedWaypointRelationshipEntry() {
  const searchParams = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [page, setPage] = useState<SuggestedWaypointRelationshipBrowserPage | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [pending, setPending] = useState(true);
  const [notice, setNotice] = useState("Loading Suggested Waypoint relationships.");
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const pageRef = useRef<SuggestedWaypointRelationshipBrowserPage | null>(null);
  const rowLinks = useRef(new Map<string, HTMLAnchorElement>());

  const load = useCallback(async (nextRequest: RequestState) => {
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
      setNotice("Loading Suggested Waypoint relationships.");
    } else {
      setNotice("Loading the requested Explorer page.");
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
          `/guide/waypoint-suggestions/relationships?${query.toString()}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error("Unexpected Suggested Waypoint relationship response status.");
        }
        const result = parseSuggestedWaypointRelationshipBrowserResult(
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
          (!result.ok && result.error !== SUGGESTED_WAYPOINT_RELATIONSHIP_DENIED)
        ) {
          setViewState(pageRef.current === null ? "failed" : "ready");
          setNotice(
            pageRef.current === null
              ? "Suggested Waypoint relationships could not be loaded."
              : "The requested page could not be loaded. The current page remains available.",
          );
          return;
        }

        if (!result.ok) {
          pageRef.current = null;
          setPage(null);
          setViewState("denied");
          setNotice("Suggested Waypoints are unavailable in this Guide workspace.");
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
              ? "No Explorers are currently available for Suggested Waypoints."
              : `Loaded ${result.data.items.length} ${result.data.items.length === 1 ? "Explorer" : "Explorers"}.`,
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
          ? "Suggested Waypoint relationships could not be loaded."
          : "The requested page could not be loaded. The current page remains available.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        setPending(false);
      } else if (timedOut && sequence === requestSequence.current) {
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(INITIAL_REQUEST), 0);
    return () => {
      window.clearTimeout(timer);
      activeController.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (
      page !== null &&
      isSuggestedWaypointRelationshipId(requestedFocus)
    ) {
      rowLinks.current.get(requestedFocus)?.focus();
    }
  }, [page, requestedFocus]);

  const pageSizes = useMemo(
    () => availableSuggestedWaypointRelationshipPageSizes(page?.total_count ?? 0),
    [page?.total_count],
  );
  const pageStart =
    page === null || page.items.length === 0
      ? 0
      : request.cursorHistory.length * request.pageSize + 1;
  const pageEnd = page === null ? 0 : pageStart + page.items.length - 1;

  const retry = () => {
    void load(request);
  };

  const changePageSize = (event: ChangeEvent<HTMLSelectElement>) => {
    const pageSize = Number(event.target.value) as SuggestedWaypointRelationshipPageSize;
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
          <p>Loading your Explorer relationships...</p>
        </div>
      )}

      {viewState === "denied" && (
        <div className="mt-6 rounded-2xl border border-amber-700/70 bg-amber-950/30 p-6">
          <h2 className="text-xl font-semibold">Suggested Waypoints unavailable</h2>
          <p className="mt-2 text-slate-300">
            This Guide workspace cannot open Suggested Waypoints. Return to the
            Guide dashboard or sign in with the appropriate Guide account.
          </p>
        </div>
      )}

      {viewState === "failed" && page === null && (
        <div className="mt-6 rounded-2xl border border-rose-700/70 bg-rose-950/30 p-6">
          <h2 className="text-xl font-semibold">Could not load Explorers</h2>
          <p className="mt-2 text-slate-300">
            Nothing was changed. Try loading the list again.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      )}

      {viewState === "ready" && page !== null && (
        <section className="mt-6" aria-labelledby="relationship-list-title" aria-busy={pending}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="relationship-list-title" className="text-2xl font-semibold">
                Explorers
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Choose an Explorer to open that relationship&apos;s Suggested Waypoint workspace.
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
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                per page
              </label>
            )}
          </div>

          {page.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-6">
              <h3 className="font-semibold">No Explorers available</h3>
              <p className="mt-2 text-sm text-slate-400">
                No active Guide relationship is currently available to this
                Suggested Waypoint feature.
              </p>
            </div>
          ) : (
            <ul className="mt-5 grid gap-3" aria-label="Explorer relationships">
              {page.items.map((item) => (
                <li key={item.guide_explorer_relationship_id}>
                  <Link
                    ref={(node) => {
                      if (node === null) {
                        rowLinks.current.delete(item.guide_explorer_relationship_id);
                      } else {
                        rowLinks.current.set(item.guide_explorer_relationship_id, node);
                      }
                    }}
                    href={`/guide/waypoint-suggestions/${item.guide_explorer_relationship_id}`}
                    className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 transition hover:border-cyan-400 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    <span>
                      <span className="block text-lg font-semibold text-slate-100">
                        {item.explorer_display_name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-400">
                        Suggested Waypoints
                      </span>
                    </span>
                    <span className="font-semibold text-cyan-300 group-hover:text-cyan-200">
                      Open
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
