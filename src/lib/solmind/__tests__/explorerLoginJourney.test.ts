import { describe, expect, it } from "vitest";
import {
  createExplorerExpiryClock, explorerStatusText, EXPLORER_CODE_REFUSAL,
  EXPLORER_LOGIN_UNCERTAINTY, EXPLORER_REENTRY_PATH, EXPLORER_RESPONSE_BUDGET_MS,
  LOGOUT_RESPONSE_BUDGET_MS, SESSION_WARNING,
} from "../explorerLoginJourney";

const base = Date.parse("2026-10-16T12:00:00.000Z");
const session = { observedAt: new Date(base).toISOString(), expiresAt: new Date(base + 600_000).toISOString() };
const status = { ready: true, stage: "code" as const, pending: null, outcome: null };

describe("Explorer journey presentation", () => {
  it("J01 uses explicit finite composition budgets and fixed re-entry", () => {
    expect([EXPLORER_RESPONSE_BUDGET_MS, LOGOUT_RESPONSE_BUDGET_MS]).toEqual([60_000, 30_000]);
    expect(EXPLORER_REENTRY_PATH).toBe("/login/explorer");
  });
  it("J02 maps opaque code refusal without inventing expiry, wrong-only or lockout", () => {
    expect(explorerStatusText({ ...status, outcome: "code_not_accepted" })).toBe(EXPLORER_CODE_REFUSAL);
    expect(/expired|already been used|doesn't match|please wait/i.test(EXPLORER_CODE_REFUSAL)).toBe(false);
  });
  it("J03 preserves conditional acknowledgment and input-only correction", () => {
    expect(explorerStatusText({ ...status, outcome: "verification_code_requested" })).toBeNull();
    expect(explorerStatusText({ ...status, outcome: "invalid_email" })).toBe("Enter a valid email address.");
    expect(explorerStatusText({ ...status, outcome: "denied" })).toBe(EXPLORER_LOGIN_UNCERTAINTY);
  });
  it("J04 pending and completion status never claims background success", () => {
    expect(explorerStatusText({ ...status, pending: "verify" })).toBe("Checking your code...");
    expect(explorerStatusText({ ...status, pending: "send" })).toBe("Requesting your code...");
    expect(explorerStatusText({ ...status, ready: false })).toBe("Preparing sign-in...");
    expect(explorerStatusText({ ...status, stage: "complete" })).toBe("Opening your Explorer home...");
    expect(SESSION_WARNING.includes("within 5 minutes") && !SESSION_WARNING.includes("Stay signed in")).toBe(true);
  });
  it("J05 exact five-minute threshold warns and exact expiry ends", () => {
    const clock = createExplorerExpiryClock(session, base, 10)!;
    expect(clock.read(base + 299_999, 300_009).warning).toBe(false);
    expect(clock.read(base + 300_000, 300_010).warning).toBe(true);
    expect(clock.read(base + 600_000, 600_010).ended).toBe(true);
  });
  it("J06 late mounting warns truthfully without restarting five minutes", () => {
    const clock = createExplorerExpiryClock(session, base + 590_000, 20)!;
    expect(clock.read(base + 590_000, 20)).toEqual({ remainingMilliseconds: 10_000, warning: true, ended: false });
  });
  it("J07 a paused monotonic clock cannot hide elapsed wall time after sleep", () => {
    const clock = createExplorerExpiryClock(session, base, 10)!;
    expect(clock.read(base + 610_000, 10).ended).toBe(true);
  });
  it("J08 wall rollback cannot extend a previously observed remaining interval", () => {
    const clock = createExplorerExpiryClock(session, base, 10)!;
    expect(clock.read(base + 400_000, 11).remainingMilliseconds).toBe(200_000);
    expect(clock.read(base - 900_000, 12).remainingMilliseconds).toBe(200_000);
    expect(clock.read(base - 900_000, 600_010).ended).toBe(true);
  });
  it("J09 initially slow wall clock is capped by the server observation", () => {
    const clock = createExplorerExpiryClock(session, base - 100_000, 0)!;
    expect(clock.read(base - 100_000, 0).remainingMilliseconds).toBe(600_000);
  });
  it("J10 bad or ended input and later clock corruption fail closed permanently", () => {
    expect(createExplorerExpiryClock({ ...session, expiresAt: "bad" }, base, 0)).toBeNull();
    expect(createExplorerExpiryClock({ ...session, expiresAt: session.observedAt }, base, 0)).toBeNull();
    expect(createExplorerExpiryClock(session, NaN, 0)).toBeNull();
    const clock = createExplorerExpiryClock(session, base, 0)!;
    expect(clock.read(Infinity, 1).ended).toBe(true);
    expect(clock.read(base, 0).ended).toBe(true);
  });
});
