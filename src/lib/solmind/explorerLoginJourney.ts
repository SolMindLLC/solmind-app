// Explorer-only presentation and finite browser waiting bounds. These values
// grant no authentication, renewal, remote completion or rollback guarantee.
// Sign-in and finite-session reminder copy approved by Paul on 2026-10-17.
import type { ExplorerSignInFlowProjection } from "./explorerSignInFlowController";
type ExplorerSignInStatus = Readonly<{ ready: boolean }> & Pick<ExplorerSignInFlowProjection, "stage" | "pending" | "outcome">;

export const EXPLORER_REENTRY_PATH = "/login/explorer" as const;
export const EXPLORER_RESPONSE_BUDGET_MS = 60_000;
export const LOGOUT_RESPONSE_BUDGET_MS = 30_000;
export const EXPIRY_WARNING_MS = 300_000;
export const EXPLORER_AVAILABILITY = "Explorer, Guide and Admin sign-in are connected.";
export const EXPLORER_CODE_REFUSAL = "We couldn\u2019t sign you in with that code. You can try the code from your latest SolMind email, or request a new one.";
export const EXPLORER_LOGIN_UNCERTAINTY = "We couldn't confirm sign-in. Please try signing in again.";
export const SESSION_WARNING = "To keep your account safe, you\u2019ll be signed out within 5 minutes. You can sign in again afterward.";
export const SIGN_OUT_UNCERTAINTY = "We couldn't confirm sign-out. For your privacy, close this browser window. Error code: SM-OUT-01.";
export const SIGNED_OUT_PRIVACY = "To stay secure on a shared computer, please close this browser window.";

/** Closed value-free copy; no inference about an account or refusal reason. */
export function explorerStatusText(status: ExplorerSignInStatus): string | null {
  if (!status.ready) return "Preparing sign-in...";
  if (status.pending === "verify") return "Checking your code...";
  if (status.pending === "send" || status.pending === "resend") return "Requesting your code...";
  if (status.stage === "complete") return "Opening your Explorer home...";
  if (status.outcome === null || status.outcome === "verification_code_requested") return null;
  if (status.outcome === "invalid_email") return "Enter a valid email address.";
  if (status.outcome === "code_not_accepted") return EXPLORER_CODE_REFUSAL;
  return EXPLORER_LOGIN_UNCERTAINTY;
}

export type ExplorerExpiry = Readonly<{ expiresAt: string; observedAt: string }>;
export type ExpiryDisplay = Readonly<{ remainingMilliseconds: number; warning: boolean; ended: boolean }>;
const ENDED: ExpiryDisplay = Object.freeze({ remainingMilliseconds: 0, warning: false, ended: true });

/** A local advisory clock. Fresh wall elapsed accounts for OS sleep when a
 * platform's monotonic clock pauses; a high-water mark prevents either clock's
 * rollback from extending the display. A stale tab never grants server access.
 */
export function createExplorerExpiryClock(session: ExplorerExpiry, wall: number, monotonic: number) {
  try {
    if (typeof session.expiresAt !== "string" || typeof session.observedAt !== "string" ||
        !Number.isFinite(wall) || !Number.isFinite(monotonic)) return null;
    const expiry = Date.parse(session.expiresAt);
    const observed = Date.parse(session.observedAt);
    if (!Number.isFinite(expiry) || !Number.isFinite(observed) || expiry <= observed) return null;
    const initial = Math.max(0, Math.min(expiry - observed, expiry - wall));
    if (!Number.isSafeInteger(Math.ceil(initial))) return null;
    let elapsed = 0;
    return Object.freeze({
      read(currentWall: number, currentMonotonic: number): ExpiryDisplay {
        if (!Number.isFinite(currentWall) || !Number.isFinite(currentMonotonic)) {
          elapsed = initial;
          return ENDED;
        }
        elapsed = Math.max(elapsed, currentWall - wall, currentMonotonic - monotonic, 0);
        const remaining = Math.max(0, initial - elapsed);
        return remaining === 0 ? ENDED : Object.freeze({
          remainingMilliseconds: remaining, warning: remaining <= EXPIRY_WARNING_MS, ended: false,
        });
      },
    });
  } catch { return null; }
}
