import { createHash } from "node:crypto";

import type { BrowserContext } from "@playwright/test";

import type { SuggestedWaypointFixtureActor } from "./suggestedWaypointLocalAuthFixture";
import type {
  SuggestedWaypointCookieRecord,
  SuggestedWaypointRoleSession,
} from "./suggestedWaypointLocalAuthFixture";
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

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const COOKIE_CONTROL = /[\u0000-\u001f\u007f]/u;
const COOKIE_PATH = /^\/(?:[^;\u0000-\u001f\u007f]*)$/u;
const MAX_COOKIE_COUNT = 16;
const MAX_COOKIE_NAME_LENGTH = 256;
const MAX_COOKIE_VALUE_LENGTH = 8_192;

type PlaywrightCookie = Parameters<BrowserContext["addCookies"]>[0][number];

export type SuggestedWaypointPlaywrightContext = Pick<
  BrowserContext,
  "addCookies" | "close" | "newPage"
>;

export type SuggestedWaypointPlaywrightBrowser = Readonly<{
  newContext(): Promise<SuggestedWaypointPlaywrightContext>;
}>;

export type SuggestedWaypointPlaywrightActor = Readonly<{
  role: SuggestedWaypointWholePathRole;
  context: SuggestedWaypointPlaywrightContext;
}>;

export type SuggestedWaypointPlaywrightBundle = Readonly<{
  actors: readonly SuggestedWaypointPlaywrightActor[];
  close(): Promise<void>;
}>;

export function suggestedWaypointPlaywrightContextOptions(
  config: SuggestedWaypointWholePathSafetyConfig,
): Readonly<{ baseURL: string }> {
  try {
    trustedApplicationDomain(config.trustedApplicationOrigin);
  } catch {
    throw new Error("whole_path_playwright_origin_refused");
  }
  return Object.freeze({ baseURL: config.trustedApplicationOrigin });
}

function sameSite(value: unknown): PlaywrightCookie["sameSite"] {
  switch (value) {
    case undefined:
    case "lax":
      return "Lax";
    case "strict":
      return "Strict";
    default:
      throw new Error("whole_path_playwright_cookie_same_site_refused");
  }
}

function trustedApplicationDomain(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("whole_path_playwright_origin_refused");
  }
  const port = Number(url.port);
  if (
    url.origin !== origin ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !Number.isSafeInteger(port) ||
    port < 4_100 ||
    port > 4_999 ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("whole_path_playwright_origin_refused");
  }
  return url.hostname;
}

function mapCookie(
  cookie: SuggestedWaypointCookieRecord,
  trustedAppDomain: string,
  nowSeconds: number,
): PlaywrightCookie | null {
  if (
    typeof cookie.name !== "string" ||
    cookie.name.length > MAX_COOKIE_NAME_LENGTH ||
    !COOKIE_NAME.test(cookie.name) ||
    typeof cookie.value !== "string" ||
    cookie.value.length === 0 ||
    cookie.value.length > MAX_COOKIE_VALUE_LENGTH ||
    COOKIE_CONTROL.test(cookie.value)
  ) {
    throw new Error("whole_path_playwright_cookie_refused");
  }

  const options = cookie.options;
  if (
    options.domain !== undefined ||
    options.partitioned === true ||
    options.secure === true ||
    options.expires !== undefined ||
    (options.httpOnly !== undefined && typeof options.httpOnly !== "boolean")
  ) {
    throw new Error("whole_path_playwright_cookie_scope_refused");
  }

  const path = options.path ?? "/";
  if (typeof path !== "string" || !COOKIE_PATH.test(path)) {
    throw new Error("whole_path_playwright_cookie_path_refused");
  }

  let expires: number | undefined;
  if (options.maxAge !== undefined) {
    if (!Number.isSafeInteger(options.maxAge)) {
      throw new Error("whole_path_playwright_cookie_expiry_refused");
    }
    if (options.maxAge <= 0) {
      return null;
    }
    expires = nowSeconds + options.maxAge;
    if (!Number.isSafeInteger(expires) || expires <= nowSeconds) {
      throw new Error("whole_path_playwright_cookie_expiry_refused");
    }
  }

  return Object.freeze({
    name: cookie.name,
    value: cookie.value,
    domain: trustedAppDomain,
    path,
    ...(expires === undefined ? {} : { expires }),
    httpOnly: options.httpOnly ?? false,
    secure: false,
    sameSite: sameSite(options.sameSite),
  });
}

