import "server-only";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION, type ExplorerEarlyTestNoticeResult } from "../explorerEarlyTestNotice";
import { SOLMIND_ROLES, type SolMindRole } from "../roles";
import { createServiceRoleClient } from "../supabase/serviceRoleClient";
import { createExplorerEarlyTestNoticeRepository, type ExplorerEarlyTestNoticeActor,
  type ExplorerEarlyTestNoticeRecord, type ExplorerEarlyTestNoticeRepository } from "../supabase/explorerEarlyTestNoticeRepository";
import { resolveExplorerHomeActorAccess } from "./explorerHomeAccess";
import { readRawRequestCookies } from "./readRawRequestCookies";
import { noopCookieSetAll } from "./requestCookieAccessor";

// Server capability only; the protected setting still decides whether the
// notice applies. No browser import, public variable or stored client flag.
export const EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV = "SOLMIND_EARLY_TEST_NOTICE";
export function isExplorerEarlyTestNoticeEnabled(): boolean {
  return process.env[EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV] === "enabled";
}

const ALLOWED: ExplorerEarlyTestNoticeResult = Object.freeze({ status: "allowed", noticeVersion: null });
const DENIED: ExplorerEarlyTestNoticeResult = Object.freeze({ status: "denied", noticeVersion: null });
const UNAVAILABLE: ExplorerEarlyTestNoticeResult = Object.freeze({ status: "unavailable", noticeVersion: null });
const REQUIRED: ExplorerEarlyTestNoticeResult = Object.freeze({ status: "required", noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION });

function project(record: ExplorerEarlyTestNoticeRecord): ExplorerEarlyTestNoticeResult {
  if (record.noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION) return UNAVAILABLE;
  return !record.enabled || record.agreed ? ALLOWED : REQUIRED;
}

// Existing feature authorization calls this before any feature RPC/provider.
// Guide and Admin paths never read this Explorer-only setting or agreement.
export async function checkExplorerEarlyTestNoticeAccess(
  repository: ExplorerEarlyTestNoticeRepository, actor: ExplorerEarlyTestNoticeActor,
  role: SolMindRole = SOLMIND_ROLES.EXPLORER,
): Promise<ExplorerEarlyTestNoticeResult> {
  if (role !== SOLMIND_ROLES.EXPLORER || !isExplorerEarlyTestNoticeEnabled()) return ALLOWED;
  try {
    const setting = await repository.readSetting();
    if (setting.noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION) return UNAVAILABLE;
    if (!setting.enabled) return ALLOWED;
    return project(await repository.read(actor));
  } catch { return UNAVAILABLE; }
}

async function authenticatedActor(rawCookieHeader: string | null): Promise<ExplorerEarlyTestNoticeActor | null> {
  const snapshot = readRawRequestCookies(rawCookieHeader);
  if (snapshot === null) return null;
  const result = await resolveExplorerHomeActorAccess({ cookies: {
    getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
  } });
  return result.allowed ? Object.freeze({ accountId: result.accountId, applicationSessionId: result.applicationSessionId }) : null;
}

export async function resolveExplorerEarlyTestNoticeStatus(rawCookieHeader: string | null): Promise<ExplorerEarlyTestNoticeResult> {
  if (!isExplorerEarlyTestNoticeEnabled()) return ALLOWED;
  try {
    const actor = await authenticatedActor(rawCookieHeader);
    if (!actor) return DENIED;
    const repository = createExplorerEarlyTestNoticeRepository(createServiceRoleClient());
    const setting = await repository.readSetting();
    if (setting.noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION) return UNAVAILABLE;
    if (!setting.enabled) return ALLOWED;
    return project(await repository.read(actor));
  } catch { return UNAVAILABLE; }
}

// The server layout reads no setting with the capability off; when enabled it
// reads only the protected setting, never account data. Off renders the existing
// children without mounting any notice client boundary or listeners.
export async function resolveExplorerEarlyTestNoticeSetting(): Promise<"on" | "off" | "unavailable"> {
  if (!isExplorerEarlyTestNoticeEnabled()) return "off";
  try {
    const repository = createExplorerEarlyTestNoticeRepository(createServiceRoleClient());
    const setting = await repository.readSetting();
    if (setting.noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION) return "unavailable";
    return setting.enabled ? "on" : "off";
  } catch { return "unavailable"; }
}

export async function agreeExplorerEarlyTestNotice(rawCookieHeader: string | null,
  noticeVersion: unknown, adultAffirmation: unknown): Promise<ExplorerEarlyTestNoticeResult> {
  if (!isExplorerEarlyTestNoticeEnabled()) return DENIED;
  if (noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION || adultAffirmation !== true) return DENIED;
  try {
    const actor = await authenticatedActor(rawCookieHeader);
    if (!actor) return DENIED;
    const repository = createExplorerEarlyTestNoticeRepository(createServiceRoleClient());
    const setting = await repository.readSetting();
    if (setting.noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION) return UNAVAILABLE;
    // No agreement is recorded when the switch was turned off in the meantime.
    if (!setting.enabled) return ALLOWED;
    return project(await repository.agree(actor, noticeVersion, adultAffirmation));
  } catch { return UNAVAILABLE; }
}
