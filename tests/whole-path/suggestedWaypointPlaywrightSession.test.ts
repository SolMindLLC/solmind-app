import { describe, expect, it, vi } from "vitest";

import type {
  SuggestedWaypointCookieRecord,
  SuggestedWaypointFixtureActor,
} from "./suggestedWaypointLocalAuthFixture";
import {
  createSuggestedWaypointPlaywrightBundle,
  suggestedWaypointPlaywrightContextOptions,
  type SuggestedWaypointPlaywrightBrowser,
  type SuggestedWaypointPlaywrightContext,
} from "./suggestedWaypointPlaywrightSession";
import type {
  SuggestedWaypointWholePathRole,
  SuggestedWaypointWholePathSafetyConfig,
} from "./suggestedWaypointWholePathSafety";

const ROLES = [
  "assigned-guide",
  "assigned-explorer",
  "unrelated-guide",
  "unrelated-explorer",
  "ended-explorer",
] as const satisfies readonly SuggestedWaypointWholePathRole[];

const config = Object.freeze({
  trustedApplicationOrigin: "http://127.0.0.1:4627",
} as SuggestedWaypointWholePathSafetyConfig);

function cookie(
  name: string,
  value: string,
  options: SuggestedWaypointCookieRecord["options"] = {},
): SuggestedWaypointCookieRecord {
  return Object.freeze({ name, value, options: Object.freeze({ ...options }) });
}

function actors(
  createCookies: (role: SuggestedWaypointWholePathRole) => readonly SuggestedWaypointCookieRecord[] =
    (role) => [cookie(`sb-${role}`, `value-${role}`, { path: "/", sameSite: "lax", maxAge: 3600 })],
): SuggestedWaypointFixtureActor[] {
  return ROLES.map((role) =>
    Object.freeze({
      role,
      session: Object.freeze({
        cookies: () => Object.freeze([...createCookies(role)]),
        async clear() {},
      }),
    }),
  );
}

function browser(failAt = -1, failCloseAt = -1) {
  const events: string[] = [];
  const contexts: SuggestedWaypointPlaywrightContext[] = [];
  const addCookies = vi.fn();
  let closeFailureAvailable = true;
  const value: SuggestedWaypointPlaywrightBrowser = {
    async newContext() {
      const index = contexts.length;
      events.push(`new:${index}`);
      const context: SuggestedWaypointPlaywrightContext = {
        async newPage() {
          throw new Error("test_context_has_no_page");
        },
        async addCookies(cookies) {
          events.push(`cookies:${index}:${cookies.length}`);
          addCookies(index, cookies.map((cookie) => ({ ...cookie })));
          if (index === failAt) throw new Error("protected add-cookie detail");
        },
        async close() {
          events.push(`close:${index}`);
          if (index === failCloseAt && closeFailureAvailable) {
            closeFailureAvailable = false;
            throw new Error("protected close detail");
          }
        },
      };
      contexts.push(context);
      return context;
    },
  };
  return { value, contexts, events, addCookies };
}

