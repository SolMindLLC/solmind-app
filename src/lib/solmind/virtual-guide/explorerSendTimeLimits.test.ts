import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS } from "../explorerSendScreenLimit";
import { withExplorerPrivateRequestBudgets } from "../operations/explorerPrivateRequestBudgets";
import type { ExplorerPrivateConversationDependencies } from "./explorerPrivateConversationComposition";
import { DEFAULT_OPENAI_MODEL, OPENAI_REPLY_LIMIT_MILLISECONDS, openAiReplyLimitMilliseconds } from "./openAiModelConfiguration";
import { EXPLORER_SAFETY_REPLY_LIMITS, EXPLORER_SEND_TIME_LIMITS, explorerSendDeadlineMilliseconds } from "./explorerSafetyReplyContract";

// Correction D-12 (2026-11-09; Paul's decisions, PRJ01-SPR002 decision queue, entry "Meeting part 2 decisions",
// items 6 and 7): one reply limit per provider model, an overall Send deadline under a ceiling, and a screen that
// always waits beyond the ceiling.
afterEach(() => { vi.useRealTimers(); });
describe("D-12 Send time limits", () => {
  const limits = [OPENAI_REPLY_LIMIT_MILLISECONDS.default, ...Object.values(OPENAI_REPLY_LIMIT_MILLISECONDS.models)];
  // The composition's numbers rest on the request factory's own alarms (src/lib/solmind/operations/
  // explorerPrivateRequestBudgets.ts): prepare's must fit its allowance, and settlement's plus trusted rendering's two
  // seconds must fit the saving reserve (review of D-12, finding 2).
  it("keeps prepare's own alarm inside the prepare allowance and settlement's inside the reserve", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const hang = () => new Promise<never>(() => undefined);
    const wrapped = withExplorerPrivateRequestBudgets({ authenticate: hang,
      repository: { read: hang, ensure: hang, observe: hang, prepare: hang, settle: hang, pause: hang } } as unknown as ExplorerPrivateConversationDependencies);
    const ended = { prepare: false, settle: false };
    wrapped.repository.prepare({} as never).catch(() => { ended.prepare = true; });
    wrapped.repository.settle({} as never).catch(() => { ended.settle = true; });
    await vi.advanceTimersByTimeAsync(EXPLORER_SEND_TIME_LIMITS.prepareAllowanceMilliseconds);
    expect(ended.prepare).toBe(true);
    await vi.advanceTimersByTimeAsync(EXPLORER_SEND_TIME_LIMITS.savingReserveMilliseconds - 2_000 -
      EXPLORER_SEND_TIME_LIMITS.prepareAllowanceMilliseconds);
    expect(ended.settle).toBe(true);
  });
  it("leaves prepare and a minimum reply window inside the setup allowance plus every model's reply limit", () => {
    for (const limit of limits) {
      expect(EXPLORER_SEND_TIME_LIMITS.minimumReplyMilliseconds).toBeLessThanOrEqual(limit);
      expect(EXPLORER_SEND_TIME_LIMITS.prepareAllowanceMilliseconds + EXPLORER_SEND_TIME_LIMITS.minimumReplyMilliseconds)
        .toBeLessThanOrEqual(EXPLORER_SEND_TIME_LIMITS.setupAllowanceMilliseconds + limit);
    }
  });
  it("keeps the screen's wait at the server ceiling plus its margin", () => {
    expect(EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS)
      .toBe(EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds + EXPLORER_SEND_TIME_LIMITS.screenMarginMilliseconds);
    expect(EXPLORER_SEND_TIME_LIMITS.screenMarginMilliseconds).toBeGreaterThan(0);
  });
  it.each(limits)("keeps the reply limit %i inside the reply alarm's range and its deadline under the ceiling", limit => {
    expect(Number.isSafeInteger(limit)).toBe(true);
    expect(limit).toBeGreaterThanOrEqual(EXPLORER_SAFETY_REPLY_LIMITS.minimumTimeoutMilliseconds);
    expect(limit).toBeLessThanOrEqual(EXPLORER_SAFETY_REPLY_LIMITS.maximumTimeoutMilliseconds);
    // A setting that would pass the ceiling fails here, instead of being cut silently at run time.
    const unclamped = EXPLORER_SEND_TIME_LIMITS.setupAllowanceMilliseconds + limit + EXPLORER_SEND_TIME_LIMITS.savingReserveMilliseconds;
    expect(unclamped).toBeLessThanOrEqual(EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds);
    expect(explorerSendDeadlineMilliseconds(limit)).toBe(unclamped);
  });
  it("uses the numbers shown to Paul for Luna", () => {
    expect(openAiReplyLimitMilliseconds(DEFAULT_OPENAI_MODEL)).toBe(60_000);
    expect(explorerSendDeadlineMilliseconds(60_000)).toBe(100_000);
    expect(EXPLORER_SEND_TIME_LIMITS).toEqual({ setupAllowanceMilliseconds: 25_000, savingReserveMilliseconds: 15_000,
      prepareAllowanceMilliseconds: 10_000, minimumReplyMilliseconds: 15_000,
      ceilingMilliseconds: 120_000, screenMarginMilliseconds: 10_000 });
    expect(EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS).toBe(130_000);
  });
  it("never lets the deadline pass the ceiling at run time", () => {
    expect(explorerSendDeadlineMilliseconds(EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds))
      .toBe(EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds);
  });
  it("uses the default for a model without its own setting and refuses an invalid model name", () => {
    expect(openAiReplyLimitMilliseconds("synthetic-model-without-setting")).toBe(OPENAI_REPLY_LIMIT_MILLISECONDS.default);
    expect(() => openAiReplyLimitMilliseconds("not a model name")).toThrow("openai_model_configuration_unavailable");
    expect(Object.isFrozen(OPENAI_REPLY_LIMIT_MILLISECONDS)).toBe(true);
    expect(Object.isFrozen(OPENAI_REPLY_LIMIT_MILLISECONDS.models)).toBe(true);
    expect(Object.isFrozen(EXPLORER_SEND_TIME_LIMITS)).toBe(true);
  });
});
