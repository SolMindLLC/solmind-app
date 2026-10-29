"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SignInPreviewView } from "./SignInPreviewParts";
import { SOLMIND_ROLES } from "@/lib/solmind/roles";
import { INITIAL_SIGN_IN_PREVIEW_STATE, SIGN_IN_HEADING_ID, SIGN_IN_SCREENS, type SignInNoticeKey } from "@/lib/solmind/signInPreview";
import {
  createExplorerSignInFlowController,
  type ExplorerSignInFlowController,
  type ExplorerSignInFlowProjection,
} from "@/lib/solmind/explorerSignInFlowController";
import type { ExplorerSignInBrowserFetch } from "@/lib/solmind/explorerSignInBrowserTransport";
import type { EXPLORER_BROWSER_SIGN_IN_HOME } from "@/lib/solmind/signInBrowserContract";

type Destination = typeof EXPLORER_BROWSER_SIGN_IN_HOME;
export type ExplorerSignInStatus = Readonly<{
  ready: boolean;
  stage: ExplorerSignInFlowProjection["stage"];
  pending: ExplorerSignInFlowProjection["pending"];
  outcome: ExplorerSignInFlowProjection["outcome"];
}>;
export type ExplorerSignInProps = Readonly<{
  fetcher: ExplorerSignInBrowserFetch;
  responseBudgetMilliseconds: number;
  createFlowId?: () => string;
  renderStatus: (status: ExplorerSignInStatus) => ReactNode;
  onNavigate: (destination: Destination) => void;
  onDepart: () => void;
}>;

type ViewSnapshot = Readonly<{
  ready: boolean;
  flow: ExplorerSignInFlowProjection;
  codeDraft: string;
}>;
const EMPTY_FLOW: ExplorerSignInFlowProjection = Object.freeze({
  stage: "email", identifier: "", pending: null, outcome: null,
  hasSelector: false, destination: null,
});

/** One Explorer view's transient event binding, also exercised without a DOM.
 * Commit cleanup invalidates the controller before deferred subscription cleanup.
 * A subscription owns its controller; a later subscription can create a fresh
 * one after invalidation, including React's development replay.
 * This is not authentication state or a reusable application store.
 */
export function createExplorerSignInViewBinding(options: Omit<ExplorerSignInProps, "renderStatus">) {
  let callbacks = { onNavigate: options.onNavigate, onDepart: options.onDepart };
  let controller: ExplorerSignInFlowController | null = null;
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
  async function submit(action: "send" | "resend" | "verify"): Promise<void> {
    const current = controller;
    if (retired || current === null || current.read().pending !== null) return;
    const state = current.read();
    if (action === "send" ? state.stage !== "email" : state.stage !== "code") return;
    if (action === "verify" && !state.hasSelector) return;
    if (action !== "verify") codeDraft = "";
    const completion = action === "verify" ? current.verify(codeDraft) : current[action]();
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
    setCallbacks(next: Pick<ExplorerSignInProps, "onNavigate" | "onDepart">) {
      callbacks = { onNavigate: next.onNavigate, onDepart: next.onDepart };
    },
    subscribe(listener: () => void) {
      const subscription = () => listener();
      listeners.add(subscription);
      if (controller === null && !retired) {
        controller = createExplorerSignInFlowController({
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
    verify: () => submit("verify"),
    reset() {
      if (retired || controller === null || controller.read().stage === "complete") return;
      codeDraft = "";
      controller.useDifferentEmail();
      publish();
    },
    depart() {
      if (retired) return;
      retired = true;
      clear();
      try { callbacks.onDepart(); } catch { /* Remain inert if the owner cannot depart. */ }
    },
  });
}

const noop = () => undefined;

/** Explorer sign-in view composed by LoginExperience. Function props come from
 * that client composition, not across a Server Component boundary.
 * The owner supplies outcome copy and navigation; no defaults exist.
 */
export function ExplorerSignIn(props: ExplorerSignInProps) {
  const binding = useMemo(() => createExplorerSignInViewBinding({
    fetcher: props.fetcher,
    responseBudgetMilliseconds: props.responseBudgetMilliseconds,
    createFlowId: props.createFlowId,
    onNavigate: noop,
    onDepart: noop,
  }), [props.fetcher, props.responseBudgetMilliseconds, props.createFlowId]);
  // Install the required current callbacks in commit, before subscription can
  // activate a controller. Callback identity changes do not discard an attempt.
  useLayoutEffect(() => {
    binding.setCallbacks({ onNavigate: props.onNavigate, onDepart: props.onDepart });
  }, [binding, props.onNavigate, props.onDepart]);
  // Store unsubscription is passive in React. End the old view's lifetime in
  // commit so a queued result cannot navigate before that later unsubscribe.
  // Keep this separate from callback updates, which preserve active attempts.
  useLayoutEffect(() => () => binding.invalidateView(), [binding]);
  const snapshot = useSyncExternalStore(binding.subscribe, binding.read, binding.readServer);
  const [notice, setNotice] = useState<SignInNoticeKey | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const screen = snapshot.flow.stage === "code" ? SIGN_IN_SCREENS.enterCode : SIGN_IN_SCREENS.explorerEmail;
  const shownScreen = useRef(screen);
  useEffect(() => {
    if (shownScreen.current !== screen) {
      shownScreen.current = screen;
      root.current?.querySelector<HTMLElement>(`#${SIGN_IN_HEADING_ID}`)?.focus();
    }
  }, [screen]);
  const unavailable = !snapshot.ready || snapshot.flow.stage === "complete";
  const status = Object.freeze({
    ready: snapshot.ready, stage: snapshot.flow.stage,
    pending: snapshot.flow.pending, outcome: snapshot.flow.outcome,
  });

  return (
    <div ref={root}>
      <SignInPreviewView
        state={{ ...INITIAL_SIGN_IN_PREVIEW_STATE, screen, role: SOLMIND_ROLES.EXPLORER, email: snapshot.flow.identifier, notice }}
        emailDraft={snapshot.flow.identifier}
        codeDraft={snapshot.codeDraft}
        hidePreviewAdditions
        pending={snapshot.flow.pending !== null}
        inputsDisabled={unavailable}
        sendDisabled={unavailable}
        verifyDisabled={unavailable || !snapshot.flow.hasSelector}
        resendDisabled={unavailable}
        status={props.renderStatus(status)}
        onChooseRole={noop}
        onChooseDifferentRole={() => { setNotice(null); binding.depart(); }}
        onEmailDraftChange={value => { setNotice(null); binding.setIdentifier(value); }}
        onCodeDraftChange={value => { setNotice(null); binding.setCode(value); }}
        onSubmitEmail={event => { event.preventDefault(); setNotice(null); void binding.send(); }}
        onSubmitCode={event => { event.preventDefault(); setNotice(null); void binding.verify(); }}
        onRequestNewCode={() => { setNotice(null); void binding.resend(); }}
        onUseDifferentEmail={() => { setNotice(null); binding.reset(); }}
        onExplain={value => { if (value === "help" || value === "phone") setNotice(value); }}
        onDismissNotice={() => setNotice(null)}
        onSubmitPassword={noop}
        onPasswordShownChange={noop}
        onRememberTickedChange={noop}
        onPreviewCodeScreen={noop}
        onPreviewRememberedChange={noop}
      />
    </div>
  );
}
