// SolMind MVP0 test-only stub for the `server-only` package.
//
// Vitest (vitest.config.ts) aliases the real `server-only` package to this inert
// module so server-only Auth/RLS modules can be imported under test in plain Node.
// It mirrors server-only's own empty.js (the module Next resolves via the
// "react-server" export condition for server bundles): it exports nothing and has no
// side effects. The real server-only import-time guard is unaffected in the Next
// build; this stub exists ONLY for the test runner and must never be imported by
// application code.
export {};
