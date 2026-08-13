export const SUGGESTED_WAYPOINT_TIMING = Object.freeze({
  minimumSeconds: 60,
  defaultSeconds: 300,
  maximumSeconds: 3600,
});

export type SuggestedWaypointContent = Readonly<{
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
}>;

export type SuggestedWaypointVersion = Readonly<{
  id: string;
  predecessorVersionId: string | null;
  deliveredAtMs: number;
  content: SuggestedWaypointContent;
}>;

export type SuggestedWaypointReceipt = Readonly<{
  versionId: string;
  acknowledgedAtMs: number;
}>;

export type SuggestedWaypointResponse = Readonly<{
  versionId: string;
  sentAtMs: number;
  exactText: string;
}>;

export type SuggestedWaypointChannel = Readonly<{
  id: string;
  relationshipId: string;
  status: "open" | "withdrawn";
  versions: readonly SuggestedWaypointVersion[];
  currentVersionId: string;
  receipts: readonly SuggestedWaypointReceipt[];
  responses: readonly SuggestedWaypointResponse[];
  withdrawnAtMs: number | null;
}>;

export type SuggestedWaypointDraft = Readonly<{
  mode: "draft";
  revision: number;
  content: SuggestedWaypointContent;
  correctionOfVersionId: string | null;
}>;

export type SuggestedWaypointPendingOutbound = Readonly<{
  mode: "pending";
  revision: number;
  operationId: string;
  commandKind: "initial-send" | "correction-send";
  lockedVersionId: string;
  predecessorVersionId: string | null;
  lockedContent: SuggestedWaypointContent;
  policyVersion: string;
  effectiveSeconds: number;
  deadlineMs: number;
  expedited: boolean;
}>;

export type SuggestedWaypointAuthoring =
  | SuggestedWaypointDraft
  | SuggestedWaypointPendingOutbound;

export type SuggestedWaypointExplorerEngagement = Readonly<{
  readVersionIds: readonly string[];
  privateDraftsByVersion: Readonly<Record<string, string>>;
  usedVersionIds: readonly string[];
}>;

export type SuggestedWaypointState = Readonly<{
  suggestionId: string;
  guideUserId: string;
  explorerUserId: string;
  relationshipId: string;
  authoring: SuggestedWaypointAuthoring;
  channel: SuggestedWaypointChannel | null;
  explorer: SuggestedWaypointExplorerEngagement;
  operationFingerprints: Readonly<Record<string, string>>;
}>;

export type SuggestedWaypointRejection =
  | "invalid-transition"
  | "stale-version"
  | "too-late"
  | "channel-closed"
  | "duplicate-response"
  | "operation-payload-mismatch";

export type SuggestedWaypointResult =
  | Readonly<{ kind: "applied" | "idempotent"; state: SuggestedWaypointState }>
  | Readonly<{
      kind: "rejected";
      code: SuggestedWaypointRejection;
      state: SuggestedWaypointState;
    }>;

export type SuggestedWaypointTimingInput = Readonly<{
  minimumSeconds: number;
  defaultSeconds: number;
  maximumSeconds: number;
  guidePreferenceSeconds?: number | null;
}>;

export type GuideSuggestedWaypointProjection = Readonly<{
  suggestionId: string;
  authoringMode: SuggestedWaypointAuthoring["mode"];
  pendingDeadlineMs: number | null;
  pullBackAvailable: boolean;
  currentVersion: SuggestedWaypointVersion | null;
  channelStatus: SuggestedWaypointChannel["status"] | "not-delivered";
  receipts: readonly SuggestedWaypointReceipt[];
  responses: readonly SuggestedWaypointResponse[];
}>;

export type ExplorerSuggestedWaypointProjection = Readonly<{
  suggestionId: string;
  channelStatus: SuggestedWaypointChannel["status"];
  currentVersion: SuggestedWaypointVersion;
  read: boolean;
  receipt: SuggestedWaypointReceipt | null;
  responded: boolean;
  usedInWaypoint: boolean;
  hasPrivateDraft: boolean;
}>;

