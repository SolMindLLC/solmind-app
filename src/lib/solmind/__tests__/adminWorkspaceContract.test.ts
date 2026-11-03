import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_CHANGE_SETTING_OUTCOMES,
  ADMIN_LIFT_PAUSE_OUTCOMES,
  ADMIN_PEOPLE_PAUSES,
  ADMIN_SETTING_KEYS,
  parseAdminChangeSettingBody,
  parseAdminCommandAnswer,
  parseAdminLiftPauseBody,
} from "../adminWorkspaceContract";
import { postAdminChangeSetting, postAdminLiftPause } from "../adminWorkspaceBrowserRequest";
import { formatAdminChicagoDay, formatAdminChicagoTime } from "../adminWorkspaceTime";
import { ADMIN_MENU, ADMIN_WORKSPACE_FRAMES } from "../adminWorkspaceFrame";
import {
  ADMIN_LIFT_OUTCOME_SENTENCES,
  ADMIN_PEOPLE_PAUSE_LABELS,
  ADMIN_SETTING_LABELS,
  ADMIN_SETTING_OUTCOME_SENTENCES,
  ADMIN_WORKSPACE_WORDING,
  formatAdminCount,
} from "../adminWorkspaceWording";
import { ADMIN_AI_USE_ROUTE, ADMIN_HOME_ROUTE, ADMIN_PEOPLE_ROUTE, ADMIN_SETTINGS_ROUTE } from "../routeAccess";

// The minimal Admin screens' browser-safe contract, wording, menu and Chicago-time strings (decision queue
// 2026-11-03 11:56:14 and 12:19:09).
const STOP = "44444444-4444-4444-8444-444444444444";
const OP = "55555555-5555-4555-8555-555555555555";
const appRoot = path.resolve(__dirname, "../../../..");

describe("Admin command bodies", () => {
  it("accept only the exact keys and closed values", () => {
    expect(parseAdminLiftPauseBody({ stopId: STOP, operationId: OP })).toEqual({ stopId: STOP, operationId: OP });
    for (const bad of [{ stopId: STOP }, { stopId: STOP, operationId: OP, extra: 1 }, { stopId: "AAAAAAAA-4444-4444-8444-444444444444", operationId: OP },
      { stopId: STOP, operationId: 7 }]) expect(parseAdminLiftPauseBody(bad)).toBeNull();
    const body = { settingKey: "suggested_waypoint_send_grace_seconds", value: 120, expectedVersion: 3, operationId: OP };
    expect(parseAdminChangeSettingBody(body)).toEqual(body);
    for (const bad of [{ ...body, settingKey: "x" }, { ...body, value: 1.5 }, { ...body, value: 2 ** 31 }, { ...body, expectedVersion: 0 },
      { ...body, expectedVersion: "3" }, { ...body, reason: "x" }]) expect(parseAdminChangeSettingBody(bad)).toBeNull();
  });

  it("read a browser answer only as exactly one known outcome", () => {
    expect(parseAdminCommandAnswer({ outcome: "lifted" }, ADMIN_LIFT_PAUSE_OUTCOMES)).toBe("lifted");
    for (const bad of [{ outcome: "applied" }, { outcome: "lifted", detail: "x" }, null, [], "lifted"]) {
      expect(parseAdminCommandAnswer(bad, ADMIN_LIFT_PAUSE_OUTCOMES)).toBeNull();
    }
    expect(parseAdminCommandAnswer({ outcome: "out_of_range" }, ADMIN_CHANGE_SETTING_OUTCOMES)).toBe("out_of_range");
  });
});

