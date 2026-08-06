import { describe, expect, it } from "vitest";

import {
  buildDirectionsTakenSummary,
  buildExactSummaryReview,
  confirmInitialPriority,
  confirmWaypoint,
  createDefaultSummarySelection,
  createDiscoveryCompass,
  createEmptyStructuredFormAnswers,
  createNonLiveGuideProjection,
  createSharedSnapshot,
  createSummaryDraft,
  createWaypointProposal,
  groupCompassCandidates,
  moveCurrentAttention,
  proposePriorityChange,
  resolvePriorityChange,
  revealCompassPoints,
  setDetailIncluded,
  setMainPointIncluded,
  type CompassPointCandidate,
  type ExplorerStructuredFormAnswers,
} from "../explorerExperience";
import { SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS } from "../onboarding";

function createAnswers() {
  return {
    ...createEmptyStructuredFormAnswers(),
    supportNow: "Create more room to breathe",
    usefulOutcome: "Leave with one manageable next step",
    supportStyle: "Gentle reflection with some structure",
    guideContext: "Work has felt crowded lately",
  };
}

function createSummaryFixture() {
  const answers = createAnswers();
  const revealed = revealCompassPoints(createDiscoveryCompass(), answers);
  const oriented = confirmInitialPriority(revealed, "support-now");
  const directions = buildDirectionsTakenSummary(oriented);
  const waypoint = confirmWaypoint(createWaypointProposal(oriented));

  return {
    answers,
    draft: createSummaryDraft(answers, oriented, directions, waypoint),
  };
}

