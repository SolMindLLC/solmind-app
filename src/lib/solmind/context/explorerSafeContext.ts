import "server-only";

import {
  SOLMIND_AI_ROLES,
  isAiRoleAllowedInContext,
} from "./aiRoleContext";
import {
  SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES,
  SOLMIND_SUMMARY_PUBLICATION_STATUSES,
  SOLMIND_SUMMARY_REVISION_STATUSES,
  SOLMIND_SUMMARY_SECTION_TYPES,
  SOLMIND_SUMMARY_SECTION_VISIBILITIES,
  SOLMIND_SUMMARY_STATUSES,
  SOLMIND_SUMMARY_TYPES,
  isExplorerFacingContextItemAllowed,
  type SolMindGuideExplorerRelationshipStatus,
  type SolMindReflectionConfirmationStatus,
  type SolMindReflectionVisibility,
  type SolMindSummaryPublicationStatus,
  type SolMindSummaryRevisionStatus,
  type SolMindSummarySectionType,
  type SolMindSummarySectionVisibility,
  type SolMindSummaryStatus,
  type SolMindSummaryType,
} from "./explorerContext";

export const EXPLORER_SAFE_CONTEXT_LIMITS = Object.freeze({
  versionLabelCharacters: 64,
  explorerDisplayNameCharacters: 120,
  explorerSafeGuardrailCharacters: 2_000,
  policyTextCharacters: 12_000,
  methodologyTextCharacters: 24_000,
  onboardingAnswerCharacters: 2_000,
  focusItemCount: 8,
  focusItemCharacters: 512,
  continuityItemCount: 32,
  continuityItemCharacters: 4_096,
  currentSessionMessageCount: 24,
  messageCharacters: 8_192,
  appointmentTimezoneCharacters: 64,
  appointmentLocationCharacters: 256,
  appointmentChannelCharacters: 64,
  serializedUtf8Bytes: 524_288,
  compassPointCount: 24,
  compassLabelCharacters: 160,
  compassRouteEventCount: 5,
  compassWaypointCount: 20,
  compassWaypointCharacters: 1_000,
} as const);

// Chat step slice S3 (Paul's decision 4, decision queue 2026-11-03 12:38:07 CST, and
// his go-ahead at 20:50:45 CST): the saved Compass and Waypoint section. It is tied to
// its own contract version both ways: that version requires the section and every
// other version forbids it, so the older twelve-layer envelope keeps its exact bytes.
// The S5 migration 20261105010000_explorer_forming_compass_points.sql rebuilds the same
// section from the saved rows and compares it exactly before a Send is prepared.
export const EXPLORER_COMPASS_CONTEXT_VERSION = "explorer-compass-context.v2" as const;
export const EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION =
  "wi007-v0.1+onboarding-fields-v2+compass-v2" as const;
// The eight saved anchors (kept here so this module adds no import edge).
const COMPASS_ANCHORS = Object.freeze([
  "apex", "upper_left", "upper_right", "side_left", "side_right",
  "lower_left", "lower_center", "lower_right",
] as const);
// Only needle moves: Paul's go-ahead names "recent needle moves" (decision queue 2026-11-03
// 20:50:45 CST), so Priority changes, arrangement and category snapshots (and their
// before-labels) are never model context. Each event carries its point's current label.
export const EXPLORER_COMPASS_CONTEXT_ROUTE_KINDS = Object.freeze([
  "attention_changed",
] as const);

export const EXPLORER_SAFE_CONTEXT_ERROR_CODES = Object.freeze([
  "explorer_context_invalid_envelope",
  "explorer_context_unknown_key",
  "explorer_context_invalid_role_alignment",
  "explorer_context_missing_required_layer",
  "explorer_context_invalid_text",
  "explorer_context_text_limit_exceeded",
  "explorer_context_collection_limit_exceeded",
  "explorer_context_invalid_candidate_kind",
  "explorer_context_candidate_not_eligible",
  "explorer_context_invalid_order",
  "explorer_context_duplicate_source",
] as const);

export type ExplorerSafeContextErrorCode =
  (typeof EXPLORER_SAFE_CONTEXT_ERROR_CODES)[number];

export class ExplorerSafeContextValidationError extends Error {
  readonly code: ExplorerSafeContextErrorCode;

