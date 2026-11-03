"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE } from "@/lib/solmind/passwordRoleSignInBrowserContract";
import {
  ENTER_CODE_COPY, INITIAL_SIGN_IN_PREVIEW_STATE, SIGN_IN_HEADING_ID, SIGN_IN_SCREENS,
  type PasswordSignInRole, type SignInNoticeKey, type SignInScreen,
} from "@/lib/solmind/signInPreview";
import { SignInPreviewView } from "./SignInPreviewParts";

/** The approved A3/A3A password field; its id is pinned by the sign-in preview tests. */
const PASSWORD_FIELD_SELECTOR = "#a3pass";

/**
 * Paul's approved help line (2026-11-02), shown under every Guide or Admin
 * refusal on the code screen, whatever its cause, so it never says which part
 * failed. It quotes the visible button label, so the two cannot drift apart.
 */
export const PASSWORD_ROLE_REENTER_PASSWORD_LINE =
  `To re-enter your password, choose '${ENTER_CODE_COPY.differentEmailLabel}'.`;

type PasswordRoleFlow = Readonly<{
  stage: string;
  identifier: string;
  pending: string | null;
  outcome: string | null;
  hasSelector: boolean;
}>;
type PasswordRoleSnapshot = Readonly<{ ready: boolean; flow: PasswordRoleFlow; codeDraft: string }>;

/** The existing Guide or Admin view binding, unchanged, seen through what this view needs. */
export type PasswordRoleViewBinding<Destination extends string> = Readonly<{
  read(): PasswordRoleSnapshot;
  readServer(): PasswordRoleSnapshot;
  invalidateView(): void;
  setCallbacks(next: { onNavigate: (destination: Destination) => void; onDepart: () => void }): void;
  subscribe(listener: () => void): () => void;
  setIdentifier(value: string): void;
  setCode(value: string): void;
  send(): Promise<void>;
  resend(): Promise<void>;
  verify(rawPassword: string): Promise<void>;
  reset(): void;
  suspend(): void;
  depart(): void;
}>;

/** The fixed differences between the Guide and Admin screens. */
export type PasswordRoleSignInConfig = Readonly<{
  role: PasswordSignInRole;
  passwordScreen: SignInScreen;
  identifierInputType: "email" | "text";
  identifierMaxLength?: number;
  invalidIdentifierOutcome: string;
  invalidIdentifierMessage: string;
  openingHomeMessage: string;
}>;

const noop = () => undefined;
// The status region stays mounted so its messages are announced; empty, it takes no space.
const emptyStatusStyle = { margin: 0 } as const;
const statusStyle = { margin: "12px 0 0", lineHeight: 1.5, textAlign: "center" } as const;
const statusLineStyle = { display: "block" } as const;

function clearPasswordField(root: HTMLElement | null) {
  const field = root?.querySelector<HTMLInputElement>(PASSWORD_FIELD_SELECTOR) ?? null;
  if (field !== null) field.value = "";
}

/**
 * The connected Guide and Admin sign-in, drawn with Paul's approved A3/A3A and
 * A4 screens through the shared SignInPreviewView, as the Explorer screen is.
 * The approved A4 has no password field, so the password typed on A3/A3A is
 * read once from its uncontrolled field at "Send my code", which empties the
 * field, and held only in a private ref (the accepted sign-in contract keeps
 * it only in the page's memory until the A4 submit): never React state, props,
 * markup, logs, URLs or browser storage. The send request never carries it;
 * verify does, and only with a non-empty code. Because the approved A4 has no
 * password field, it is also kept across "Send a new code" and a refusal on A4
 * (Paul confirmed this on 2026-11-02), and cleared on a failed send, success,
 * "Use a different email", "Choose a different role", an identifier edit,
 * navigation, departure, unmount and pagehide. After any refusal on A4 the
 * status adds the help line naming "Use a different email", the way to
 * re-enter the password. The status region stays mounted for screen readers
 * and takes no space while it is empty.
 */
