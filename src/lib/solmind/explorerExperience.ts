import type { SolMindStructuredFormFieldKey } from "./onboarding";

export const MAX_VISIBLE_COMPASS_POINTS = 8;

export type ExplorerStructuredFormAnswers = Record<
  SolMindStructuredFormFieldKey,
  string
>;

export type CompassZone = "priority" | "detour" | "excursion";

export type CompassPointCandidate = {
  id: string;
  categoryKey: string;
  label: string;
  detail: string;
  zone: CompassZone;
  emphasis: 1 | 2 | 3;
};

export type CompassPoint = {
  id: string;
  categoryKey: string;
  label: string;
  details: string[];
  sourceLabels: string[];
  zone: CompassZone;
  emphasis: 1 | 2 | 3;
};

export type CompassRouteEntry = {
  id: string;
  description: string;
  attentionPointId: string | null;
  confirmedPriorityId: string | null;
};

export type SessionCompassState = {
  mode: "discovery" | "oriented";
  points: CompassPoint[];
  otherPaths: CompassPoint[];
  priorityPointId: string | null;
  attentionPointId: string | null;
  pendingPriorityPointId: string | null;
  route: CompassRouteEntry[];
};

export type DirectionsTakenSummary = {
  heading: string;
  statements: string[];
};

export type WaypointProposal = {
  id: string;
  text: string;
  confirmed: boolean;
};

export type SummaryDetail = {
  id: string;
  text: string;
};

export type SummaryMainPoint = {
  id: string;
  title: string;
  details: SummaryDetail[];
};

export type SummaryDraft = {
  id: string;
  mainPoints: SummaryMainPoint[];
};

export type SummarySelection = Record<string, boolean>;

export type ReviewedSummaryDetail = Readonly<{
  id: string;
  text: string;
}>;

export type ReviewedSummaryMainPoint = Readonly<{
  id: string;
  title: string;
  details: readonly ReviewedSummaryDetail[];
}>;

export type ExactSummaryReview = Readonly<{
  mainPoints: readonly ReviewedSummaryMainPoint[];
}>;

export type SharedSnapshot = Readonly<{
  id: string;
  status: "shared";
  mainPoints: readonly ReviewedSummaryMainPoint[];
}>;

export type GuideVisibleOnboardingAnswer = Readonly<{
  key: SolMindStructuredFormFieldKey;
  value: string;
}>;

export type NonLiveGuideProjection = Readonly<{
  onboardingAnswers: readonly GuideVisibleOnboardingAnswer[];
  sharedSnapshot: SharedSnapshot | null;
}>;

const EMPTY_ANSWERS: ExplorerStructuredFormAnswers = {
  supportNow: "",
  usefulOutcome: "",
  supportStyle: "",
  guideContext: "",
  communicationPreference: "",
  doNotEmphasize: "",
};

export function createEmptyStructuredFormAnswers(): ExplorerStructuredFormAnswers {
  return { ...EMPTY_ANSWERS };
}

