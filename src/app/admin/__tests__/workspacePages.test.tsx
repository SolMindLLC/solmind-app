import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestCookieAccessor } from "../../../lib/solmind/auth/requestCookieAccessor";

// The three new minimal Admin pages (decision queue 2026-11-03 11:56:14), in the pattern of
// src/app/admin/home/__tests__/page.test.tsx: direct invocation with mocked request and access seams. This
// does not render an async React Server Component or prove real access.
const seams = vi.hoisted(() => ({
  header: null as string | null,
  throwHeaders: false,
  people: vi.fn(), aiUse: vi.fn(), settings: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => {
  if (seams.throwHeaders) throw new Error("fixture_private_error");
  return { get: (name: string) => name === "cookie" ? seams.header : null };
} }));
vi.mock("@/lib/solmind/auth/adminWorkspaceAccess", () => ({
  resolveAdminPeopleAccess: seams.people, resolveAdminAiUseAccess: seams.aiUse, resolveAdminSettingsAccess: seams.settings,
}));
import AdminPeoplePage, * as peopleModule from "../people/page";
import AdminAiUsePage, * as aiUseModule from "../ai-use/page";
import AdminSettingsPage, * as settingsModule from "../settings/page";
import { AdminHome, AdminSessionOutcome } from "../../../components/solmind/AdminHome";

const times = { expiresAt: "2026-11-03T19:00:00.000Z", observedAt: "2026-11-03T18:00:00.000Z" };
const PAGES = [
  ["people", AdminPeoplePage, peopleModule, seams.people, { page: "people", guides: [] }],
  ["ai-use", AdminAiUsePage, aiUseModule, seams.aiUse, { page: "aiUse", aiUse: { pauses: [], sharedStop: null } }],
  ["settings", AdminSettingsPage, settingsModule, seams.settings, { page: "settings", settings: null }],
] as const;

beforeEach(() => {
  seams.header = null; seams.throwHeaders = false;
  for (const access of [seams.people, seams.aiUse, seams.settings]) {
    access.mockReset();
    access.mockResolvedValue({ allowed: false, reason: "route_access_denied" });
  }
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  for (const level of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0);
  for (const level of ["log", "warn", "error", "info", "debug"] as const) expect(vi.mocked(console[level]).mock.calls.length).toBe(0);
  vi.restoreAllMocks();
});

describe.each(PAGES)("Admin %s page raw-header composition", (_name, Page, module, access, view) => {
  it("is dynamic on Node and passes only the session times and the view", async () => {
    access.mockResolvedValue({ allowed: true, ...times, view, actorUserAccountId: "fixture-internal-actor" });
    const result = await Page();
    expect(module.dynamic === "force-dynamic" && module.runtime === "nodejs").toBe(true);
    expect(result.type).toBe(AdminHome);
    expect(Object.keys(result.props).sort()).toEqual(["session", "view"]);
    expect(result.props.session).toEqual(times);
    expect(result.props.view).toBe(view);
    expect(JSON.stringify(result.props).includes("fixture-internal")).toBe(false);
  });
  it("keeps duplicate raw cookies for the access check and denies to the session-ended outcome", async () => {
    seams.header = "solmind-session=fixture-one; solmind-session=fixture-two";
    const result = await Page();
    const cookies: RequestCookieAccessor = access.mock.calls[0][0].cookies;
    expect(cookies.getAll()).toEqual([{ name: "solmind-session", value: "fixture-one" }, { name: "solmind-session", value: "fixture-two" }]);
    expect(result.type === AdminSessionOutcome && result.props.outcome === "session_ended").toBe(true);
  });
  it("denies malformed framing before access and collapses failures without raw errors", async () => {
    seams.header = "solmind-auth=bad value";
    expect((await Page()).type === AdminSessionOutcome && access.mock.calls.length === 0).toBe(true);
    seams.header = null; seams.throwHeaders = true;
    expect((await Page()).type).toBe(AdminSessionOutcome);
    seams.throwHeaders = false; access.mockRejectedValue(new Error("fixture_private_error"));
    expect((await Page()).type).toBe(AdminSessionOutcome);
  });
});
