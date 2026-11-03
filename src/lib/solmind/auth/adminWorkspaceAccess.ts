// Server-only access for the minimal functional Admin screens (PRJ01_R-WS03-
// WI014; decision queue 2026-11-03 11:52:57, 11:56:14 and 12:19:09). Shaped
// like adminHomeAccess.ts: each page and each command runs the existing audited
// Admin chain once, against its own fixed rule (resolveAdminWorkspaceForRequest
// with a fixed resolver), and only then makes its closed database call: a read
// with the server-derived actor (which the read rechecks as an active Admin),
// a write with no account id. Guard and read happen in the same server request, so a
// page view writes the usual two audit rows and no more. The actor never leaves
// this module: pages receive the session times and plain display data, the
// commands a value-free outcome. Reuses the existing Admin sign-in and server
// checks; no new security design. Paul may throw these screens away.

import "server-only";

import {
  adminCommandResult,
  type AdminAiUseView,
  type AdminChangeSettingBody,
  type AdminChangeSettingResult,
  type AdminLiftPauseBody,
  type AdminLiftPauseResult,
  type AdminOverviewView,
  type AdminPauseView,
  type AdminPeopleGuideView,
  type AdminSettingView,
  type AdminWorkspaceView,
} from "../adminWorkspaceContract";
import { formatAdminChicagoDay, formatAdminChicagoTime } from "../adminWorkspaceTime";
import { createServiceRoleClient } from "../supabase/serviceRoleClient";
import {
  createAdminWorkspaceRpcExecutor,
  type AdminPauseRow,
  type AdminPeopleRow,
  type AdminWorkspaceRpcExecutor,
} from "../supabase/adminWorkspaceRpcExecutor";
import { resolveAdminWorkspaceForRequest, type AdminAccessRequestDependencies } from "./adminAccessRequest";
import {
  resolveAdminAiUseRouteAccess,
  resolveAdminChangeSettingRouteAccess,
  resolveAdminHomeRouteAccess,
  resolveAdminLiftPauseRouteAccess,
  resolveAdminPeopleRouteAccess,
  resolveAdminSettingsRouteAccess,
} from "./adminRouteAccess";
import { type RequestCookieAccessor } from "./requestCookieAccessor";
import { ROUTE_ACCESS_DENY_REASON } from "./routeAccessDecision";

if (typeof window !== "undefined") {
  throw new Error("SolMind server configuration error: Admin workspace access is server-only.");
}

// Test seams: the audited chain's own injectable factories and the executor.
// Production passes only cookies.
export type AdminWorkspaceAccessArgs = Readonly<{
  cookies: RequestCookieAccessor;
  now?: () => Date;
  requestDependencies?: Omit<AdminAccessRequestDependencies, "cookies" | "now">;
  createExecutor?: () => AdminWorkspaceRpcExecutor;
}>;

export type AdminWorkspacePageAccessResult =
  | Readonly<{ allowed: true; expiresAt: string; observedAt: string; view: AdminWorkspaceView }>
  | Readonly<{ allowed: false; reason: typeof ROUTE_ACCESS_DENY_REASON }>;

const DENIED: AdminWorkspacePageAccessResult = Object.freeze({ allowed: false, reason: ROUTE_ACCESS_DENY_REASON });

type FixedResolver = Parameters<typeof resolveAdminWorkspaceForRequest>[1];

function guard(args: AdminWorkspaceAccessArgs, resolveRoute: FixedResolver) {
  return resolveAdminWorkspaceForRequest({ ...args.requestDependencies, cookies: args.cookies, now: args.now }, resolveRoute);
}

function executor(args: AdminWorkspaceAccessArgs): AdminWorkspaceRpcExecutor {
  return (args.createExecutor ?? (() => createAdminWorkspaceRpcExecutor(createServiceRoleClient())))();
}

// One page: guard, then read. A read that fails after an allowed guard gives
// the page with no data (it says the information could not be loaded); it is
// not shown as a session end. Any guard failure denies.
async function page<T>(
  args: AdminWorkspaceAccessArgs,
  resolveRoute: FixedResolver,
  read: (rpc: AdminWorkspaceRpcExecutor, actor: string) => Promise<T>,
  view: (data: T | null) => AdminWorkspaceView,
): Promise<AdminWorkspacePageAccessResult> {
  try {
    const access = await guard(args, resolveRoute);
    if (!access.allowed) return DENIED;
    let data: T | null = null;
    try {
      data = await read(executor(args), access.actorUserAccountId);
    } catch {
      data = null;
    }
    return Object.freeze({ allowed: true, expiresAt: access.expiresAt, observedAt: access.observedAt, view: view(data) });
  } catch {
    return DENIED;
  }
}

function projectPeople(rows: readonly AdminPeopleRow[]): readonly AdminPeopleGuideView[] {
  const guides = new Map<string, { name: string; explorers: AdminPeopleGuideView["explorers"][number][] }>();
  for (const row of rows) {
    const guide = guides.get(row.guideProfileId) ?? { name: row.guideName, explorers: [] };
    guides.set(row.guideProfileId, guide);
    if (row.explorer !== null) {
      guide.explorers.push(Object.freeze({
        name: row.explorer.name,
        relationshipStatus: row.explorer.relationshipStatus,
        lastSignIn: row.explorer.lastSignInAt === null ? null : formatAdminChicagoTime(row.explorer.lastSignInAt),
        pausedNow: row.explorer.pause,
      }));
    }
  }
  return Object.freeze([...guides.values()].map((guide) =>
    Object.freeze({ name: guide.name, explorers: Object.freeze(guide.explorers) })));
}