  constructor(code: ExplorerSafeContextErrorCode) {
    super(code);
    this.name = "ExplorerSafeContextValidationError";
    this.code = code;
  }
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

type VersionedText = {
  version: string;
  text: string;
};

type ExplorerBinding = {
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
};

type FocusItem = {
  id: string;
  order: number;
  text: string;
};

type NextAppointment = {
  startsAt: string;
  timezone: string;
  mode: "video" | "phone" | "in_person";
  status: "scheduled" | "confirmed";
  location: string | null;
  channel: string | null;
};

type SessionContext = {
  sessionType: "explorer_virtual_guide";
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
  explorerDisplayName: string | null;
  activeFocusItems: ReadonlyArray<FocusItem>;
  nextAppointment: NextAppointment | null;
  explorerSafeGuardrail: string | null;
};

export const EXPLORER_ONBOARDING_CONTINUITY_FIELDS = Object.freeze([
  "supportNow",
  "usefulOutcome",
  "supportStyle",
  "guideContext",
  "communicationPreference",
  "doNotEmphasize",
] as const);

type ExplorerOnboardingContinuityField =
  (typeof EXPLORER_ONBOARDING_CONTINUITY_FIELDS)[number];

type ReflectionCandidate = {
  kind: "reflection";
  sourceId: string;
  order: number;
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
  confirmationStatus: SolMindReflectionConfirmationStatus;
  visibility: SolMindReflectionVisibility;
  content: string;
};

type SummaryCandidate = {
  kind: "summary";
  sourceId: string;
  order: number;
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
  summaryType: SolMindSummaryType;
  summaryStatus: SolMindSummaryStatus;
  publicationStatus: SolMindSummaryPublicationStatus;
  relationshipStatus: SolMindGuideExplorerRelationshipStatus;
  revisionStatus: SolMindSummaryRevisionStatus;
  sectionType: SolMindSummarySectionType;
  sectionVisibility: SolMindSummarySectionVisibility;
  content: string;
};

type SharedSnapshotCandidate = {
  kind: "shared_snapshot";
  sourceId: string;
  order: number;
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
  confirmationStatus: "confirmed";
  content: string;
};

type OnboardingAnswerCandidate = {
  kind: "onboarding_answer";
  sourceId: string;
  order: number;
  explorerId: string;
  sessionId: string;
  continuityBindingId: string;
  field: ExplorerOnboardingContinuityField;
  content: string;
};

type ContinuityCandidate =
  | ReflectionCandidate
  | SummaryCandidate
  | SharedSnapshotCandidate
  | OnboardingAnswerCandidate;

type ApprovedContinuityItem = {
  sourceId: string;
  order: number;
  kind: ContinuityCandidate["kind"];
  field: ExplorerOnboardingContinuityField | null;
  content: string;
};

type CurrentSessionMessage = {
  messageId: string;
  order: number;
  explorerId: string;
  sessionId: string;
  role: "explorer" | "solmind_virtual_guide";
  content: string;
};

type ImmediateExplorerMessage = {
  messageId: string;
  explorerId: string;
  sessionId: string;
  role: "explorer";
  content: string;
};

type OutputRequirements = {
  format: "plain_text";
  includeCitations: boolean;
  allowMarkdown: boolean;
};

type CompassPoint = {
  id: string;
  label: string;
  order: number;
  formation: "saved" | "forming";
  anchor: (typeof COMPASS_ANCHORS)[number] | null;
  emphasis: 1 | 2 | 3 | null;
};

type CompassRouteEvent = {
  kind: (typeof EXPLORER_COMPASS_CONTEXT_ROUTE_KINDS)[number];
  pointId: string;
  label: string;
  // S4 pairs these keys. Historical S3 contexts keep their original bytes.
  actor?: "explorer" | "virtual_guide";
  awaitingReply?: boolean;
};

type CompassWaypoint = {
  id: string;
  title: string;
  destination: string;
  meaning: string;
  arrivalSignal: string;
  stage: "formed" | "reached" | "released";
  reachedEvidence: string | null;
};

export type ExplorerCompassContext = {
  version: typeof EXPLORER_COMPASS_CONTEXT_VERSION;
  points: ReadonlyArray<CompassPoint>;
  priorityId: string | null;
  attentionId: string | null;
  recentRoute: ReadonlyArray<CompassRouteEvent>;
  waypoints: ReadonlyArray<CompassWaypoint>;
  drafts: ReadonlyArray<never>;
};

export type ExplorerSafeContext = {
  contractVersion: string;
  aiRole: "solmind_virtual_guide";
  actorRoleContext: "explorer";
  globalPolicy: VersionedText;
  roleBehavior: VersionedText;
  crisisBehavior: VersionedText;
  methodologyContext: VersionedText;
  sessionContext: SessionContext;
  approvedContinuity: ReadonlyArray<ApprovedContinuityItem>;
  // Present exactly when contractVersion is EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION.
  compassContext?: ExplorerCompassContext;
  currentSessionMessages: ReadonlyArray<CurrentSessionMessage>;
  immediateExplorerMessage: ImmediateExplorerMessage;
  outputRequirements: OutputRequirements;
};

export type ExplorerSafeContextAssembly = DeepReadonly<{
  context: ExplorerSafeContext;
  serialized: string;
}>;

const TOP_LEVEL_KEYS = [
  "contractVersion",
  "aiRole",
  "actorRoleContext",
  "explorerBinding",
  "globalPolicy",
  "roleBehavior",
  "crisisBehavior",
  "methodologyContext",
  "sessionContext",
  "continuityCandidates",
  "currentSessionMessages",
  "immediateExplorerMessage",
  "outputRequirements",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROHIBITED_TEXT_PATTERN =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function fail(code: ExplorerSafeContextErrorCode): never {
  throw new ExplorerSafeContextValidationError(code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parsePlainObject(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail("explorer_context_invalid_envelope");
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      !Object.prototype.propertyIsEnumerable.call(value, key) ||
      !allowed.has(key)
    ) {
      fail("explorer_context_unknown_key");
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("explorer_context_missing_required_layer");
    }
  }
}

function parseText(value: unknown, maximum: number): string {
  if (typeof value !== "string") {
    fail("explorer_context_invalid_text");
  }
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0 || PROHIBITED_TEXT_PATTERN.test(normalized)) {
    fail("explorer_context_invalid_text");
  }
  if (normalized.length > maximum) {
    fail("explorer_context_text_limit_exceeded");
  }
  return normalized;
}

function parseNullableText(value: unknown, maximum: number): string | null {
  return value === null ? null : parseText(value, maximum);
}

function parseUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail("explorer_context_invalid_envelope");
  }
  return value;
}

