// Browser side of the two Admin commands (minimal Admin screens, decision
// queue 2026-11-03 11:56:14): one same-origin JSON POST per button press, with
// the request options of the shared logout request (logoutBrowserRequest.ts),
// a bounded wait, and a strict check of the value-free answer. Anything else,
// including no answer in time, is "failed": the outcome is not known, so the
// page reloads to show the current state. No retry and no browser storage.

import {
  ADMIN_CHANGE_SETTING_OUTCOMES,
  ADMIN_LIFT_PAUSE_OUTCOMES,
  parseAdminCommandAnswer,
  type AdminChangeSettingBody,
  type AdminChangeSettingOutcome,
  type AdminLiftPauseBody,
  type AdminLiftPauseOutcome,
} from "./adminWorkspaceContract";
import { ADMIN_CHANGE_SETTING_ROUTE, ADMIN_LIFT_PAUSE_ROUTE } from "./routeAccess";

export type AdminCommandFetch = (path: string, init: RequestInit) => Promise<Response>;

export const ADMIN_COMMAND_RESPONSE_BUDGET_MS = 30_000;

async function post<T extends string>(
  fetcher: AdminCommandFetch,
  path: string,
  body: object,
  outcomes: readonly T[],
  budgetMs: number,
): Promise<T | "failed"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const response = await fetcher(path, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
      return "failed";
    }
    return parseAdminCommandAnswer(await response.json(), outcomes) ?? "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

export function postAdminLiftPause(
  body: AdminLiftPauseBody,
  fetcher: AdminCommandFetch,
  budgetMs = ADMIN_COMMAND_RESPONSE_BUDGET_MS,
): Promise<AdminLiftPauseOutcome> {
  return post(fetcher, ADMIN_LIFT_PAUSE_ROUTE, body, ADMIN_LIFT_PAUSE_OUTCOMES, budgetMs);
}

export function postAdminChangeSetting(
  body: AdminChangeSettingBody,
  fetcher: AdminCommandFetch,
  budgetMs = ADMIN_COMMAND_RESPONSE_BUDGET_MS,
): Promise<AdminChangeSettingOutcome> {
  return post(fetcher, ADMIN_CHANGE_SETTING_ROUTE, body, ADMIN_CHANGE_SETTING_OUTCOMES, budgetMs);
}
