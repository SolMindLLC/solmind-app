import "server-only";

import { createHash } from "node:crypto";

import {
  ExplorerSafeContextValidationError,
  assembleExplorerSafeContext,
} from "@/lib/solmind/context/explorerSafeContext";
import {
  VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
  parseVirtualGuideConversationRequest,
  type VirtualGuideConversationRequest,
} from "@/lib/solmind/virtual-guide/virtualGuideConversationContract";

export const AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION =
  "authorized-virtual-guide-context.v1" as const;

export const AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_LIMITS = Object.freeze({
  authorizationVersionCharacters: 128,
  requiredConsentDocumentCount: 16,
} as const);

export const AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_ERROR_CODES = Object.freeze([
  "authorized_virtual_guide_context_invalid_request",
  "authorized_virtual_guide_context_unknown_key",
  "authorized_virtual_guide_context_invalid_source",
  "authorized_virtual_guide_context_authorization_denied",
  "authorized_virtual_guide_context_consent_denied",
  "authorized_virtual_guide_context_relationship_denied",
  "authorized_virtual_guide_context_invalid_context",
  "authorized_virtual_guide_context_stale_authorization",
  "authorized_virtual_guide_context_cancelled",
  "authorized_virtual_guide_context_source_failed",
] as const);

export type AuthorizedVirtualGuideContextErrorCode =
  (typeof AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_ERROR_CODES)[number];

export class AuthorizedVirtualGuideContextError extends Error {
  readonly code: AuthorizedVirtualGuideContextErrorCode;

  constructor(code: AuthorizedVirtualGuideContextErrorCode) {
    super(code);
    this.name = "AuthorizedVirtualGuideContextError";
    this.code = code;
  }
}

export type AuthorizedVirtualGuideContextLookup = Readonly<{
  explorerId: string;
  sessionId: string;
}>;

export type AuthorizedVirtualGuideContextProof = Readonly<{
  authorizationVersion: string;
  actorAccountId: string;
  explorerId: string;
  sessionId: string;
  relationshipId: string;
  activeRequiredConsentDocumentIds: ReadonlyArray<string>;
}>;

export type AuthorizedVirtualGuideContextSource = Readonly<{
  loadAuthorizationSnapshot: (
    lookup: AuthorizedVirtualGuideContextLookup,
    signal: AbortSignal | undefined,
  ) => Promise<unknown>;
  revalidateAuthorization: (
    proof: AuthorizedVirtualGuideContextProof,
    signal: AbortSignal | undefined,
  ) => Promise<unknown>;
}>;

export type AuthorizedVirtualGuideContext = Readonly<{
  conversationRequest: VirtualGuideConversationRequest;
  authorizationProof: AuthorizedVirtualGuideContextProof;
}>;

type Request = {
  contractVersion: typeof AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION;
  invocationId: string;
  requestedExplorerId: string;
  requestedSessionId: string;
  contextSnapshotId: string;
};

type AuthorizationSnapshot = {
  authorizationVersion: string;
  actor: { accountId: string; roleContext: "explorer" };
  explorer: {
    explorerId: string;
    accountId: string;
    onboardingStatus: "active";
    adultAffirmation: true;
  };
  relationship: {
    relationshipId: string;
    explorerId: string;
    status: "active" | "paused";
  };
  activeRequiredConsentDocumentIds: ReadonlyArray<string>;
  acceptedRequiredConsentDocumentIds: ReadonlyArray<string>;
  contextInput: unknown;
};

const REQUEST_KEYS = [
  "contractVersion",
  "invocationId",
  "requestedExplorerId",
  "requestedSessionId",
  "contextSnapshotId",
] as const;
const SNAPSHOT_KEYS = [
  "authorizationVersion",
  "actor",
  "explorer",
  "relationship",
  "activeRequiredConsentDocumentIds",
  "acceptedRequiredConsentDocumentIds",
  "contextInput",
] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROHIBITED_TEXT_PATTERN =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