export type AdminSuggestedWaypointProjection = Readonly<{
  suggestionId: string;
  relationshipId: string;
  lifecycleCategory: "not-delivered" | "pending" | "open" | "withdrawn";
  currentVersionId: string | null;
  pendingDeadlineMs: number | null;
}>;

const immutableContent = (
  content: SuggestedWaypointContent,
): SuggestedWaypointContent =>
  Object.freeze({
    destination: content.destination,
    why: content.why,
    arrivalSignals: Object.freeze([...content.arrivalSignals]),
  });

const immutableState = (
  state: SuggestedWaypointState,
): SuggestedWaypointState =>
  Object.freeze({
    ...state,
    authoring: Object.freeze(
      state.authoring.mode === "draft"
        ? { ...state.authoring, content: immutableContent(state.authoring.content) }
        : {
            ...state.authoring,
            lockedContent: immutableContent(state.authoring.lockedContent),
          },
    ),
    channel:
      state.channel === null
        ? null
        : Object.freeze({
            ...state.channel,
            versions: Object.freeze(
              state.channel.versions.map((version) =>
                Object.freeze({
                  ...version,
                  content: immutableContent(version.content),
                }),
              ),
            ),
            receipts: Object.freeze(
              state.channel.receipts.map((receipt) => Object.freeze({ ...receipt })),
            ),
            responses: Object.freeze(
              state.channel.responses.map((response) =>
                Object.freeze({ ...response }),
              ),
            ),
          }),
    explorer: Object.freeze({
      readVersionIds: Object.freeze([...state.explorer.readVersionIds]),
      privateDraftsByVersion: Object.freeze({
        ...state.explorer.privateDraftsByVersion,
      }),
      usedVersionIds: Object.freeze([...state.explorer.usedVersionIds]),
    }),
    operationFingerprints: Object.freeze({ ...state.operationFingerprints }),
  });

const reject = (
  state: SuggestedWaypointState,
  code: SuggestedWaypointRejection,
): SuggestedWaypointResult => Object.freeze({ kind: "rejected", code, state });

const apply = (
  state: SuggestedWaypointState,
  kind: "applied" | "idempotent" = "applied",
): SuggestedWaypointResult => Object.freeze({ kind, state: immutableState(state) });

const fingerprint = (
  parts: readonly (string | number | boolean | null)[],
): string =>
  JSON.stringify(parts);

const inspectReplay = (
  state: SuggestedWaypointState,
  operationId: string,
  nextFingerprint: string,
): "new" | "same" | "mismatch" => {
  const prior = state.operationFingerprints[operationId];
  if (prior === undefined) return "new";
  return prior === nextFingerprint ? "same" : "mismatch";
};

const withOperation = (
  state: SuggestedWaypointState,
  operationId: string,
  operationFingerprint: string,
): SuggestedWaypointState => ({
  ...state,
  operationFingerprints: {
    ...state.operationFingerprints,
    [operationId]: operationFingerprint,
  },
});

export function resolveSuggestedWaypointTiming(
  input: SuggestedWaypointTimingInput,
): number {
  const { minimumSeconds, defaultSeconds, maximumSeconds } = input;
  if (
    minimumSeconds < 1 ||
    defaultSeconds < minimumSeconds ||
    maximumSeconds < defaultSeconds ||
    maximumSeconds > SUGGESTED_WAYPOINT_TIMING.maximumSeconds
  ) {
    throw new Error("Invalid Suggested Waypoint timing policy.");
  }

  const selected = input.guidePreferenceSeconds ?? defaultSeconds;
  if (!Number.isInteger(selected) || selected > maximumSeconds) {
    throw new Error("Invalid Suggested Waypoint Guide timing preference.");
  }
  return Math.max(minimumSeconds, selected);
}