function parseOrder(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail("explorer_context_invalid_order");
  }
  return value as number;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    fail("explorer_context_invalid_envelope");
  }
  return value;
}

function parseVersionedText(
  value: unknown,
  textMaximum: number,
): VersionedText {
  const object = parsePlainObject(value);
  assertExactKeys(object, ["version", "text"]);
  return {
    version: parseText(
      object.version,
      EXPLORER_SAFE_CONTEXT_LIMITS.versionLabelCharacters,
    ),
    text: parseText(object.text, textMaximum),
  };
}

function parseBinding(value: unknown): ExplorerBinding {
  const object = parsePlainObject(value);
  assertExactKeys(object, ["explorerId", "sessionId", "continuityBindingId"]);
  return {
    explorerId: parseUuid(object.explorerId),
    sessionId: parseUuid(object.sessionId),
    continuityBindingId: parseUuid(object.continuityBindingId),
  };
}

function assertBinding(
  explorerId: string,
  sessionId: string,
  binding: ExplorerBinding,
): void {
  if (
    explorerId !== binding.explorerId ||
    sessionId !== binding.sessionId
  ) {
    fail("explorer_context_invalid_role_alignment");
  }
}

function parseFocusItems(value: unknown): ReadonlyArray<FocusItem> {
  if (!Array.isArray(value)) {
    fail("explorer_context_invalid_envelope");
  }
  if (value.length > EXPLORER_SAFE_CONTEXT_LIMITS.focusItemCount) {
    fail("explorer_context_collection_limit_exceeded");
  }
  const parsed = value.map((candidate) => {
    const object = parsePlainObject(candidate);
    assertExactKeys(object, ["id", "order", "text"]);
    return {
      id: parseUuid(object.id),
      order: parseOrder(object.order),
      text: parseText(
        object.text,
        EXPLORER_SAFE_CONTEXT_LIMITS.focusItemCharacters,
      ),
    };
  });
  return orderUnique(parsed, "id");
}

function parseAppointment(value: unknown): NextAppointment | null {
  if (value === null) {
    return null;
  }
  const object = parsePlainObject(value);
  assertExactKeys(object, [
    "startsAt",
    "timezone",
    "mode",
    "status",
    "location",
    "channel",
  ]);
  const startsAt = parseText(
    object.startsAt,
    EXPLORER_SAFE_CONTEXT_LIMITS.versionLabelCharacters,
  );
  if (!ISO_TIMESTAMP_PATTERN.test(startsAt)) {
    fail("explorer_context_invalid_envelope");
  }
  if (!(["video", "phone", "in_person"] as const).includes(object.mode as never)) {
    fail("explorer_context_invalid_envelope");
  }
  if (!(["scheduled", "confirmed"] as const).includes(object.status as never)) {
    fail("explorer_context_invalid_envelope");
  }
  return {
    startsAt,
    timezone: parseText(
      object.timezone,
      EXPLORER_SAFE_CONTEXT_LIMITS.appointmentTimezoneCharacters,
    ),
    mode: object.mode as NextAppointment["mode"],
    status: object.status as NextAppointment["status"],
    location: parseNullableText(
      object.location,
      EXPLORER_SAFE_CONTEXT_LIMITS.appointmentLocationCharacters,
    ),
    channel: parseNullableText(
      object.channel,
      EXPLORER_SAFE_CONTEXT_LIMITS.appointmentChannelCharacters,
    ),
  };
}