describe("Suggested Waypoint in-memory Playwright session seam", () => {
  it("binds manual browser contexts to the validated trusted origin", () => {
    const options = suggestedWaypointPlaywrightContextOptions(config);
    expect(options).toEqual({ baseURL: "http://127.0.0.1:4627" });
    expect(Object.isFrozen(options)).toBe(true);
  });

  it("refuses an untrusted manual-context origin", () => {
    expect(() =>
      suggestedWaypointPlaywrightContextOptions({
        ...config,
        trustedApplicationOrigin: "https://example.com",
      }),
    ).toThrow("whole_path_playwright_origin_refused");
  });

  it("creates five role-isolated contexts and maps every active cookie chunk", async () => {
    const target = browser();
    const bundle = await createSuggestedWaypointPlaywrightBundle(
      target.value,
      actors((role) => [
        cookie(`sb-${role}.0`, `chunk-a-${role}`, { path: "/", sameSite: "lax", maxAge: 3600 }),
        cookie(`sb-${role}.1`, `chunk-b-${role}`, { path: "/auth", sameSite: "strict", httpOnly: true }),
      ]),
      config,
      () => 1_800_000_000_000,
    );

    expect(bundle.actors.map((actor) => actor.role)).toEqual(ROLES);
    expect(new Set(bundle.actors.map((actor) => actor.context)).size).toBe(5);
    expect(target.addCookies).toHaveBeenCalledTimes(5);
    expect(target.addCookies.mock.calls[0]?.[1]).toEqual([
      {
        name: "sb-assigned-guide.0",
        value: "chunk-a-assigned-guide",
        domain: "127.0.0.1",
        path: "/",
        expires: 1_800_003_600,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
      {
        name: "sb-assigned-guide.1",
        value: "chunk-b-assigned-guide",
        domain: "127.0.0.1",
        path: "/auth",
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
      },
    ]);
  });

  it("drops removal records without reordering active chunks", async () => {
    const target = browser();
    await createSuggestedWaypointPlaywrightBundle(
      target.value,
      actors((role) => [
        cookie(`sb-${role}.removed`, "removed", { maxAge: 0 }),
        cookie(`sb-${role}.active`, "active", { maxAge: 60, sameSite: "lax" }),
      ]),
      config,
      () => 2_000,
    );
    expect(target.addCookies.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({
        name: "sb-assigned-guide.active",
        sameSite: "Lax",
        expires: 62,
      }),
    ]);
  });

  it.each([
    ["Domain", { domain: "example.com" }],
    ["Secure", { secure: true }],
    ["Partitioned", { partitioned: true }],
    ["explicit expires", { expires: new Date("2099-01-01T00:00:00Z") }],
    ["unknown SameSite", { sameSite: true }],
    ["SameSite None on non-secure loopback", { sameSite: "none" }],
    ["malformed path", { path: "/ok; Domain=bad" }],
    ["fractional maxAge", { maxAge: 1.5 }],
  ] as const)("refuses %s before creating a browser context", async (_label, options) => {
    const target = browser();
    await expect(
      createSuggestedWaypointPlaywrightBundle(
        target.value,
        actors((role) => [cookie(`sb-${role}`, "protected", options)]),
        config,
      ),
    ).rejects.toThrow("whole_path_playwright_setup_failed");
    expect(target.contexts).toHaveLength(0);
  });

  it("refuses malformed names, values, empty active sets, actor drift, and clocks", async () => {
    const target = browser();
    for (const createActors of [
      () => actors(() => [cookie("bad name", "value")]),
      () => actors(() => [cookie("good-name", "bad\nvalue")]),
      () => actors(() => [cookie("good-name", "removed", { maxAge: -1 })]),
      () => actors().slice(1),
      () => actors().map((actor, index, all) => index === 4 ? Object.freeze({ ...actor, session: all[0]!.session }) : actor),
    ]) {
      await expect(
        createSuggestedWaypointPlaywrightBundle(target.value, createActors(), config),
      ).rejects.toThrow(/whole_path_playwright_/u);
    }
    await expect(
      createSuggestedWaypointPlaywrightBundle(target.value, actors(), config, () => Number.NaN),
    ).rejects.toThrow("whole_path_playwright_clock_refused");
    await expect(
      createSuggestedWaypointPlaywrightBundle(target.value, actors(), config, () => {
        throw new Error("protected clock detail");
      }),
    ).rejects.toThrow("whole_path_playwright_clock_refused");
    expect(target.contexts).toHaveLength(0);
  });

  it("refuses a forged non-loopback or out-of-range application origin", async () => {
    const target = browser();
    for (const trustedApplicationOrigin of [
      "https://127.0.0.1:4627",
      "http://localhost:4627",
      "http://127.0.0.1:54321",
      "not-an-origin",
    ]) {
      await expect(
        createSuggestedWaypointPlaywrightBundle(
          target.value,
          actors(),
          { trustedApplicationOrigin } as SuggestedWaypointWholePathSafetyConfig,
        ),
      ).rejects.toThrow("whole_path_playwright_origin_refused");
    }
    expect(target.contexts).toHaveLength(0);
  });

  it("closes every prior context in reverse order after a setup failure", async () => {
    const target = browser(3);
    await expect(
      createSuggestedWaypointPlaywrightBundle(target.value, actors(), config),
    ).rejects.toThrow("whole_path_playwright_setup_failed");
    expect(target.events.filter((event) => event.startsWith("close:"))).toEqual([
      "close:3", "close:2", "close:1", "close:0",
    ]);
    expect(target.events.join(" ")).not.toContain("protected");
  });

  it("refuses duplicate role-session cookie identity and closes the prior context", async () => {
    const target = browser();
    await expect(
      createSuggestedWaypointPlaywrightBundle(
        target.value,
        actors(() => [cookie("sb-common", "same-session")]),
        config,
      ),
    ).rejects.toThrow("whole_path_playwright_setup_failed");
    expect(target.events).toEqual(["new:0", "cookies:0:1", "close:0"]);
  });

  it("reports setup-cleanup failure with one fixed value-free category", async () => {
    const target = browser(3, 2);
    await expect(
      createSuggestedWaypointPlaywrightBundle(target.value, actors(), config),
    ).rejects.toThrow("whole_path_playwright_setup_cleanup_failed");
  });

  it("owns reverse, complete, idempotent success cleanup", async () => {
    const target = browser();
    const bundle = await createSuggestedWaypointPlaywrightBundle(
      target.value,
      actors(),
      config,
    );
    await Promise.all([bundle.close(), bundle.close()]);
    await bundle.close();
    expect(target.events.filter((event) => event.startsWith("close:"))).toEqual([
      "close:4", "close:3", "close:2", "close:1", "close:0",
    ]);
    expect(bundle.actors.map((actor) => actor.role)).toEqual(ROLES);
  });

  it("refuses unbounded cookie records before creating a browser context", async () => {
    const target = browser();
    for (const createCookies of [
      () => Array.from({ length: 17 }, (_, index) => cookie(`sb-${index}`, "value")),
      () => [cookie(`sb-${"a".repeat(254)}`, "value")],
      () => [cookie("sb-name", "v".repeat(8_193))],
    ]) {
      await expect(
        createSuggestedWaypointPlaywrightBundle(
          target.value,
          actors(createCookies),
          config,
        ),
      ).rejects.toThrow("whole_path_playwright_setup_failed");
    }
    expect(target.contexts).toHaveLength(0);
  });

  it("reports success-cleanup failure without protected context detail", async () => {
    const target = browser(-1, 1);
    const bundle = await createSuggestedWaypointPlaywrightBundle(
      target.value,
      actors(),
      config,
    );
    await expect(bundle.close()).rejects.toThrow(
      "whole_path_playwright_cleanup_failed",
    );
    await bundle.close();
    await bundle.close();
    expect(target.events.filter((event) => event.startsWith("close:"))).toEqual([
      "close:4", "close:3", "close:2", "close:1", "close:0",
      "close:4", "close:3", "close:2", "close:1", "close:0",
    ]);
    expect(target.events.join(" ")).not.toContain("protected");
  });
});
