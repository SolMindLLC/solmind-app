import "server-only";

import { checkLoginVerificationConfigurationAtStartup } from "./lib/solmind/auth/loginRouteConfiguration";

// Login step 6, sub-slice S6-8: the Node.js half of the server start hook.
//
// AUTH-RLS-DEC-032 requires the verification pepper at startup. Sub-slice
// S6-1 banked the check and left calling it, when the server starts, to the
// first activating slice. `src/instrumentation.ts` imports this module in the
// Node.js runtime only (the pepper path uses `node:crypto`) and calls the
// function below once.
//
// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 9, option 1),
// what a missing pepper does when the app starts: "the app starts, sign-in
// is unavailable, and one fixed line with no value says so." Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". Each sign-in route already fails closed without the pepper,
// because its configuration load throws and the route answers its generic
// deny.
//
// What it does: calls the banked check once. On ANY throw it writes one
// fixed line to standard error and returns. The line is a constant: it never
// carries a value, a variable's content or the error, which is dropped
// unread. With a good pepper it writes nothing. It never throws. As read
// from the installed Next.js source (not run), an error from the start hook
// is rethrown, not swallowed, so "the application keeps starting" holds only
// because nothing leaves this function.

// The one fixed line for a failed startup check.
export const LOGIN_STARTUP_CHECK_FAILED_LINE = "solmind_login_startup_check_failed\n" as const;

export function runLoginStartupCheck(): void {
  try {
    checkLoginVerificationConfigurationAtStartup();
  } catch {
    try {
      process.stderr.write(LOGIN_STARTUP_CHECK_FAILED_LINE);
    } catch {
      // Dropped unread: the server keeps starting.
    }
  }
}
