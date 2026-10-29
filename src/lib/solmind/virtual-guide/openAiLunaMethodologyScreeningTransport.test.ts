import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindMethodologySafetyScreenSubject } from "./methodologySafetyScreenContract";
import { createLunaMethodologyScreenRequestBuilder, createOpenAiLunaMethodologyScreeningTransport } from "./openAiLunaMethodologyScreeningTransport";
import type { MethodologyScreeningRequest } from "./methodologyScreeningComposition";
import { createMethodologyScreeningComposition } from "./methodologyScreeningComposition";

const ID = "00000000-0000-4000-8000-000000000001";
const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: ID, content: "Synthetic non-clinical reflective methodology." });
const policy = { version: "synthetic-screen-policy.v1", prohibitedPolicy: "Synthetic prohibition against false clinical identity.", behavioralBaselines: "Synthetic role/privacy baseline." };
function fixture(modelName?: string) {
  const builder = createLunaMethodologyScreenRequestBuilder(policy, modelName);
  const fixed = { task: "methodology_safety_screen", protocolVersion: "methodology-safety-screen.v1", providerName: "openai" } as const;
  const body = builder.buildRequest({ ...fixed, subject, ...builder.configuration });
  const request: MethodologyScreeningRequest = { ...fixed, modelName: builder.configuration.modelName, policyVersion: builder.configuration.policyVersion,
    policyManifestSha256: builder.configuration.policyManifestSha256, operationId: ID, invocationId: ID, packId: ID, versionId: ID,
    subjectSha256: subject.subjectSha256, requestSha256: createHash("sha256").update(body).digest("hex").toUpperCase(), requestBody: body };
  const value = { result: "pass", subject_sha256: subject.subjectSha256, findings: [] };
  const envelope = { object: "response", model: builder.configuration.modelName, status: "completed", error: null, incomplete_details: null,
    output: [{ type: "reasoning" }, { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(value) }] }] };
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(envelope), { headers: { "Content-Type": "application/json" } }));
  const transport = createOpenAiLunaMethodologyScreeningTransport({ apiKey: "synthetic-not-a-credential", fetchImpl });
  return { builder, request, body, value, envelope, fetchImpl, transport };
}
beforeEach(() => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_actual_network")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("dormant exact Luna methodology screening request/HTTP owner", () => {
  it("builds bound bytes and makes one injected fixed HTTP attempt without tools or storage", async () => {
    const f = fixture();
    expect(await f.transport.execute(f.request, new AbortController().signal)).toEqual(f.value);
    expect(f.fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = f.fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", cache: "no-store", body: f.body });
    const body = JSON.parse(f.body);
    expect(body).toMatchObject({ model: "gpt-5.6-luna", reasoning: { effort: "medium" }, store: false, stream: false, background: false, max_output_tokens: 4096, truncation: "disabled" });
    expect(body).not.toHaveProperty("tools"); expect(body).not.toHaveProperty("previous_response_id");
    expect(JSON.parse(body.input).subject).toEqual({ sha256: subject.subjectSha256, content: subject.subject.content });
    expect(body.input).not.toContain(ID);
  });
  it("binds policy bytes independent of property insertion order", () => {
    const f = fixture(); const other = createLunaMethodologyScreenRequestBuilder({ behavioralBaselines: policy.behavioralBaselines, version: policy.version, prohibitedPolicy: policy.prohibitedPolicy });
    expect(other.configuration).toEqual(f.builder.configuration);
  });
  it.each(["synthetic-compatible.v1", "synthetic-compatible.v1-2026-10-28"])("sends the captured selected model and accepts its exact or dated reply: %s", async model => {
    const f = fixture("synthetic-compatible.v1");
    f.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ ...f.envelope, model }), { headers: { "Content-Type": "application/json" } }));
    expect(await f.transport.execute(f.request, new AbortController().signal)).toEqual(f.value);
    expect(f.builder.configuration.modelName).toBe("synthetic-compatible.v1");
    expect(f.fetchImpl).toHaveBeenCalledOnce();
    const [, init] = f.fetchImpl.mock.calls[0];
    expect(JSON.parse(init!.body as string).model).toBe("synthetic-compatible.v1");
  });
  it.each(["synthetic-compatible.v1-mini", "other-model"])("rejects a response outside the selected model: %s", async model => {
    const f = fixture("synthetic-compatible.v1");
    f.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ ...f.envelope, model }), { headers: { "Content-Type": "application/json" } }));
    await expect(f.transport.execute(f.request, new AbortController().signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).toHaveBeenCalledOnce();
  });
  it("refuses malformed selected models before building or dispatching", async () => {
    const f = fixture();
    expect(() => createLunaMethodologyScreenRequestBuilder(policy, " synthetic-compatible.v1")).toThrow(/^methodology_screen_http_unavailable$/);
    await expect(f.transport.execute({ ...f.request, modelName: "bad/model" }, new AbortController().signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["gpt-5.6-luna-2026-10-27", "gpt-5.6-luna-mini", "other-model"])("accepts only Luna or its dated model name: %s", async model => {
    const f = fixture();
    f.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ ...f.envelope, model }), { headers: { "Content-Type": "application/json" } }));
    if (model === "gpt-5.6-luna-2026-10-27") expect(await f.transport.execute(f.request, new AbortController().signal)).toEqual(f.value);
    else await expect(f.transport.execute(f.request, new AbortController().signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).toHaveBeenCalledOnce(); expect(JSON.parse(f.body).model).toBe("gpt-5.6-luna");
  });
  it.each(["body", "subject", "policy", "model"] as const)("refuses %s drift before HTTP", async drift => {
    const f = fixture(); const request = { ...f.request };
    if (drift === "body") request.requestBody += " ";
    if (drift === "subject") request.subjectSha256 = "B".repeat(64);
    if (drift === "policy") request.policyManifestSha256 = "B".repeat(64);
    if (drift === "model") request.modelName = "other-model" as never;
    await expect(f.transport.execute(request, new AbortController().signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["model", "incomplete", "refusal", "tool", "extra-message", "invalid-json", "oversized"] as const)("closes %s output without retry", async fault => {
    const f = fixture(); const envelope = structuredClone(f.envelope);
    if (fault === "model") envelope.model = "other-model";
    if (fault === "incomplete") envelope.status = "incomplete";
    if (fault === "refusal") envelope.output[1].content![0] = { type: "refusal", text: "not a result" };
    if (fault === "tool") envelope.output.push({ type: "function_call" });
    if (fault === "extra-message") envelope.output.push(envelope.output[1]);
    if (fault === "invalid-json") envelope.output[1].content![0].text = "{";
    if (fault === "oversized") envelope.output[1].content![0].text = "x".repeat(131073);
    f.fetchImpl.mockResolvedValue(new Response(JSON.stringify(envelope), { headers: { "Content-Type": "application/json" } }));
    await expect(f.transport.execute(f.request, new AbortController().signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).toHaveBeenCalledOnce();
  });
  it("settles the local deadline even when injected HTTP ignores its abort request", async () => {
    vi.useFakeTimers(); const f = fixture(); f.fetchImpl.mockImplementation(() => new Promise(() => undefined));
    const result = f.transport.execute(f.request, new AbortController().signal);
    const rejection = expect(result).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    await vi.advanceTimersByTimeAsync(60_000); await rejection;
    expect(f.fetchImpl).toHaveBeenCalledOnce(); expect(f.fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it("does not dispatch after cancellation and bounds authored request bytes", async () => {
    const f = fixture(); const signal = new AbortController(); signal.abort();
    await expect(f.transport.execute(f.request, signal.signal)).rejects.toThrow(/^methodology_screen_http_unavailable$/);
    expect(f.fetchImpl).not.toHaveBeenCalled();
    expect(() => createLunaMethodologyScreenRequestBuilder({ ...policy, prohibitedPolicy: "x".repeat(131073) })).toThrow("methodology_screen_http_unavailable");
  });
});

it("joins the real screening composition, pinned builder, HTTP envelope and subject parser with synthetic storage", async () => {
  const f = fixture();
  const prepare = vi.fn(async () => ({ outcome: "ok", screen_invocation_id: ID, dispatch_permitted: true }));
  const settle = vi.fn(async () => ({ outcome: "ok" }));
  const composition = createMethodologyScreeningComposition({ configuration: f.builder.configuration, buildRequest: f.builder.buildRequest,
    transport: f.transport, repository: { prepare, settle,
      readOwnedDraft: async () => ({ packId: ID, versionId: ID, scopeType: "guide", scopeId: ID, packStatus: "draft", createdByAccountId: ID,
        createdByActorType: "admin", createdByRoleContext: "admin", approvalStatus: "draft", content: subject.subject.content, contentSha256: subject.subjectSha256 }) } });
  const input = { actor: { accountId: ID, applicationSessionId: ID }, packId: ID, versionId: ID, expectedGuideId: ID, operationId: ID, invocationId: ID };
  expect(await composition.run(input)).toEqual({ status: "completed", screenResult: "pass" });
  expect(prepare).toHaveBeenCalledOnce(); expect(settle).toHaveBeenCalledOnce(); expect(f.fetchImpl).toHaveBeenCalledOnce();
  expect(settle.mock.calls[0]).toMatchObject([{ p_terminal_status: "completed", p_result: f.value }, expect.any(AbortSignal)]);
  prepare.mockResolvedValue({ outcome: "exact_replay", screen_invocation_id: ID, dispatch_permitted: false });
  expect(await composition.run(input)).toEqual({ status: "not_dispatched" });
  expect(f.fetchImpl).toHaveBeenCalledOnce(); expect(settle).toHaveBeenCalledOnce();
});