function fail(code: AuthorizedVirtualGuideContextErrorCode): never {
  throw new AuthorizedVirtualGuideContextError(code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parsePlainObject(
  value: unknown,
  code:
    | "authorized_virtual_guide_context_invalid_request"
    | "authorized_virtual_guide_context_invalid_source",
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(code);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: ReadonlyArray<string>,
  code:
    | "authorized_virtual_guide_context_invalid_request"
    | "authorized_virtual_guide_context_invalid_source",
): void {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length) {
    fail(
      code === "authorized_virtual_guide_context_invalid_request"
        ? "authorized_virtual_guide_context_unknown_key"
        : code,
    );
  }
  for (const key of ownKeys) {
    if (
      typeof key !== "string" ||
      !keys.includes(key) ||
      !Object.prototype.propertyIsEnumerable.call(value, key)
    ) {
      fail(
        code === "authorized_virtual_guide_context_invalid_request"
          ? "authorized_virtual_guide_context_unknown_key"
          : code,
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      fail(code);
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(code);
    }
  }
}

function parseUuid(
  value: unknown,
  code: AuthorizedVirtualGuideContextErrorCode,
): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail(code);
  }
  return value;
}

function parseAuthorizationVersion(value: unknown): string {
  if (typeof value !== "string") {
    fail("authorized_virtual_guide_context_invalid_source");
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length >
      AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_LIMITS.authorizationVersionCharacters ||
    PROHIBITED_TEXT_PATTERN.test(normalized)
  ) {
    fail("authorized_virtual_guide_context_invalid_source");
  }
  return normalized;
}

function parseUuidSet(value: unknown): ReadonlyArray<string> {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length >
      AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_LIMITS.requiredConsentDocumentCount
  ) {
    fail("authorized_virtual_guide_context_consent_denied");
  }
  const expectedKeys = new Set([
    "length",
    ...Array.from({ length: value.length }, (_unused, index) => String(index)),
  ]);
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    fail("authorized_virtual_guide_context_consent_denied");
  }
  const parsed = Array.from({ length: value.length }, (_unused, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      fail("authorized_virtual_guide_context_consent_denied");
    }
    return parseUuid(
      descriptor.value,
      "authorized_virtual_guide_context_consent_denied",
    );
  });
  const unique = new Set(parsed);
  if (unique.size !== parsed.length) {
    fail("authorized_virtual_guide_context_consent_denied");
  }
  return Object.freeze([...parsed].sort());
}

function parseRequest(value: unknown): Request {
  const request = parsePlainObject(
    value,
    "authorized_virtual_guide_context_invalid_request",
  );
  assertExactKeys(
    request,
    REQUEST_KEYS,
    "authorized_virtual_guide_context_invalid_request",
  );
  if (
    request.contractVersion !==
    AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION
  ) {
    fail("authorized_virtual_guide_context_invalid_request");
  }
  return {
    contractVersion: AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION,
    invocationId: parseUuid(
      request.invocationId,
      "authorized_virtual_guide_context_invalid_request",
    ),
    requestedExplorerId: parseUuid(
      request.requestedExplorerId,
      "authorized_virtual_guide_context_invalid_request",
    ),
    requestedSessionId: parseUuid(
      request.requestedSessionId,
      "authorized_virtual_guide_context_invalid_request",
    ),
    contextSnapshotId: parseUuid(
      request.contextSnapshotId,
      "authorized_virtual_guide_context_invalid_request",
    ),
  };
}

