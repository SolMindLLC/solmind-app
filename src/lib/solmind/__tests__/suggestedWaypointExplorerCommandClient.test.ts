import { describe, expect, it, vi } from "vitest";

import {
  createSuggestedWaypointExplorerAcknowledgeCommand,
  createSuggestedWaypointExplorerMarkReadCommand,
  submitSuggestedWaypointExplorerCommand,
} from "../suggestedWaypointExplorerCommandClient";

const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";
const OPERATION_ID = "88888888-8888-4888-8888-888888888888";

const input = () => ({
  operationId: OPERATION_ID,
  suggestedWaypointId: SUGGESTION_ID,
  versionId: VERSION_ID,
});

describe("Explorer Suggested Waypoint command client", () => {
  it("creates exact immutable action-specific request snapshots", () => {
    const markRead = createSuggestedWaypointExplorerMarkReadCommand(input());
    const acknowledge = createSuggestedWaypointExplorerAcknowledgeCommand(input());

    expect(markRead).toEqual({
      kind: "explorer.mark_read",
      operationId: OPERATION_ID,
      snapshot: JSON.stringify({
        kind: "explorer.mark_read",
        operationId: OPERATION_ID,
        versionId: VERSION_ID,
      }),
      suggestedWaypointId: SUGGESTION_ID,
      url: `/explorer/waypoints/${SUGGESTION_ID}/commands`,
      versionId: VERSION_ID,
    });
    expect(acknowledge).toEqual({
      kind: "explorer.acknowledge",
      operationId: OPERATION_ID,
      snapshot: JSON.stringify({
        kind: "explorer.acknowledge",
        operationId: OPERATION_ID,
        expectedCurrentVersionId: VERSION_ID,
      }),
      suggestedWaypointId: SUGGESTION_ID,
      url: `/explorer/waypoints/${SUGGESTION_ID}/commands`,
      versionId: VERSION_ID,
    });
    expect(Object.isFrozen(markRead)).toBe(true);
    expect(Object.isFrozen(acknowledge)).toBe(true);
  });

  it.each([
    null,
    [],
    { ...input(), operationId: "not-a-v4" },
    { ...input(), suggestedWaypointId: "not-a-suggestion" },
    { ...input(), versionId: "not-a-version" },
    { ...input(), actorId: OPERATION_ID },
    Object.assign(Object.create({ inherited: true }), input()),
  ])("rejects widened or invalid command input", (value) => {
    expect(createSuggestedWaypointExplorerMarkReadCommand(value)).toBeNull();
    expect(createSuggestedWaypointExplorerAcknowledgeCommand(value)).toBeNull();
  });

  it("rejects accessors, symbols, and hostile reflection without reading values", () => {
    let getterCalls = 0;
    const accessor = {
      get operationId() {
        getterCalls += 1;
        return OPERATION_ID;
      },
      suggestedWaypointId: SUGGESTION_ID,
      versionId: VERSION_ID,
    };
    const symbolic = { ...input(), [Symbol("authority")]: true };
    const hostile = new Proxy(input(), {
      ownKeys() {
        throw new Error("hostile");
      },
    });

    expect(createSuggestedWaypointExplorerMarkReadCommand(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    expect(createSuggestedWaypointExplorerMarkReadCommand(symbolic)).toBeNull();
    expect(createSuggestedWaypointExplorerMarkReadCommand(hostile)).toBeNull();
  });

  it("submits exact retained bytes and headers", async () => {
    const command = createSuggestedWaypointExplorerMarkReadCommand(input())!;
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        outcome: "applied",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      }),
    });

    const result = await submitSuggestedWaypointExplorerCommand(
      command,
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
    expect(fetcher.mock.calls[0]).toEqual([
      command.url,
      expect.objectContaining({
        body: command.snapshot,
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        method: "POST",
      }),
    ]);
  });

  it("keeps action-specific expected-outcome allowlists closed", async () => {
    const stale = {
      ok: false,
      outcome: "stale",
      suggestedWaypointId: null,
      error: null,
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => stale,
    });

    await expect(
      submitSuggestedWaypointExplorerCommand(
        createSuggestedWaypointExplorerMarkReadCommand(input())!,
        new AbortController().signal,
        fetcher,
      ),
    ).resolves.toEqual({
      kind: "conclusive",
      result: {
        ok: false,
        outcome: null,
        suggestedWaypointId: null,
        error: "command_failed",
      },
    });
    await expect(
      submitSuggestedWaypointExplorerCommand(
        createSuggestedWaypointExplorerAcknowledgeCommand(input())!,
        new AbortController().signal,
        fetcher,
      ),
    ).resolves.toEqual({ kind: "conclusive", result: stale });
  });

  it.each([
    {},
    {
      ok: true,
      outcome: "applied",
      suggestedWaypointId: "99999999-9999-4999-8999-999999999999",
      error: null,
    },
    {
      ok: false,
      outcome: "too_late",
      suggestedWaypointId: null,
      error: null,
    },
  ])("maps malformed, wrong-target, or wrong-action responses to fixed failure", async (payload) => {
    const result = await submitSuggestedWaypointExplorerCommand(
      createSuggestedWaypointExplorerMarkReadCommand(input())!,
      new AbortController().signal,
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );
    expect(result).toEqual({
      kind: "conclusive",
      result: {
        ok: false,
        outcome: null,
        suggestedWaypointId: null,
        error: "command_failed",
      },
    });
  });

  it.each([
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    vi.fn().mockRejectedValue(new Error("offline")),
  ])("classifies transport uncertainty without changing the command", async (fetcher) => {
    const command = createSuggestedWaypointExplorerAcknowledgeCommand(input())!;
    await expect(
      submitSuggestedWaypointExplorerCommand(
        command,
        new AbortController().signal,
        fetcher,
      ),
    ).resolves.toEqual({ kind: "transport_uncertain", result: null });
    expect(command.snapshot).toContain(OPERATION_ID);
  });

  it("maps an unreadable successful response to fixed failure", async () => {
    const result = await submitSuggestedWaypointExplorerCommand(
      createSuggestedWaypointExplorerMarkReadCommand(input())!,
      new AbortController().signal,
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("malformed json");
        },
      }),
    );
    expect(result).toMatchObject({
      kind: "conclusive",
      result: { error: "command_failed" },
    });
  });
});
