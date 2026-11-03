"use client";

import { ExplorerOverviewHome } from "./ExplorerOverviewHome";
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createLogoutBrowserRequest, type LogoutBrowserFetch } from "@/lib/solmind/logoutBrowserRequest";
import {
  createExplorerExpiryClock, EXPLORER_REENTRY_PATH, LOGOUT_RESPONSE_BUDGET_MS,
  SIGN_OUT_UNCERTAINTY, SIGNED_OUT_PRIVACY, type ExplorerExpiry,
} from "@/lib/solmind/explorerLoginJourney";

type Screen = "home" | "signed_out" | "no_current_sign_in" | "session_ended" | "unconfirmed" | "restoring";
type Snapshot = Readonly<{ screen: Screen; pending: boolean; warning: boolean }>;
type HomePorts = Readonly<{
  fetch: LogoutBrowserFetch;
  wall(): number;
  monotonic(): number;
  schedule(callback: () => void, milliseconds: number): () => void;
}>;

/** One mounted home lifetime, with no authority beyond its server projection.
 * Tests exercise these event edges; they do not substitute for mounted React.
 */
export function createExplorerHomeViewBinding(session: ExplorerExpiry, ports: HomePorts) {
  const listeners = new Set<() => void>();
  const initial: Snapshot = Object.freeze({ screen: "home", pending: false, warning: false });
  let snapshot = initial;
  let retired = false;
  let active: Readonly<{
    request: NonNullable<ReturnType<typeof createLogoutBrowserRequest>>;
    clock: NonNullable<ReturnType<typeof createExplorerExpiryClock>>;
  }> | null = null;
  let stopTimer: (() => void) | null = null;
  let timerVersion = 0;

  function publish(next: Snapshot) {
    snapshot = Object.freeze(next);
    for (const notify of listeners) { try { notify(); } catch { /* No underlying error output. */ } }
  }
  function clearTimer() {
    timerVersion += 1;
    const stop = stopTimer;
    stopTimer = null;
    try { stop?.(); } catch { /* Best effort timer removal. */ }
  }
  function clear() {
    const previous = active;
    active = null; // Invalidate before cancellation can call any continuation.
    clearTimer();
    previous?.request.dispose();
  }
  function end(screen: Exclude<Screen, "home">) {
    retired = true;
    clear();
    publish({ screen, pending: false, warning: false });
  }
  function tick(expected = active, expectedVersion = timerVersion) {
    const current = active;
    if (current === null || current !== expected || expectedVersion !== timerVersion || retired || listeners.size === 0) return;
    const version = ++timerVersion;
    stopTimer = null;
    let display;
    try { display = current.clock.read(ports.wall(), ports.monotonic()); }
    catch { end("session_ended"); return; }
    if (display.ended) { end("session_ended"); return; }
    if (snapshot.warning !== display.warning) publish({ ...snapshot, warning: display.warning });
    if (active !== current || version !== timerVersion || retired || listeners.size === 0) return;
    try {
      const stop = ports.schedule(() => tick(current, version), Math.min(1_000, Math.max(1, Math.ceil(display.remainingMilliseconds))));
      if (active === current && version === timerVersion && !retired && listeners.size > 0) stopTimer = stop;
      else stop();
    }
    catch { end("session_ended"); }
  }
  function start() {
    if (active !== null || retired) return;
    try {
      const clock = createExplorerExpiryClock(session, ports.wall(), ports.monotonic());
      const request = createLogoutBrowserRequest({ fetch: ports.fetch, responseBudgetMs: LOGOUT_RESPONSE_BUDGET_MS });
      if (clock === null || request === null) { request?.dispose(); end("session_ended"); return; }
      const current = Object.freeze({ request, clock });
      active = current;
      const version = timerVersion;
      publish(initial);
      tick(current, version);
    } catch { end("session_ended"); }
  }
  return Object.freeze({
    read: () => snapshot,
    readServer: () => initial,
    subscribe(notify: () => void) {
      const subscription = () => notify();
      listeners.add(subscription);
      if (active === null && !retired) start();
      let live = true;
      return () => {
        if (!live) return;
        live = false;
        listeners.delete(subscription);
        if (listeners.size === 0) clear();
      };
    },
    invalidateView: clear,
    suspend() { retired = true; end("restoring"); },
    recheck() {
      clearTimer();
      tick();
    },
    async signOut(): Promise<void> {
      const current = active;
      if (current === null || retired || snapshot.screen !== "home" || snapshot.pending) return;
      publish({ ...snapshot, pending: true });
      if (active !== current || retired || listeners.size === 0) return;
      let outcome: string;
      try { outcome = (await current.request.request()).outcome; }
      catch { outcome = "unavailable"; }
      if (active !== current || retired || listeners.size === 0) return;
      end(outcome === "signed_out" ? "signed_out" : outcome === "no_current_sign_in" ? "no_current_sign_in" : "unconfirmed");
    },
  });
}

const OUTCOME_LINK =
  "inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-stone-950 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

export function ExplorerSessionOutcome({ outcome }: Readonly<{ outcome: Exclude<Screen, "home"> }>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [outcome]);
  const heading = outcome === "signed_out" ? "You're signed out" : outcome === "no_current_sign_in" ? "No current sign-in was found at this browser address." : outcome === "session_ended" ? "Your session ended" : outcome === "restoring" ? "Checking your session..." : "Sign-out could not be confirmed";
  // The dark and amber page look only: no workspace menu, because no signed-in
  // session is shown here. The text and the re-entry link are unchanged.
  return <main className="min-h-dvh bg-[#050404] px-6 py-16 text-stone-100">
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="rounded-md font-serif text-3xl leading-tight text-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" ref={headingRef} tabIndex={-1}>{heading}</h1>
      {outcome === "signed_out" ? <p className="text-sm leading-6 text-stone-300">{SIGNED_OUT_PRIVACY}</p> : null}
      {outcome === "unconfirmed" ? <p className="rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50" role="alert">{SIGN_OUT_UNCERTAINTY}</p> : null}
      {outcome === "session_ended" ? <p className="text-sm leading-6 text-stone-300">Sign in again to continue as an Explorer.</p> : null}
      {outcome !== "restoring" ? <p><a className={OUTCOME_LINK} href={EXPLORER_REENTRY_PATH}>Sign in</a></p> : null}
    </div>
  </main>;
}

const browserPorts: HomePorts = {
  fetch: (path, init) => globalThis.fetch(path, init),
  wall: () => Date.now(), monotonic: () => performance.now(),
  schedule: (callback, milliseconds) => {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
};

export function ExplorerHome({ session }: Readonly<{ session: ExplorerExpiry }>) {
  const { expiresAt, observedAt } = session;
  const binding = useMemo(() => createExplorerHomeViewBinding({ expiresAt, observedAt }, browserPorts), [expiresAt, observedAt]);
  useLayoutEffect(() => () => binding.invalidateView(), [binding]);
  const state = useSyncExternalStore(binding.subscribe, binding.read, binding.readServer);
  useEffect(() => {
    const leave = () => binding.suspend();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); else binding.recheck(); };
    const visible = () => { if (document.visibilityState === "visible") binding.recheck(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [binding]);
  if (state.screen !== "home") return <ExplorerSessionOutcome outcome={state.screen} />;
  // Overview (Paul's 2026-11-02 decisions): the signed-in home in the Explorer
  // workspace frame. Only the pending and warning flags and the sign-out
  // action leave this binding.
  return <ExplorerOverviewHome onSignOut={() => { void binding.signOut(); }} pending={state.pending} warning={state.warning} />;
}
