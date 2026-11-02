"use client";

import { useMemo } from "react";
import { createGuideSignInFlowController, type GuideSignInFlowController, type GuideSignInFlowProjection } from "@/lib/solmind/guideSignInFlowController";
import type { GuideSignInBrowserFetch } from "@/lib/solmind/guideSignInBrowserTransport";
import { GUIDE_BROWSER_SIGN_IN_HOME } from "@/lib/solmind/passwordRoleSignInBrowserContract";
import { SOLMIND_ROLES } from "@/lib/solmind/roles";
import { SIGN_IN_SCREENS } from "@/lib/solmind/signInPreview";
import { PasswordRoleSignInView, type PasswordRoleSignInConfig } from "./PasswordRoleSignInView";

type Destination = typeof GUIDE_BROWSER_SIGN_IN_HOME;
export type GuideSignInProps = Readonly<{
  fetcher: GuideSignInBrowserFetch;
  responseBudgetMilliseconds: number;
  createFlowId?: () => string;
  onNavigate: (destination: Destination) => void;
  onDepart: () => void;
}>;

type ViewSnapshot = Readonly<{
  ready: boolean;
  flow: GuideSignInFlowProjection;
  codeDraft: string;
}>;
const EMPTY_FLOW: GuideSignInFlowProjection = Object.freeze({
  stage: "email", identifier: "", pending: null, outcome: null,
  hasSelector: false, destination: null,
});

/** One Guide view's transient event binding, also exercised without a DOM.
 * Commit cleanup invalidates the controller before deferred subscription cleanup.
 * A subscription owns its controller; a later subscription can create a fresh
 * one after invalidation, including React's development replay.
 * This is not authentication state or a reusable application store.
 */
export function createGuideSignInViewBinding(options: GuideSignInProps) {
  let callbacks = { onNavigate: options.onNavigate, onDepart: options.onDepart };
  let controller: GuideSignInFlowController | null = null;
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
    if (action === "send" ? state.stage !== "email" : state.stage !== "code") return;
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
    setCallbacks(next: Pick<GuideSignInProps, "onNavigate" | "onDepart">) {
      callbacks = { onNavigate: next.onNavigate, onDepart: next.onDepart };
    },
    subscribe(listener: () => void) {
      const subscription = () => listener();
      listeners.add(subscription);
      if (controller === null && !retired) {
        controller = createGuideSignInFlowController({
          fetcher: options.fetcher, responseBudgetMilliseconds: options.responseBudgetMilliseconds,
          createFlowId: options.createFlowId ?? (() => crypto.randomUUID()),
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
      controller.useDifferentEmail();
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
const GUIDE_SIGN_IN_CONFIG: PasswordRoleSignInConfig = Object.freeze({
  role: SOLMIND_ROLES.GUIDE,
  passwordScreen: SIGN_IN_SCREENS.guidePassword,
  identifierInputType: "email",
  invalidIdentifierOutcome: "invalid_email",
  invalidIdentifierMessage: "Enter a valid email address.",
  openingHomeMessage: "Opening your Guide home...",
});

/** A fixed Guide view: Paul's approved A3 and A4 screens through the shared
 * PasswordRoleSignInView, which owns the password's lifetime (see there).
 * Function ports originate in the client composition, not server props.
 */
export function GuideSignIn(props: GuideSignInProps) {
  const binding = useMemo(() => createGuideSignInViewBinding({
    fetcher: props.fetcher, responseBudgetMilliseconds: props.responseBudgetMilliseconds,
    createFlowId: props.createFlowId,
    onNavigate: noop, onDepart: noop,
  }), [props.fetcher, props.responseBudgetMilliseconds, props.createFlowId]);
  return <PasswordRoleSignInView binding={binding} config={GUIDE_SIGN_IN_CONFIG} onNavigate={props.onNavigate} onDepart={props.onDepart} />;
}