function parseSessionContext(
  value: unknown,
  binding: ExplorerBinding,
): SessionContext {
  const object = parsePlainObject(value);
  assertExactKeys(object, [
    "sessionType",
    "explorerId",
    "sessionId",
    "continuityBindingId",
    "explorerDisplayName",
    "activeFocusItems",
    "nextAppointment",
    "explorerSafeGuardrail",
  ]);
  if (object.sessionType !== "explorer_virtual_guide") {
    fail("explorer_context_invalid_role_alignment");
  }
  const explorerId = parseUuid(object.explorerId);
  const sessionId = parseUuid(object.sessionId);
  assertBinding(explorerId, sessionId, binding);
  if (parseUuid(object.continuityBindingId) !== binding.continuityBindingId) {
    fail("explorer_context_invalid_role_alignment");
  }
  return {
    sessionType: "explorer_virtual_guide",
    explorerId,
    sessionId,
    continuityBindingId: binding.continuityBindingId,
    explorerDisplayName: parseNullableText(
      object.explorerDisplayName,
      EXPLORER_SAFE_CONTEXT_LIMITS.explorerDisplayNameCharacters,
    ),
    activeFocusItems: parseFocusItems(object.activeFocusItems),
    nextAppointment: parseAppointment(object.nextAppointment),
    explorerSafeGuardrail: parseNullableText(
      object.explorerSafeGuardrail,
      EXPLORER_SAFE_CONTEXT_LIMITS.explorerSafeGuardrailCharacters,
    ),
  };
}

function orderUnique<T extends { order: number }>(
  values: ReadonlyArray<T>,
  identityKey: keyof T,
): ReadonlyArray<T> {
  const identities = new Set<unknown>();
  const orders = new Set<number>();
  for (const value of values) {
    if (identities.has(value[identityKey])) {
      fail("explorer_context_duplicate_source");
    }
    if (orders.has(value.order)) {
      fail("explorer_context_invalid_order");
    }
    identities.add(value[identityKey]);
    orders.add(value.order);
  }
  const sorted = [...values].sort((left, right) => left.order - right.order);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].order !== index) {
      fail("explorer_context_invalid_order");
    }
  }
  return sorted;
}

