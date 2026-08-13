import { describe, expect, it } from "vitest";

import {
  acknowledgeSuggestedWaypoint,
  createSuggestedWaypointDraft,
  deliverPendingSuggestedWaypoint,
  markSuggestedWaypointRead,
  projectSuggestedWaypointForAdmin,
  projectSuggestedWaypointForExplorer,
  projectSuggestedWaypointForGuide,
  pullBackSuggestedWaypoint,
  resolveSuggestedWaypointTiming,
  savePrivateSuggestedWaypointDraft,
  scheduleSuggestedWaypointSend,
  sendExactSuggestedWaypointResponse,
  withdrawSuggestedWaypoint,
  type SuggestedWaypointResult,
  type SuggestedWaypointState,
} from "../suggestedWaypoints";

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);

const createDraft = () =>
  createSuggestedWaypointDraft({
    suggestionId: "suggestion-1",
    guideUserId: "guide-morgan",
    explorerUserId: "explorer-avery",
    relationshipId: "relationship-1",
    content: {
      destination: "Protect one evening each week for recovery",
      why: "Create dependable space to recover.",
      arrivalSignals: ["One evening stays unscheduled."],
    },
  });

const expectState = (result: SuggestedWaypointResult): SuggestedWaypointState => {
  expect(result.kind).not.toBe("rejected");
  return result.state;
};

const schedule = (
  state = createDraft(),
  operationId = "schedule-1",
  versionId = "version-1",
) =>
  scheduleSuggestedWaypointSend(state, {
    operationId,
    versionId,
    expectedRevision: state.authoring.revision,
    nowMs: NOW,
    policyVersion: "policy-v1",
    timing: {
      minimumSeconds: 60,
      defaultSeconds: 300,
      maximumSeconds: 3600,
    },
  });

const deliver = (state = expectState(schedule())) =>
  deliverPendingSuggestedWaypoint(state, {
    operationId: "delivery-1",
    nowMs: NOW + 300_000,
  });

describe("Suggested Waypoint timing", () => {
  it("SW-RT-TIME-001 enforces the protected minimum", () => {
    expect(
      resolveSuggestedWaypointTiming({
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
        guidePreferenceSeconds: 30,
      }),
    ).toBe(60);
  });

  it("SW-RT-TIME-002 uses the Guide preference independently", () => {
    expect(
      resolveSuggestedWaypointTiming({
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
        guidePreferenceSeconds: 900,
      }),
    ).toBe(900);
  });

  it("SW-RT-TIME-007 rejects a preference above the Pilot 1 maximum", () => {
    expect(() =>
      resolveSuggestedWaypointTiming({
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
        guidePreferenceSeconds: 3601,
      }),
    ).toThrow("Invalid Suggested Waypoint Guide timing preference");
  });
});

describe("Guide-only pending send and Pull Back", () => {
  it("SW-RT-AGG-001 creates no shared record before first delivery", () => {
    const pending = expectState(schedule());

    expect(pending.authoring.mode).toBe("pending");
    expect(pending.channel).toBeNull();
    expect(projectSuggestedWaypointForExplorer(pending)).toBeNull();
  });

  it("SW-RT-TIME-008 allows Pull Back only before the deadline", () => {
    const pending = expectState(schedule());
    const pulled = pullBackSuggestedWaypoint(pending, NOW + 299_999);

    expect(pulled.kind).toBe("applied");
    expect(pulled.state.authoring.mode).toBe("draft");
    expect(pulled.state.channel).toBeNull();

    const tooLate = pullBackSuggestedWaypoint(pending, NOW + 300_000);
    expect(tooLate.kind).toBe("rejected");
    if (tooLate.kind === "rejected") expect(tooLate.code).toBe("too-late");
  });

  it("SW-RT-CMD-006 prevents a second save/send while pending", () => {
    const pending = expectState(schedule());
    const duplicateSchedule = scheduleSuggestedWaypointSend(pending, {
      operationId: "schedule-2",
      versionId: "version-2",
      expectedRevision: pending.authoring.revision,
      nowMs: NOW,
      policyVersion: "policy-v1",
      timing: {
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
      },
    });

    expect(duplicateSchedule.kind).toBe("rejected");
    if (duplicateSchedule.kind === "rejected") {
      expect(duplicateSchedule.code).toBe("invalid-transition");
    }
  });

  it("SW-RT-CON-006 returns the same pending result for an exact schedule replay", () => {
    const pending = expectState(schedule());
    const replay = scheduleSuggestedWaypointSend(pending, {
      operationId: "schedule-1",
      versionId: "version-1",
      expectedRevision: 1,
      nowMs: NOW + 30_000,
      policyVersion: "policy-v1",
      timing: {
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
      },
    });

    expect(replay.kind).toBe("idempotent");
    expect(replay.state).toEqual(pending);
  });
});