export function createSuggestedWaypointDraft(input: Readonly<{
  suggestionId: string;
  guideUserId: string;
  explorerUserId: string;
  relationshipId: string;
  content: SuggestedWaypointContent;
}>): SuggestedWaypointState {
  return immutableState({
    suggestionId: input.suggestionId,
    guideUserId: input.guideUserId,
    explorerUserId: input.explorerUserId,
    relationshipId: input.relationshipId,
    authoring: {
      mode: "draft",
      revision: 1,
      content: immutableContent(input.content),
      correctionOfVersionId: null,
    },
    channel: null,
    explorer: {
      readVersionIds: [],
      privateDraftsByVersion: {},
      usedVersionIds: [],
    },
    operationFingerprints: {},
  });
}

export function scheduleSuggestedWaypointSend(
  state: SuggestedWaypointState,
  input: Readonly<{
    operationId: string;
    versionId: string;
    expectedRevision: number;
    nowMs: number;
    policyVersion: string;
    timing: SuggestedWaypointTimingInput;
  }>,
): SuggestedWaypointResult {
  if (state.authoring.mode === "pending") {
    if (state.authoring.operationId !== input.operationId) {
      return reject(state, "invalid-transition");
    }
    const pendingFingerprint = fingerprint([
      state.authoring.commandKind,
      state.guideUserId,
      input.versionId,
      input.expectedRevision,
      input.policyVersion,
      state.authoring.lockedContent.destination,
      state.authoring.lockedContent.why,
      ...state.authoring.lockedContent.arrivalSignals,
    ]);
    return inspectReplay(state, input.operationId, pendingFingerprint) === "same"
      ? apply(state, "idempotent")
      : reject(state, "operation-payload-mismatch");
  }
  if (state.authoring.revision !== input.expectedRevision) {
    return reject(state, "stale-version");
  }
  if (state.channel?.status === "withdrawn") {
    return reject(state, "channel-closed");
  }

  const commandKind =
    state.authoring.correctionOfVersionId === null
      ? "initial-send"
      : "correction-send";
  const operationFingerprint = fingerprint([
    commandKind,
    state.guideUserId,
    input.versionId,
    input.expectedRevision,
    input.policyVersion,
    state.authoring.content.destination,
    state.authoring.content.why,
    ...state.authoring.content.arrivalSignals,
  ]);
  const replay = inspectReplay(state, input.operationId, operationFingerprint);
  if (replay === "mismatch") {
    return reject(state, "operation-payload-mismatch");
  }
  if (replay === "same") return apply(state, "idempotent");

  const effectiveSeconds = resolveSuggestedWaypointTiming(input.timing);
  const next = withOperation(
    {
      ...state,
      authoring: {
        mode: "pending",
        revision: state.authoring.revision,
        operationId: input.operationId,
        commandKind,
        lockedVersionId: input.versionId,
        predecessorVersionId: state.authoring.correctionOfVersionId,
        lockedContent: immutableContent(state.authoring.content),
        policyVersion: input.policyVersion,
        effectiveSeconds,
        deadlineMs: input.nowMs + effectiveSeconds * 1000,
        expedited: false,
      },
    },
    input.operationId,
    operationFingerprint,
  );
  return apply(next);
}

export function pullBackSuggestedWaypoint(
  state: SuggestedWaypointState,
  nowMs: number,
): SuggestedWaypointResult {
  if (state.authoring.mode !== "pending") {
    return reject(state, "invalid-transition");
  }
  if (nowMs >= state.authoring.deadlineMs) {
    return reject(state, "too-late");
  }
  return apply({
    ...state,
    authoring: {
      mode: "draft",
      revision: state.authoring.revision + 1,
      content: state.authoring.lockedContent,
      correctionOfVersionId: state.authoring.predecessorVersionId,
    },
  });
}

