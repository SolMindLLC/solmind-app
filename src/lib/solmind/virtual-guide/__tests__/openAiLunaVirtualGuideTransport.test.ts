import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
  VirtualGuideConversationError,
  invokeVirtualGuideConversation,
  type VirtualGuideConversationRequest,
} from "@/lib/solmind/virtual-guide/virtualGuideConversationContract";
import {
  OPENAI_LUNA_RESPONSES_ENDPOINT,
  OPENAI_LUNA_VIRTUAL_GUIDE_INSTRUCTIONS,
  OPENAI_LUNA_VIRTUAL_GUIDE_MODEL,
  OPENAI_LUNA_VIRTUAL_GUIDE_REASONING_EFFORT,
  OpenAiLunaVirtualGuideError,
  createOpenAiLunaVirtualGuideTransport,
} from "../openAiLunaVirtualGuideTransport";

const IDS = Object.freeze({
  invocation: "11111111-1111-4111-8111-111111111111",
  explorer: "22222222-2222-4222-8222-222222222222",
  session: "33333333-3333-4333-8333-333333333333",
  snapshot: "44444444-4444-4444-8444-444444444444",
  message: "55555555-5555-4555-8555-555555555555",
});

function request(): VirtualGuideConversationRequest {
  return Object.freeze({
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: IDS.invocation,
    explorerId: IDS.explorer,
    sessionId: IDS.session,
    contextSnapshotId: IDS.snapshot,
    contextFingerprint: "A".repeat(64),
    authorizedContext: JSON.stringify({
      immediateExplorerMessage: { content: "I want to think this through." },
    }),
  });
}

function providerResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "resp_test",
    object: "response",
    status: "completed",
    error: null,
    incomplete_details: null,
    model: OPENAI_LUNA_VIRTUAL_GUIDE_MODEL,
    output: [
      { type: "reasoning", id: "rs_test", summary: [] },
      {
        type: "message",
        id: "msg_test",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "What feels most important to name first?",
            annotations: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function transportWith(fetchImpl: typeof fetch) {
  return createOpenAiLunaVirtualGuideTransport({
    apiKey: "sk-test-value-that-never-leaves-the-fake",
    fetchImpl,
    createMessageId: () => IDS.message,
  });
}

async function expectConversationCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("openAiLunaVirtualGuideTransport", () => {
  it("OLVG-001 sends the exact non-stored Luna medium Responses request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(providerResponse()));
    const result = await invokeVirtualGuideConversation({
      request: request(),
      transport: transportWith(fetchImpl as typeof fetch),
      timeoutMilliseconds: 1_000,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENAI_LUNA_RESPONSES_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer sk-test-value-that-never-leaves-the-fake",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: OPENAI_LUNA_VIRTUAL_GUIDE_MODEL,
      reasoning: { effort: OPENAI_LUNA_VIRTUAL_GUIDE_REASONING_EFFORT },
      store: false,
      instructions: OPENAI_LUNA_VIRTUAL_GUIDE_INSTRUCTIONS,
      input: request().authorizedContext,
      max_output_tokens: 4_096,
    });
    expect(result).toEqual({
      contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
      invocationId: IDS.invocation,
      assistantMessage: {
        messageId: IDS.message,
        role: "solmind_virtual_guide",
        content: "What feels most important to name first?",
      },
      finishReason: "completed",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("OLVG-002 passes only the authorized context as provider input", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(providerResponse()));
    await invokeVirtualGuideConversation({
      request: request(),
      transport: transportWith(fetchImpl as typeof fetch),
      timeoutMilliseconds: 1_000,
    });
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;
    expect(body).not.toHaveProperty("metadata");
    expect(JSON.stringify(body)).not.toContain(IDS.explorer);
    expect(JSON.stringify(body)).not.toContain(IDS.session);
    expect(JSON.stringify(body)).not.toContain(IDS.snapshot);
    expect(JSON.stringify(body)).not.toContain("contextFingerprint");
  });

  it("OLVG-003 forwards the owned abort signal to fetch", async () => {
    let observed: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      observed = init?.signal as AbortSignal;
      return jsonResponse(providerResponse());
    });
    await invokeVirtualGuideConversation({
      request: request(),
      transport: transportWith(fetchImpl as typeof fetch),
      timeoutMilliseconds: 1_000,
    });
    expect(observed).toBeInstanceOf(AbortSignal);
    expect(observed?.aborted).toBe(false);
  });

  it("OLVG-004 maps HTTP and fetch failures without provider or secret detail", async () => {
    for (const fetchImpl of [
      vi.fn(async () => jsonResponse({ secret: "provider-secret" }, 500)),
      vi.fn(async () => {
        throw new Error("sk-live-secret provider body");
      }),
    ]) {
      const outcome = invokeVirtualGuideConversation({
        request: request(),
        transport: transportWith(fetchImpl as typeof fetch),
        timeoutMilliseconds: 1_000,
      });
      await expectConversationCode(
        outcome,
        "virtual_guide_conversation_transport_failed",
      );
      await outcome.catch((error: unknown) => {
        expect(String(error)).not.toContain("secret");
        expect(String(error)).not.toContain("provider body");
      });
    }
  });

  it("OLVG-005 rejects incomplete, wrong-model, tool and malformed output", async () => {
    const cases = [
      providerResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
      providerResponse({ model: "gpt-5.6-sol" }),
      providerResponse({ output: [{ type: "function_call", name: "unexpected" }] }),
      providerResponse({
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: 42 }],
          },
        ],
      }),
    ];
    for (const body of cases) {
      await expectConversationCode(
        invokeVirtualGuideConversation({
          request: request(),
          transport: transportWith(
            vi.fn(async () => jsonResponse(body)) as typeof fetch,
          ),
          timeoutMilliseconds: 1_000,
        }),
        "virtual_guide_conversation_transport_failed",
      );
    }
  });

  it("OLVG-006 maps one provider refusal to fixed Explorer-facing text", async () => {
    const result = await invokeVirtualGuideConversation({
      request: request(),
      transport: transportWith(
        vi.fn(async () =>
          jsonResponse(
            providerResponse({
              output: [
                {
                  type: "message",
                  status: "completed",
                  role: "assistant",
                  content: [{ type: "refusal", refusal: "private provider text" }],
                },
              ],
            }),
          ),
        ) as typeof fetch,
      ),
      timeoutMilliseconds: 1_000,
    });
    expect(result.finishReason).toBe("refused");
    expect(result.assistantMessage.content).toBe(
      "I'm not able to help with that request, but I can help you explore a safer direction.",
    );
    expect(result.assistantMessage.content).not.toContain("provider text");
  });

  it("OLVG-007 rejects oversized response bodies", async () => {
    const oversized = "x".repeat(262_145);
    await expectConversationCode(
      invokeVirtualGuideConversation({
        request: request(),
        transport: transportWith(
          vi.fn(async () => new Response(oversized, { status: 200 })) as typeof fetch,
        ),
        timeoutMilliseconds: 1_000,
      }),
      "virtual_guide_conversation_transport_failed",
    );
  });

  it("OLVG-008 rejects invalid configuration and accessors without reading secrets", () => {
    const getter = vi.fn(() => "sk-secret");
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, "apiKey", { enumerable: true, get: getter });
    expect(() =>
      createOpenAiLunaVirtualGuideTransport(accessor as never),
    ).toThrowError(OpenAiLunaVirtualGuideError);
    expect(getter).not.toHaveBeenCalled();

    for (const candidate of [
      { apiKey: "" },
      { apiKey: "contains whitespace" },
      { apiKey: "sk-valid-value", endpoint: "https://attacker.invalid" },
      { apiKey: "sk-valid-value", fetchImpl: "not-a-function" },
    ]) {
      expect(() =>
        createOpenAiLunaVirtualGuideTransport(candidate as never),
      ).toThrowError(OpenAiLunaVirtualGuideError);
    }
  });

  it("OLVG-009 rejects an invalid locally generated message ID through S03B", async () => {
    const transport = createOpenAiLunaVirtualGuideTransport({
      apiKey: "sk-test-value",
      fetchImpl: vi.fn(async () => jsonResponse(providerResponse())) as typeof fetch,
      createMessageId: () => "not-a-uuid",
    });
    const outcome = invokeVirtualGuideConversation({
      request: request(),
      transport,
      timeoutMilliseconds: 1_000,
    });
    await expect(outcome).rejects.toBeInstanceOf(VirtualGuideConversationError);
    await expectConversationCode(
      outcome,
      "virtual_guide_conversation_invalid_response",
    );
  });

  it("OLVG-010 remains server-only, fixed-endpoint and free of environment access", () => {
    const sourcePath = fileURLToPath(
      new URL("../openAiLunaVirtualGuideTransport.ts", import.meta.url),
    );
    const source = fs.readFileSync(sourcePath, "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).toContain('"https://api.openai.com/v1/responses"');
    expect(source).not.toMatch(/process\.env|localStorage|sessionStorage|previous_response_id/);
    expect(source).not.toMatch(/from\s+["']openai["']/);
  });

  it("OLVG-011 exposes only one frozen generate capability", () => {
    const transport = transportWith(
      vi.fn(async () => jsonResponse(providerResponse())) as typeof fetch,
    );
    expect(Reflect.ownKeys(transport)).toEqual(["generate"]);
    expect(Object.isFrozen(transport)).toBe(true);
  });
});
