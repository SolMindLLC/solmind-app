import { describe, expect, it } from "vitest";
import { EXPLORER_PRIVATE_RESPONSE_VERSION, parseExplorerPrivateConversationResponse } from "./explorerPrivateConversationResponse";

const result = { ok: true, error: null, state: { version: "explorer-conversation.v1", conversationId: null,
  revision: 0, providerState: "unavailable", pendingTurn: false, messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] } };
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
  it("admits static assistance after authority loss without private state", () => {
    const denied = { ok: false, state: null, error: "denied" };
    expect(parseExplorerPrivateConversationResponse({ ...response(), result: denied })?.result).toEqual(denied);
    expect(parseExplorerPrivateConversationResponse({ ...response(), assistance: null })?.assistance).toBeNull();
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