function parseContinuityCandidates(
  value: unknown,
  binding: ExplorerBinding,
): ReadonlyArray<ApprovedContinuityItem> {
  if (!Array.isArray(value)) {
    fail("explorer_context_invalid_envelope");
  }
  if (value.length > EXPLORER_SAFE_CONTEXT_LIMITS.continuityItemCount) {
    fail("explorer_context_collection_limit_exceeded");
  }

  const approved: ApprovedContinuityItem[] = [];
  const allIdentities = new Set<string>();
  const onboardingFields = new Map<string, Set<ExplorerOnboardingContinuityField>>();
  const allOrders = new Set<number>();

  for (const candidate of value) {
    const object = parsePlainObject(candidate);
    if (typeof object.kind !== "string") {
      fail("explorer_context_invalid_candidate_kind");
    }
    const commonRequired = [
      "kind",
      "sourceId",
      "order",
      "explorerId",
      "sessionId",
      "continuityBindingId",
      "content",
    ];
    switch (object.kind) {
      case "reflection":
        assertExactKeys(object, [
          ...commonRequired,
          "confirmationStatus",
          "visibility",
        ]);
        break;
      case "summary":
        assertExactKeys(object, [
          ...commonRequired,
          "summaryType",
          "summaryStatus",
          "publicationStatus",
          "relationshipStatus",
          "revisionStatus",
          "sectionType",
          "sectionVisibility",
        ]);
        break;
      case "shared_snapshot":
        assertExactKeys(object, [...commonRequired, "confirmationStatus"]);
        break;
      case "onboarding_answer":
        assertExactKeys(object, [...commonRequired, "field"]);
        break;
      default:
        fail("explorer_context_invalid_candidate_kind");
    }
    const sourceId = parseUuid(object.sourceId);
    const order = parseOrder(object.order);
    const explorerId = parseUuid(object.explorerId);
    const sessionId = parseUuid(object.sessionId);
    assertBinding(explorerId, sessionId, binding);
    if (parseUuid(object.continuityBindingId) !== binding.continuityBindingId) {
      fail("explorer_context_invalid_role_alignment");
    }
    // Intake answers are fields of one real response-set row, not separate
    // source rows. Only this validated family may qualify identity by field.
    // A UUID may still never be reused across source families.
    if (object.kind === "onboarding_answer") {
      if (!EXPLORER_ONBOARDING_CONTINUITY_FIELDS.includes(object.field as ExplorerOnboardingContinuityField)) {
        fail("explorer_context_invalid_candidate_kind");
      }
      const fields = onboardingFields.get(sourceId);
      if ((allIdentities.has(sourceId) && !fields) || fields?.has(object.field as ExplorerOnboardingContinuityField)) {
        fail("explorer_context_duplicate_source");
      }
      const updated = fields ?? new Set<ExplorerOnboardingContinuityField>();
      updated.add(object.field as ExplorerOnboardingContinuityField);
      onboardingFields.set(sourceId, updated);
    } else if (allIdentities.has(sourceId)) {
      fail("explorer_context_duplicate_source");
    }
    if (allOrders.has(order)) {
      fail("explorer_context_invalid_order");
    }
    allIdentities.add(sourceId);
    allOrders.add(order);

    let eligible = true;
    let field: ExplorerOnboardingContinuityField | null = null;
    let textMaximum: number =
      EXPLORER_SAFE_CONTEXT_LIMITS.continuityItemCharacters;

    switch (object.kind) {
      case "reflection": {
        assertExactKeys(object, [
          ...commonRequired,
          "confirmationStatus",
          "visibility",
        ]);
        if (
          !(["proposed", "confirmed", "rejected", "superseded", "archived"] as const).includes(
            object.confirmationStatus as never,
          ) ||
          !(["explorer_and_guide", "paused_from_ai_context"] as const).includes(
            object.visibility as never,
          )
        ) {
          fail("explorer_context_invalid_candidate_kind");
        }
        eligible = isExplorerFacingContextItemAllowed({
          kind: "reflection",
          confirmationStatus:
            object.confirmationStatus as SolMindReflectionConfirmationStatus,
          visibility: object.visibility as SolMindReflectionVisibility,
        });
        break;
      }
      case "summary": {
        assertExactKeys(object, [
          ...commonRequired,
          "summaryType",
          "summaryStatus",
          "publicationStatus",
          "relationshipStatus",
          "revisionStatus",
          "sectionType",
          "sectionVisibility",
        ]);
        if (
          !SOLMIND_SUMMARY_TYPES.includes(object.summaryType as never) ||
          !SOLMIND_SUMMARY_STATUSES.includes(object.summaryStatus as never) ||
          !SOLMIND_SUMMARY_PUBLICATION_STATUSES.includes(
            object.publicationStatus as never,
          ) ||
          !SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES.includes(
            object.relationshipStatus as never,
          ) ||
          !SOLMIND_SUMMARY_REVISION_STATUSES.includes(
            object.revisionStatus as never,
          ) ||
          !SOLMIND_SUMMARY_SECTION_TYPES.includes(
            object.sectionType as never,
          ) ||
          !SOLMIND_SUMMARY_SECTION_VISIBILITIES.includes(
            object.sectionVisibility as never,
          )
        ) {
          fail("explorer_context_invalid_candidate_kind");
        }
        eligible = isExplorerFacingContextItemAllowed({
          kind: "summary",
          summaryType: object.summaryType as SolMindSummaryType,
          summaryStatus: object.summaryStatus as SolMindSummaryStatus,
          publicationStatus:
            object.publicationStatus as SolMindSummaryPublicationStatus,
          relationshipStatus:
            object.relationshipStatus as SolMindGuideExplorerRelationshipStatus,
          revisionStatus:
            object.revisionStatus as SolMindSummaryRevisionStatus,
          sectionType: object.sectionType as SolMindSummarySectionType,
          sectionVisibility:
            object.sectionVisibility as SolMindSummarySectionVisibility,
        });
        break;
      }
      case "shared_snapshot":
        assertExactKeys(object, [...commonRequired, "confirmationStatus"]);
        if (object.confirmationStatus !== "confirmed") {
          fail("explorer_context_candidate_not_eligible");
        }
        break;
      case "onboarding_answer":
        assertExactKeys(object, [...commonRequired, "field"]);
        if (
          !EXPLORER_ONBOARDING_CONTINUITY_FIELDS.includes(
            object.field as ExplorerOnboardingContinuityField,
          )
        ) {
          fail("explorer_context_invalid_candidate_kind");
        }
        field = object.field as ExplorerOnboardingContinuityField;
        textMaximum = EXPLORER_SAFE_CONTEXT_LIMITS.onboardingAnswerCharacters;
        break;
      default:
        fail("explorer_context_invalid_candidate_kind");
    }

    if (!eligible) {
      continue;
    }
    const content = parseText(object.content, textMaximum);
    approved.push({
      sourceId,
      order,
      kind: object.kind as ApprovedContinuityItem["kind"],
      field,
      content,
    });
  }

  const orderedAll = [...allOrders].sort((left, right) => left - right);
  for (let index = 0; index < orderedAll.length; index += 1) {
    if (orderedAll[index] !== index) {
      fail("explorer_context_invalid_order");
    }
  }
  return approved.sort((left, right) => left.order - right.order);
}

