// How long the conversation screen waits for the answer to a command before it says the outcome could not be confirmed
// (correction D-12, 2026-11-09; REV341b finding 3). It is the server's ceiling for one Send plus a margin
// (EXPLORER_SEND_TIME_LIMITS in src/lib/solmind/virtual-guide/explorerSafetyReplyContract.ts, which is server-only, so
// the number is repeated here; a test checks the two agree). Waiting past the ceiling leaves the server time to answer
// first; time spent before the server's request handler starts, or a shorter hosting or proxy limit, can still use up
// the margin.
export const EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS = 130_000;
