import "server-only";

import { SESSION_COOKIE_NO_STORE_HEADERS } from "../auth/sessionCookiePolicy";

// Closed browser contract. Detailed failure reasons belong only to internal,
// value-free reporting; the page owns the SM-OUT-01 uncertainty message.
export type LogoutOutcome = "signed_out" | "sign_out_unconfirmed" | "denied";
export const LOGOUT_ERROR_CATEGORY = "SM-OUT-01" as const;
export const LOGOUT_RESPONSE_HEADERS = Object.freeze({
  ...Object.fromEntries(SESSION_COOKIE_NO_STORE_HEADERS.map(({ name, value }) => [name, value])),
  "X-Content-Type-Options": "nosniff",
});

export function logoutResult(outcome: LogoutOutcome): Readonly<{ outcome: LogoutOutcome }> {
  return Object.freeze({ outcome });
}

export function isLogoutRequestShape(request: Request, body: Readonly<Record<string, unknown>>): boolean {
  try {
    return new URL(request.url).search === "" && Reflect.ownKeys(body).length === 0;
  } catch {
    return false;
  }
}
