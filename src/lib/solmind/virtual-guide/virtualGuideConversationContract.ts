import "server-only";

export const VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION =
  "virtual-guide-conversation.v1" as const;

export const VIRTUAL_GUIDE_CONVERSATION_LIMITS = Object.freeze({
  authorizedContextUtf8Bytes: 524_288,
  assistantMessageCharacters: 8_192,
  minimumTimeoutMilliseconds: 10,
  maximumTimeoutMilliseconds: 60_000,
} as const);

export const VIRTUAL_GUIDE_CONVERSATION_ERROR_CODES = Object.freeze([
  "virtual_guide_conversation_invalid_request",
  "virtual_guide_conversation_unknown_key",
  "virtual_guide_conversation_invalid_binding",
  "virtual_guide_conversation_invalid_text",
  "virtual_guide_conversation_limit_exceeded",
  "virtual_guide_conversation_invalid_transport",
  "virtual_guide_conversation_cancelled",
  "virtual_guide_conversation_timed_out",
  "virtual_guide_conversation_transport_failed",
  "virtual_guide_conversation_invalid_response",
] as const);

export type VirtualGuideConversationErrorCode =
  (typeof VIRTUAL_GUIDE_CONVERSATION_ERROR_CODES)[number];

export class VirtualGuideConversationError extends Error {
  readonly code: VirtualGuideConversationErrorCode;

  constructor(code: VirtualGuideConversationErrorCode) {
    super(code);
    this.name = "VirtualGuideConversationError";
    this.code = code;
  }
}

export type VirtualGuideConversationRequest = Readonly<{
  contractVersion: typeof VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION;
  invocationId: string;
  explorerId: string;
  sessionId: string;
  contextSnapshotId: string;
  contextFingerprint: string;
  authorizedContext: string;
}>;

export type VirtualGuideConversationResponse = Readonly<{
  contractVersion: typeof VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION;
  invocationId: string;
  assistantMessage: Readonly<{
    messageId: string;
    role: "solmind_virtual_guide";
    content: string;
  }>;
  finishReason: "completed" | "refused" | "safety_redirect";
}>;

export type VirtualGuideConversationTransport = Readonly<{
  generate: (
    request: VirtualGuideConversationRequest,
    signal: AbortSignal,
  ) => Promise<unknown>;
}>;

const REQUEST_KEYS = [
  "contractVersion",
  "invocationId",
  "explorerId",
  "sessionId",
  "contextSnapshotId",
  "contextFingerprint",
  "authorizedContext",
] as const;

const RESPONSE_KEYS = [
  "contractVersion",
  "invocationId",
  "assistantMessage",
  "finishReason",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const PROHIBITED_TEXT_PATTERN =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const ABORT_SENTINEL = Object.freeze({ kind: "virtual_guide_abort" });

function fail(code: VirtualGuideConversationErrorCode): never {
  throw new VirtualGuideConversationError(code);
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
    | "virtual_guide_conversation_invalid_request"
    | "virtual_guide_conversation_invalid_response",
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(code);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: ReadonlyArray<string>,
  invalidCode:
    | "virtual_guide_conversation_invalid_request"
    | "virtual_guide_conversation_invalid_response",
): void {
  if (Reflect.ownKeys(value).length !== keys.length) {
    fail(
      invalidCode === "virtual_guide_conversation_invalid_request"
        ? "virtual_guide_conversation_unknown_key"
        : invalidCode,
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      !Object.prototype.propertyIsEnumerable.call(value, key) ||
      !keys.includes(key)
    ) {
      fail(
        invalidCode === "virtual_guide_conversation_invalid_request"
          ? "virtual_guide_conversation_unknown_key"
          : invalidCode,
      );
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(invalidCode);
    }
  }
}

function parseUuid(value: unknown, response = false): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail(
      response
        ? "virtual_guide_conversation_invalid_response"
        : "virtual_guide_conversation_invalid_binding",
    );
  }
  return value;
}

function parseAuthorizedContext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("virtual_guide_conversation_invalid_text");
  }
  if (
    new TextEncoder().encode(value).byteLength >
    VIRTUAL_GUIDE_CONVERSATION_LIMITS.authorizedContextUtf8Bytes
  ) {
    fail("virtual_guide_conversation_limit_exceeded");
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainObject(parsed) || JSON.stringify(parsed) !== value) {
      fail("virtual_guide_conversation_invalid_text");
    }
  } catch (error) {
    if (error instanceof VirtualGuideConversationError) {
      throw error;
    }
    fail("virtual_guide_conversation_invalid_text");
  }
  return value;
}

function parseAssistantContent(value: unknown): string {
  if (typeof value !== "string") {
    fail("virtual_guide_conversation_invalid_response");
  }
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0 || PROHIBITED_TEXT_PATTERN.test(normalized)) {
    fail("virtual_guide_conversation_invalid_response");
  }
  if (
    normalized.length >
    VIRTUAL_GUIDE_CONVERSATION_LIMITS.assistantMessageCharacters
  ) {
    fail("virtual_guide_conversation_limit_exceeded");
  }
  return normalized;
}