function parseCurrentSessionMessages(
  value: unknown,
  binding: ExplorerBinding,
): ReadonlyArray<CurrentSessionMessage> {
  if (!Array.isArray(value)) {
    fail("explorer_context_invalid_envelope");
  }
  if (value.length > EXPLORER_SAFE_CONTEXT_LIMITS.currentSessionMessageCount) {
    fail("explorer_context_collection_limit_exceeded");
  }
  const parsed = value.map((candidate) => {
    const object = parsePlainObject(candidate);
    assertExactKeys(object, [
      "messageId",
      "order",
      "explorerId",
      "sessionId",
      "role",
      "content",
    ]);
    const explorerId = parseUuid(object.explorerId);
    const sessionId = parseUuid(object.sessionId);
    assertBinding(explorerId, sessionId, binding);
    if (
      object.role !== "explorer" &&
      object.role !== SOLMIND_AI_ROLES.VIRTUAL_GUIDE
    ) {
      fail("explorer_context_invalid_role_alignment");
    }
    return {
      messageId: parseUuid(object.messageId),
      order: parseOrder(object.order),
      explorerId,
      sessionId,
      role: object.role as CurrentSessionMessage["role"],
      content: parseText(
        object.content,
        EXPLORER_SAFE_CONTEXT_LIMITS.messageCharacters,
      ),
    };
  });
  return orderUnique(parsed, "messageId");
}

function parseImmediateMessage(
  value: unknown,
  binding: ExplorerBinding,
  currentMessages: ReadonlyArray<CurrentSessionMessage>,
): ImmediateExplorerMessage {
  const object = parsePlainObject(value);
  assertExactKeys(object, [
    "messageId",
    "explorerId",
    "sessionId",
    "role",
    "content",
  ]);
  const explorerId = parseUuid(object.explorerId);
  const sessionId = parseUuid(object.sessionId);
  assertBinding(explorerId, sessionId, binding);
  if (object.role !== "explorer") {
    fail("explorer_context_invalid_role_alignment");
  }
  const messageId = parseUuid(object.messageId);
  if (currentMessages.some((message) => message.messageId === messageId)) {
    fail("explorer_context_duplicate_source");
  }
  return {
    messageId,
    explorerId,
    sessionId,
    role: "explorer",
    content: parseText(
      object.content,
      EXPLORER_SAFE_CONTEXT_LIMITS.messageCharacters,
    ),
  };
}

function parseOutputRequirements(value: unknown): OutputRequirements {
  const object = parsePlainObject(value);
  assertExactKeys(object, ["format", "includeCitations", "allowMarkdown"]);
  if (object.format !== "plain_text") {
    fail("explorer_context_invalid_envelope");
  }
  return {
    format: "plain_text",
    includeCitations: parseBoolean(object.includeCitations),
    allowMarkdown: parseBoolean(object.allowMarkdown),
  };
}

function parseNullablePointId(value: unknown, pointIds: ReadonlySet<string>): string | null {
  if (value === null) {
    return null;
  }
  const id = parseUuid(value);
  if (!pointIds.has(id)) {
    fail("explorer_context_invalid_envelope");
  }
  return id;
}

