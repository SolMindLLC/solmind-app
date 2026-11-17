import { describe, expect, it } from "vitest";
import { EXPLORER_PRIVATE_RESPONSE_VERSION, parseExplorerPrivateConversationResponse } from "./explorerPrivateConversationResponse";

const result = { ok: true, error: null, state: { version: "explorer-conversation.v1", conversationId: null,
  compassMode: "legacy", compassChanges: [],
  waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 0 },
  revision: 0, providerState: "unavailable", pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] } };
const assistance = { kind: "support", body: "Synthetic temporary support.\nNo saved reply.", persisted: false };
const response = () => ({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result, assistance });
describe("private conversation browser response", () => {
  it("keeps a real empty container projection and temporary assistance distinct", () => {
    const parsed = parseExplorerPrivateConversationResponse(response());
    expect(parsed?.result).toEqual(result);
    expect(parsed?.assistance).toEqual(assistance);
    expect(parsed?.result.ok && parsed.result.state.messages).toEqual([]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.assistance)).toBe(true);
  });
  it("admits the server-written hard-stop pause notice as one more closed assistance kind, frozen", () => {
    const paused = { kind: "paused", body: "Synthetic pause notice.\n\nSynthetic help text.", persisted: false };
    const parsed = parseExplorerPrivateConversationResponse({ ...response(), assistance: paused });
    expect(parsed?.assistance).toEqual(paused); expect(Object.isFrozen(parsed?.assistance)).toBe(true);
    expect(parseExplorerPrivateConversationResponse({ ...response(), assistance: { ...paused, notice_kind: "shared" } })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...response(), assistance: { ...paused, crisis: true } })).toBeNull();
  });
  it("admits static assistance after authority loss without private state", () => {
    const denied = { ok: false, state: null, error: "denied" };
    expect(parseExplorerPrivateConversationResponse({ ...response(), result: denied })?.result).toEqual(denied);
    expect(parseExplorerPrivateConversationResponse({ ...response(), assistance: null })?.assistance).toBeNull();
  });
  it("admits the failed-reply sentence only with a confirmed available, settled state", () => {
    const assistance = { kind: "reply_failed", body: "The reply did not come through. You can try again.", persisted: false };
    const available = { ...result, state: { ...result.state, providerState: "available" } };
    expect(parseExplorerPrivateConversationResponse({ ...response(), result: available, assistance })?.assistance).toEqual(assistance);
    for (const refused of [result, { ok: false, state: null, error: "denied" },
      { ...available, state: { ...available.state, pendingTurn: true } }]) {
      expect(parseExplorerPrivateConversationResponse({ ...response(), result: refused, assistance })).toBeNull();
    }
  });
  it.each([
    { ...response(), version: "another-version" },
    { ...response(), policy_state: { restrictedLevel: 3 } },
    { ...response(), result: { ...result, actor: "browser authority" } },
    { ...response(), assistance: { ...assistance, persisted: true } },
    { ...response(), assistance: { ...assistance, classification: 3 } },
    { ...response(), assistance: { ...assistance, kind: "generated_reply" } },
    { ...response(), assistance: { ...assistance, body: "x".repeat(8193) } },
    { ...response(), assistance: { ...assistance, body: "\ud800" } },
    { ...response(), assistance: { ...assistance, body: "\u0000private" } },
    { ...response(), assistance: { ...assistance, body: "   " } },
    result,
  ])("closes malformed, persisted or server-only projections", input => {
    expect(parseExplorerPrivateConversationResponse(input)).toBeNull();
  });
});

describe("offers build step 2: the stored result of an offer answer in the browser response", () => {
  const CONVERSATION = "00000000-0000-4000-8000-000000000011"; const REPLY = "00000000-0000-4000-8000-000000000012";
  const OFFER = "00000000-0000-4000-8000-000000000013"; const WAYPOINT = "00000000-0000-4000-8000-000000000014";
  const RESULT = "00000000-0000-4000-8000-000000000015";
  const saved = { ...result, state: { ...result.state, conversationId: CONVERSATION, revision: 2,
    messages: [{ id: REPLY, role: "virtualGuide", body: "A saved synthetic reply.", createdAt: "2026-11-16T09:00:00Z" }] } };
  const stored = { offerId: OFFER, kind: "change", waypointId: WAYPOINT, suggestionMessageId: REPLY, response: "right", typed: false,
    outcome: "confirmed", resultWaypointId: RESULT };
  const answered = (waypointOfferResult: unknown = stored) => ({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: saved, assistance: null, waypointOfferResult });
  it("admits the verified result beside a saved state, exactly and frozen, with its carrying reply", () => {
    for (const value of [stored, { ...stored, response: "close", outcome: "kept_open", resultWaypointId: null },
      { ...stored, response: "not_it", outcome: "declined", resultWaypointId: null },
      { ...stored, kind: "reached", resultWaypointId: WAYPOINT }, { ...stored, kind: "revisit" }]) {
      const parsed = parseExplorerPrivateConversationResponse(answered(value));
      expect(parsed).toEqual(answered(value));
      expect(Object.keys(parsed!).sort()).toEqual(["assistance", "result", "version", "waypointOfferResult"]);
      expect(parsed?.waypointOfferResult?.suggestionMessageId).toBe(REPLY);
      expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed?.waypointOfferResult)).toBe(true);
      expect(parsed?.waypointOfferResult).not.toBe(value);
    }
  });
  it("keeps every response without the key exactly as before", () => {
    for (const value of [response(), { ...response(), assistance: null }, { version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: saved, assistance: null }]) {
      const parsed = parseExplorerPrivateConversationResponse(value);
      expect(parsed).toEqual(value);
      expect(parsed).not.toHaveProperty("waypointOfferResult");
      expect(Object.keys(parsed!).sort()).toEqual(["assistance", "result", "version"]);
    }
  });
  it("refuses a malformed result, a typed answer's result, and a result beside a failure, assistance or no conversation", () => {
    for (const value of [null, {}, [], "confirmed", { ...stored, extra: true }, { ...stored, outcome: "declined" },
      { ...stored, resultWaypointId: null }, { ...stored, resultWaypointId: WAYPOINT }, { ...stored, offerId: "not-an-id" },
      { ...stored, suggestionMessageId: null }, { ...stored, typed: true }, { ...stored, typed: "false" },
      { ...stored, kind: "reached", response: "close", outcome: "kept_open", resultWaypointId: null }]) {
      expect(parseExplorerPrivateConversationResponse(answered(value))).toBeNull();
    }
    expect(parseExplorerPrivateConversationResponse({ ...answered(), waypointOfferResult: undefined })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...answered(), result })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...answered(), result: { ok: false, state: null, error: "unavailable" } })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...answered(), assistance })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...answered(), offerResult: stored })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ ...answered(), policy_state: {} })).toBeNull();
    expect(parseExplorerPrivateConversationResponse({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: saved, waypointOfferResult: stored })).toBeNull();
  });
});
