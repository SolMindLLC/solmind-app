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
  SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED,
  availableSuggestedWaypointExplorerListPageSizes,
  parseSuggestedWaypointExplorerListBrowserResult,
  type SuggestedWaypointExplorerListItem,
  type SuggestedWaypointExplorerListPage,
  type SuggestedWaypointExplorerListPageSize,
} from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";
import { formatSuggestedWaypointDate } from "@/lib/solmind/suggestedWaypointDisplayDate";
import { SUGGESTED_WAYPOINT_REFRESH_REQUIRED } from "@/lib/solmind/suggestedWaypointPaginationSharedContract";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";
import { FOCUS_RING, SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { ExplorerWorkspaceFrame } from "./ExplorerWorkspaceFrame";
import { ExplorerYourWaypoints } from "./ExplorerYourWaypoints";
import { YOUR_WAYPOINTS_WORDING } from "@/lib/solmind/explorerYourWaypoints";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";
import { useExplorerEarlyTestNoticeRecheck } from "@/lib/solmind/explorerEarlyTestNoticeRecheck";

// The dark and amber look of the signed-in conversation screen.
const CARD_CLASS = "rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5";
const PAGER_BUTTON = joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-40");
const SELECT_CLASS = joinClasses("rounded-lg border border-amber-200/25 bg-[#0c0a08] px-3 py-2 text-stone-100", FOCUS_RING);

type RequestState = Readonly<{
  cursor: string | null;
  cursorHistory: readonly (string | null)[];
  pageSize: SuggestedWaypointExplorerListPageSize;
}>;

type ViewState = "loading" | "ready" | "denied" | "failed";

const INITIAL_REQUEST: RequestState = Object.freeze({
  cursor: null,
  cursorHistory: Object.freeze([]),
  pageSize: 10,
});

function StatusPills({ item }: { item: SuggestedWaypointExplorerListItem }) {
  return (
    <>
      <SuggestedWaypointStatusPill surface="dark" tone={item.read ? "neutral" : "positive"}>
        {item.read ? "✓ Read" : "● Unread"}
      </SuggestedWaypointStatusPill>
      {item.receipt_acknowledged && item.acknowledged_at !== null && (
        <SuggestedWaypointStatusPill surface="dark" tone="positive">
          ☑ You acknowledged receipt {formatSuggestedWaypointDate(item.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

export function ExplorerSuggestedWaypointInbox() {
  const notifyExplorerEarlyTestNoticeRecheck = useExplorerEarlyTestNoticeRecheck();
  const searchParams = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [page, setPage] = useState<SuggestedWaypointExplorerListPage | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [pending, setPending] = useState(true);
  const [notice, setNotice] = useState("Loading Waypoint Suggestions.");
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const pageRef = useRef<SuggestedWaypointExplorerListPage | null>(null);
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
      setNotice("Loading Waypoint Suggestions.");
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
          `/explorer/waypoints/suggestions?${query.toString()}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error("Unexpected Waypoint Suggestions response status.");
        }
        const result = parseSuggestedWaypointExplorerListBrowserResult(
          await response.json(),
        );
        if (controller.signal.aborted || sequence !== requestSequence.current) {
          return;
        }
        if (result && !result.ok && result.error !== SUGGESTED_WAYPOINT_REFRESH_REQUIRED) {
          notifyExplorerEarlyTestNoticeRecheck();
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
          (!result.ok && result.error !== SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED)
        ) {
          setViewState(pageRef.current === null ? "failed" : "ready");
          setNotice(
            pageRef.current === null
              ? "Waypoint Suggestions could not be loaded."
              : "The requested page could not be loaded. The current page remains available.",
          );
          return;
        }

        if (!result.ok) {
          pageRef.current = null;
          setPage(null);
          setViewState("denied");
          setNotice("Waypoint Suggestions are unavailable.");
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
              ? "No Waypoint Suggestions are currently in your inbox."
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
          ? "Waypoint Suggestions could not be loaded."
          : "The requested page could not be loaded. The current page remains available.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (sequence === requestSequence.current) {
        setPending(false);
      }
    }
  }, [notifyExplorerEarlyTestNoticeRecheck]);

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
    () => availableSuggestedWaypointExplorerListPageSizes(page?.total_count ?? 0),
    [page?.total_count],
  );
  const pageStart =
    page === null || page.items.length === 0
      ? 0
      : request.cursorHistory.length * request.pageSize + 1;
  const pageEnd = page === null ? 0 : pageStart + page.items.length - 1;

  const changePageSize = (event: ChangeEvent<HTMLSelectElement>) => {
    const pageSize = Number(event.target.value) as SuggestedWaypointExplorerListPageSize;
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
    // In the Explorer workspace frame with Waypoints current (Paul's 2026-11-02
    // decisions); the content keeps every read, state, live region and text.
    <ExplorerWorkspaceFrame page="waypoints">
        <div className="min-w-0 px-3 pb-16 pt-5 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/10 pb-5">
            {/* The canonical unnamed form (solmind-docs/canonical/06_SolMind_ScreenInventory_Phase0_v1_0.md):
                this page receives no chosen name. */}
            <p className="font-medium text-stone-200">{`◉ ${SOLMIND_TERMS.virtualGuide}`}</p>
            <SuggestedWaypointStatusPill surface="dark" tone="private">◆ Private Explorer view</SuggestedWaypointStatusPill>
          </div>

          {/* The Waypoints page (execution/07 item 43): the private Your Waypoints section first, then the
              Waypoint Suggestions from the Guide, whose reads, commands and text are unchanged. */}
          <h1 className="mb-8 font-serif text-3xl leading-tight text-stone-50 sm:text-4xl">{YOUR_WAYPOINTS_WORDING.pageHeading}</h1>
          <ExplorerYourWaypoints />
          <section aria-labelledby="suggestion-inbox-title" aria-busy={pending}>
            <h2 id="suggestion-inbox-title" className="font-serif text-2xl leading-tight text-stone-50 sm:text-3xl">Waypoint Suggestions</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300">
              Suggestions from your Guide remain suggestions, not assignments. You decide what to do with them.
            </p>
            <p className="mt-4 text-sm text-stone-300" role="status" aria-live="polite">{notice}</p>

            {viewState === "loading" && page === null && (
              <div className={joinClasses("mt-7 text-stone-200", CARD_CLASS)}>Loading Waypoint Suggestions...</div>
            )}

            {viewState === "denied" && (
              <div className="mt-7 rounded-2xl border border-amber-400/70 bg-amber-950/60 p-5 text-amber-50">
                <h3 className="font-serif text-xl">Waypoint Suggestions unavailable</h3>
                <p className="mt-2 text-sm leading-6">This Explorer workspace cannot open the requested suggestions.</p>
              </div>
            )}

            {viewState === "failed" && page === null && (
              <div className="mt-7 rounded-2xl border border-rose-400/60 bg-rose-950/50 p-5 text-rose-50">
                <h3 className="font-serif text-xl">Could not load Waypoint Suggestions</h3>
                <p className="mt-2 text-sm leading-6">Nothing was changed. Try loading the inbox again.</p>
                <button type="button" className={joinClasses("mt-4", SECONDARY_BUTTON)} onClick={() => void load(request)}>Try again</button>
              </div>
            )}

            {viewState === "ready" && page !== null && (
              <>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-sm text-stone-300">Delivered suggestions only. Opening one remains private.</p>
                  {pageSizes.length > 1 && (
                    <label className="flex items-center gap-2 text-sm text-stone-300">
                      Show
                      <select className={SELECT_CLASS} value={request.pageSize} onChange={changePageSize} disabled={pending}>
                        {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      per page
                    </label>
                  )}
                </div>

                {page.items.length === 0 ? (
                  <div className={joinClasses("mt-5", CARD_CLASS)}>
                    <h3 className="font-serif text-xl text-stone-50">No suggestions yet</h3>
                    <p className="mt-2 text-sm text-stone-300">Suggestions from your Guide will appear here after they are delivered.</p>
                  </div>
                ) : (
                  <ul className="mt-5 grid gap-3" aria-label="Waypoint Suggestions">
                    {page.items.map((item) => (
                      <li key={item.suggested_waypoint_id}>
                        <Link
                          ref={(node) => {
                            if (node === null) rowLinks.current.delete(item.suggested_waypoint_id);
                            else rowLinks.current.set(item.suggested_waypoint_id, node);
                          }}
                          href={`/explorer/waypoints/${item.suggested_waypoint_id}`}
                          className={joinClasses("group block rounded-3xl border border-amber-200/15 border-l-4 border-l-amber-300/70 bg-[#0c0a08]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-amber-300/60", FOCUS_RING)}
                        >
                          <span className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <span>
                              <span className="block font-serif text-xl text-stone-50">{item.destination_preview}</span>
                              <span className="mt-2 block text-sm text-stone-300">Received {formatSuggestedWaypointDate(item.received_at)} as a suggestion, not an assignment.</span>
                            </span>
                            <span className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end"><StatusPills item={item} /></span>
                          </span>
                          <span className="mt-4 block text-sm font-semibold text-amber-200 group-hover:text-amber-100">Open suggestion</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {page.total_count > 0 && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-amber-200/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-stone-300">Showing {pageStart}-{pageEnd} of {page.total_count}</p>
                    <div className="flex gap-3">
                      <button type="button" className={PAGER_BUTTON} onClick={goBack} disabled={pending || request.cursorHistory.length === 0}>Previous</button>
                      <button type="button" className={PAGER_BUTTON} onClick={goForward} disabled={pending || page.next_cursor === null}>Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
    </ExplorerWorkspaceFrame>
  );
}