function validateActors(
  actors: readonly SuggestedWaypointFixtureActor[],
): readonly SuggestedWaypointFixtureActor[] {
  try {
    if (actors.length !== ROLES.length) {
      throw new Error("whole_path_playwright_actor_binding_refused");
    }
    const sessions = new Set<SuggestedWaypointRoleSession>();
    for (let index = 0; index < ROLES.length; index += 1) {
      const actor = actors[index];
      if (!actor || actor.role !== ROLES[index] || sessions.has(actor.session)) {
        throw new Error("whole_path_playwright_actor_binding_refused");
      }
      sessions.add(actor.session);
    }
    return actors;
  } catch {
    throw new Error("whole_path_playwright_actor_binding_refused");
  }
}

function cookieSetDigest(cookies: readonly PlaywrightCookie[]): string {
  const ordered = [...cookies].sort((left, right) => {
    const leftKey = `${left.name}\u0000${left.value}`;
    const rightKey = `${right.name}\u0000${right.value}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const hash = createHash("sha256");
  for (const cookie of ordered) {
    for (const value of [cookie.name, cookie.value]) {
      hash.update(String(Buffer.byteLength(value, "utf8")));
      hash.update(":");
      hash.update(value, "utf8");
      hash.update(";");
    }
  }
  return hash.digest("hex");
}

async function closeContexts(
  contexts: readonly SuggestedWaypointPlaywrightContext[],
): Promise<boolean> {
  let failed = false;
  for (const context of [...contexts].reverse()) {
    try {
      await context.close();
    } catch {
      failed = true;
    }
  }
  return !failed;
}

export async function createSuggestedWaypointPlaywrightBundle(
  browser: SuggestedWaypointPlaywrightBrowser,
  actors: readonly SuggestedWaypointFixtureActor[],
  config: SuggestedWaypointWholePathSafetyConfig,
  now: () => number = Date.now,
): Promise<SuggestedWaypointPlaywrightBundle> {
  const validatedActors = validateActors(actors);
  let nowMilliseconds: number;
  try {
    nowMilliseconds = now();
  } catch {
    throw new Error("whole_path_playwright_clock_refused");
  }
  if (!Number.isSafeInteger(nowMilliseconds) || nowMilliseconds < 0) {
    throw new Error("whole_path_playwright_clock_refused");
  }
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  let trustedAppDomain: string;
  try {
    trustedAppDomain = trustedApplicationDomain(config.trustedApplicationOrigin);
  } catch {
    throw new Error("whole_path_playwright_origin_refused");
  }
  const contexts: SuggestedWaypointPlaywrightContext[] = [];
  const playwrightActors: SuggestedWaypointPlaywrightActor[] = [];
  const sessionDigests = new Set<string>();

  try {
    for (const actor of validatedActors) {
      const snapshot = [...actor.session.cookies()];
      if (snapshot.length === 0 || snapshot.length > MAX_COOKIE_COUNT) {
        throw new Error("whole_path_playwright_cookie_set_refused");
      }
      const cookies = snapshot
        .map((cookie) =>
          mapCookie(cookie, trustedAppDomain, nowSeconds),
        )
        .filter((cookie): cookie is PlaywrightCookie => cookie !== null);
      snapshot.length = 0;
      if (cookies.length === 0) {
        throw new Error("whole_path_playwright_cookie_set_refused");
      }
      const sessionDigest = cookieSetDigest(cookies);
      if (sessionDigests.has(sessionDigest)) {
        throw new Error("whole_path_playwright_session_reuse_refused");
      }
      sessionDigests.add(sessionDigest);

      const context = await browser.newContext();
      if (contexts.includes(context)) {
        throw new Error("whole_path_playwright_context_reuse_refused");
      }
      contexts.push(context);
      try {
        await context.addCookies(cookies);
      } finally {
        cookies.length = 0;
      }
      playwrightActors.push(Object.freeze({ role: actor.role, context }));
    }
  } catch {
    const cleanupPassed = await closeContexts(contexts);
    if (!cleanupPassed) {
      throw new Error("whole_path_playwright_setup_cleanup_failed");
    }
    throw new Error("whole_path_playwright_setup_failed");
  }

  let closed = false;
  let closing: Promise<void> | undefined;
  return Object.freeze({
    actors: Object.freeze(playwrightActors),
    async close() {
      if (closed) return;
      if (!closing) {
        closing = (async () => {
          if (!(await closeContexts(contexts))) {
            throw new Error("whole_path_playwright_cleanup_failed");
          }
          contexts.length = 0;
          sessionDigests.clear();
          closed = true;
        })();
      }
      try {
        await closing;
      } finally {
        closing = undefined;
      }
    },
  });
}
