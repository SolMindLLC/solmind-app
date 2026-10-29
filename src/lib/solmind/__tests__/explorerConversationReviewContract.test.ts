import { describe, expect, it } from "vitest";
import { EXPLORER_CONVERSATION_VERSION } from "../explorerConversationContract";
import {
  EXPLORER_CONVERSATION_REVIEW_VERSION,
  parseExplorerConversationReviewResult,
} from "../explorerConversationReviewContract";

const id = (n: number) => "f42c0000-0000-4000-8000-" + String(n).padStart(12, "0");
const at = "2026-10-29T10:00:00.123456+00:00";
const metadata = (n = 1, endedAt: string | null = at) => ({ conversationId: id(n), endedAt });
const ended = () => ({
  version: EXPLORER_CONVERSATION_VERSION, conversationId: id(1), revision: 4,
  pendingTurn: false, providerState: "unavailable", messages: [], compassItems: [],
  priorityId: null, attentionId: null, waypoints: [], route: [], sessionStatus: "ended", ending: null,
});
const success = (state: unknown = null, items: unknown = [metadata()]) => ({
  version: EXPLORER_CONVERSATION_REVIEW_VERSION, ok: true, items, state, error: null,
});

// Pure parsing only. These cases claim no authentication, SQL, browser or provider proof.
describe("Explorer ended-conversation review contract", () => {
  it("accepts list-only success, including an empty owned list, without a synthetic state", () => {
    expect(parseExplorerConversationReviewResult(success(null, []))).toEqual(success(null, []));
    expect(parseExplorerConversationReviewResult(success())).toEqual(success());
  });
  it("retains every valid metadata row without an arbitrary history cap", () => {
    const items = Array.from({ length: 200 }, (_, n) => metadata(n + 1));
    const parsed = parseExplorerConversationReviewResult(success(null, items));
    expect(parsed?.ok && parsed.items.length).toBe(200);
    expect(parsed?.ok && Object.isFrozen(parsed.items) && parsed.items.every(Object.isFrozen)).toBe(true);
  });
  it("accepts an actual ended selected state and honest legacy absence of a saved ending", () => {
    const state = ended();
    expect(parseExplorerConversationReviewResult(success(state))).toEqual(success(state));
    expect(parseExplorerConversationReviewResult(success(state, [metadata(1, null)]))).toEqual(success(state, [metadata(1, null)]));
    const savedEnding = { ...state, ending: { operationId: id(9), revision: 4,
      endedAt: "2026-10-29T10:00:01Z", directionsTaken: "No Priority was confirmed. There are no recorded Route changes.",
      routeThroughRevision: 3 } };
    expect(parseExplorerConversationReviewResult(success(savedEnding))).toEqual(success(savedEnding));
  });
  it.each(["denied", "unavailable"] as const)("accepts only the closed %s failure with no private data", error => {
    const failure = { version: EXPLORER_CONVERSATION_REVIEW_VERSION, ok: false, items: null, state: null, error };
    const parsed = parseExplorerConversationReviewResult(failure);
    expect(parsed).toEqual(failure);
    expect(Object.isFrozen(parsed)).toBe(true);
  });
  it("rejects widened, missing or contradictory envelope fields", () => {
    for (const value of [null, [], { ...success(), version: "other" }, { ...success(), extra: true },
      { ...success(), ok: "true" }, { ...success(), error: "denied" },
      { version: EXPLORER_CONVERSATION_REVIEW_VERSION, ok: true, items: [], state: null },
      { version: EXPLORER_CONVERSATION_REVIEW_VERSION, outcome: "ok", items: [], state: null, error: null },
      { ...success(), items: null }]) expect(parseExplorerConversationReviewResult(value)).toBeNull();
  });
  it("rejects malformed, widened and duplicate metadata without dropping a row", () => {
    for (const items of [[metadata(), metadata()], [{ ...metadata(), title: "Not projected" }],
      [{ conversationId: id(1) }], [{ ...metadata(), conversationId: id(1) + "\n" }],
      [{ ...metadata(), conversationId: id(1).toUpperCase() }], [{ ...metadata(), conversationId: null }],
      [{ ...metadata(), endedAt: "2026-02-30T10:00:00Z" }], [{ ...metadata(), endedAt: at + "\n" }],
      [{ ...metadata(), endedAt: "2026-10-29T10:00:00-05:00" }], [{ ...metadata(), endedAt: 42 }]]) {
      expect(parseExplorerConversationReviewResult(success(null, items))).toBeNull();
    }
  });
  it("requires selected state to be ended, nonpending, unavailable and present in metadata", () => {
    for (const state of [{ ...ended(), sessionStatus: "active" }, { ...ended(), sessionStatus: null },
      { ...ended(), pendingTurn: true }, { ...ended(), providerState: "available" },
      { ...ended(), conversationId: null }, { ...ended(), conversationId: id(2) }, { ...ended(), revision: -1 }]) {
      expect(parseExplorerConversationReviewResult(success(state))).toBeNull();
    }
    const legacyState = ended() as Record<string, unknown>;
    delete legacyState.sessionStatus; delete legacyState.ending;
    expect(parseExplorerConversationReviewResult(success(legacyState))).toBeNull();
  });
  it("delegates selected-state content validation to the common conversation parser", () => {
    expect(parseExplorerConversationReviewResult(success({ ...ended(), privatePolicy: {} }))).toBeNull();
    expect(parseExplorerConversationReviewResult(success({ ...ended(), messages: [{ id: id(3) }] }))).toBeNull();
    expect(parseExplorerConversationReviewResult(success({ ...ended(), ending: { operationId: id(9) } }))).toBeNull();
  });
  it("rejects failure payload leaks and provider/readiness-specific errors", () => {
    const failure = { version: EXPLORER_CONVERSATION_REVIEW_VERSION, ok: false, items: null, state: null, error: "denied" };
    for (const value of [{ ...failure, items: [] }, { ...failure, items: [metadata()] }, { ...failure, state: ended() },
      { ...failure, error: null }, { ...failure, error: "provider_unavailable" }, { ...failure, error: "refresh_required" }]) {
      expect(parseExplorerConversationReviewResult(value)).toBeNull();
    }
  });
  it("copies and freezes metadata rather than retaining mutable input rows", () => {
    const input = success();
    const parsed = parseExplorerConversationReviewResult(input);
    (input.items as ReturnType<typeof metadata>[])[0].endedAt = null;
    expect(parsed?.ok && parsed.items[0].endedAt).toBe(at);
    expect(Object.isFrozen(parsed)).toBe(true);
  });
});