function parseAuthorizationSnapshot(value: unknown): AuthorizationSnapshot {
  const snapshot = parsePlainObject(
    value,
    "authorized_virtual_guide_context_invalid_source",
  );
  assertExactKeys(
    snapshot,
    SNAPSHOT_KEYS,
    "authorized_virtual_guide_context_invalid_source",
  );

  const actor = parsePlainObject(
    snapshot.actor,
    "authorized_virtual_guide_context_invalid_source",
  );
  assertExactKeys(
    actor,
    ["accountId", "roleContext"],
    "authorized_virtual_guide_context_invalid_source",
  );
  if (actor.roleContext !== "explorer") {
    fail("authorized_virtual_guide_context_authorization_denied");
  }

  const explorer = parsePlainObject(
    snapshot.explorer,
    "authorized_virtual_guide_context_invalid_source",
  );
  assertExactKeys(
    explorer,
    ["explorerId", "accountId", "onboardingStatus", "adultAffirmation"],
    "authorized_virtual_guide_context_invalid_source",
  );
  if (
    explorer.onboardingStatus !== "active" ||
    explorer.adultAffirmation !== true
  ) {
    fail("authorized_virtual_guide_context_authorization_denied");
  }

  const relationship = parsePlainObject(
    snapshot.relationship,
    "authorized_virtual_guide_context_invalid_source",
  );
  assertExactKeys(
    relationship,
    ["relationshipId", "explorerId", "status"],
    "authorized_virtual_guide_context_invalid_source",
  );
  if (relationship.status !== "active" && relationship.status !== "paused") {
    fail("authorized_virtual_guide_context_relationship_denied");
  }

  return {
    authorizationVersion: parseAuthorizationVersion(
      snapshot.authorizationVersion,
    ),
    actor: {
      accountId: parseUuid(
        actor.accountId,
        "authorized_virtual_guide_context_authorization_denied",
      ),
      roleContext: "explorer",
    },
    explorer: {
      explorerId: parseUuid(
        explorer.explorerId,
        "authorized_virtual_guide_context_authorization_denied",
      ),
      accountId: parseUuid(
        explorer.accountId,
        "authorized_virtual_guide_context_authorization_denied",
      ),
      onboardingStatus: "active",
      adultAffirmation: true,
    },
    relationship: {
      relationshipId: parseUuid(
        relationship.relationshipId,
        "authorized_virtual_guide_context_relationship_denied",
      ),
      explorerId: parseUuid(
        relationship.explorerId,
        "authorized_virtual_guide_context_relationship_denied",
      ),
      status: relationship.status,
    },
    activeRequiredConsentDocumentIds: parseUuidSet(
      snapshot.activeRequiredConsentDocumentIds,
    ),
    acceptedRequiredConsentDocumentIds: parseUuidSet(
      snapshot.acceptedRequiredConsentDocumentIds,
    ),
    contextInput: snapshot.contextInput,
  };
}

function parseSource(value: unknown): AuthorizedVirtualGuideContextSource {
  if (!isPlainObject(value)) {
    fail("authorized_virtual_guide_context_invalid_source");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("loadAuthorizationSnapshot") ||
    !keys.includes("revalidateAuthorization")
  ) {
    fail("authorized_virtual_guide_context_invalid_source");
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      typeof descriptor.value !== "function" ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      fail("authorized_virtual_guide_context_invalid_source");
    }
  }
  const loadDescriptor = Object.getOwnPropertyDescriptor(
    value,
    "loadAuthorizationSnapshot",
  );
  const revalidateDescriptor = Object.getOwnPropertyDescriptor(
    value,
    "revalidateAuthorization",
  );
  return Object.freeze({
    loadAuthorizationSnapshot:
      loadDescriptor?.value as AuthorizedVirtualGuideContextSource["loadAuthorizationSnapshot"],
    revalidateAuthorization:
      revalidateDescriptor?.value as AuthorizedVirtualGuideContextSource["revalidateAuthorization"],
  });
}

function consentSetsMatch(
  active: ReadonlyArray<string>,
  accepted: ReadonlyArray<string>,
): boolean {
  return (
    active.length === accepted.length &&
    active.every((id, index) => id === accepted[index])
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function assertNotCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    fail("authorized_virtual_guide_context_cancelled");
  }
}