export function deliverPendingSuggestedWaypoint(
  state: SuggestedWaypointState,
  input: Readonly<{ operationId: string; nowMs: number; expedite?: boolean }>,
): SuggestedWaypointResult {
  if (state.authoring.mode !== "pending") {
    const deliveredVersionId = state.channel?.currentVersionId;
    if (!deliveredVersionId) return reject(state, "invalid-transition");
    const replayFingerprint = fingerprint([
      "deliver",
      deliveredVersionId,
      Boolean(input.expedite),
    ]);
    const replay = inspectReplay(state, input.operationId, replayFingerprint);
    if (replay === "same") return apply(state, "idempotent");
    return replay === "mismatch"
      ? reject(state, "operation-payload-mismatch")
      : reject(state, "invalid-transition");
  }
  if (!input.expedite && input.nowMs < state.authoring.deadlineMs) {
    return reject(state, "too-late");
  }
  if (state.channel?.status === "withdrawn") {
    return reject(state, "channel-closed");
  }
  if (
    state.authoring.predecessorVersionId !== null &&
    state.channel?.currentVersionId !== state.authoring.predecessorVersionId
  ) {
    return reject(state, "stale-version");
  }

  const deliveryFingerprint = fingerprint([
    "deliver",
    state.authoring.lockedVersionId,
    Boolean(input.expedite),
  ]);
  const replay = inspectReplay(state, input.operationId, deliveryFingerprint);
  if (replay === "mismatch") {
    return reject(state, "operation-payload-mismatch");
  }
  if (replay === "same") return apply(state, "idempotent");

  const version: SuggestedWaypointVersion = Object.freeze({
    id: state.authoring.lockedVersionId,
    predecessorVersionId: state.authoring.predecessorVersionId,
    deliveredAtMs: input.nowMs,
    content: state.authoring.lockedContent,
  });
  const channel: SuggestedWaypointChannel = state.channel
    ? {
        ...state.channel,
        versions: [...state.channel.versions, version],
        currentVersionId: version.id,
      }
    : {
        id: state.suggestionId,
        relationshipId: state.relationshipId,
        status: "open",
        versions: [version],
        currentVersionId: version.id,
        receipts: [],
        responses: [],
        withdrawnAtMs: null,
      };

  return apply(
    withOperation(
      {
        ...state,
        channel,
        authoring: {
          mode: "draft",
          revision: state.authoring.revision + 1,
          content: state.authoring.lockedContent,
          correctionOfVersionId: version.id,
        },
      },
      input.operationId,
      deliveryFingerprint,
    ),
  );
}

const currentVersion = (
  state: SuggestedWaypointState,
): SuggestedWaypointVersion | null =>
  state.channel?.versions.find(
    (version) => version.id === state.channel?.currentVersionId,
  ) ?? null;

export function markSuggestedWaypointRead(
  state: SuggestedWaypointState,
  versionId: string,
): SuggestedWaypointResult {
  if (!state.channel?.versions.some((version) => version.id === versionId)) {
    return reject(state, "stale-version");
  }
  if (state.explorer.readVersionIds.includes(versionId)) {
    return apply(state, "idempotent");
  }
  return apply({
    ...state,
    explorer: {
      ...state.explorer,
      readVersionIds: [...state.explorer.readVersionIds, versionId],
    },
  });
}

export function acknowledgeSuggestedWaypoint(
  state: SuggestedWaypointState,
  input: Readonly<{ versionId: string; nowMs: number }>,
): SuggestedWaypointResult {
  if (!state.channel || state.channel.status !== "open") {
    return reject(state, "channel-closed");
  }
  if (state.channel.currentVersionId !== input.versionId) {
    return reject(state, "stale-version");
  }
  if (state.channel.receipts.some((item) => item.versionId === input.versionId)) {
    return apply(state, "idempotent");
  }
  return apply({
    ...state,
    channel: {
      ...state.channel,
      receipts: [
        ...state.channel.receipts,
        { versionId: input.versionId, acknowledgedAtMs: input.nowMs },
      ],
    },
  });
}

