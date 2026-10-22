"use client";

import { useEffect, useRef, useState } from "react";
import { GuideSignIn } from "./GuideSignIn";
import { GUIDE_BROWSER_SIGN_IN_HOME } from "@/lib/solmind/passwordRoleSignInBrowserContract";
import { ExplorerSignIn, type ExplorerSignInStatus } from "./ExplorerSignIn";
import { SignInPreview } from "./SignInPreview";
import { SignInPreviewView } from "./SignInPreviewParts";
import { INITIAL_SIGN_IN_PREVIEW_STATE, SIGN_IN_HEADING_ID, type SignInNoticeKey } from "@/lib/solmind/signInPreview";
import { SOLMIND_ROLES, type SolMindRole } from "@/lib/solmind/roles";
import { EXPLORER_BROWSER_SIGN_IN_HOME } from "@/lib/solmind/signInBrowserContract";
import { EXPLORER_AVAILABILITY, EXPLORER_RESPONSE_BUDGET_MS, explorerStatusText } from "@/lib/solmind/explorerLoginJourney";
import type { ExplorerSignInBrowserFetch } from "@/lib/solmind/explorerSignInBrowserTransport";

const noop = () => undefined;
const browserFetch: ExplorerSignInBrowserFetch = (path, init) => globalThis.fetch(path, init);
function navigateHome(destination: typeof EXPLORER_BROWSER_SIGN_IN_HOME) {
  if (destination === EXPLORER_BROWSER_SIGN_IN_HOME) window.location.replace(EXPLORER_BROWSER_SIGN_IN_HOME);
}
function navigateGuideHome(destination: typeof GUIDE_BROWSER_SIGN_IN_HOME) {
  if (destination === GUIDE_BROWSER_SIGN_IN_HOME) window.location.replace(GUIDE_BROWSER_SIGN_IN_HOME);
}
function statusView(status: ExplorerSignInStatus) {
  const message = explorerStatusText(status);
  return message === null ? null : <p role="status" aria-live="polite">{message}</p>;
}

/** The role chooser uses the same approved markup; Explorer and Guide are connected.
 * Function ports originate here on the client, never in Server Component props.
 */
export function LoginExperience({ initialExplorer = false, initialGuide = false }: Readonly<{ initialExplorer?: boolean; initialGuide?: boolean }>) {
  const [role, setRole] = useState<SolMindRole | null>(initialExplorer ? SOLMIND_ROLES.EXPLORER : initialGuide ? SOLMIND_ROLES.GUIDE : null);
  const [notice, setNotice] = useState<SignInNoticeKey | null>(null);
  const shownRole = useRef(role);
  useEffect(() => {
    if (shownRole.current !== role) {
      shownRole.current = role;
      document.getElementById(SIGN_IN_HEADING_ID)?.focus();
    }
  }, [role]);
  const chooseRole = (next: SolMindRole | null) => { setNotice(null); setRole(next); };
  const depart = () => chooseRole(null);
  if (role === SOLMIND_ROLES.EXPLORER) return <ExplorerSignIn
    fetcher={browserFetch} responseBudgetMilliseconds={EXPLORER_RESPONSE_BUDGET_MS}
    renderStatus={statusView} onNavigate={navigateHome} onDepart={depart}
  />;
  if (role === SOLMIND_ROLES.GUIDE) return <GuideSignIn
    fetcher={browserFetch} responseBudgetMilliseconds={60_000}
    onNavigate={navigateGuideHome} onDepart={depart}
  />;
  if (role === SOLMIND_ROLES.ADMIN) return <SignInPreview
    key={role} initialRole={role} onChooseDifferentRole={depart}
  />;
  return <SignInPreviewView
    state={{ ...INITIAL_SIGN_IN_PREVIEW_STATE, notice }} emailDraft="" codeDraft="" hidePreviewAdditions
    status={<p role="status">{EXPLORER_AVAILABILITY}</p>}
    onChooseRole={chooseRole} onChooseDifferentRole={noop}
    onEmailDraftChange={noop} onCodeDraftChange={noop} onSubmitEmail={noop} onSubmitCode={noop}
    onSubmitPassword={noop} onRequestNewCode={noop} onUseDifferentEmail={noop}
    onPasswordShownChange={noop} onRememberTickedChange={noop}
    onPreviewCodeScreen={noop} onPreviewRememberedChange={noop}
    onExplain={value => { if (value === "help") setNotice(value); }} onDismissNotice={() => setNotice(null)}
  />;
}
