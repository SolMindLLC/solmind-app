import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
  VIRTUAL_GUIDE_CONVERSATION_ERROR_CODES,
  VirtualGuideConversationError,
  invokeVirtualGuideConversation,
  parseVirtualGuideConversationRequest,
  parseVirtualGuideConversationResponse,
  type VirtualGuideConversationTransport,
} from "../virtualGuideConversationContract";

const IDS = Object.freeze({
  invocation: "00000000-0000-4000-8000-000000000001",
  explorer: "00000000-0000-4000-8000-000000000002",
  session: "00000000-0000-4000-8000-000000000003",
  snapshot: "00000000-0000-4000-8000-000000000004",
  message: "00000000-0000-4000-8000-000000000005",
});

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: IDS.invocation,
    explorerId: IDS.explorer,
    sessionId: IDS.session,
    contextSnapshotId: IDS.snapshot,
    contextFingerprint: "a".repeat(64),
    authorizedContext: JSON.stringify({
      contractVersion: "explorer-safe-context.v1",
      immediateExplorerMessage: { content: "I want to prepare." },
    }),
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: IDS.invocation,
    assistantMessage: {
      messageId: IDS.message,
      role: "solmind_virtual_guide",
      content: "What would feeling prepared look like?",
    },
    finishReason: "completed",
    ...overrides,
  };
}

function errorCode(error: unknown): string | undefined {
  return error instanceof VirtualGuideConversationError ? error.code : undefined;
}

