"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createAdminSignInFlowController, type AdminSignInFlowController, type AdminSignInFlowProjection } from "@/lib/solmind/adminSignInFlowController";
import type { AdminSignInBrowserFetch } from "@/lib/solmind/adminSignInBrowserTransport";
import { ADMIN_BROWSER_SIGN_IN_HOME, PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE } from "@/lib/solmind/passwordRoleSignInBrowserContract";
import { SOLMIND_ROLES } from "@/lib/solmind/roles";
import { SOLMIND_LOGO_SRC } from "@/lib/solmind/explorerCompassComparison";
import { CHOOSE_DIFFERENT_ROLE_LABEL, CODE_LENGTH, EMAIL_PLACEHOLDER, ENTER_CODE_COPY, PASSWORD_SIGN_IN_COPY, PASSWORD_SIGN_IN_IDENTIFIER_LABELS, SIGN_IN_HEADING_ID, enterCodeIntro, signingInAsLine } from "@/lib/solmind/signInPreview";

type Destination = typeof ADMIN_BROWSER_SIGN_IN_HOME;
export type AdminSignInProps = Readonly<{
  fetcher: AdminSignInBrowserFetch;
  responseBudgetMilliseconds: number;
  onNavigate: (destination: Destination) => void;
  onDepart: () => void;
}>;

type ViewSnapshot = Readonly<{
  ready: boolean;
  flow: AdminSignInFlowProjection;
  codeDraft: string;
}>;
const EMPTY_FLOW: AdminSignInFlowProjection = Object.freeze({
  stage: "identifier", identifier: "", pending: null, outcome: null,
  hasSelector: false, destination: null,
});

/** One Admin view's transient event binding, also exercised without a DOM.
 * Commit cleanup invalidates the controller before deferred subscription cleanup.
 * A subscription owns its controller; a later subscription can create a fresh
 * one after invalidation, including React's development replay.
 * This is not authentication state or a reusable application store.
 */
export function createAdminSignInViewBinding(options: AdminSignInProps) {
  let callbacks = { onNavigate: options.onNavigate, onDepart: options.onDepart };
  let controller: AdminSignInFlowController | null = null;
  let codeDraft = "";
  let retired = false;
  let navigated = false;
  const listeners = new Set<() => void>();
  const initial: ViewSnapshot = Object.freeze({ ready: false, flow: EMPTY_FLOW, codeDraft: "" });
  let snapshot = initial;

  function publish() {
    snapshot = Object.freeze({ ready: controller !== null && !retired, flow: controller?.read() ?? EMPTY_FLOW, codeDraft });
    for (const listener of listeners) {
      try { listener(); } catch { /* Listener failures cannot expose request data. */ }
    }
  }
  function clear() {
    const previous = controller;
    controller = null;
    codeDraft = "";
    previous?.dispose();
    publish();
  }
  async function submit(action: "send" | "resend" | "verify", rawPassword?: string): Promise<void> {
    const current = controller;
    if (retired || current === null || current.read().pending !== null) return;
    const state = current.read();
    if (action === "send" ? state.stage !== "identifier" : state.stage !== "code") return;
    if (action === "verify" && !state.hasSelector) return;
    if (action !== "verify") codeDraft = "";
    const completion = action === "verify" ? current.verify(rawPassword, codeDraft) : current[action]();
    publish();
    await completion;
    if (retired || current !== controller || listeners.size === 0) return;
    // Never use the async marker as a saved state: a reset may already have won.
    const latest = current.read();
    if (latest.stage === "complete") codeDraft = "";
    publish();
    if (!retired && current === controller && listeners.size > 0 &&
        latest.stage === "complete" && latest.destination !== null && !navigated) {
      navigated = true;
      try { callbacks.onNavigate(latest.destination); } catch { /* No retry or underlying error publication. */ }
    }
  }

  return Object.freeze({
    read: () => snapshot,
    readServer: () => initial,
    invalidateView() {
      clear();
    },
    setCallbacks(next: Pick<AdminSignInProps, "onNavigate" | "onDepart">) {
      callbacks = { onNavigate: next.onNavigate, onDepart: next.onDepart };
    },
    subscribe(listener: () => void) {
      const subscription = () => listener();
      listeners.add(subscription);
      if (controller === null && !retired) {
        controller = createAdminSignInFlowController({
          fetcher: options.fetcher, responseBudgetMilliseconds: options.responseBudgetMilliseconds,
        });
        navigated = false;
        codeDraft = "";
        publish();
      }
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(subscription);
        if (listeners.size === 0) clear();
      };
    },
    setIdentifier(value: string) {
      if (typeof value !== "string" || retired || controller === null || controller.read().stage === "complete") return;
      if (value === controller.read().identifier) return;
      codeDraft = "";
      controller.setIdentifier(value);
      publish();
    },
    setCode(value: string) {
      if (typeof value !== "string" || retired || controller === null || controller.read().stage !== "code" || controller.read().pending !== null) return;
      codeDraft = value;
      publish();
    },
    send: () => submit("send"),
    resend: () => submit("resend"),
    verify: (rawPassword: string) => typeof rawPassword === "string" ? submit("verify", rawPassword) : Promise.resolve(),
    reset() {
      if (retired || controller === null || controller.read().stage === "complete") return;
      codeDraft = "";
      controller.useDifferentIdentifier();
      publish();
    },
    suspend() { retired = true; clear(); },
    depart() {
      if (retired) return;
      retired = true;
      clear();
      try { callbacks.onDepart(); } catch { /* Remain inert if the owner cannot depart. */ }
    },
  });
}

