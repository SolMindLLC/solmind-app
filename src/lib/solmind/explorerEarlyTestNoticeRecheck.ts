"use client";

import { createContext, useContext } from "react";

// Only the boundary mounted by a server-reported on setting supplies a recheck.
// With the setting off, feature refusals have no notice behavior or listeners.
export const EXPLORER_EARLY_TEST_NOTICE_RECHECK = "solmind:explorer-early-test-notice-recheck";
const noRecheck = () => undefined;
export const ExplorerEarlyTestNoticeRecheckContext = createContext<() => void>(noRecheck);

export function useExplorerEarlyTestNoticeRecheck(): () => void {
  return useContext(ExplorerEarlyTestNoticeRecheckContext);
}
