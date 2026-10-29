import "server-only";

import { NextResponse } from "next/server";
import { readSameOriginJsonWriteRequest } from "../auth/sameOriginJsonWriteRequest";
import {
  readSessionAuthCookieCleanupCandidate, readSessionCookieEntries,
  resolveSessionCookiePolicy, type SessionCookiePolicy,
} from "../auth/sessionCookiePolicy";
import { writeLogoutSessionCookieClears } from "./loginCookieWriter";
import {
  isLogoutRequestShape, LOGOUT_ERROR_CATEGORY, LOGOUT_RESPONSE_HEADERS,
  logoutResult, type LogoutOutcome,
} from "./logoutRouteContract";
import { isLogoutUuid } from "./userSessionLogoutCaller";
import type { LogoutProviderCleanup } from "./logoutProviderSignOut";

export type LogoutDatabaseDependencies = Readonly<{
  identify(accessToken: string, signal: AbortSignal): Promise<string | null>;
  findAccount(providerUserId: string, signal: AbortSignal): Promise<string | null>;
  endSession(accountId: string, presentedSessionId: string): Promise<"ended" | "already_ended" | "failed">;
}>;

export type LogoutPorts = Readonly<{
  loadOrigin(): string;
  readCookies(): Promise<unknown>;
  createDatabase(): LogoutDatabaseDependencies | undefined;
  createProvider(input: Readonly<{ trustedOrigin: string; policy: SessionCookiePolicy }>): LogoutProviderCleanup | undefined;
  report?(category: typeof LOGOUT_ERROR_CATEGORY): unknown;
  createResponse?(outcome: LogoutOutcome): NextResponse;
}>;

function response(outcome: LogoutOutcome): NextResponse {
  return NextResponse.json(logoutResult(outcome), { status: 200, headers: LOGOUT_RESPONSE_HEADERS });
}

// Each stage owns its deadline; a late identity/lookup result cannot execute
// a later stage. Abort requests cancellation, never proves remote rollback.
async function bounded<T>(milliseconds: number, call: (signal: AbortSignal) => PromiseLike<T> | T): Promise<T | null> {
  const deadline = performance.now() + milliseconds;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<null>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, milliseconds);
  });
  const result = Promise.resolve().then(() => {
    if (performance.now() >= deadline) return null;
    return call(controller.signal);
  }).then((value) => performance.now() < deadline ? value : null, () => null);
  try { return await Promise.race([result, elapsed]); }
  finally { clearTimeout(timer); }
}

export async function handleLogout(request: Request, ports: LogoutPorts): Promise<NextResponse> {
  let needsReport = false;
  const deny = () => { needsReport = true; return response("denied"); };
  try {
    let trustedOrigin: string;
    try { trustedOrigin = ports.loadOrigin(); } catch { return deny(); }
    const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin });
    if (!guarded.ok) return deny();

    const validShape = isLogoutRequestShape(request, guarded.value);
    // Guard first, one credential snapshot, trusted policy before any remote IO.
    let rawCookies: unknown;
    try { rawCookies = await ports.readCookies(); } catch { return deny(); }
    const policy = resolveSessionCookiePolicy(trustedOrigin);
    const requestCookies = readSessionCookieEntries(rawCookies, false);
    if (!policy || !requestCookies) return deny();
    const candidate = readSessionAuthCookieCleanupCandidate(policy, requestCookies);
    const bindings = requestCookies.filter(({ name }) => name === policy.bindingCookieName);
    const presentedSessionId = bindings.length === 1 && isLogoutUuid(bindings[0].value) ? bindings[0].value : null;

    // Absence is local to this trusted browser address, not proof of remote
    // revocation. Any owned-looking current-policy family member, even an
    // empty value or suspicious suffix, keeps the ordinary logout path.
    const noCurrentSignIn = validShape && !requestCookies.some(({ name }) =>
      name.startsWith(policy.authCookieName) || name.startsWith(policy.bindingCookieName));
    let confirmed = false;
    if (validShape && !noCurrentSignIn) {
      let database: LogoutDatabaseDependencies | undefined;
      let provider: LogoutProviderCleanup | undefined;
      try { database = ports.createDatabase(); } catch { needsReport = true; }
      try { provider = ports.createProvider({ trustedOrigin, policy }); } catch { needsReport = true; }
      if (!database || !provider) needsReport = true;
      if (database && candidate && presentedSessionId) {
        const identity = await bounded(3_000, (signal) => database.identify(candidate.accessToken, signal));
        if (isLogoutUuid(identity)) {
          const account = await bounded(3_000, (signal) => database.findAccount(identity, signal));
          if (isLogoutUuid(account)) {
            const ended = await bounded(6_100, () => database.endSession(account, presentedSessionId));
            confirmed = ended === "ended" || ended === "already_ended";
          }
        }
      }
      // Separate capability: lack of a DB key/binding/identity never makes
      // eligible provider cleanup skip safe clearing or target another token.
      if (provider && candidate) {
        const cleaned = await bounded(5_100, () => provider.cleanup(candidate));
        if (cleaned !== "cleaned") needsReport = true;
      }
    }
    if (!confirmed && !noCurrentSignIn) needsReport = true;
    try {
      const result = (ports.createResponse ?? response)(confirmed ? "signed_out"
        : noCurrentSignIn ? "no_current_sign_in" : "sign_out_unconfirmed");
      for (const [name, value] of Object.entries(LOGOUT_RESPONSE_HEADERS)) result.headers.set(name, value);
      const clear = writeLogoutSessionCookieClears({
        trustedOrigin, requestCookies,
        heldCookies: requestCookies.map(({ name }) => ({ name, value: "" })), response: result,
      });
      if (clear.outcome !== "cleared") return deny();
      return result;
    } catch {
      // A partially written response is discarded, never returned.
      return deny();
    }
  } catch {
    return deny();
  } finally {
    if (needsReport && ports.report) {
      await bounded(100, () => ports.report!(LOGOUT_ERROR_CATEGORY));
    }
  }
}