const noop = () => undefined;
const FOCUS = "focus:outline-2 focus:outline-offset-2 focus:outline-[#f0a64a]";
const LINK = "text-[#f3b566] hover:text-[#ffd08f] focus:outline-2 focus:outline-offset-2 focus:outline-[#f0a64a]";
const inputStyle: CSSProperties = { width: "100%", height: 54, boxSizing: "border-box", padding: "0 16px", borderRadius: 10, border: "1px solid #4a3b2b", background: "#0f0c09", color: "#f4ede3", font: "inherit", fontSize: 17 };
const linkStyle: CSSProperties = { border: 0, padding: 0, background: "transparent", font: "inherit", cursor: "pointer" };
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f0a64a" };

/** A fixed Admin view. The password lives only in its uncontrolled input and the
 * current verify request; it is never a React value, projection, or send field.
 * Function ports originate in the client composition, not server props.
 */
export function AdminSignIn(props: AdminSignInProps) {
  const { onNavigate, onDepart } = props;
  const password = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [passwordShown, setPasswordShown] = useState(false);
  const binding = useMemo(() => createAdminSignInViewBinding({
    fetcher: props.fetcher, responseBudgetMilliseconds: props.responseBudgetMilliseconds,
    onNavigate: noop, onDepart: noop,
  }), [props.fetcher, props.responseBudgetMilliseconds]);
  useLayoutEffect(() => {
    const clear = () => { if (password.current !== null) password.current.value = ""; };
    binding.setCallbacks({
      onNavigate: destination => { clear(); onNavigate(destination); },
      onDepart: () => { clear(); onDepart(); },
    });
  }, [binding, onNavigate, onDepart]);
  useLayoutEffect(() => () => {
    if (password.current !== null) password.current.value = "";
    binding.invalidateView();
  }, [binding]);
  const state = useSyncExternalStore(binding.subscribe, binding.read, binding.readServer);
  const isCode = state.flow.stage === "code";
  const previousCode = useRef(isCode);
  useEffect(() => {
    if (previousCode.current !== isCode) { previousCode.current = isCode; heading.current?.focus(); }
  }, [isCode]);
  useEffect(() => {
    const leave = () => {
      if (password.current !== null) password.current.value = "";
      binding.suspend();
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => { window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, [binding]);
  const pending = state.flow.pending !== null;
  const unavailable = !state.ready || state.flow.stage === "complete";
  const status = !state.ready ? "Preparing sign-in..." : pending
    ? state.flow.pending === "verify" ? "Checking your password and code..." : "Requesting your code..."
    : state.flow.stage === "complete" ? "Opening your Admin home..."
    : state.flow.outcome === "invalid_identifier" ? "Enter a valid email address or Admin username."
    : state.flow.outcome === "not_matched" ? PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE
    : state.flow.outcome !== null && state.flow.outcome !== "verification_code_requested"
      ? "We couldn't confirm sign-in. Please try signing in again." : null;
  const clearPassword = () => { if (password.current !== null) password.current.value = ""; setPasswordShown(false); };
  return <main style={{ minHeight: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 32px", background: "#0c0a08", color: "#f4ede3", fontFamily: "Figtree, system-ui, sans-serif" }}>
    <Image alt="SolMind: Illuminate, Understand, Grow" height={159} width={220} loading="eager" src={SOLMIND_LOGO_SRC} unoptimized style={{ marginTop: 40, width: 220, height: 159, objectFit: "contain" }} />
    <h1 id={SIGN_IN_HEADING_ID} ref={heading} tabIndex={-1} style={{ margin: "20px 0 0", fontFamily: "Newsreader, Georgia, serif", fontWeight: 400, fontSize: 44, lineHeight: 1.15, textAlign: "center" }}>{isCode ? ENTER_CODE_COPY.heading : PASSWORD_SIGN_IN_COPY.heading}</h1>
    <p style={{ margin: "8px 0 0", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, color: "#d9c7ad" }}>
      <span>{signingInAsLine(SOLMIND_ROLES.ADMIN)}</span><span aria-hidden="true">&middot;</span>
      <button type="button" className={LINK} style={linkStyle} onClick={() => { clearPassword(); binding.depart(); }}>{CHOOSE_DIFFERENT_ROLE_LABEL}</button>
    </p>
    <p style={{ margin: "10px 0 0", fontSize: 18, lineHeight: 1.5, color: "#f0a64a", textAlign: "center", maxWidth: 480 }}>{isCode ? enterCodeIntro(state.flow.identifier) : PASSWORD_SIGN_IN_COPY.intro}</p>
    <form aria-busy={pending || undefined} style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 10, marginTop: 32 }} onSubmit={event => {
      event.preventDefault();
      if (isCode) void binding.verify(password.current?.value ?? "");
      else void binding.send();
    }}>
      <label htmlFor="admin-identifier" style={labelStyle}>{PASSWORD_SIGN_IN_IDENTIFIER_LABELS[SOLMIND_ROLES.ADMIN]}</label>
      <input id="admin-identifier" type="text" maxLength={512} autoComplete="username" placeholder={EMAIL_PLACEHOLDER} required className={FOCUS} style={inputStyle} disabled={unavailable || pending || isCode} value={state.flow.identifier} onChange={event => { clearPassword(); binding.setIdentifier(event.target.value); }} />
      <label htmlFor="admin-password" style={{ ...labelStyle, marginTop: 10 }}>{PASSWORD_SIGN_IN_COPY.passwordLabel}</label>
      <div style={{ position: "relative", display: "flex" }}>
        <input ref={password} id="admin-password" type={passwordShown ? "text" : "password"} autoComplete="current-password" placeholder={PASSWORD_SIGN_IN_COPY.passwordPlaceholder} required className={FOCUS} style={{ ...inputStyle, paddingRight: 64 }} disabled={unavailable || pending} />
        <button type="button" className={FOCUS} disabled={unavailable || pending} aria-label={passwordShown ? PASSWORD_SIGN_IN_COPY.hidePasswordLabel : PASSWORD_SIGN_IN_COPY.showPasswordLabel} aria-pressed={passwordShown} onClick={() => setPasswordShown(shown => !shown)} style={{ position: "absolute", right: 6, top: 5, width: 52, height: 44, border: 0, borderRadius: 8, background: "transparent", color: "#bfb2a0", cursor: "pointer" }}>{passwordShown ? "Hide" : "Show"}</button>
      </div>
      {isCode ? <>
        <label htmlFor="admin-code" style={{ ...labelStyle, marginTop: 10 }}>{ENTER_CODE_COPY.codeLabel}</label>
        <input id="admin-code" type="text" autoComplete="one-time-code" inputMode="numeric" maxLength={CODE_LENGTH} placeholder={ENTER_CODE_COPY.codePlaceholder} required className={FOCUS} style={{ ...inputStyle, height: 62, fontSize: 26, letterSpacing: "0.4em", textAlign: "center" }} disabled={unavailable || pending} value={state.codeDraft} onChange={event => binding.setCode(event.target.value)} />
      </> : null}
      <button type="submit" disabled={unavailable || pending || (isCode && !state.flow.hasSelector)} style={{ width: "100%", height: 58, marginTop: 14, border: 0, borderRadius: 12, background: "#f0a64a", color: "#1a1208", font: "inherit", fontSize: 18, fontWeight: 600, cursor: "pointer" }}>{isCode ? ENTER_CODE_COPY.verifyLabel : PASSWORD_SIGN_IN_COPY.sendCodeLabel}</button>
      <div role="status" aria-live="polite" style={{ minHeight: "1.5em", lineHeight: 1.5 }}>{status}</div>
    </form>
    {isCode ? <>
      <div style={{ width: "100%", maxWidth: 480, marginTop: 12, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
        <button type="button" className={LINK} style={linkStyle} disabled={unavailable || pending} onClick={() => { clearPassword(); void binding.resend(); }}>{ENTER_CODE_COPY.resendLabel}</button>
        <button type="button" className={LINK} style={linkStyle} onClick={() => { clearPassword(); binding.reset(); }}>{ENTER_CODE_COPY.differentEmailLabel}</button>
      </div>
      <p style={{ marginTop: 18, fontSize: 15, color: "#bfb2a0" }}>{ENTER_CODE_COPY.spamHint}</p>
    </> : null}
  </main>;
}