export function createDiscoveryCompass(): SessionCompassState {
  return {
    mode: "discovery",
    points: [],
    otherPaths: [],
    priorityPointId: null,
    attentionPointId: null,
    pendingPriorityPointId: null,
    route: [
      {
        id: "route-discovery-start",
        description: "Started in Discovery mode with no confirmed Priority.",
        attentionPointId: null,
        confirmedPriorityId: null,
      },
    ],
  };
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function makeCompassLabel(value: string, fallback: string): string {
  const normalized = normalizeSpaces(value);

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 42) {
    return normalized;
  }

  const shortened = normalized.slice(0, 39);
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened.slice(0, lastSpace > 22 ? lastSpace : 39)}...`;
}

export function groupCompassCandidates(
  candidates: readonly CompassPointCandidate[],
): { visible: CompassPoint[]; otherPaths: CompassPoint[] } {
  const grouped = new Map<string, CompassPoint>();

  for (const candidate of candidates) {
    const existing = grouped.get(candidate.categoryKey);

    if (existing) {
      if (!existing.details.includes(candidate.detail)) {
        existing.details.push(candidate.detail);
      }

      if (!existing.sourceLabels.includes(candidate.label)) {
        existing.sourceLabels.push(candidate.label);
      }

      existing.emphasis = Math.max(
        existing.emphasis,
        candidate.emphasis,
      ) as 1 | 2 | 3;
      continue;
    }

    grouped.set(candidate.categoryKey, {
      id: candidate.id,
      categoryKey: candidate.categoryKey,
      label: candidate.label,
      details: [candidate.detail],
      sourceLabels: [candidate.label],
      zone: candidate.zone,
      emphasis: candidate.emphasis,
    });
  }

  const ordered = [...grouped.values()].sort(
    (left, right) => right.emphasis - left.emphasis,
  );

  return {
    visible: ordered.slice(0, MAX_VISIBLE_COMPASS_POINTS),
    otherPaths: ordered.slice(MAX_VISIBLE_COMPASS_POINTS),
  };
}

export function createDeterministicCompassPoints(
  answers: ExplorerStructuredFormAnswers,
): { visible: CompassPoint[]; otherPaths: CompassPoint[] } {
  return groupCompassCandidates([
    {
      id: "support-now",
      categoryKey: "current-support",
      label: makeCompassLabel(answers.supportNow, "What matters right now"),
      detail: normalizeSpaces(answers.supportNow) || "Discover what matters now.",
      zone: "priority",
      emphasis: 3,
    },
    {
      id: "useful-outcome",
      categoryKey: "useful-outcome",
      label: makeCompassLabel(answers.usefulOutcome, "A useful next step"),
      detail:
        normalizeSpaces(answers.usefulOutcome) ||
        "Clarify what would make this conversation useful.",
      zone: "detour",
      emphasis: 2,
    },
    {
      id: "support-style",
      categoryKey: "support-style",
      label: makeCompassLabel(answers.supportStyle, "How support should feel"),
      detail:
        normalizeSpaces(answers.supportStyle) ||
        "Explore what kind of support feels helpful today.",
      zone: "excursion",
      emphasis: 1,
    },
  ]);
}

export function revealCompassPoints(
  state: SessionCompassState,
  answers: ExplorerStructuredFormAnswers,
): SessionCompassState {
  const grouped = createDeterministicCompassPoints(answers);

  return {
    ...state,
    points: grouped.visible,
    otherPaths: grouped.otherPaths,
    attentionPointId: grouped.visible[0]?.id ?? null,
    route: [
      ...state.route,
      {
        id: `route-${state.route.length + 1}`,
        description:
          "Tentative paths appeared. No Priority changed automatically.",
        attentionPointId: grouped.visible[0]?.id ?? null,
        confirmedPriorityId: state.priorityPointId,
      },
    ],
  };
}

export function confirmInitialPriority(
  state: SessionCompassState,
  pointId: string,
): SessionCompassState {
  const point = state.points.find((candidate) => candidate.id === pointId);

  if (!point) {
    return state;
  }

  return {
    ...state,
    mode: "oriented",
    priorityPointId: pointId,
    attentionPointId: pointId,
    pendingPriorityPointId: null,
    route: [
      ...state.route,
      {
        id: `route-${state.route.length + 1}`,
        description: `Explorer confirmed "${point.label}" as the Priority.`,
        attentionPointId: pointId,
        confirmedPriorityId: pointId,
      },
    ],
  };
}

export function moveCurrentAttention(
  state: SessionCompassState,
  pointId: string,
): SessionCompassState {
  const point = state.points.find((candidate) => candidate.id === pointId);

  if (!point) {
    return state;
  }

  return {
    ...state,
    attentionPointId: pointId,
    route: [
      ...state.route,
      {
        id: `route-${state.route.length + 1}`,
        description: `Attention moved to "${point.label}" without changing Priority.`,
        attentionPointId: pointId,
        confirmedPriorityId: state.priorityPointId,
      },
    ],
  };
}

export function proposePriorityChange(
  state: SessionCompassState,
  pointId: string,
): SessionCompassState {
  if (!state.points.some((point) => point.id === pointId)) {
    return state;
  }

  return {
    ...state,
    pendingPriorityPointId: pointId,
  };
}

export function resolvePriorityChange(
  state: SessionCompassState,
  accept: boolean,
): SessionCompassState {
  const proposedPoint = state.points.find(
    (point) => point.id === state.pendingPriorityPointId,
  );

  if (!proposedPoint) {
    return state;
  }

  if (!accept) {
    return {
      ...state,
      pendingPriorityPointId: null,
      route: [
        ...state.route,
        {
          id: `route-${state.route.length + 1}`,
          description: `Explorer kept the current Priority instead of changing it to "${proposedPoint.label}".`,
          attentionPointId: state.attentionPointId,
          confirmedPriorityId: state.priorityPointId,
        },
      ],
    };
  }

  return {
    ...state,
    mode: "oriented",
    priorityPointId: proposedPoint.id,
    attentionPointId: proposedPoint.id,
    pendingPriorityPointId: null,
    route: [
      ...state.route,
      {
        id: `route-${state.route.length + 1}`,
        description: `Explorer confirmed "${proposedPoint.label}" as the new Priority.`,
        attentionPointId: proposedPoint.id,
        confirmedPriorityId: proposedPoint.id,
      },
    ],
  };
}

export function buildDirectionsTakenSummary(
  state: SessionCompassState,
): DirectionsTakenSummary {
  const priority = state.points.find(
    (point) => point.id === state.priorityPointId,
  );
  const attention = state.points.find(
    (point) => point.id === state.attentionPointId,
  );

  if (!priority) {
    return {
      heading: "Discovery was the direction",
      statements: [
        "No Priority was confirmed.",
        state.points.length
          ? "Tentative paths were noticed without forcing a ranking."
          : "The session ended without inventing any topic points.",
      ],
    };
  }

  return {
    heading: "Directions taken",
    statements: [
      `Confirmed Priority: ${priority.label}.`,
      attention && attention.id !== priority.id
        ? `The conversation also spent time with ${attention.label}.`
        : "Current attention ended with the confirmed Priority.",
      `${state.route.length} Route moments are preserved in this in-memory prototype.`,
    ],
  };
}

export function createWaypointProposal(
  state: SessionCompassState,
): WaypointProposal {
  const priority = state.points.find(
    (point) => point.id === state.priorityPointId,
  );

  return {
    id: "first-compass-waypoint",
    text: priority
      ? `Pause and notice what becomes possible when "${priority.label}" stays visible.`
      : "Pause and notice that discovering what matters can be a valid step.",
    confirmed: false,
  };
}

export function confirmWaypoint(
  proposal: WaypointProposal,
): WaypointProposal {
  return { ...proposal, confirmed: true };
}

export function createSummaryDraft(
  answers: ExplorerStructuredFormAnswers,
  state: SessionCompassState,
  directions: DirectionsTakenSummary,
  waypoint: WaypointProposal,
): SummaryDraft {
  const priority = state.points.find(
    (point) => point.id === state.priorityPointId,
  );
  const attention = state.points.find(
    (point) => point.id === state.attentionPointId,
  );

  return {
    id: "first-compass-summary-draft",
    mainPoints: [
      {
        id: "support-focus",
        title: "What I wanted support with",
        details: [
          {
            id: "support-focus-answer",
            text:
              normalizeSpaces(answers.supportNow) ||
              "I was still discovering what I wanted support with.",
          },
          {
            id: "support-focus-priority",
            text: priority
              ? `I confirmed "${priority.label}" as my Priority.`
              : "I did not confirm a Priority.",
          },
        ],
      },
      {
        id: "route",
        title: directions.heading,
        details: directions.statements.map((statement, index) => ({
          id: `route-${index + 1}`,
          text: statement,
        })),
      },
      {
        id: "waypoint",
        title: waypoint.confirmed
          ? "A private Waypoint I confirmed"
          : "A Waypoint I did not confirm",
        details: [
          {
            id: "waypoint-status",
            text: waypoint.confirmed
              ? waypoint.text
              : "No Waypoint was made durable in this prototype.",
          },
          ...(attention
            ? [
                {
                  id: "attention-ending",
                  text: `Attention ended with "${attention.label}".`,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

export function createDefaultSummarySelection(
  draft: SummaryDraft,
): SummarySelection {
  return draft.mainPoints.reduce<SummarySelection>((selection, mainPoint) => {
    selection[mainPoint.id] = true;

    for (const detail of mainPoint.details) {
      selection[detail.id] = true;
    }

    return selection;
  }, {});
}

export function setMainPointIncluded(
  draft: SummaryDraft,
  selection: SummarySelection,
  mainPointId: string,
  included: boolean,
): SummarySelection {
  const next = { ...selection, [mainPointId]: included };
  const mainPoint = draft.mainPoints.find((point) => point.id === mainPointId);

  if (!included && mainPoint) {
    for (const detail of mainPoint.details) {
      next[detail.id] = false;
    }
  }

  return next;
}

export function setDetailIncluded(
  selection: SummarySelection,
  detailId: string,
  included: boolean,
): SummarySelection {
  return { ...selection, [detailId]: included };
}

export function buildExactSummaryReview(
  draft: SummaryDraft,
  selection: SummarySelection,
): ExactSummaryReview {
  return {
    mainPoints: draft.mainPoints
      .filter((mainPoint) => selection[mainPoint.id])
      .map((mainPoint) => ({
        id: mainPoint.id,
        title: mainPoint.title,
        details: mainPoint.details
          .filter((detail) => selection[detail.id])
          .map((detail) => ({ ...detail })),
      })),
  };
}

export function createSharedSnapshot(
  review: ExactSummaryReview,
): SharedSnapshot {
  const snapshot: SharedSnapshot = {
    id: "first-compass-shared-snapshot",
    status: "shared",
    mainPoints: review.mainPoints.map((mainPoint) =>
      Object.freeze({
        ...mainPoint,
        details: Object.freeze(
          mainPoint.details.map((detail) => Object.freeze({ ...detail })),
        ),
      }),
    ),
  };

  Object.freeze(snapshot.mainPoints);

  return Object.freeze(snapshot);
}

export function createNonLiveGuideProjection(
  answers: ExplorerStructuredFormAnswers,
  snapshot: SharedSnapshot | null,
): NonLiveGuideProjection {
  const onboardingAnswers = (
    Object.entries(answers) as [SolMindStructuredFormFieldKey, string][]
  )
    .filter(([, value]) => normalizeSpaces(value).length > 0)
    .map(([key, value]) => Object.freeze({ key, value: normalizeSpaces(value) }));

  return Object.freeze({
    onboardingAnswers: Object.freeze(onboardingAnswers),
    sharedSnapshot: snapshot,
  });
}