export function savePrivateSuggestedWaypointDraft(
  state: SuggestedWaypointState,
  versionId: string,
  exactText: string,
): SuggestedWaypointResult {
  if (!state.channel?.versions.some((version) => version.id === versionId)) {
    return reject(state, "stale-version");
  }
  return apply({
    ...state,
    explorer: {
      ...state.explorer,
      privateDraftsByVersion: {
        ...state.explorer.privateDraftsByVersion,
        [versionId]: exactText,
      },
    },
  });
}

export function sendExactSuggestedWaypointResponse(
  state: SuggestedWaypointState,
  input: Readonly<{ versionId: string; nowMs: number; exactText: string }>,
): SuggestedWaypointResult {
  if (!state.channel || state.channel.status !== "open") {
    return reject(state, "channel-closed");
  }
  if (state.channel.currentVersionId !== input.versionId) {
    return reject(state, "stale-version");
  }
  if (state.channel.responses.some((item) => item.versionId === input.versionId)) {
    return reject(state, "duplicate-response");
  }
  return apply({
    ...state,
    channel: {
      ...state.channel,
      responses: [
        ...state.channel.responses,
        {
          versionId: input.versionId,
          sentAtMs: input.nowMs,
          exactText: input.exactText,
        },
      ],
    },
  });
}

export function withdrawSuggestedWaypoint(
  state: SuggestedWaypointState,
  nowMs: number,
): SuggestedWaypointResult {
  if (!state.channel || state.channel.status !== "open") {
    return reject(state, "invalid-transition");
  }
  return apply({
    ...state,
    channel: {
      ...state.channel,
      status: "withdrawn",
      withdrawnAtMs: nowMs,
    },
  });
}

export function projectSuggestedWaypointForGuide(
  state: SuggestedWaypointState,
  nowMs: number,
): GuideSuggestedWaypointProjection {
  return Object.freeze({
    suggestionId: state.suggestionId,
    authoringMode: state.authoring.mode,
    pendingDeadlineMs:
      state.authoring.mode === "pending" ? state.authoring.deadlineMs : null,
    pullBackAvailable:
      state.authoring.mode === "pending" && nowMs < state.authoring.deadlineMs,
    currentVersion: currentVersion(state),
    channelStatus: state.channel?.status ?? "not-delivered",
    receipts: Object.freeze([...(state.channel?.receipts ?? [])]),
    responses: Object.freeze([...(state.channel?.responses ?? [])]),
  });
}

export function projectSuggestedWaypointForExplorer(
  state: SuggestedWaypointState,
): ExplorerSuggestedWaypointProjection | null {
  const version = currentVersion(state);
  if (!state.channel || !version) return null;
  return Object.freeze({
    suggestionId: state.suggestionId,
    channelStatus: state.channel.status,
    currentVersion: version,
    read: state.explorer.readVersionIds.includes(version.id),
    receipt:
      state.channel.receipts.find((item) => item.versionId === version.id) ??
      null,
    responded: state.channel.responses.some(
      (item) => item.versionId === version.id,
    ),
    usedInWaypoint: state.explorer.usedVersionIds.includes(version.id),
    hasPrivateDraft: state.explorer.privateDraftsByVersion[version.id] !== undefined,
  });
}

export function projectSuggestedWaypointForAdmin(
  state: SuggestedWaypointState,
): AdminSuggestedWaypointProjection {
  return Object.freeze({
    suggestionId: state.suggestionId,
    relationshipId: state.relationshipId,
    lifecycleCategory:
      state.authoring.mode === "pending"
        ? "pending"
        : state.channel?.status ?? "not-delivered",
    currentVersionId: state.channel?.currentVersionId ?? null,
    pendingDeadlineMs:
      state.authoring.mode === "pending" ? state.authoring.deadlineMs : null,
  });
}
