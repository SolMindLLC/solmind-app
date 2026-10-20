// Login step 6, sub-slice S6-8: the server start hook.
//
// Next.js calls `register` once when a server instance starts. In the Node.js
// runtime only, it loads the Node.js half beside this file with a literal
// import and runs the login startup check of AUTH-RLS-DEC-032. Everything is
// inside one guard: a throw while that module loads, or from the call, is
// dropped unread and gives one fixed line on standard error, so the server
// keeps starting. That line is a constant and is not the line the check
// itself writes for a missing pepper, so the two cases can be told apart. It
// does nothing else, and nothing in any other runtime. `register` is this
// file's only export.

// The one fixed line for a start hook that could not load or run its check.
const LOGIN_STARTUP_CHECK_NOT_RUN_LINE = "solmind_login_startup_check_not_run\n" as const;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const startup = await import("./instrumentation-node");
      startup.runLoginStartupCheck();
    } catch {
      try {
        process.stderr.write(LOGIN_STARTUP_CHECK_NOT_RUN_LINE);
      } catch {
        // Dropped unread: the server keeps starting.
      }
    }
  }
}
