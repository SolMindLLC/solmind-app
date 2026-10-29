import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversationReview, ExplorerEndedConversationReadback } from "../ExplorerConversationReview";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";

function ended(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: "conversation-a", revision: 4,
    pendingTurn: false, providerState: "unavailable", messages: [], compassItems: [], priorityId: null, attentionId: null,
    waypoints: [], route: [], sessionStatus: "ended", ending: { operationId: "end-operation", revision: 4,
      endedAt: "2026-10-29T07:04:00.123456+00:00", directionsTaken: "Actual saved ending <script>plain text</script>.", routeThroughRevision: 3 }, ...overrides };
}
beforeEach(() => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_effect")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("Ended conversation readback (static proof only)", () => {
  it("renders a data-free public shell before any authenticated browser GET", () => {
    const html = renderToStaticMarkup(createElement(ExplorerConversationReview));
    expect(html).toContain("Your ended conversations");
    expect(html).toContain("Loading your saved ended conversations...");
    expect(html).not.toContain("Actual saved ending");
    expect(html).not.toContain("conversation-a");
    expect(html).not.toContain("Your message");
  });
  it("renders actual saved ending bytes/time and escaped messages without a composer or mutation controls", () => {
    const current = ended({ messages: [{ id: "message-a", role: "virtualGuide", body: "A saved reply <script>not markup</script>", createdAt: "2026-10-29T07:00:00Z" }] });
    const html = renderToStaticMarkup(createElement(ExplorerEndedConversationReadback, { state: current }));
    expect(html).toContain("Saved directions taken");
    expect(html).toContain("Actual saved ending &lt;script&gt;plain text&lt;/script&gt;.");
    expect(html).toContain("2026-10-29T07:04:00.123456+00:00");
    expect(html).toContain("A saved reply &lt;script&gt;not markup&lt;/script&gt;");
    expect(html).toContain("SolMind Virtual Guide");
    for (const tag of ["<form", "<button", "<input", "<select", "<textarea", "<script>"]) expect(html).not.toContain(tag);
    expect(html).not.toContain("No saved ending summary is available.");
  });
  it("keeps a legacy ending summary unavailable and zero-point Discovery honest", () => {
    const html = renderToStaticMarkup(createElement(ExplorerEndedConversationReadback, { state: ended({ ending: null }) }));
    expect(html).toContain("No saved ending summary is available.");
    expect(html).toContain("There are no saved messages in this conversation.");
    expect(html).toContain("No Priority confirmed");
    expect(html).toContain("No recorded direction changes are available yet.");
    expect(html).not.toContain("Saved directions taken");
    expect(html).not.toContain("Nothing happened");
  });
  it("does not present active or absent status as a saved ended conversation", () => {
    for (const sessionStatus of ["active", undefined] as const) {
      const html = renderToStaticMarkup(createElement(ExplorerEndedConversationReadback, { state: ended({ sessionStatus, ending: null }) }));
      expect(html).toContain("This ended conversation is not available for review.");
      expect(html).not.toContain("Saved directions taken");
      expect(html).not.toContain("Session Compass");
    }
  });
});