export function PasswordRoleSignInView<Destination extends string>({ binding, config, onNavigate, onDepart }: Readonly<{
  binding: PasswordRoleViewBinding<Destination>;
  config: PasswordRoleSignInConfig;
  onNavigate: (destination: Destination) => void;
  onDepart: () => void;
}>) {
  const root = useRef<HTMLDivElement>(null);
  const held = useRef<string | null>(null);
  const [passwordShown, setPasswordShown] = useState(false);
  const [notice, setNotice] = useState<SignInNoticeKey | null>(null);
  // Install the current callbacks in commit, before subscription can activate a
  // controller. Callback identity changes do not discard an attempt.
  useLayoutEffect(() => {
    const node = root.current;
    const forget = () => { held.current = null; clearPasswordField(node); };
    binding.setCallbacks({
      onNavigate: destination => { forget(); onNavigate(destination); },
      onDepart: () => { forget(); onDepart(); },
    });
  }, [binding, onNavigate, onDepart]);
  // End the old view's lifetime in commit, as the hand-built screens did.
  useLayoutEffect(() => {
    const node = root.current;
    return () => {
      held.current = null;
      clearPasswordField(node);
      binding.invalidateView();
    };
  }, [binding]);
  const snapshot = useSyncExternalStore(binding.subscribe, binding.read, binding.readServer);
  useEffect(() => {
    const node = root.current;
    const leave = () => {
      held.current = null;
      clearPasswordField(node);
      binding.suspend();
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => { window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, [binding]);

  const { flow } = snapshot;
  // A4 stays on screen while the home opens, so no empty password form flashes.
  const screen = flow.stage === "code" || flow.stage === "complete" ? SIGN_IN_SCREENS.enterCode : config.passwordScreen;
  const shownScreen = useRef(screen);
  useEffect(() => {
    if (shownScreen.current !== screen) {
      shownScreen.current = screen;
      root.current?.querySelector<HTMLElement>(`#${SIGN_IN_HEADING_ID}`)?.focus();
    }
  }, [screen]);

  const pending = flow.pending !== null;
  const unavailable = !snapshot.ready || flow.stage === "complete";
  const statusText = !snapshot.ready ? "Preparing sign-in..." : pending
    ? flow.pending === "verify" ? "Checking your password and code..." : "Requesting your code..."
    : flow.stage === "complete" ? config.openingHomeMessage
    : flow.outcome === config.invalidIdentifierOutcome ? config.invalidIdentifierMessage
    : flow.outcome === "not_matched" ? PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE
    : flow.outcome !== null && flow.outcome !== "verification_code_requested"
      ? "We couldn't confirm sign-in. Please try signing in again." : null;
  // On A4 a shown status, once nothing is pending, is always a refusal: a
  // requested code shows none. The help line then follows it in the same region.
  const helpLine = snapshot.ready && !pending && flow.stage === "code" && statusText !== null
    ? PASSWORD_ROLE_REENTER_PASSWORD_LINE : null;

  const forgetAll = () => {
    held.current = null;
    clearPasswordField(root.current);
    setPasswordShown(false);
  };
  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const field = event.currentTarget.querySelector<HTMLInputElement>(PASSWORD_FIELD_SELECTOR);
    if (field === null) { held.current = null; return; }
    // Read once, then empty the field: from here the password lives only in the private ref.
    held.current = field.value;
    field.value = "";
    setPasswordShown(false);
    void binding.send().then(() => {
      // A failed send stays on A3/A3A with an empty password field; only a requested code keeps it for A4.
      if (binding.read().flow.stage !== "code") held.current = null;
    });
  };
  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const password = held.current;
    // An empty code never sends the password (the connected code field is also required).
    if (password === null || binding.read().codeDraft === "") return;
    void binding.verify(password).then(() => {
      if (binding.read().flow.stage === "complete") held.current = null;
    });
  };

  return (
    <div ref={root}>
      <SignInPreviewView
        state={{ ...INITIAL_SIGN_IN_PREVIEW_STATE, screen, role: config.role, email: flow.identifier, notice, passwordShown }}
        emailDraft={flow.identifier}
        codeDraft={snapshot.codeDraft}
        hidePreviewAdditions
        connectedPasswordSignIn
        identifierInputType={config.identifierInputType}
        identifierMaxLength={config.identifierMaxLength}
        pending={pending}
        inputsDisabled={unavailable}
        sendDisabled={unavailable}
        verifyDisabled={unavailable || !flow.hasSelector}
        resendDisabled={unavailable}
        status={
          <p aria-live="polite" role="status" style={statusText === null ? emptyStatusStyle : statusStyle}>
            {helpLine === null ? statusText : (
              <>
                <span style={statusLineStyle}>{statusText}</span>
                <span style={statusLineStyle}>{helpLine}</span>
              </>
            )}
          </p>
        }
        onChooseRole={noop}
        onChooseDifferentRole={() => { setNotice(null); forgetAll(); binding.depart(); }}
        onEmailDraftChange={value => { setNotice(null); forgetAll(); binding.setIdentifier(value); }}
        onCodeDraftChange={value => { setNotice(null); binding.setCode(value); }}
        onSubmitEmail={noop}
        onSubmitPassword={submitPassword}
        onSubmitCode={submitCode}
        onRequestNewCode={() => { setNotice(null); void binding.resend(); }}
        onUseDifferentEmail={() => { setNotice(null); forgetAll(); binding.reset(); }}
        onPasswordShownChange={shown => setPasswordShown(shown)}
        onExplain={value => { if (value === "help" || value === "phone" || value === "forgot") setNotice(value); }}
        onDismissNotice={() => setNotice(null)}
        onRememberTickedChange={noop}
        onPreviewCodeScreen={noop}
        onPreviewRememberedChange={noop}
      />
    </div>
  );
}