describe("virtualGuideConversationContract", () => {
  it("VGC-001 parses an exact provider-neutral request and severs caller references", () => {
    const input = request();
    const parsed = parseVirtualGuideConversationRequest(input);

    input.contextFingerprint = "b".repeat(64);

    expect(parsed).toEqual({
      ...request(),
      contextFingerprint: "A".repeat(64),
    });
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("VGC-002 rejects unknown, missing, symbolic, and non-enumerable request keys", () => {
    expect(() =>
      parseVirtualGuideConversationRequest(request({ unexpected: true })),
    ).toThrowError("virtual_guide_conversation_unknown_key");

    const missing = request();
    delete missing.sessionId;
    expect(() => parseVirtualGuideConversationRequest(missing)).toThrowError(
      "virtual_guide_conversation_unknown_key",
    );

    const symbolic = request();
    Object.defineProperty(symbolic, Symbol("hidden"), { enumerable: true, value: 1 });
    expect(() => parseVirtualGuideConversationRequest(symbolic)).toThrowError(
      "virtual_guide_conversation_unknown_key",
    );

    const nonEnumerable = request();
    Object.defineProperty(nonEnumerable, "hidden", { enumerable: false, value: 1 });
    expect(() => parseVirtualGuideConversationRequest(nonEnumerable)).toThrowError(
      "virtual_guide_conversation_unknown_key",
    );
  });

  it("VGC-003 rejects invalid identifiers, fingerprints, and contract versions", () => {
    for (const candidate of [
      request({ invocationId: "not-a-uuid" }),
      request({ contextFingerprint: "abc" }),
      request({ contractVersion: "virtual-guide-conversation.v2" }),
    ]) {
      expect(() => parseVirtualGuideConversationRequest(candidate)).toThrow(
        VirtualGuideConversationError,
      );
    }
  });

  it("VGC-004 requires compact object JSON as the already-authorized context", () => {
    for (const authorizedContext of [
      "",
      "not-json",
      "[]",
      '{ "message": "not compact" }',
    ]) {
      expect(() =>
        parseVirtualGuideConversationRequest(request({ authorizedContext })),
      ).toThrowError("virtual_guide_conversation_invalid_text");
    }
  });

  it("VGC-005 enforces the authorized-context UTF-8 byte limit", () => {
    const authorizedContext = JSON.stringify({ value: "x".repeat(524_288) });
    expect(() =>
      parseVirtualGuideConversationRequest(request({ authorizedContext })),
    ).toThrowError("virtual_guide_conversation_limit_exceeded");
  });

  it("VGC-006 validates, normalizes, and deeply freezes the provider response", () => {
    const parsed = parseVirtualGuideConversationResponse(
      response({
        assistantMessage: {
          messageId: IDS.message,
          role: "solmind_virtual_guide",
          content: "  First line\r\nSecond line  ",
        },
      }),
      IDS.invocation,
    );

    expect(parsed.assistantMessage.content).toBe("First line\nSecond line");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.assistantMessage)).toBe(true);
  });

  it("VGC-007 rejects response over-disclosure, role drift, and invocation drift", () => {
    for (const candidate of [
      response({ provider: "hidden-provider" }),
      response({ invocationId: IDS.session }),
      response({
        assistantMessage: {
          messageId: IDS.message,
          role: "assistant",
          content: "Hello",
        },
      }),
    ]) {
      expect(() =>
        parseVirtualGuideConversationResponse(candidate, IDS.invocation),
      ).toThrowError("virtual_guide_conversation_invalid_response");
    }
    expect(() =>
      parseVirtualGuideConversationResponse(response(), "not-a-uuid"),
    ).toThrowError("virtual_guide_conversation_invalid_response");
  });

  it("VGC-008 accepts only the closed finish-reason vocabulary", () => {
    for (const finishReason of ["completed", "refused", "safety_redirect"]) {
      expect(
        parseVirtualGuideConversationResponse(
          response({ finishReason }),
          IDS.invocation,
        ).finishReason,
      ).toBe(finishReason);
    }
    expect(() =>
      parseVirtualGuideConversationResponse(
        response({ finishReason: "tool_call" }),
        IDS.invocation,
      ),
    ).toThrowError("virtual_guide_conversation_invalid_response");
  });

  it("VGC-009 passes a frozen request and cancellation signal to an injected fake transport", async () => {
    const generate = vi.fn(async (parsedRequest, signal: AbortSignal) => {
      expect(Object.isFrozen(parsedRequest)).toBe(true);
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      return response();
    });

    await expect(
      invokeVirtualGuideConversation({
        request: request(),
        transport: { generate } as VirtualGuideConversationTransport,
        timeoutMilliseconds: 1_000,
      }),
    ).resolves.toEqual(response());
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("VGC-009A rejects transport capability overreach", async () => {
    const generate = vi.fn(async () => response());
    await expect(
      invokeVirtualGuideConversation({
        request: request(),
        transport: { generate, providerName: "should-not-cross" } as never,
        timeoutMilliseconds: 1_000,
      }),
    ).rejects.toMatchObject({
      code: "virtual_guide_conversation_invalid_transport",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("VGC-009B rejects an accessor transport without invoking its getter", async () => {
    const getter = vi.fn(() => async () => response());
    const transport = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(transport, "generate", {
      enumerable: true,
      get: getter,
    });

    await expect(
      invokeVirtualGuideConversation({
        request: request(),
        transport: transport as never,
        timeoutMilliseconds: 1_000,
      }),
    ).rejects.toMatchObject({
      code: "virtual_guide_conversation_invalid_transport",
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it("VGC-010 denies malformed requests before calling transport", async () => {
    const generate = vi.fn(async () => response());
    await expect(
      invokeVirtualGuideConversation({
        request: request({ unexpected: "never send" }),
        transport: { generate },
        timeoutMilliseconds: 1_000,
      }),
    ).rejects.toMatchObject({ code: "virtual_guide_conversation_unknown_key" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("VGC-011 maps provider failures to one value-free transport error", async () => {
    const secret = "provider-secret-detail";
    const generate = vi.fn(async () => {
      throw new Error(secret);
    });
    const failure = invokeVirtualGuideConversation({
      request: request(),
      transport: { generate },
      timeoutMilliseconds: 1_000,
    });

    await expect(failure).rejects.toMatchObject({
      code: "virtual_guide_conversation_transport_failed",
      message: "virtual_guide_conversation_transport_failed",
    });
    await failure.catch((error: unknown) => {
      expect(String(error)).not.toContain(secret);
    });
  });

  it("VGC-012 fails closed before transport when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn(async () => response());

    await expect(
      invokeVirtualGuideConversation({
        request: request(),
        transport: { generate },
        timeoutMilliseconds: 1_000,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "virtual_guide_conversation_cancelled" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("VGC-013 aborts an in-flight transport at the bounded timeout", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const generate = vi.fn((_request, signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<never>(() => undefined);
    });
    const outcome = invokeVirtualGuideConversation({
      request: request(),
      transport: { generate },
      timeoutMilliseconds: 10,
    });
    const assertion = expect(outcome).rejects.toMatchObject({
      code: "virtual_guide_conversation_timed_out",
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(observedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("VGC-014 aborts an in-flight transport when the caller cancels", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const generate = vi.fn((_request, signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<never>(() => undefined);
    });
    const outcome = invokeVirtualGuideConversation({
      request: request(),
      transport: { generate },
      timeoutMilliseconds: 1_000,
      signal: controller.signal,
    });
    const assertion = expect(outcome).rejects.toMatchObject({
      code: "virtual_guide_conversation_cancelled",
    });

    controller.abort();
    await assertion;
    expect(observedSignal?.aborted).toBe(true);
  });

  it("VGC-015 keeps the error algebra closed and value-free", () => {
    expect(VIRTUAL_GUIDE_CONVERSATION_ERROR_CODES).toEqual([
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
    ]);
    for (const code of VIRTUAL_GUIDE_CONVERSATION_ERROR_CODES) {
      expect(errorCode(new VirtualGuideConversationError(code))).toBe(code);
      expect(String(new VirtualGuideConversationError(code))).toBe(
        `VirtualGuideConversationError: ${code}`,
      );
    }
  });

  it("VGC-016 remains server-only, provider-neutral, and off client barrels", () => {
    const sourcePath = fileURLToPath(
      new URL("../virtualGuideConversationContract.ts", import.meta.url),
    );
    const source = fs.readFileSync(sourcePath, "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai|ai|next|react|@supabase)|\bfetch\s*\(|process\.env|localStorage|sessionStorage/,
    );
    expect(source).not.toMatch(/repository|database|route handler|server action/i);

    const barrel = path.resolve(path.dirname(sourcePath), "..", "index.ts");
    if (fs.existsSync(barrel)) {
      expect(fs.readFileSync(barrel, "utf8")).not.toContain(
        "virtualGuideConversationContract",
      );
    }
  });
});
