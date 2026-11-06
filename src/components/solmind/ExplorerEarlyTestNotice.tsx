"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  EARLY_TEST_NOTICE_AGREE, EARLY_TEST_NOTICE_BULLETS, EARLY_TEST_NOTICE_CHECKING,
  EARLY_TEST_NOTICE_DECLINED_BODY, EARLY_TEST_NOTICE_DECLINED_HEADING, EARLY_TEST_NOTICE_HEADING,
  EARLY_TEST_NOTICE_NOT_NOW, EARLY_TEST_NOTICE_OPENING, EARLY_TEST_NOTICE_SAVING,
  EARLY_TEST_NOTICE_UNAVAILABLE_HEADING, EARLY_TEST_NOTICE_SIGN_OUT, EARLY_TEST_NOTICE_SIGNING_OUT,
  EARLY_TEST_NOTICE_UNAVAILABLE, EXPLORER_EARLY_TEST_NOTICE_VERSION,
  type ExplorerEarlyTestNoticeStatus,
} from "@/lib/solmind/explorerEarlyTestNotice";
import { requestExplorerEarlyTestNotice } from "@/lib/solmind/explorerEarlyTestNoticeBrowserRequest";
import { EXPLORER_EARLY_TEST_NOTICE_RECHECK, ExplorerEarlyTestNoticeRecheckContext } from "@/lib/solmind/explorerEarlyTestNoticeRecheck";
import { createLogoutBrowserRequest, type LogoutBrowserRequest } from "@/lib/solmind/logoutBrowserRequest";
import { LOGOUT_RESPONSE_BUDGET_MS } from "@/lib/solmind/explorerLoginJourney";
import { ExplorerSessionOutcome } from "./ExplorerHome";

const BUTTON = "rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50";
const SECONDARY_BUTTON = "rounded-full border border-stone-500 px-5 py-3 text-sm text-stone-100 hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50";
type View = ExplorerEarlyTestNoticeStatus | "checking" | "declined" | "signed_out" | "unconfirmed";

function requestRecheck() {
  window.dispatchEvent(new Event(EXPLORER_EARLY_TEST_NOTICE_RECHECK));
}

function NoticePage({ children, initialView = "checking" }: Readonly<{
  children: ReactNode; initialView?: "checking" | "unavailable";
}>) {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  const logout = useRef<LogoutBrowserRequest | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    if (initialView === "unavailable") {
      return () => { controller.abort(); logout.current?.dispose(); };
    }
    let checking = false;
    const check = () => {
      if (checking || controller.signal.aborted) return;
      checking = true;
      void requestExplorerEarlyTestNotice("/explorer/early-test-notice/status", null, controller.signal).then(result => {
        checking = false;
        if (!controller.signal.aborted) setView(result.status);
      });
    };
    check();
    const leave = () => { controller.abort(); logout.current?.dispose(); setView("checking"); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    window.addEventListener(EXPLORER_EARLY_TEST_NOTICE_RECHECK, check);
    return () => {
      controller.abort();
      logout.current?.dispose();
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener(EXPLORER_EARLY_TEST_NOTICE_RECHECK, check);
    };
  }, [initialView]);
  useEffect(() => { if (view !== "allowed" && view !== "checking") heading.current?.focus(); }, [view]);

  async function agree() {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || submitting.current || view !== "required") return;
    submitting.current = true;
    setBusy(true);
    const result = await requestExplorerEarlyTestNotice("/explorer/early-test-notice/agree", {
      noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION, adultAffirmation: true,
    }, controller.signal);
    if (!controller.signal.aborted) { setView(result.status); setBusy(false); submitting.current = false; }
  }
  async function signOut() {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const request = createLogoutBrowserRequest({ fetch: (path, init) => fetch(path, init), responseBudgetMs: LOGOUT_RESPONSE_BUDGET_MS });
    logout.current = request;
    const result = await request?.request();
    if (!controller.signal.aborted) {
      setView(result?.outcome === "signed_out" ? "signed_out" : result?.outcome === "no_current_sign_in" ? "denied" : "unconfirmed");
      setBusy(false);
      submitting.current = false;
    }
  }
  if (view === "allowed") return <ExplorerEarlyTestNoticeRecheckContext value={requestRecheck}>{children}</ExplorerEarlyTestNoticeRecheckContext>;
  if (view === "denied" || view === "signed_out" || view === "unconfirmed") {
    return <ExplorerSessionOutcome outcome={view === "denied" ? "session_ended" : view} />;
  }
  const title = view === "required" ? EARLY_TEST_NOTICE_HEADING : view === "declined" ? EARLY_TEST_NOTICE_DECLINED_HEADING : view === "checking" ? EARLY_TEST_NOTICE_CHECKING : EARLY_TEST_NOTICE_UNAVAILABLE_HEADING;
  return <main className="min-h-dvh bg-[#050404] px-6 py-12 text-stone-100">
    <section aria-labelledby="early-test-notice-heading" className="mx-auto grid max-w-2xl gap-6">
      <h1 id="early-test-notice-heading" ref={heading} tabIndex={-1} className="rounded-md font-serif text-3xl text-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">{title}</h1>
      {view === "required" ? <>
        <p className="leading-7 text-stone-200">{EARLY_TEST_NOTICE_OPENING}</p>
        <ul className="list-disc space-y-4 pl-6 leading-7 text-stone-200">{EARLY_TEST_NOTICE_BULLETS.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON} disabled={busy} onClick={() => { void agree(); }}>{EARLY_TEST_NOTICE_AGREE}</button>
          <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setView("declined")}>{EARLY_TEST_NOTICE_NOT_NOW}</button>
        </div>
        <p role="status" className="text-sm text-stone-300">{busy ? EARLY_TEST_NOTICE_SAVING : ""}</p>
      </> : view === "declined" || view === "unavailable" ? <>
        <p className="leading-7 text-stone-200">{view === "declined" ? EARLY_TEST_NOTICE_DECLINED_BODY : EARLY_TEST_NOTICE_UNAVAILABLE}</p>
        <div><button type="button" className={BUTTON} disabled={busy} onClick={() => { void signOut(); }}>{EARLY_TEST_NOTICE_SIGN_OUT}</button></div>
        <p role="status" className="text-sm text-stone-300">{busy ? EARLY_TEST_NOTICE_SIGNING_OUT : ""}</p>
      </> : null}
    </section>
  </main>;
}

export function ExplorerEarlyTestNoticeBoundary({ children }: Readonly<{ children: ReactNode }>) {
  // Layouts persist across Next navigation. A new page gets a fresh status read.
  const pathname = usePathname();
  return <NoticePage key={pathname}>{children}</NoticePage>;
}

export function ExplorerEarlyTestNoticeUnavailable() {
  return <NoticePage initialView="unavailable">{null}</NoticePage>;
}