describe("delivery, versioning, and replay", () => {
  it("SW-RT-CON-003 delivers one immutable first version", () => {
    const delivered = expectState(deliver());

    expect(delivered.channel?.versions).toHaveLength(1);
    expect(delivered.channel?.currentVersionId).toBe("version-1");
    expect(delivered.channel?.versions[0]?.predecessorVersionId).toBeNull();
  });

  it("SW-RT-TIME-008 blocks ordinary worker delivery before deadline", () => {
    const pending = expectState(schedule());
    const early = deliverPendingSuggestedWaypoint(pending, {
      operationId: "delivery-early",
      nowMs: NOW + 299_999,
    });

    expect(early.kind).toBe("rejected");
    if (early.kind === "rejected") expect(early.code).toBe("too-late");
  });

  it("SW-RT-CON-008 allows deliberate expedite without a second version", () => {
    const pending = expectState(schedule());
    const expedited = deliverPendingSuggestedWaypoint(pending, {
      operationId: "delivery-expedite",
      nowMs: NOW + 1_000,
      expedite: true,
    });

    expect(expedited.kind).toBe("applied");
    expect(expedited.state.channel?.versions).toHaveLength(1);
  });

  it("SW-RT-CON-009 rejects operation-id reuse with a changed payload", () => {
    const first = expectState(schedule());
    const pulled = expectState(pullBackSuggestedWaypoint(first, NOW + 1_000));
    const changed = scheduleSuggestedWaypointSend(pulled, {
      operationId: "schedule-1",
      versionId: "changed-version",
      expectedRevision: pulled.authoring.revision,
      nowMs: NOW + 2_000,
      policyVersion: "policy-v1",
      timing: {
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
      },
    });

    expect(changed.kind).toBe("rejected");
    if (changed.kind === "rejected") {
      expect(changed.code).toBe("operation-payload-mismatch");
    }
  });

  it("SW-RT-CON-006 replays delivery but rejects changed expedite semantics", () => {
    const delivered = expectState(deliver());
    const replay = deliverPendingSuggestedWaypoint(delivered, {
      operationId: "delivery-1",
      nowMs: NOW + 310_000,
    });
    const mismatch = deliverPendingSuggestedWaypoint(delivered, {
      operationId: "delivery-1",
      nowMs: NOW + 310_000,
      expedite: true,
    });

    expect(replay.kind).toBe("idempotent");
    expect(mismatch.kind).toBe("rejected");
    if (mismatch.kind === "rejected") {
      expect(mismatch.code).toBe("operation-payload-mismatch");
    }
  });

  it("SW-RT-AGG-001 deeply freezes delivered content and shared effects", () => {
    const delivered = expectState(deliver());
    const acknowledged = expectState(
      acknowledgeSuggestedWaypoint(delivered, {
        versionId: "version-1",
        nowMs: NOW + 310_000,
      }),
    );
    const responded = expectState(
      sendExactSuggestedWaypointResponse(acknowledged, {
        versionId: "version-1",
        nowMs: NOW + 320_000,
        exactText: "Exact outward response",
      }),
    );

    expect(Object.isFrozen(responded.channel?.versions[0]?.content)).toBe(true);
    expect(
      Object.isFrozen(responded.channel?.versions[0]?.content.arrivalSignals),
    ).toBe(true);
    expect(Object.isFrozen(responded.channel?.receipts[0])).toBe(true);
    expect(Object.isFrozen(responded.channel?.responses[0])).toBe(true);
  });
});