function parseTimeout(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) <
      VIRTUAL_GUIDE_CONVERSATION_LIMITS.minimumTimeoutMilliseconds ||
    (value as number) >
      VIRTUAL_GUIDE_CONVERSATION_LIMITS.maximumTimeoutMilliseconds
  ) {
    fail("virtual_guide_conversation_invalid_request");
  }
  return value as number;
}

export function parseVirtualGuideConversationRequest(
  input: unknown,
): VirtualGuideConversationRequest {
  const request = parsePlainObject(
    input,
    "virtual_guide_conversation_invalid_request",
  );
  assertExactKeys(
    request,
    REQUEST_KEYS,
    "virtual_guide_conversation_invalid_request",
  );
  if (request.contractVersion !== VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION) {
    fail("virtual_guide_conversation_invalid_request");
  }
  if (
    typeof request.contextFingerprint !== "string" ||
    !SHA256_PATTERN.test(request.contextFingerprint)
  ) {
    fail("virtual_guide_conversation_invalid_binding");
  }

  return Object.freeze({
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: parseUuid(request.invocationId),
    explorerId: parseUuid(request.explorerId),
    sessionId: parseUuid(request.sessionId),
    contextSnapshotId: parseUuid(request.contextSnapshotId),
    contextFingerprint: request.contextFingerprint.toUpperCase(),
    authorizedContext: parseAuthorizedContext(request.authorizedContext),
  });
}

export function parseVirtualGuideConversationResponse(
  input: unknown,
  expectedInvocationId: string,
): VirtualGuideConversationResponse {
  const expectedInvocation = parseUuid(expectedInvocationId, true);
  const response = parsePlainObject(
    input,
    "virtual_guide_conversation_invalid_response",
  );
  assertExactKeys(
    response,
    RESPONSE_KEYS,
    "virtual_guide_conversation_invalid_response",
  );
  if (
    response.contractVersion !== VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION ||
    response.invocationId !== expectedInvocation ||
    !(
      response.finishReason === "completed" ||
      response.finishReason === "refused" ||
      response.finishReason === "safety_redirect"
    )
  ) {
    fail("virtual_guide_conversation_invalid_response");
  }

  const assistantMessage = parsePlainObject(
    response.assistantMessage,
    "virtual_guide_conversation_invalid_response",
  );
  assertExactKeys(
    assistantMessage,
    ["messageId", "role", "content"],
    "virtual_guide_conversation_invalid_response",
  );
  if (assistantMessage.role !== "solmind_virtual_guide") {
    fail("virtual_guide_conversation_invalid_response");
  }

  const parsedMessage = Object.freeze({
    messageId: parseUuid(assistantMessage.messageId, true),
    role: "solmind_virtual_guide" as const,
    content: parseAssistantContent(assistantMessage.content),
  });
  return Object.freeze({
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: expectedInvocation,
    assistantMessage: parsedMessage,
    finishReason: response.finishReason,
  });
}

export async function invokeVirtualGuideConversation(input: {
  request: unknown;
  transport: VirtualGuideConversationTransport;
  timeoutMilliseconds: unknown;
  signal?: AbortSignal;
}): Promise<VirtualGuideConversationResponse> {
  const request = parseVirtualGuideConversationRequest(input.request);
  const timeoutMilliseconds = parseTimeout(input.timeoutMilliseconds);
  const generateDescriptor = isPlainObject(input.transport)
    ? Object.getOwnPropertyDescriptor(input.transport, "generate")
    : undefined;
  if (
    !isPlainObject(input.transport) ||
    Reflect.ownKeys(input.transport).length !== 1 ||
    Reflect.ownKeys(input.transport)[0] !== "generate" ||
    !generateDescriptor?.enumerable ||
    typeof generateDescriptor.value !== "function" ||
    generateDescriptor.get !== undefined ||
    generateDescriptor.set !== undefined
  ) {
    fail("virtual_guide_conversation_invalid_transport");
  }
  const generate = generateDescriptor.value as VirtualGuideConversationTransport["generate"];
  if (input.signal?.aborted) {
    fail("virtual_guide_conversation_cancelled");
  }

  const controller = new AbortController();
  let abortReason: "cancelled" | "timed_out" | null = null;
  const cancelFromCaller = (): void => {
    if (abortReason === null) {
      abortReason = "cancelled";
      controller.abort();
    }
  };
  input.signal?.addEventListener("abort", cancelFromCaller, { once: true });

  const timeout = setTimeout(() => {
    if (abortReason === null) {
      abortReason = "timed_out";
      controller.abort();
    }
  }, timeoutMilliseconds);

  const abort = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        reject(ABORT_SENTINEL);
      },
      { once: true },
    );
  });

  try {
    const rawResponse = await Promise.race([
      generate(request, controller.signal),
      abort,
    ]);
    return parseVirtualGuideConversationResponse(
      rawResponse,
      request.invocationId,
    );
  } catch (error) {
    if (error instanceof VirtualGuideConversationError) {
      throw error;
    }
    if (abortReason === "cancelled") {
      fail("virtual_guide_conversation_cancelled");
    }
    if (abortReason === "timed_out") {
      fail("virtual_guide_conversation_timed_out");
    }
    throw new VirtualGuideConversationError(
      "virtual_guide_conversation_transport_failed",
    );
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", cancelFromCaller);
  }
}
