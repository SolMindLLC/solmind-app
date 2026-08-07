import "server-only";

import {
  SOLMIND_AI_ROLES,
  isAiRoleAllowedInContext,
} from "./aiRoleContext";
import {
  isExplorerFacingContextItemAllowed,
  type SolMindReflectionConfirmationStatus,
  type SolMindReflectionVisibility,
  type SolMindSummaryStatus,
  type SolMindSummaryType,
  type SolMindSummaryVisibility,
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
} as const);

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
  "current_challenges",
  "desired_changes",
  "what_has_helped",
  "what_has_not_helped",
  "preferences",
  "anything_else",
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
  visibility: SolMindSummaryVisibility;
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
          "visibility",
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
    if (allIdentities.has(sourceId)) {
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
          "visibility",
        ]);
        if (
          !(["guide_prep", "check_in", "reflection", "session", "safety", "trigger_pattern", "general"] as const).includes(
            object.summaryType as never,
          ) ||
          !(["draft", "ready_for_review", "approved", "rejected", "archived"] as const).includes(
            object.summaryStatus as never,
          ) ||
          !(["guide_only", "admin_qa", "explorer_visible_after_approval"] as const).includes(
            object.visibility as never,
          )
        ) {
          fail("explorer_context_invalid_candidate_kind");
        }
        eligible = isExplorerFacingContextItemAllowed({
          kind: "summary",
          summaryType: object.summaryType as SolMindSummaryType,
          summaryStatus: object.summaryStatus as SolMindSummaryStatus,
          visibility: object.visibility as SolMindSummaryVisibility,
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
  assertExactKeys(envelope, TOP_LEVEL_KEYS);

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
