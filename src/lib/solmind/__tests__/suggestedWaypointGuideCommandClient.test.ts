import { describe, expect, it, vi } from "vitest";

import {
  SUGGESTED_WAYPOINT_GUIDE_SAVE_DRAFT_OUTCOMES,
  SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_SEND_OUTCOMES,
  createSuggestedWaypointGuidePullBackCommand,
  createSuggestedWaypointGuideSaveDraftCommand,
  createSuggestedWaypointGuideScheduleSendCommand,
  submitSuggestedWaypointGuideCommand,
  submitSuggestedWaypointGuidePullBackCommand,
} from "../suggestedWaypointGuideCommandClient";

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";
const OPERATION_ID = "88888888-8888-4888-8888-888888888888";

const createCommand = () =>
  createSuggestedWaypointGuidePullBackCommand({
    expectedPendingVersionId: VERSION_ID,
    expectedRevision: 3,
    operationId: OPERATION_ID,
    relationshipId: RELATIONSHIP_ID,
    suggestedWaypointId: SUGGESTION_ID,
  });

describe("Guide Pull Back command client", () => {
  it("creates one exact immutable request snapshot without URL selectors", () => {
    const command = createCommand();
    expect(command).not.toBeNull();
    expect(command).toEqual({
      kind: "guide.pull_back",
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      snapshot: JSON.stringify({
        kind: "guide.pull_back",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 3,
        expectedPendingVersionId: VERSION_ID,
      }),
      suggestedWaypointId: SUGGESTION_ID,
      url: `/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands`,
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(command?.url).not.toContain(SUGGESTION_ID);
    expect(command?.url).not.toContain(VERSION_ID);
  });

  it.each([
    { operationId: "not-a-v4" },
    { relationshipId: "not-a-relationship" },
    { suggestedWaypointId: "not-a-suggestion" },
    { expectedPendingVersionId: "not-a-version" },
    { expectedRevision: 0 },
  ])("rejects invalid command input $operationId", (override) => {
    expect(
      createSuggestedWaypointGuidePullBackCommand({
        expectedPendingVersionId: VERSION_ID,
        expectedRevision: 3,
        operationId: OPERATION_ID,
        relationshipId: RELATIONSHIP_ID,
        suggestedWaypointId: SUGGESTION_ID,
        ...override,
      }),
    ).toBeNull();
  });

  it("submits the exact retained bytes and parses a permitted result", async () => {
    const command = createCommand();
    expect(command).not.toBeNull();
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        outcome: "applied",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      }),
    });

    const result = await submitSuggestedWaypointGuidePullBackCommand(
      command!,
      new AbortController().signal,
      fetcher,
    );

    expect(result).toEqual({
      kind: "conclusive",
      result: {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      body: command?.snapshot,
      method: "POST",
      credentials: "same-origin",
    });
  });

  it.each([
    { ok: false, json: async () => ({}) },
    { ok: true, json: async () => ({ widened: true }) },
    {
      ok: true,
      json: async () => ({
        ok: true,
        outcome: "applied",
        suggestedWaypointId: "99999999-9999-4999-8999-999999999999",
        error: null,
      }),
    },
  ])("classifies non-confirming responses as transport uncertain", async (response) => {
    const result = await submitSuggestedWaypointGuidePullBackCommand(
      createCommand()!,
      new AbortController().signal,
      vi.fn().mockResolvedValue(response),
    );
    expect(result).toEqual({ kind: "transport_uncertain", result: null });
  });

  it("classifies a rejected fetch as transport uncertain", async () => {
    const result = await submitSuggestedWaypointGuidePullBackCommand(
      createCommand()!,
      new AbortController().signal,
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    expect(result).toEqual({ kind: "transport_uncertain", result: null });
  });
});

describe("Guide draft save and schedule command client", () => {
  const content = {
    destination: "Protect one evening each week for recovery",
    why: "A protected evening may make the week feel more sustainable.",
    arrivalSignals: ["One evening stays unscheduled."],
  };

  it("creates exact immutable save bytes and a detached content snapshot", () => {
    const input = { ...content, arrivalSignals: [...content.arrivalSignals] };
    const command = createSuggestedWaypointGuideSaveDraftCommand({
      ...input,
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    });
    expect(command).toEqual({
      kind: "guide.save_draft",
      content,
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
      snapshot: JSON.stringify({
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 3,
        ...content,
      }),
      url: `/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands`,
    });
    expect(command && Object.isFrozen(command)).toBe(true);
    expect(command && Object.isFrozen(command.content)).toBe(true);
    input.arrivalSignals[0] = "Changed later";
    expect(command?.content.arrivalSignals).toEqual(content.arrivalSignals);
  });

  it("creates exact immutable schedule bytes without policy or version authority", () => {
    const command = createSuggestedWaypointGuideScheduleSendCommand({
      expectedRevision: 4,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    });
    expect(command).toEqual({
      kind: "guide.schedule_send",
      expectedRevision: 4,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
      snapshot: JSON.stringify({
        kind: "guide.schedule_send",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 4,
      }),
      url: `/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands`,
    });
    expect(command?.snapshot).not.toContain("policy");
    expect(command?.snapshot).not.toContain("versionId");
  });

  it.each([
    { destination: "line one\nline two" },
    { why: "bad\u2028separator" },
    { arrivalSignals: ["Duplicate", "Duplicate"] },
    { expectedRevision: 0 },
    { operationId: "not-a-v4" },
    { relationshipId: "not-a-relationship" },
    { suggestedWaypointId: "not-a-suggestion" },
  ])("rejects invalid save input without coercion", (override) => {
    expect(createSuggestedWaypointGuideSaveDraftCommand({
      ...content,
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
      ...override,
    })).toBeNull();
  });

  it("uses action-bound outcome allowlists and retains exact request bytes", async () => {
    const save = createSuggestedWaypointGuideSaveDraftCommand({
      ...content,
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    })!;
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: false,
        outcome: "policy_unavailable",
        suggestedWaypointId: null,
        error: null,
      }),
    });
    expect(await submitSuggestedWaypointGuideCommand(
      save,
      SUGGESTED_WAYPOINT_GUIDE_SAVE_DRAFT_OUTCOMES,
      new AbortController().signal,
      fetcher,
    )).toEqual({ kind: "transport_uncertain", result: null });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: save.snapshot });

    const schedule = createSuggestedWaypointGuideScheduleSendCommand({
      expectedRevision: 3,
      operationId: OPERATION_ID,
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    })!;
    expect(await submitSuggestedWaypointGuideCommand(
      schedule,
      SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_SEND_OUTCOMES,
      new AbortController().signal,
      fetcher,
    )).toEqual({
      kind: "conclusive",
      result: { ok: false, outcome: "policy_unavailable", suggestedWaypointId: null, error: null },
    });
  });
});