describe("PRJ01_R-WS09-WI021-S01 deterministic Explorer experience", () => {
  it("CMP-001 keeps the structured form data independent from First Compass state", () => {
    const answers = createAnswers();
    const compass = createDiscoveryCompass();

    expect(answers.supportNow).toBe("Create more room to breathe");
    expect(compass.mode).toBe("discovery");
    expect(compass.points).toEqual([]);
    expect(compass.priorityPointId).toBeNull();
  });

  it("CMP-002 starts and ends honestly in zero-point Discovery mode", () => {
    const compass = createDiscoveryCompass();
    const summary = buildDirectionsTakenSummary(compass);

    expect(compass.points).toHaveLength(0);
    expect(compass.priorityPointId).toBeNull();
    expect(summary.heading).toBe("Discovery was the direction");
    expect(summary.statements).toContain("No Priority was confirmed.");
    expect(summary.statements.join(" ")).toContain(
      "without inventing any topic points",
    );
  });

  it("CMP-003 and CMP-009 move attention without changing the fixed Priority", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const oriented = confirmInitialPriority(revealed, "support-now");
    const moved = moveCurrentAttention(oriented, "useful-outcome");

    expect(moved.priorityPointId).toBe("support-now");
    expect(moved.attentionPointId).toBe("useful-outcome");
    expect(moved.route.at(-1)?.description).toContain(
      "without changing Priority",
    );
  });

  it("CMP-004 changes Priority only after explicit Explorer confirmation", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const oriented = confirmInitialPriority(revealed, "support-now");
    const proposed = proposePriorityChange(oriented, "useful-outcome");

    expect(proposed.priorityPointId).toBe("support-now");
    expect(proposed.pendingPriorityPointId).toBe("useful-outcome");

    const declined = resolvePriorityChange(proposed, false);
    expect(declined.priorityPointId).toBe("support-now");
    expect(declined.pendingPriorityPointId).toBeNull();

    const reproposed = proposePriorityChange(declined, "useful-outcome");
    const confirmed = resolvePriorityChange(reproposed, true);
    expect(confirmed.priorityPointId).toBe("useful-outcome");
    expect(confirmed.attentionPointId).toBe("useful-outcome");
    expect(confirmed.route.at(-1)?.description).toContain(
      "Explorer confirmed",
    );
  });

  it("CMP-005 and CMP-006 keep eight visible points and preserve overflow", () => {
    const candidates: CompassPointCandidate[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: `path-${index + 1}`,
        categoryKey: `category-${index + 1}`,
        label: `Path ${index + 1}`,
        detail: `Detail ${index + 1}`,
        zone:
          index < 3 ? "priority" : index < 6 ? "detour" : "excursion",
        emphasis: index < 3 ? 3 : index < 6 ? 2 : 1,
      }),
    );

    const grouped = groupCompassCandidates(candidates);

    expect(grouped.visible).toHaveLength(8);
    expect(grouped.otherPaths).toHaveLength(2);
    expect([
      ...grouped.visible.map((point) => point.label),
      ...grouped.otherPaths.map((point) => point.label),
    ]).toHaveLength(10);
    expect(new Set(grouped.visible.map((point) => point.zone))).toEqual(
      new Set(["priority", "detour", "excursion"]),
    );
  });

  it("CMP-007 broadens matching categories without discarding provenance", () => {
    const grouped = groupCompassCandidates([
      {
        id: "pace-1",
        categoryKey: "sustainable-pace",
        label: "Work pace",
        detail: "Fewer rushed transitions",
        zone: "detour",
        emphasis: 2,
      },
      {
        id: "pace-2",
        categoryKey: "sustainable-pace",
        label: "Rest rhythm",
        detail: "Protect recovery time",
        zone: "detour",
        emphasis: 3,
      },
    ]);

    expect(grouped.visible).toHaveLength(1);
    expect(grouped.visible[0]?.details).toEqual([
      "Fewer rushed transitions",
      "Protect recovery time",
    ]);
    expect(grouped.visible[0]?.sourceLabels).toEqual([
      "Work pace",
      "Rest rhythm",
    ]);
    expect(grouped.visible[0]?.emphasis).toBe(3);
  });

  it("CMP-010 preserves meaningful Route movement in the ending summary", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const oriented = confirmInitialPriority(revealed, "support-now");
    const moved = moveCurrentAttention(oriented, "useful-outcome");
    const summary = buildDirectionsTakenSummary(moved);

    expect(summary.heading).toBe("Directions taken");
    expect(summary.statements.join(" ")).toContain(
      "Create more room to breathe",
    );
    expect(summary.statements.join(" ")).toContain(
      "Leave with one manageable next step",
    );
    expect(moved.route.length).toBeGreaterThan(2);
  });

  it("CMP-012 keeps a proposed Waypoint unconfirmed until the Explorer confirms it", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const proposal = createWaypointProposal(revealed);

    expect(proposal.confirmed).toBe(false);

    const confirmed = confirmWaypoint(proposal);
    expect(confirmed.confirmed).toBe(true);
    expect(proposal.confirmed).toBe(false);
  });

  it("SHARE-001 removes excluded detail bytes from the exact review and Guide projection", () => {
    const answers = createAnswers();
    const revealed = revealCompassPoints(createDiscoveryCompass(), answers);
    const oriented = confirmInitialPriority(revealed, "support-now");
    const directions = buildDirectionsTakenSummary(oriented);
    const waypoint = confirmWaypoint(createWaypointProposal(oriented));
    const draft = createSummaryDraft(
      answers,
      oriented,
      directions,
      waypoint,
    );
    const sentinelDetail = {
      id: "excluded-sentinel-detail",
      text: "EXCLUDED-SENTINEL-DETAIL-ONLY",
    };

    draft.mainPoints[0]?.details.push(sentinelDetail);

    const initialSelection = createDefaultSummarySelection(draft);
    const selection = setDetailIncluded(
      initialSelection,
      sentinelDetail.id,
      false,
    );
    const review = buildExactSummaryReview(draft, selection);
    const snapshot = createSharedSnapshot(review);
    const projection = createNonLiveGuideProjection(answers, snapshot);

    expect(JSON.stringify(review)).not.toContain(sentinelDetail.text);
    expect(JSON.stringify(snapshot)).not.toContain(sentinelDetail.text);
    expect(JSON.stringify(projection.sharedSnapshot)).not.toContain(
      sentinelDetail.text,
    );
  });

  it("SHARE-002 derives a fresh exact review from the current selection", () => {
    const answers = createAnswers();
    const compass = revealCompassPoints(createDiscoveryCompass(), answers);
    const directions = buildDirectionsTakenSummary(compass);
    const waypoint = createWaypointProposal(compass);
    const draft = createSummaryDraft(
      answers,
      compass,
      directions,
      waypoint,
    );
    const selected = createDefaultSummarySelection(draft);
    const firstReview = buildExactSummaryReview(draft, selected);
    const changed = setMainPointIncluded(
      draft,
      selected,
      "support-focus",
      false,
    );
    const freshReview = buildExactSummaryReview(draft, changed);

    expect(firstReview.mainPoints.some((point) => point.id === "support-focus")).toBe(
      true,
    );
    expect(freshReview.mainPoints.some((point) => point.id === "support-focus")).toBe(
      false,
    );
    expect(
      freshReview.mainPoints.flatMap((point) => point.details).some(
        (detail) => detail.id === "support-focus-answer",
      ),
    ).toBe(false);
  });

  it("SHARE-003 creates zero Guide-visible conversation artifact when not ready", () => {
    const projection = createNonLiveGuideProjection(createAnswers(), null);

    expect(projection.sharedSnapshot).toBeNull();
    expect(JSON.stringify(projection)).not.toContain("route-discovery-start");
    expect(JSON.stringify(projection)).not.toContain("private Waypoint");
  });

  it("SHARE-009 freezes the exact in-memory Shared Snapshot deeply", () => {
    const answers = createAnswers();
    const compass = revealCompassPoints(createDiscoveryCompass(), answers);
    const directions = buildDirectionsTakenSummary(compass);
    const waypoint = createWaypointProposal(compass);
    const draft = createSummaryDraft(
      answers,
      compass,
      directions,
      waypoint,
    );
    const review = buildExactSummaryReview(
      draft,
      createDefaultSummarySelection(draft),
    );
    const snapshot = createSharedSnapshot(review);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.mainPoints)).toBe(true);
    expect(Object.isFrozen(snapshot.mainPoints[0])).toBe(true);
    expect(Object.isFrozen(snapshot.mainPoints[0]?.details)).toBe(true);
    expect(Object.isFrozen(snapshot.mainPoints[0]?.details[0])).toBe(true);
    expect(snapshot.mainPoints).toEqual(review.mainPoints);
  });

  it("S01R1-PRIV-001 excludes waypoint-status by default", () => {
    const { draft } = createSummaryFixture();
    const selection = createDefaultSummarySelection(draft);

    expect(selection.waypoint).toBe(true);
    expect(selection["waypoint-status"]).toBe(false);
    expect(selection["support-focus"]).toBe(true);
    expect(selection["support-focus-answer"]).toBe(true);
  });

  it("S01R1-PRIV-002 excludes attention-ending by default", () => {
    const { draft } = createSummaryFixture();
    const selection = createDefaultSummarySelection(draft);

    expect(selection["attention-ending"]).toBe(false);
  });

  it("S01R1-PRIV-003 makes a future private child inherit the parent default", () => {
    const { draft } = createSummaryFixture();
    const waypoint = draft.mainPoints.find((point) => point.id === "waypoint");

    waypoint?.details.push({
      id: "future-waypoint-detail",
      text: "SM_PRIVATE_FUTURE_WAYPOINT_8Q4N6V",
    });

    const selection = createDefaultSummarySelection(draft);

    expect(selection["future-waypoint-detail"]).toBe(false);
  });

  it("S01R1-PRIV-004 deliberately includes only the selected private detail", () => {
    const { draft } = createSummaryFixture();
    const initial = createDefaultSummarySelection(draft);
    const selected = setDetailIncluded(initial, "waypoint-status", true);
    const review = buildExactSummaryReview(draft, selected);
    const waypoint = review.mainPoints.find((point) => point.id === "waypoint");

    expect(selected["waypoint-status"]).toBe(true);
    expect(selected["attention-ending"]).toBe(false);
    expect(waypoint?.details.map((detail) => detail.id)).toEqual([
      "waypoint-status",
    ]);
    expect(JSON.stringify(review)).not.toContain("defaultDetailSharing");
  });

  it("S01R1-PRIV-005 parent exclusion clears every current and future child", () => {
    const { draft } = createSummaryFixture();
    const waypoint = draft.mainPoints.find((point) => point.id === "waypoint");

    waypoint?.details.push({
      id: "future-waypoint-detail",
      text: "SM_PRIVATE_FUTURE_WAYPOINT_3P7K2M",
    });

    const initial = createDefaultSummarySelection(draft);
    const selected = setDetailIncluded(initial, "waypoint-status", true);
    const excluded = setMainPointIncluded(draft, selected, "waypoint", false);

    expect(excluded.waypoint).toBe(false);
    expect(excluded["waypoint-status"]).toBe(false);
    expect(excluded["attention-ending"]).toBe(false);
    expect(excluded["future-waypoint-detail"]).toBe(false);
  });

  it("S01R1-PROJ-001 emits only the six canonical onboarding keys in order", () => {
    const answers: ExplorerStructuredFormAnswers = {
      supportNow: "SM_ALLOWED_SUPPORT_NOW_A1",
      usefulOutcome: "SM_ALLOWED_USEFUL_OUTCOME_B2",
      supportStyle: "SM_ALLOWED_SUPPORT_STYLE_C3",
      guideContext: "SM_ALLOWED_GUIDE_CONTEXT_D4",
      communicationPreference: "SM_ALLOWED_COMMUNICATION_E5",
      doNotEmphasize: "SM_ALLOWED_DO_NOT_EMPHASIZE_F6",
    };

    const projection = createNonLiveGuideProjection(answers, null);

    expect(projection.onboardingAnswers.map((answer) => answer.key)).toEqual(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.map((field) => field.key),
    );
  });

  it("S01R1-PROJ-002 excludes a runtime-injected seventh key and sentinel", () => {
    const answers = createAnswers() as ExplorerStructuredFormAnswers &
      Record<string, string>;
    answers.unexpectedPrivateKey = "SM_CANARY_SEVENTH_KEY_7Q4M9X";

    const serialized = JSON.stringify(createNonLiveGuideProjection(answers, null));

    expect(serialized).not.toContain("unexpectedPrivateKey");
    expect(serialized).not.toContain("SM_CANARY_SEVENTH_KEY_7Q4M9X");
  });

  it("S01R1-PROJ-003 excludes Route, conversation, selection, draft, and excluded-detail canaries", () => {
    const { answers, draft } = createSummaryFixture();
    const support = draft.mainPoints.find((point) => point.id === "support-focus");
    support?.details.push({
      id: "excluded-detail-canary",
      text: "SM_CANARY_EXCLUDED_DETAIL_9D5H7S",
    });

    const initial = createDefaultSummarySelection(draft);
    const selected = setDetailIncluded(
      initial,
      "excluded-detail-canary",
      false,
    );
    const snapshot = createSharedSnapshot(
      buildExactSummaryReview(draft, selected),
    );
    const unsafeAnswers = answers as ExplorerStructuredFormAnswers &
      Record<string, string>;
    unsafeAnswers.route = "SM_CANARY_ROUTE_8N3C6P";
    unsafeAnswers.conversation = "SM_CANARY_CONVERSATION_5R9K2V";
    unsafeAnswers.selection = "SM_CANARY_SELECTION_4T7B3J";
    unsafeAnswers.privateDraft = "SM_CANARY_PRIVATE_DRAFT_6W2F8L";

    const serialized = JSON.stringify(
      createNonLiveGuideProjection(unsafeAnswers, snapshot),
    );

    for (const canary of [
      "SM_CANARY_ROUTE_8N3C6P",
      "SM_CANARY_CONVERSATION_5R9K2V",
      "SM_CANARY_SELECTION_4T7B3J",
      "SM_CANARY_PRIVATE_DRAFT_6W2F8L",
      "SM_CANARY_EXCLUDED_DETAIL_9D5H7S",
    ]) {
      expect(serialized).not.toContain(canary);
    }
  });

  it("S01R1-STATE-001 keeps Discovery and null Priority after decline", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const proposed = proposePriorityChange(revealed, "support-now");
    const declined = resolvePriorityChange(proposed, false);

    expect(declined.mode).toBe("discovery");
    expect(declined.priorityPointId).toBeNull();
    expect(declined.pendingPriorityPointId).toBeNull();
    expect(declined.route.at(-1)?.description).toBe(
      "Explorer declined the proposed Priority. Discovery remains the current direction.",
    );
  });

  it("S01R1-STATE-002 preserves and names the existing Priority after decline", () => {
    const revealed = revealCompassPoints(
      createDiscoveryCompass(),
      createAnswers(),
    );
    const oriented = confirmInitialPriority(revealed, "support-now");
    const proposed = proposePriorityChange(oriented, "useful-outcome");
    const declined = resolvePriorityChange(proposed, false);

    expect(declined.priorityPointId).toBe("support-now");
    expect(declined.pendingPriorityPointId).toBeNull();
    expect(declined.route.at(-1)?.description).toContain(
      '"Create more room to breathe" remains the current Priority.',
    );
  });
});
