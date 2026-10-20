import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { describe, expect, it } from "vitest";

import { readSessionAuthCookieAccessToken, readSessionAuthCookieCleanupCandidate, readSessionAuthCookies, resolveSessionCookiePolicy } from "../sessionCookiePolicy";

const policy = resolveSessionCookiePolicy("http://127.0.0.1:3000")!;
const access = "aW50ZXJuYWw.c3ludGhldGlj.c2lnbmF0dXJl";
const refresh = "synthetic-refresh";
const proof = `v1.${"A".repeat(43)}`;
const session = { access_token: access, refresh_token: refresh, expires_at: 1_900_000_000, user: { id: "untrusted-account" } };
const cookies = (value: unknown) => createChunks(policy.authCookieName, `base64-${stringToBase64URL(JSON.stringify(value))}`);

describe("cleanup-only shared cookie projection", () => {
  it("uses the shared parser for chunked auth, returns only immutable credential primitives and preserves legacy access-only behavior", () => {
    const input = cookies({ ...session, user: { id: "untrusted-account", padding: "x".repeat(5000) }, solmind_pair_proof: proof });
    const result = readSessionAuthCookieCleanupCandidate(policy, input);
    expect(input.length > 1).toBe(true);
    expect(result !== null && Object.isFrozen(result) && result.accessToken === access && result.refreshToken === refresh && result.proof === proof).toBe(true);
    expect(result === null ? [] : Object.keys(result).sort()).toEqual(["accessToken", "proof", "refreshToken"]);
    expect(readSessionAuthCookieAccessToken(policy, input) === access).toBe(true);
    expect(readSessionAuthCookies(policy, input).status).toBe("present");
  });

  it("returns no authority for copied profile fields, and missing or non-string proof keeps old access extraction available", () => {
    for (const extra of [{}, { solmind_pair_proof: { issuer: "untrusted", token: "private" } }, { solmind_pair_proof: null }]) {
      const result = readSessionAuthCookieCleanupCandidate(policy, cookies({ ...session, ...extra }));
      expect(result !== null && result.proof === undefined && result.accessToken === access).toBe(true);
    }
  });

  it("refuses the same malformed JSON, missing fields, invalid UTF8 and bad cookie families as the shared format check", () => {
    const inputs = [
      [], cookies(null), cookies([]), cookies({ ...session, refresh_token: "" }), cookies({ ...session, access_token: "not-a-jwt" }),
      cookies({ ...session, expires_at: 0 }), cookies({ ...session, user: [] }),
      [{ name: policy.authCookieName, value: "base64-_w" }],
      [...cookies(session), { name: `${policy.authCookieName}.9`, value: "bad+chunk" }],
    ];
    for (const input of inputs) {
      expect(readSessionAuthCookies(policy, input).status === "present").toBe(false);
      expect(readSessionAuthCookieCleanupCandidate(policy, input) === null).toBe(true);
      expect(readSessionAuthCookieAccessToken(policy, input) === null).toBe(true);
    }
  });

  it("follows the existing library-compatible base-cookie precedence without merging credentials from another chunk family", () => {
    const base = cookies(session);
    const other = createChunks(policy.authCookieName, `base64-${stringToBase64URL(JSON.stringify({ ...session, refresh_token: "different-refresh", user: { padding: "x".repeat(4000) } }))}`);
    const result = readSessionAuthCookieCleanupCandidate(policy, [...base, ...other]);
    expect(result !== null && result.refreshToken === refresh).toBe(true);
  });
});