function parseCompassContext(value: unknown): ExplorerCompassContext {
  const object = parsePlainObject(value);
  assertExactKeys(object, [
    "version",
    "points",
    "priorityId",
    "attentionId",
    "recentRoute",
    "waypoints",
    "drafts",
  ]);
  if (object.version !== EXPLORER_COMPASS_CONTEXT_VERSION) {
    fail("explorer_context_invalid_envelope");
  }
  if (
    !Array.isArray(object.points) ||
    !Array.isArray(object.recentRoute) ||
    !Array.isArray(object.waypoints) ||
    !Array.isArray(object.drafts)
  ) {
    fail("explorer_context_invalid_envelope");
  }
  if (
    object.points.length > EXPLORER_SAFE_CONTEXT_LIMITS.compassPointCount ||
    object.recentRoute.length > EXPLORER_SAFE_CONTEXT_LIMITS.compassRouteEventCount ||
    object.waypoints.length > EXPLORER_SAFE_CONTEXT_LIMITS.compassWaypointCount
  ) {
    fail("explorer_context_collection_limit_exceeded");
  }
  // Reserved for a later slice; nothing may be supplied yet.
  if (object.drafts.length !== 0) {
    fail("explorer_context_invalid_envelope");
  }
  const anchors = new Set<string>();
  const points = orderUnique(
    object.points.map((candidate): CompassPoint => {
      const point = parsePlainObject(candidate);
      assertExactKeys(point, ["id", "label", "order", "formation", "anchor", "emphasis"]);
      if (
        (point.formation !== "saved" && point.formation !== "forming") ||
        (point.formation === "forming" && (point.anchor !== null || point.emphasis !== null)) ||
        !(point.anchor === null || COMPASS_ANCHORS.includes(point.anchor as never)) ||
        !(point.emphasis === null || point.emphasis === 1 || point.emphasis === 2 || point.emphasis === 3) ||
        (point.anchor !== null && point.emphasis === null)
      ) {
        fail("explorer_context_invalid_envelope");
      }
      if (point.anchor !== null) {
        if (anchors.has(point.anchor as string)) {
          fail("explorer_context_invalid_envelope");
        }
        anchors.add(point.anchor as string);
      }
      return {
        id: parseUuid(point.id),
        label: parseText(point.label, EXPLORER_SAFE_CONTEXT_LIMITS.compassLabelCharacters),
        order: parseOrder(point.order),
        formation: point.formation,
        anchor: point.anchor as CompassPoint["anchor"],
        emphasis: point.emphasis as CompassPoint["emphasis"],
      };
    }),
    "id",
  );
  const pointIds = new Set(points.map((point) => point.id));
  const priorityId = parseNullablePointId(object.priorityId, pointIds);
  if (points.find(point => point.id === priorityId)?.formation === "forming") fail("explorer_context_invalid_envelope");
  const attentionId = parseNullablePointId(object.attentionId, pointIds);
  const routeCount = object.recentRoute.length;
  const recentRoute = object.recentRoute.map((candidate, index): CompassRouteEvent => {
    const event = parsePlainObject(candidate);
    const hasActor = Object.prototype.hasOwnProperty.call(event, "actor");
    const hasAwaitingReply = Object.prototype.hasOwnProperty.call(event, "awaitingReply");
    assertExactKeys(event, ["kind", "pointId", "label"], ["actor", "awaitingReply"]);
    if (!EXPLORER_COMPASS_CONTEXT_ROUTE_KINDS.includes(event.kind as never)) {
      fail("explorer_context_invalid_envelope");
    }
    if (hasActor !== hasAwaitingReply || (hasActor &&
        (!["explorer", "virtual_guide"].includes(event.actor as string) || typeof event.awaitingReply !== "boolean" ||
          (event.awaitingReply && (event.actor !== "explorer" || index !== routeCount - 1))))) {
      fail("explorer_context_invalid_envelope");
    }
    const pointId = parseNullablePointId(event.pointId, pointIds);
    const point = points.find(point => point.id === pointId);
    const label = parseText(event.label, EXPLORER_SAFE_CONTEXT_LIMITS.compassLabelCharacters);
    // A forming point enters recentRoute only as the next-reply acknowledgment,
    // rebuilt from the latest Explorer move and current wording, never saved history.
    if (pointId === null || (point?.formation === "forming" &&
        (event.actor !== "explorer" || event.awaitingReply !== true || index !== routeCount - 1 ||
          pointId !== attentionId || label !== point.label))) {
      fail("explorer_context_invalid_envelope");
    }
    return {
      kind: event.kind as CompassRouteEvent["kind"],
      pointId,
      label,
      ...(hasActor ? { actor: event.actor as "explorer" | "virtual_guide", awaitingReply: event.awaitingReply as boolean } : {}),
    };
  });
  const waypointIds = new Set<string>();
  const waypoints = object.waypoints.map((candidate): CompassWaypoint => {
    const waypoint = parsePlainObject(candidate);
    assertExactKeys(waypoint, [
      "id",
      "title",
      "destination",
      "meaning",
      "arrivalSignal",
      "stage",
      "reachedEvidence",
    ]);
    const id = parseUuid(waypoint.id);
    if (waypointIds.has(id) || pointIds.has(id)) {
      fail("explorer_context_duplicate_source");
    }
    waypointIds.add(id);
    if (!(["formed", "reached", "released"] as const).includes(waypoint.stage as never)) {
      fail("explorer_context_invalid_envelope");
    }
    const stage = waypoint.stage as CompassWaypoint["stage"];
    if (stage !== "reached" && waypoint.reachedEvidence !== null) {
      fail("explorer_context_invalid_envelope");
    }
    const maximum = EXPLORER_SAFE_CONTEXT_LIMITS.compassWaypointCharacters;
    return {
      id,
      title: parseText(waypoint.title, maximum),
      destination: parseText(waypoint.destination, maximum),
      meaning: parseText(waypoint.meaning, maximum),
      arrivalSignal: parseText(waypoint.arrivalSignal, maximum),
      stage,
      reachedEvidence: stage === "reached" ? parseText(waypoint.reachedEvidence, maximum) : null,
    };
  });
  return {
    version: EXPLORER_COMPASS_CONTEXT_VERSION,
    points,
    priorityId,
    attentionId,
    recentRoute,
    waypoints,
    drafts: [],
  };
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function assembleExplorerSafeContext(
  input: unknown,
): ExplorerSafeContextAssembly {
  const envelope = parsePlainObject(input);
  assertExactKeys(envelope, TOP_LEVEL_KEYS, ["compassContext"]);

  if (
    envelope.aiRole !== SOLMIND_AI_ROLES.VIRTUAL_GUIDE ||
    envelope.actorRoleContext !== "explorer" ||
    !isAiRoleAllowedInContext(
      envelope.aiRole as string,
      envelope.actorRoleContext as string,
    )
  ) {
    fail("explorer_context_invalid_role_alignment");
  }

  const contractVersion = parseText(
    envelope.contractVersion,
    EXPLORER_SAFE_CONTEXT_LIMITS.versionLabelCharacters,
  );
  const hasCompassContext = Object.prototype.hasOwnProperty.call(envelope, "compassContext");
  if (hasCompassContext !== (contractVersion === EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION)) {
    fail("explorer_context_invalid_envelope");
  }
  const binding = parseBinding(envelope.explorerBinding);
  const globalPolicy = parseVersionedText(
    envelope.globalPolicy,
    EXPLORER_SAFE_CONTEXT_LIMITS.policyTextCharacters,
  );
  const roleBehavior = parseVersionedText(
    envelope.roleBehavior,
    EXPLORER_SAFE_CONTEXT_LIMITS.policyTextCharacters,
  );
  const crisisBehavior = parseVersionedText(
    envelope.crisisBehavior,
    EXPLORER_SAFE_CONTEXT_LIMITS.policyTextCharacters,
  );
  const methodologyContext = parseVersionedText(
    envelope.methodologyContext,
    EXPLORER_SAFE_CONTEXT_LIMITS.methodologyTextCharacters,
  );
  const sessionContext = parseSessionContext(envelope.sessionContext, binding);
  const approvedContinuity = parseContinuityCandidates(
    envelope.continuityCandidates,
    binding,
  );
  const compassContext = hasCompassContext
    ? parseCompassContext(envelope.compassContext)
    : undefined;
  const currentSessionMessages = parseCurrentSessionMessages(
    envelope.currentSessionMessages,
    binding,
  );
  const immediateExplorerMessage = parseImmediateMessage(
    envelope.immediateExplorerMessage,
    binding,
    currentSessionMessages,
  );
  const outputRequirements = parseOutputRequirements(envelope.outputRequirements);

  const context: ExplorerSafeContext = {
    contractVersion,
    aiRole: SOLMIND_AI_ROLES.VIRTUAL_GUIDE,
    actorRoleContext: "explorer",
    globalPolicy,
    roleBehavior,
    crisisBehavior,
    methodologyContext,
    sessionContext,
    approvedContinuity,
    // Serialized after approvedContinuity, before the history, only when supplied.
    ...(compassContext === undefined ? {} : { compassContext }),
    currentSessionMessages,
    immediateExplorerMessage,
    outputRequirements,
  };
  deepFreeze(context);
  const serialized = JSON.stringify(context);
  if (
    new TextEncoder().encode(serialized).byteLength >
    EXPLORER_SAFE_CONTEXT_LIMITS.serializedUtf8Bytes
  ) {
    fail("explorer_context_collection_limit_exceeded");
  }
  return deepFreeze({ context, serialized });
}