function projectPause(row: AdminPauseRow): AdminPauseView[] {
  if (row.kind === "individual") {
    return [Object.freeze({
      kind: "recorded" as const,
      stopId: row.stopId,
      explorerName: row.explorerName,
      stopDay: formatAdminChicagoDay(row.stopDay),
      reachedAt: formatAdminChicagoTime(row.reachedAt),
      dayTotal: row.dayTotal,
      limit: row.limit,
      inCrisisAtStop: row.accountInCrisis,
    })];
  }
  if (row.kind === "unrecorded") {
    return [Object.freeze({
      kind: "not_recorded" as const,
      explorerName: row.explorerName,
      stopDay: formatAdminChicagoDay(row.stopDay),
      dayTotal: row.dayTotal,
      limit: row.limit,
    })];
  }
  return [];
}

function projectAiUse(rows: readonly AdminPauseRow[]): AdminAiUseView {
  const shared = rows.find((row) => row.kind === "shared");
  return Object.freeze({
    pauses: Object.freeze(rows.flatMap(projectPause)),
    sharedStop: shared === undefined ? null : Object.freeze({
      stopDay: formatAdminChicagoDay(shared.stopDay),
      reachedAt: formatAdminChicagoTime(shared.reachedAt),
      dayTotal: shared.dayTotal,
      limit: shared.limit,
    }),
  });
}

// The Dashboard is the signed-in Admin home (/admin/home, its fixed rule).
export function resolveAdminDashboardAccess(args: AdminWorkspaceAccessArgs): Promise<AdminWorkspacePageAccessResult> {
  return page(args, resolveAdminHomeRouteAccess, (rpc, actor) => rpc.readOverview(actor), (data) =>
    Object.freeze({
      page: "dashboard" as const,
      overview: data === null ? null : Object.freeze<AdminOverviewView>({
        guides: data.guideCount,
        explorers: data.explorerCount,
        explorersSignedInLast7Days: data.explorersSignedInLast7Days,
        accountsPausedNow: data.accountsPausedNow,
      }),
    }));
}

export function resolveAdminPeopleAccess(args: AdminWorkspaceAccessArgs): Promise<AdminWorkspacePageAccessResult> {
  return page(args, resolveAdminPeopleRouteAccess, async (rpc, actor) => projectPeople(await rpc.readPeople(actor)),
    (guides) => Object.freeze({ page: "people" as const, guides }));
}

export function resolveAdminAiUseAccess(args: AdminWorkspaceAccessArgs): Promise<AdminWorkspacePageAccessResult> {
  return page(args, resolveAdminAiUseRouteAccess, async (rpc, actor) => projectAiUse(await rpc.readPauses(actor)),
    (aiUse) => Object.freeze({ page: "aiUse" as const, aiUse }));
}

export function resolveAdminSettingsAccess(args: AdminWorkspaceAccessArgs): Promise<AdminWorkspacePageAccessResult> {
  return page(args, resolveAdminSettingsRouteAccess,
    async (rpc, actor): Promise<readonly AdminSettingView[]> => rpc.readSettings(actor),
    (settings) => Object.freeze({ page: "settings" as const, settings }));
}

// Lift pause: the existing lift, after the Admin guard, with the executor's one
// fixed authority reference (Paul's decision queue entry for these screens) and
// the browser's operation id for this press; the Admin's account id is not
// sent. Audited as a system change on Paul's word (accepted for these
// throwaway screens).
export async function liftAdminPause(
  args: AdminWorkspaceAccessArgs & Readonly<{ body: AdminLiftPauseBody }>,
): Promise<AdminLiftPauseResult> {
  try {
    const access = await guard(args, resolveAdminLiftPauseRouteAccess);
    if (!access.allowed) return adminCommandResult("denied");
    return adminCommandResult(await executor(args).liftPause({
      stopId: args.body.stopId, operationId: args.body.operationId,
    }));
  } catch {
    return adminCommandResult("failed");
  }
}

// Setting change: the existing audited writer, after the Admin guard, one
// setting per submit, basis paul_approved, the executor's one fixed authority
// reference (the Admin's account id is not sent) and the version the page read
// as the expected version. Audited as a system change on Paul's word (accepted
// for these throwaway screens).
export async function changeAdminSetting(
  args: AdminWorkspaceAccessArgs & Readonly<{ body: AdminChangeSettingBody }>,
): Promise<AdminChangeSettingResult> {
  try {
    const access = await guard(args, resolveAdminChangeSettingRouteAccess);
    if (!access.allowed) return adminCommandResult("denied");
    return adminCommandResult(await executor(args).changeSetting({
      settingKey: args.body.settingKey,
      value: args.body.value,
      expectedVersion: args.body.expectedVersion,
      operationId: args.body.operationId,
    }));
  } catch {
    return adminCommandResult("failed");
  }
}
