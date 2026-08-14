import { describe, expect, it, vi } from "vitest";

import * as supabaseBarrel from "../index";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION,
  validateSuggestedWaypointRelationshipSelectorPayload,
  validateSuggestedWaypointRelationshipSelectorRpcCall,
} from "../suggestedWaypointRelationshipSelectorContract";
import {
  SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
  createSuggestedWaypointRelationshipSelectorExecutor,
} from "../suggestedWaypointRelationshipSelectorExecutor";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const RELATIONSHIP_ID = "22222222-2222-4222-8222-222222222222";
const TIMESTAMP = "2026-08-14T17:00:00.000Z";

const CALL = Object.freeze({
  functionName: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION,
  args: Object.freeze({
    p_actor_user_account_id: ACTOR_ID,
    p_page_size: 10 as const,
    p_cursor: null,
  }),
});

const DATA = Object.freeze([
  Object.freeze({
    items: Object.freeze([
      Object.freeze({
        guide_explorer_relationship_id: RELATIONSHIP_ID,
        explorer_display_name: "Avery",
        relationship_created_at: TIMESTAMP,
      }),
    ]),
    next_cursor: null,
    total_count: 1,
  }),
]);

describe("Suggested Waypoint relationship-selector contract", () => {
  it("accepts only the exact function and input shape", () => {
    expect(validateSuggestedWaypointRelationshipSelectorRpcCall(CALL)).toEqual(CALL);
    expect(
      validateSuggestedWaypointRelationshipSelectorRpcCall({
        ...CALL,
        args: { ...CALL.args, p_page_size: 25 },
      }),
    ).toBeNull();
    expect(
      validateSuggestedWaypointRelationshipSelectorRpcCall({
        ...CALL,
        args: { ...CALL.args, p_guide_profile_id: ACTOR_ID },
      }),
    ).toBeNull();
    expect(
      validateSuggestedWaypointRelationshipSelectorRpcCall({
        ...CALL,
        functionName: "solmind_list_guide_explorers",
      }),
    ).toBeNull();
  });

  it("deep-freezes an exact bounded page", () => {
    const page = validateSuggestedWaypointRelationshipSelectorPayload(DATA);
    expect(page).not.toBeNull();
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page?.items)).toBe(true);
    expect(Object.isFrozen(page?.items[0])).toBe(true);
  });

  it.each([
    "",
    "  Avery",
    "Ave\r\nry",
    "A\u0001very",
    "Ame\u0301lie",
    "A".repeat(161),
  ])("rejects unsafe Explorer display name %j", (explorerDisplayName) => {
    expect(
      validateSuggestedWaypointRelationshipSelectorPayload([
        {
          ...DATA[0],
          items: [
            {
              ...DATA[0].items[0],
              explorer_display_name: explorerDisplayName,
            },
          ],
        },
      ]),
    ).toBeNull();
  });

  it("rejects duplicate relationships and projection expansion", () => {
    expect(
      validateSuggestedWaypointRelationshipSelectorPayload([
        { ...DATA[0], items: [DATA[0].items[0], DATA[0].items[0]], total_count: 2 },
      ]),
    ).toBeNull();
    expect(
      validateSuggestedWaypointRelationshipSelectorPayload([
        {
          ...DATA[0],
          items: [{ ...DATA[0].items[0], practice_id: ACTOR_ID }],
        },
      ]),
    ).toBeNull();
  });

  it("rejects non-RFC3339 timestamp strings even when Date can parse them", () => {
    expect(
      validateSuggestedWaypointRelationshipSelectorPayload([
        {
          ...DATA[0],
          items: [
            {
              ...DATA[0].items[0],
              relationship_created_at: "Thu, 14 Aug 2026 17:00:00 GMT",
            },
          ],
        },
      ]),
    ).toBeNull();
  });

  it("keeps every selector owner off the shared Supabase barrel", () => {
    expect(
      "createSuggestedWaypointRelationshipSelectorExecutor" in supabaseBarrel,
    ).toBe(false);
    expect(
      "resolveSuggestedWaypointRelationshipSelectorRequest" in supabaseBarrel,
    ).toBe(false);
    expect(
      "SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_FUNCTION" in supabaseBarrel,
    ).toBe(false);
  });
});

describe("createSuggestedWaypointRelationshipSelectorExecutor", () => {
  it("dispatches the one closed function and returns the validated page", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: DATA, error: null });
    const executor = createSuggestedWaypointRelationshipSelectorExecutor({
      rpc,
    } as never);

    const result = await executor.execute(CALL);

    expect(rpc).toHaveBeenCalledWith(CALL.functionName, CALL.args);
    expect(result).toEqual({ data: DATA[0], error: null });
  });

  it.each([
    { data: null, error: { message: "secret" } },
    { data: [], error: null },
    { data: [{ ...DATA[0], internal: true }], error: null },
  ])("fails closed for transport or payload failure", async (transportResult) => {
    const rpc = vi.fn().mockResolvedValue(transportResult);
    const executor = createSuggestedWaypointRelationshipSelectorExecutor({ rpc } as never);

    await expect(executor.execute(CALL)).resolves.toEqual({
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
    });
  });

  it("does not dispatch malformed calls and collapses thrown details", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("environment detail"));
    const executor = createSuggestedWaypointRelationshipSelectorExecutor({ rpc } as never);

    await expect(executor.execute({ ...CALL, extra: true })).resolves.toEqual({
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
    });
    expect(rpc).not.toHaveBeenCalled();

    await expect(executor.execute(CALL)).resolves.toEqual({
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
    });
  });

  it("fails closed on hostile call objects before transport", async () => {
    const rpc = vi.fn();
    const executor = createSuggestedWaypointRelationshipSelectorExecutor({ rpc } as never);
    const hostileCall = new Proxy(CALL, {
      ownKeys: () => {
        throw new Error("hostile proxy");
      },
    });

    await expect(executor.execute(hostileCall)).resolves.toEqual({
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a page wider than the exact requested page size", async () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      ...DATA[0].items[0],
      guide_explorer_relationship_id: `22222222-2222-4222-8222-22222222222${index}`,
      explorer_display_name: `Explorer ${index}`,
    }));
    const rpc = vi.fn().mockResolvedValue({
      data: [{ items, next_cursor: null, total_count: 6 }],
      error: null,
    });
    const executor = createSuggestedWaypointRelationshipSelectorExecutor({ rpc } as never);

    await expect(
      executor.execute({
        ...CALL,
        args: { ...CALL.args, p_page_size: 5 },
      }),
    ).resolves.toEqual({
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_RPC_FAILED,
    });
  });
});