describe("Admin browser command request", () => {
  const json = (value: unknown, type = "application/json") =>
    new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": type } });

  it("posts once, same-origin JSON with no-store and no redirect, to the fixed path", async () => {
    const fetcher = vi.fn(async () => json({ outcome: "lifted" }));
    expect(await postAdminLiftPause({ stopId: STOP, operationId: OP }, fetcher)).toBe("lifted");
    expect(fetcher).toHaveBeenCalledOnce();
    const [pathName, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(pathName).toBe("/admin/ai-use/lift");
    expect(init.method === "POST" && init.credentials === "same-origin" && init.cache === "no-store" && init.redirect === "error").toBe(true);
    expect(init.body).toBe(JSON.stringify({ stopId: STOP, operationId: OP }));
  });

  it("treats anything but a known answer as failed", async () => {
    const body = { settingKey: "explorer_shared_snapshot_sendability_days" as const, value: 8, expectedVersion: 1, operationId: OP };
    expect(await postAdminChangeSetting(body, vi.fn(async () => json({ outcome: "applied" })))).toBe("applied");
    expect(await postAdminChangeSetting(body, vi.fn(async () => json({ outcome: "lifted" })))).toBe("failed");
    expect(await postAdminChangeSetting(body, vi.fn(async () => json({ outcome: "applied" }, "text/html")))).toBe("failed");
    expect(await postAdminChangeSetting(body, vi.fn(async () => { throw new Error("offline"); }))).toBe("failed");
    expect(await postAdminChangeSetting(body, vi.fn(async () => new Response("x", { status: 500 })))).toBe("failed");
    const slow = vi.fn((_path: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    expect(await postAdminChangeSetting(body, slow, 5)).toBe("failed");
  });
});

describe("Admin Chicago-time strings and wording", () => {
  it("formats moments and days in Chicago time, ASCII only", () => {
    expect(formatAdminChicagoTime("2026-11-03T17:05:00.000Z")).toBe("Nov 3, 2026, 11:05 AM CST");
    expect(formatAdminChicagoTime("2026-07-01T17:05:00+00:00")).toBe("Jul 1, 2026, 12:05 PM CDT");
    expect(formatAdminChicagoDay("2026-11-03")).toBe("Nov 3, 2026");
    expect(() => formatAdminChicagoTime("nonsense")).toThrow();
    expect(() => formatAdminChicagoDay("2026-02-30")).toThrow();
    expect(formatAdminCount(2000)).toBe("2,000");
    expect(formatAdminCount(12)).toBe("12");
  });

  it("has a plain sentence for every outcome and a label for every setting", () => {
    for (const outcome of ADMIN_LIFT_PAUSE_OUTCOMES) expect(ADMIN_LIFT_OUTCOME_SENTENCES[outcome]).toMatch(/\.$/);
    for (const outcome of ADMIN_CHANGE_SETTING_OUTCOMES) expect(ADMIN_SETTING_OUTCOME_SENTENCES[outcome]).toMatch(/\.$/);
    for (const key of ADMIN_SETTING_KEYS) expect(ADMIN_SETTING_LABELS[key].label.length).toBeGreaterThan(0);
    // A pause already lifted by another press or path: true, and distinct from a transient conflict.
    expect(ADMIN_LIFT_OUTCOME_SENTENCES.lifted_elsewhere).toBe("This pause had already been lifted. Nothing was changed.");
    expect(ADMIN_LIFT_OUTCOME_SENTENCES.conflict).toBe("The pause could not be lifted just now. Nothing was changed.");
    expect(parseAdminCommandAnswer({ outcome: "lifted_elsewhere" }, ADMIN_LIFT_PAUSE_OUTCOMES)).toBe("lifted_elsewhere");
    expect(ADMIN_WORKSPACE_WORDING.settings.wholeNumber).toBe("To save it, enter a whole number: each setting holds whole numbers only.");
    expect(ADMIN_PEOPLE_PAUSES.map((pause) => ADMIN_PEOPLE_PAUSE_LABELS[pause])).toEqual(["Yes", "Yes, shared pause", "No"]);
  });

  it("has a menu of exactly the four working screens, each a link, one current per page", () => {
    expect(ADMIN_MENU.map((entry) => [entry.id, entry.label, entry.href])).toEqual([
      ["dashboard", "Dashboard", ADMIN_HOME_ROUTE],
      ["people", "Guides and Explorers", ADMIN_PEOPLE_ROUTE],
      ["aiUse", "AI use and pauses", ADMIN_AI_USE_ROUTE],
      ["settings", "Settings", ADMIN_SETTINGS_ROUTE],
    ]);
    expect(ADMIN_MENU.every((entry) => entry.explanation === null)).toBe(true);
    for (const [page, frame] of Object.entries(ADMIN_WORKSPACE_FRAMES)) {
      expect(frame.navigation.filter((item) => item.current === "page").map((item) => item.id)).toEqual([page]);
      expect(frame.profile).toEqual({ name: "", role: "Admin", icon: "admin" });
    }
  });

  it("keeps the new browser-safe files ASCII, free of storage, environment and server imports", () => {
    for (const file of ["adminWorkspaceContract.ts", "adminWorkspaceTime.ts", "adminWorkspaceWording.ts", "adminWorkspaceFrame.ts",
      "adminWorkspaceBrowserRequest.ts"]) {
      const source = readFileSync(path.join(appRoot, "src/lib/solmind", file), "utf8");
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(/localStorage|sessionStorage|indexedDB|process\.env|server-only|serviceRoleClient|\/supabase\//.test(source), file).toBe(false);
    }
  });
});
