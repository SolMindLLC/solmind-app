import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { EXPLORER_SAFETY_REQUEST_VERSION, parseExplorerSafetyReplyRequest } from "../explorerSafetyReplyContract";
import { invokeExplorerSafetyReply } from "../explorerSafetyReplyInvocation";
import {
  createOpenAiLunaExplorerSafetyTransport, explorerSafetyHttpInstructions,
  OPENAI_LUNA_EXPLORER_SAFETY_ENDPOINT, OPENAI_LUNA_EXPLORER_SAFETY_MODEL,
} from "../openAiLunaExplorerSafetyTransport";

function request(mode: "classification_and_reply" | "classification_only" = "classification_and_reply") {
  const authorizedContext = JSON.stringify({ contractVersion: "wi007-v0.1+onboarding-fields-v2",
    immediateExplorerMessage: { content: "Synthetic fixture only." }, outputRequirements: { format: "plain_text" } });
  return parseExplorerSafetyReplyRequest({ contractVersion: EXPLORER_SAFETY_REQUEST_VERSION,
    invocationId: "00000000-0000-4000-8000-000000000001", explorerId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003", contextSnapshotId: "00000000-0000-4000-8000-000000000004",
    contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex"), authorizedContext, mode,
    classificationPolicyVersion: "synthetic-model.v1", fallbackPolicyVersion: "synthetic-fallback.v1", instructionVersion: "synthetic-instructions.v1" });
}
function envelope(raw: string, overrides: Record<string, unknown> = {}) {
  return { object: "response", status: "completed", error: null, incomplete_details: null,
    model: OPENAI_LUNA_EXPLORER_SAFETY_MODEL,
    output: [{ type: "reasoning", summary: [] }, { type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text: raw }] }], ...overrides };
}
const RAW = '{"protocol":"explorer-safety-reply.v1","classification":{"level":4,"minorIndicated":false},"candidateReply":{"content":"\\ud800"}}';
function adapter(fetchImpl: typeof fetch) { return createOpenAiLunaExplorerSafetyTransport({ apiKey: "synthetic-never-transmitted-key", fetchImpl }); }
describe("Dormant injected Explorer same-call HTTP transport", () => {
  it("sends one exact unchanged compact input with fixed model/effort/no-store/no-tools and JSON outer instructions", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(RAW)))); const input = request();
    const raw = await adapter(fetchImpl as typeof fetch).generate(input, new AbortController().signal);
    expect(raw).toBe(RAW); expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENAI_LUNA_EXPLORER_SAFETY_ENDPOINT); expect(init.method).toBe("POST"); expect(init.redirect).toBe("error");
    const sent = JSON.parse(init.body as string);
    expect(sent.input).toBe(input.authorizedContext); expect(sent.model).toBe("gpt-5.6-luna");
    expect(sent.reasoning).toEqual({ effort: "medium" }); expect(sent.store).toBe(false); expect(sent.max_output_tokens).toBe(4096);
    expect(Object.keys(sent).sort()).toEqual(["input", "instructions", "max_output_tokens", "model", "reasoning", "store"]);
    expect(sent.instructions).toContain("OUTER response"); expect(sent.instructions).toContain("ONLY to candidateReply.content");
    for (const id of [input.invocationId, input.explorerId, input.sessionId, input.contextSnapshotId]) expect(init.body).not.toContain(id);
  });
  it("extracts malformed prose untouched so the owner can retain classification first", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(RAW))));
    const result = await invokeExplorerSafetyReply({ request: request(), transport: adapter(fetchImpl as typeof fetch), timeoutMilliseconds: 1000 });
    expect(result.status).toBe("observed"); expect(result.observation?.classification.level).toBe(4);
    expect(result.observation?.candidate.kind).toBe("unusable"); expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("uses the closed classification-only instruction without changing input", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(RAW)))); const input = request("classification_only");
    const result = await invokeExplorerSafetyReply({ request: input, transport: adapter(fetchImpl as typeof fetch), timeoutMilliseconds: 1000 });
    expect(result.observation?.candidate.kind).toBe("not_requested");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).instructions).toBe(explorerSafetyHttpInstructions("classification_only"));
    expect(JSON.parse(init.body as string).instructions).toContain("candidateReply MUST be null");
  });
  it("refusal creates no synthetic classification or second call", async () => {
    const refusal = envelope(RAW, { output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "private provider detail" }] }] });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(refusal)));
    const result = await invokeExplorerSafetyReply({ request: request(), transport: adapter(fetchImpl as typeof fetch), timeoutMilliseconds: 1000 });
    expect(result.status).toBe("unavailable"); expect(result.observation).toBeNull(); expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });
  it("accepts the dated Luna response model while keeping the requested model fixed", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(RAW, { model: "gpt-5.6-luna-2026-10-27" }))));
    expect(await adapter(fetchImpl as typeof fetch).generate(request(), new AbortController().signal)).toBe(RAW);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("gpt-5.6-luna");
  });
  it.each([{ model: "gpt-5.6-luna-mini" }, { model: "other-model" }, { status: "incomplete" }, { error: { detail: "private" } },
    { output: [{ type: "function_call", name: "unsafe" }] }])("rejects unsupported outer provider evidence: %j", async (overrides) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(RAW, overrides))));
    await expect(adapter(fetchImpl as typeof fetch).generate(request(), new AbortController().signal)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("bounds actual HTTP bytes even without Content-Length", async () => {
    const fetchImpl = vi.fn(async () => new Response(" ".repeat(262145)));
    await expect(adapter(fetchImpl as typeof fetch).generate(request(), new AbortController().signal)).rejects.toThrow();
  });
  it("uses fatal UTF8 decoding", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([0xc3, 0x28])));
    await expect(adapter(fetchImpl as typeof fetch).generate(request(), new AbortController().signal)).rejects.toThrow();
  });
  it("does not retry non-success HTTP or a throwing injected HTTP port", async () => {
    for (const fetchImpl of [vi.fn(async () => new Response("private detail", { status: 401 })),
      vi.fn(async () => { throw new Error("private credential detail"); })]) {
      await expect(adapter(fetchImpl as typeof fetch).generate(request(), new AbortController().signal)).rejects.toThrowError("explorer_safety_http_failed");
      expect(fetchImpl).toHaveBeenCalledOnce();
    }
  });
  it("requires an injected HTTP function and never evaluates configuration getters", () => {
    const getter = vi.fn(); const configuration = Object.defineProperty({ fetchImpl: vi.fn() }, "apiKey", { enumerable: true, get: getter });
    expect(() => createOpenAiLunaExplorerSafetyTransport(configuration as unknown as Parameters<typeof createOpenAiLunaExplorerSafetyTransport>[0])).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => createOpenAiLunaExplorerSafetyTransport({ apiKey: "synthetic" } as Parameters<typeof createOpenAiLunaExplorerSafetyTransport>[0])).toThrow();
  });
});
