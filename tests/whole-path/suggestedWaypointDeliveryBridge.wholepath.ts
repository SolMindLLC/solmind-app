import { describe, expect, it } from "vitest";

import { invokeSuggestedWaypointDelivery } from "@/lib/solmind/supabase/suggestedWaypointDeliveryWorker";
import { readSuggestedWaypointWholePathSafetyConfig } from "./suggestedWaypointWholePathSafety";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requiredUuid(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new Error("whole_path_delivery_bridge_input_refused");
  }
  return value;
}

describe("local-only Suggested Waypoint delivery bridge", () => {
  it("invokes one exact job and its exact idempotent replay", async () => {
    if (readSuggestedWaypointWholePathSafetyConfig(process.env) === null) {
      throw new Error("whole_path_delivery_bridge_safety_refused");
    }

    const job = Object.freeze({
      operationId: requiredUuid("SOLMIND_WHOLE_PATH_DELIVERY_OPERATION_ID"),
      suggestedWaypointId: requiredUuid("SOLMIND_WHOLE_PATH_DELIVERY_SUGGESTION_ID"),
      expectedPendingVersionId: requiredUuid(
        "SOLMIND_WHOLE_PATH_DELIVERY_PENDING_VERSION_ID",
      ),
    });

    expect(await invokeSuggestedWaypointDelivery(job)).toBe("delivered");
    expect(await invokeSuggestedWaypointDelivery(job)).toBe("delivered");
  });
});
