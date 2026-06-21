import { describe, expect, it } from "vitest";

import {
  selectActiveUserSession,
  type UserSessionSelectionCandidate,
} from "../sessionSelection";

const ACCOUNT_ID = "user-account-1";

// Fixed injected "now". Future/past expiries are relative to this.
const NOW = new Date("2026-06-21T12:00:00.000Z");
const FUTURE = "2026-06-21T13:00:00.000Z";
const PAST = "2026-06-21T11:00:00.000Z";

function candidate(
  overrides: Partial<UserSessionSelectionCandidate> = {},
): UserSessionSelectionCandidate {
  return {
    user_account_id: ACCOUNT_ID,
    active_role_context: "guide",
    session_status: "active",
    expires_at: FUTURE,
    ...overrides,
  };
}

describe("selectActiveUserSession", () => {
  it("returns the single valid active, non-expired session", () => {
    const only = candidate();

    const result = selectActiveUserSession({ candidates: [only], now: NOW });

    expect(result).toBe(only);
  });

  it("returns null when there are zero candidates", () => {
    expect(selectActiveUserSession({ candidates: [], now: NOW })).toBeNull();
  });

  it("returns null for non-active statuses even with a future expiry", () => {
    for (const status of [
      "expired",
      "logged_out",
      "revoked",
      "pending",
      "",
      "active ",
    ]) {
      const result = selectActiveUserSession({
        candidates: [candidate({ session_status: status })],
        now: NOW,
      });
      expect(result).toBeNull();
    }
  });

  it("returns null when an active-status session is already expired by time (expiration wins)", () => {
    const result = selectActiveUserSession({
      candidates: [candidate({ session_status: "active", expires_at: PAST })],
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("treats an expiry exactly equal to now as expired (not valid)", () => {
    const result = selectActiveUserSession({
      candidates: [
        candidate({ expires_at: "2026-06-21T12:00:00.000Z" }),
      ],
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("returns null for an unparseable expires_at", () => {
    const result = selectActiveUserSession({
      candidates: [candidate({ expires_at: "not-a-timestamp" })],
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("returns null when two valid active sessions exist (deny on ambiguity)", () => {
    const result = selectActiveUserSession({
      candidates: [
        candidate({ active_role_context: "guide" }),
        candidate({ active_role_context: "explorer" }),
      ],
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("returns the one valid active session when mixed with inactive/expired ones", () => {
    const valid = candidate({ active_role_context: "guide", expires_at: FUTURE });
    const result = selectActiveUserSession({
      candidates: [
        candidate({ session_status: "logged_out", expires_at: FUTURE }),
        valid,
        candidate({ session_status: "active", expires_at: PAST }),
        candidate({ session_status: "revoked", expires_at: FUTURE }),
      ],
      now: NOW,
    });

    expect(result).toBe(valid);
  });

  it("is deterministic for the same inputs", () => {
    const candidates = [candidate()];
    const first = selectActiveUserSession({ candidates, now: NOW });
    const second = selectActiveUserSession({ candidates, now: NOW });

    expect(first).toBe(second);
  });
});
