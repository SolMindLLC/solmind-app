// Pure raw-cookie framing shared by protected pages and conversation requests.
// Preserve owned occurrences and exact values for the existing auth boundary.
// Tolerance applies only to malformed unrelated pairs; this grants no identity.
import {
  SESSION_AUTH_COOKIE_BASE_NAME,
  SESSION_BINDING_COOKIE_BASE_NAME,
  SESSION_HOSTED_COOKIE_NAME_PREFIX,
} from "./sessionCookiePolicy";
import type { RequestCookie } from "./requestCookieAccessor";

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;
function ownedLooking(pair: string): boolean {
  const unprefixed = pair.startsWith(SESSION_HOSTED_COOKIE_NAME_PREFIX)
    ? pair.slice(SESSION_HOSTED_COOKIE_NAME_PREFIX.length) : pair;
  return unprefixed.startsWith(SESSION_AUTH_COOKIE_BASE_NAME) ||
    unprefixed.startsWith(SESSION_BINDING_COOKIE_BASE_NAME);
}

export function readRawRequestCookies(raw: string | null): readonly RequestCookie[] | null {
  if (raw === null || raw === "") return [];
  // Count the original header and every raw segment before skipping anything.
  if (raw.length > 16_384 || raw.includes("\r") || raw.includes("\n") || raw.includes("\u0000")) return null;
  const parts = raw.split(";");
  if (parts.length > 128) return null;
  const result: RequestCookie[] = [];
  for (const segment of parts) {
    const pair = segment.replace(/^[\t ]+/, "");
    const equals = pair.indexOf("=");
    if (equals >= 1) {
      const name = pair.slice(0, equals), value = pair.slice(equals + 1);
      if (COOKIE_NAME.test(name) && COOKIE_VALUE.test(value)) {
        result.push({ name, value });
        continue;
      }
    }
    // Never hide an invalid owned duplicate, chunk, verifier or suspicious suffix.
    if (ownedLooking(pair)) return null;
  }
  return result;
}