describe("Explorer-private engagement and shared outward actions", () => {
  it("SW-RT-CON-004 binds one receipt to the current exact version", () => {
    const delivered = expectState(deliver());
    const acknowledged = acknowledgeSuggestedWaypoint(delivered, {
      versionId: "version-1",
      nowMs: NOW + 310_000,
    });
    const retry = acknowledgeSuggestedWaypoint(acknowledged.state, {
      versionId: "version-1",
      nowMs: NOW + 320_000,
    });

    expect(acknowledged.kind).toBe("applied");
    expect(retry.kind).toBe("idempotent");
    expect(retry.state.channel?.receipts).toHaveLength(1);
  });

  it("SW-RT-CMD-005 copies only the exact reviewed response outward", () => {
    const delivered = expectState(deliver());
    const drafted = expectState(
      savePrivateSuggestedWaypointDraft(
        delivered,
        "version-1",
        "Could we discuss how to protect that time?",
      ),
    );
    const sent = sendExactSuggestedWaypointResponse(drafted, {
      versionId: "version-1",
      nowMs: NOW + 320_000,
      exactText: "I would like your input on protecting this time.",
    });

    expect(sent.state.channel?.responses[0]?.exactText).toBe(
      "I would like your input on protecting this time.",
    );
    expect(sent.state.explorer.privateDraftsByVersion["version-1"]).toBe(
      "Could we discuss how to protect that time?",
    );
  });

  it("SW-RT-CMD-008 preserves private work but rejects outward actions after withdrawal", () => {
    const delivered = expectState(deliver());
    const drafted = expectState(
      savePrivateSuggestedWaypointDraft(delivered, "version-1", "Private text"),
    );
    const withdrawn = expectState(withdrawSuggestedWaypoint(drafted, NOW + 320_000));

    const receipt = acknowledgeSuggestedWaypoint(withdrawn, {
      versionId: "version-1",
      nowMs: NOW + 330_000,
    });
    const response = sendExactSuggestedWaypointResponse(withdrawn, {
      versionId: "version-1",
      nowMs: NOW + 330_000,
      exactText: "Do not send",
    });

    expect(receipt.kind).toBe("rejected");
    expect(response.kind).toBe("rejected");
    expect(withdrawn.explorer.privateDraftsByVersion["version-1"]).toBe(
      "Private text",
    );
  });
});

describe("role projections", () => {
  it("SW-RT-PRJ-001 keeps Explorer read state out of the Guide projection", () => {
    const delivered = expectState(deliver());
    const read = expectState(markSuggestedWaypointRead(delivered, "version-1"));
    const guideJson = JSON.stringify(
      projectSuggestedWaypointForGuide(read, NOW + 320_000),
    );

    expect(guideJson).not.toContain("readVersionIds");
    expect(guideJson).not.toContain('"read"');
    expect(guideJson).not.toContain("privateDraft");
    expect(guideJson).not.toContain("usedInWaypoint");
  });

  it("SW-RT-PRJ-002 keeps pending and Pull Back state out of Explorer output", () => {
    const pending = expectState(schedule());
    expect(projectSuggestedWaypointForExplorer(pending)).toBeNull();

    const delivered = expectState(deliver(pending));
    const explorerJson = JSON.stringify(
      projectSuggestedWaypointForExplorer(delivered),
    );
    expect(explorerJson).not.toContain("pendingDeadline");
    expect(explorerJson).not.toContain("pullBack");
    expect(explorerJson).not.toContain("policyVersion");
  });

  it("SW-RT-PRJ-003 keeps all content and behavioral signals out of Admin output", () => {
    const delivered = expectState(deliver());
    const read = expectState(markSuggestedWaypointRead(delivered, "version-1"));
    const adminJson = JSON.stringify(projectSuggestedWaypointForAdmin(read));

    for (const forbidden of [
      "Protect one evening",
      "Create dependable",
      "readVersionIds",
      "privateDraft",
      "receipt",
      "response",
      "usedInWaypoint",
    ]) {
      expect(adminJson).not.toContain(forbidden);
    }
  });

  it("SW-RT-PRJ-007 makes expedited and scheduled Explorer output indistinguishable", () => {
    const pending = expectState(schedule());
    const ordinary = expectState(
      deliverPendingSuggestedWaypoint(pending, {
        operationId: "ordinary",
        nowMs: NOW + 300_000,
      }),
    );
    const expedited = expectState(
      deliverPendingSuggestedWaypoint(pending, {
        operationId: "expedited",
        nowMs: NOW + 1_000,
        expedite: true,
      }),
    );

    expect(projectSuggestedWaypointForExplorer(expedited)).toEqual({
      ...projectSuggestedWaypointForExplorer(ordinary),
      currentVersion: {
        ...projectSuggestedWaypointForExplorer(ordinary)?.currentVersion,
        deliveredAtMs: NOW + 1_000,
      },
    });
  });
});
