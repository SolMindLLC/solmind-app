"use client";

import Image from "next/image";
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
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusPills({ item }: { item: SuggestedWaypointExplorerListItem }) {
  return (
    <>
      <SuggestedWaypointStatusPill tone={item.read ? "neutral" : "positive"}>
        {item.read ? "✓ Read" : "● Unread"}
      </SuggestedWaypointStatusPill>
      {item.receipt_acknowledged && item.acknowledged_at !== null && (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ You acknowledged receipt {formatDate(item.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

export function ExplorerSuggestedWaypointInbox() {
  const searchParams = useSearchParams();
  const requestedFocus = searchParams.get("focus");
  const [navigationOpen, setNavigationOpen] = useState(false);
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

    const query = new URLSearchParams({ pageSize: String(nextRequest.pageSize) });
    if (nextRequest.cursor !== null) {
      query.set("cursor", nextRequest.cursor);
    }

    try {
      const response = await fetch(`/explorer/waypoints/suggestions?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Unexpected Waypoint Suggestions response status.");
      }
      const result = parseSuggestedWaypointExplorerListBrowserResult(
        await response.json(),
      );
      if (controller.signal.aborted || sequence !== requestSequence.current) {
        return;
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
      setRequest(nextRequest);
      setViewState("ready");
      setNotice(
        result.data.items.length === 0
          ? "No Waypoint Suggestions are currently in your inbox."
          : `Loaded ${result.data.items.length} ${result.data.items.length === 1 ? "suggestion" : "suggestions"}.`,
      );
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
  }, []);

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

  const unavailableDestination = (label: string) => {
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
            <Link className="block rounded-lg px-4 py-2 hover:bg-white/15" href="/explorer">Home</Link>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => unavailableDestination("Talk with Mary")}>Talk with ◉ Mary</button>
            <Link className="block rounded-lg bg-white/15 px-4 py-2 font-semibold" href="/explorer/waypoints">Waypoints</Link>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => unavailableDestination("Appointments")}>Appointments</button>
            <button className="w-full rounded-lg px-4 py-2 text-left hover:bg-white/15" type="button" onClick={() => unavailableDestination("History")}>History</button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-16 pt-20 sm:px-8 lg:px-12 lg:pt-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-5">
            <p className="font-medium">◉ Mary (SolMind Virtual Guide)</p>
            <SuggestedWaypointStatusPill tone="private">◆ Private Explorer view</SuggestedWaypointStatusPill>
          </div>

          <section aria-labelledby="suggestion-inbox-title" aria-busy={pending}>
            <p className="text-sm font-semibold text-[#1d6768]">Waypoints</p>
            <h1 id="suggestion-inbox-title" className="mt-2 text-3xl font-semibold">Waypoint Suggestions</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Suggestions from your Guide remain suggestions, not assignments. You decide what to do with them.
            </p>
            <p className="mt-4 text-sm text-slate-600" role="status" aria-live="polite">{notice}</p>

            {viewState === "loading" && page === null && (
              <div className="mt-7 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">Loading Waypoint Suggestions...</div>
            )}

            {viewState === "denied" && (
              <div className="mt-7 rounded-xl border border-amber-300 bg-amber-50 p-5">
                <h2 className="text-xl font-semibold">Waypoint Suggestions unavailable</h2>
                <p className="mt-2 text-slate-700">This Explorer workspace cannot open the requested suggestions.</p>
              </div>
            )}

            {viewState === "failed" && page === null && (
              <div className="mt-7 rounded-xl border border-rose-300 bg-rose-50 p-5">
                <h2 className="text-xl font-semibold">Could not load Waypoint Suggestions</h2>
                <p className="mt-2 text-slate-700">Nothing was changed. Try loading the inbox again.</p>
                <button type="button" className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768]" onClick={() => void load(request)}>Try again</button>
              </div>
            )}

            {viewState === "ready" && page !== null && (
              <>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-sm text-slate-600">Delivered suggestions only. Opening one remains private.</p>
                  {pageSizes.length > 1 && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      Show
                      <select className="rounded-lg border border-slate-400 bg-white px-3 py-2" value={request.pageSize} onChange={changePageSize} disabled={pending}>
                        {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      per page
                    </label>
                  )}
                </div>

                {page.items.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
                    <h2 className="font-semibold">No suggestions yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Suggestions from your Guide will appear here after they are delivered.</p>
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
                          className="group block rounded-xl border border-slate-300 border-l-4 border-l-[#227a7c] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#227a7c] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#227a7c]"
                        >
                          <span className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <span>
                              <span className="block text-lg font-semibold">{item.destination_preview}</span>
                              <span className="mt-2 block text-sm text-slate-600">Received {formatDate(item.received_at)} as a suggestion, not an assignment.</span>
                            </span>
                            <span className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end"><StatusPills item={item} /></span>
                          </span>
                          <span className="mt-4 block text-sm font-semibold text-[#1d6768] group-hover:text-[#145354]">Open suggestion</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {page.total_count > 0 && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-300 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">Showing {pageStart}-{pageEnd} of {page.total_count}</p>
                    <div className="flex gap-3">
                      <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40" onClick={goBack} disabled={pending || request.cursorHistory.length === 0}>Previous</button>
                      <button type="button" className="rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] disabled:cursor-not-allowed disabled:opacity-40" onClick={goForward} disabled={pending || page.next_cursor === null}>Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