export async function composeAuthorizedVirtualGuideContext(input: {
  request: unknown;
  source: AuthorizedVirtualGuideContextSource;
  signal?: AbortSignal;
}): Promise<AuthorizedVirtualGuideContext> {
  const request = parseRequest(input.request);
  const source = parseSource(input.source);
  const lookup = Object.freeze({
    explorerId: request.requestedExplorerId,
    sessionId: request.requestedSessionId,
  });

  assertNotCancelled(input.signal);
  let rawSnapshot: unknown;
  try {
    rawSnapshot = await source.loadAuthorizationSnapshot(lookup, input.signal);
  } catch (error) {
    if (error instanceof AuthorizedVirtualGuideContextError) {
      throw error;
    }
    assertNotCancelled(input.signal);
    fail("authorized_virtual_guide_context_source_failed");
  }
  assertNotCancelled(input.signal);

  const snapshot = parseAuthorizationSnapshot(rawSnapshot);
  if (
    snapshot.actor.accountId !== snapshot.explorer.accountId ||
    snapshot.explorer.explorerId !== request.requestedExplorerId
  ) {
    fail("authorized_virtual_guide_context_authorization_denied");
  }
  if (
    snapshot.relationship.explorerId !== request.requestedExplorerId
  ) {
    fail("authorized_virtual_guide_context_relationship_denied");
  }
  if (
    !consentSetsMatch(
      snapshot.activeRequiredConsentDocumentIds,
      snapshot.acceptedRequiredConsentDocumentIds,
    )
  ) {
    fail("authorized_virtual_guide_context_consent_denied");
  }

  let assembly: ReturnType<typeof assembleExplorerSafeContext>;
  try {
    assembly = assembleExplorerSafeContext(snapshot.contextInput);
  } catch (error) {
    if (error instanceof ExplorerSafeContextValidationError) {
      fail("authorized_virtual_guide_context_invalid_context");
    }
    fail("authorized_virtual_guide_context_source_failed");
  }
  if (
    assembly.context.sessionContext.explorerId !==
      request.requestedExplorerId ||
    assembly.context.sessionContext.sessionId !== request.requestedSessionId
  ) {
    fail("authorized_virtual_guide_context_invalid_context");
  }

  const fingerprint = createHash("sha256")
    .update(assembly.serialized, "utf8")
    .digest("hex")
    .toUpperCase();
  const proof = deepFreeze({
    authorizationVersion: snapshot.authorizationVersion,
    actorAccountId: snapshot.actor.accountId,
    explorerId: request.requestedExplorerId,
    sessionId: request.requestedSessionId,
    relationshipId: snapshot.relationship.relationshipId,
    activeRequiredConsentDocumentIds:
      snapshot.activeRequiredConsentDocumentIds,
  });

  assertNotCancelled(input.signal);
  let revalidation: unknown;
  try {
    revalidation = await source.revalidateAuthorization(proof, input.signal);
  } catch (error) {
    if (error instanceof AuthorizedVirtualGuideContextError) {
      throw error;
    }
    assertNotCancelled(input.signal);
    fail("authorized_virtual_guide_context_source_failed");
  }
  assertNotCancelled(input.signal);
  const confirmation = parsePlainObject(
    revalidation,
    "authorized_virtual_guide_context_invalid_source",
  );
  assertExactKeys(
    confirmation,
    ["authorizationVersion", "status"],
    "authorized_virtual_guide_context_invalid_source",
  );
  if (
    confirmation.status !== "current" ||
    confirmation.authorizationVersion !== snapshot.authorizationVersion
  ) {
    fail("authorized_virtual_guide_context_stale_authorization");
  }

  const conversationRequest = parseVirtualGuideConversationRequest({
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: request.invocationId,
    explorerId: request.requestedExplorerId,
    sessionId: request.requestedSessionId,
    contextSnapshotId: request.contextSnapshotId,
    contextFingerprint: fingerprint,
    authorizedContext: assembly.serialized,
  });

  return deepFreeze({
    conversationRequest,
    authorizationProof: proof,
  });
}
