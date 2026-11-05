/**
 * Synthetic S4 joined-path mechanics only. The actual injected HTTP adapter,
 * reply parser, controller, closed RPC repository and browser decoder run here.
 * Auth, readiness, context and RPC results are explicit in-memory test ports.
 * No network, database, provider, operational approval or SQL correctness proof.
 * The older opt-in AV2 real-database local proof remains a separate predecessor.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION, parseExplorerPrivateConversationResponse } from "../../src/lib/solmind/explorerPrivateConversationResponse";
import { createExplorerPrivateConversationRepository } from "../../src/lib/solmind/supabase/explorerPrivateConversationRepository";
import { getExplorerPrivateConfigurationCandidate } from "../../src/lib/solmind/virtual-guide/explorerPrivateConfiguration";
import { commandExplorerPrivateConversation, type ExplorerPrivateConversationDependencies,
  type ExplorerPrivateOperationalReadiness, type ExplorerPrivateSettleParameters } from "../../src/lib/solmind/virtual-guide/explorerPrivateConversationComposition";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "../../src/lib/solmind/virtual-guide/explorerSafetyReplyContract";
import { createOpenAiLunaExplorerSafetyTransport } from "../../src/lib/solmind/virtual-guide/openAiLunaExplorerSafetyTransport";

const id = (value: number) => `f4400000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const SHA = "A".repeat(64);
const ACTOR = { accountId: id(1), applicationSessionId: id(2) };
const POLICY = { known: true, contractVersion: "explorer-conversation-safety.v1", restrictedLevel: null, adultReflectionStopped: false, version: 0 };
const CHOICES = [{ label: "Explore this topic" }, { label: "I have a question" }];
const COMMAND = { kind: "send", operationId: id(8), expectedRevision: 1, body: "Synthetic message about money worries." } as const;

function fixture(proposals: Record<string, unknown>) {
  const configuration = getExplorerPrivateConfigurationCandidate();
  if (!configuration) throw new Error("synthetic_configuration_missing");
  const readiness: ExplorerPrivateOperationalReadiness = { configuration, configurationFingerprint: SHA,
    modelName: "gpt-5.6-luna", modelPolicyVersion: "synthetic-model.v1", resourcePolicyVersion: "synthetic-resources.v1",
    sourceVerificationReceiptSha256: SHA, resourceVerificationReceiptSha256: SHA,
    rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: id(6), versionId: id(7), contentSha256: SHA, authorizationVersion: "MV1:" + SHA } };
  let current: ExplorerConversationState = { version: "explorer-conversation.v1", conversationId: id(3),
    revision: 1, pendingTurn: false, providerState: "unavailable",
    messages: [{ id: id(10), role: "explorer", body: "Synthetic source about money worries.", createdAt: "2026-11-04T12:00:00Z" }],
    compassItems: [{ id: id(9), sourceMessageId: id(10), label: "Money worries" }], priorityId: null, attentionId: null, waypoints: [] };
  let settled = false; let fingerprint: string | null = null;
  const authority = { explorerId: id(4), authorizationVersion: "AV3:" + SHA };
  const rpc = vi.fn((name: string, parameters: Readonly<Record<string, unknown>>) => ({
    abortSignal: async (_signal: AbortSignal) => {
      void _signal;
      let row: Record<string, unknown>;
      if (name === "solmind_read_explorer_conversation_v3") {
        const exact = settled && parameters.p_operation_id === COMMAND.operationId && parameters.p_command_fingerprint === fingerprint;
        row = { outcome: exact ? "exact_replay" : "ok", conversation_state: current, authority_context: authority, policy_state: POLICY };
      } else if (name === "solmind_read_explorer_ai_use_pause_v1") {
        row = { outcome: "ok", notice_kind: null, crisis: false, adults_only: false };
      } else if (name === "solmind_ensure_explorer_conversation_v3") {
        row = { outcome: "reused", conversation_state: current, authority_context: authority, policy_state: POLICY };
      } else if (name === "solmind_observe_explorer_conversation_fallback_v3") {
        row = { outcome: "ok", policy_state: POLICY };
      } else if (name === "solmind_prepare_explorer_conversation_turn_v3") {
        fingerprint = parameters.p_command_fingerprint as string;
        current = { ...current, revision: 2, pendingTurn: true,
          messages: [...current.messages, { id: parameters.p_message_id as string, role: "explorer",
            body: parameters.p_body as string, createdAt: "2026-11-04T12:00:01Z" }] };
        row = { outcome: "ok", conversation_state: current, dispatch_permitted: true, policy_state: POLICY };
      } else if (name === "solmind_settle_explorer_conversation_turn_v4") {
        const terminal = parameters as ExplorerPrivateSettleParameters;
        if (terminal.p_reply_kind !== "ordinary" || terminal.p_reply_body === null || terminal.p_reply_message_id === null) {
          throw new Error("synthetic_unexpected_terminal");
        }
        settled = true;
        current = { ...current, revision: 3, pendingTurn: false, attentionId: terminal.p_attention_item_id,
          ...(terminal.p_attention_item_id === null ? {} : { route: [{ operationId: id(11), revision: 3,
            kind: "attention_changed", compassItemId: terminal.p_attention_item_id, label: "Money worries",
            recordedAt: "2026-11-04T12:00:02Z", actor: "virtual_guide" }] }),
          messages: [...current.messages, { id: terminal.p_reply_message_id, role: "virtualGuide", body: terminal.p_reply_body,
            createdAt: "2026-11-04T12:00:02Z", ...(terminal.p_choices === null ? {} : { choices: terminal.p_choices }) }] };
        row = { outcome: "ok", conversation_state: current, policy_state: POLICY, saved_reply: true };
      } else throw new Error("synthetic_unexpected_rpc");
      return { data: [row], error: null };
    },
  }));
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ object: "response", status: "completed", error: null,
    incomplete_details: null, model: "gpt-5.6-luna", output: [{ type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text: JSON.stringify({ protocol: "explorer-safety-reply.v2",
        classification: { level: 0, minorIndicated: false }, candidateReply: { content: "We can explore what matters about that topic." }, ...proposals }) }] }] })));
  const dependencies: ExplorerPrivateConversationDependencies = {
    authenticate: async () => ACTOR,
    repository: createExplorerPrivateConversationRepository({ rpc } as unknown as SupabaseClient),
    resolveOperationalReadiness: async () => readiness,
    provider: createOpenAiLunaExplorerSafetyTransport({ apiKey: "synthetic-never-transmitted-key", fetchImpl: fetchImpl as typeof fetch }),
    operationalSignal: { verificationReceiptSha256: SHA, emit: async () => undefined },
    renderer: { verificationReceiptSha256: SHA,
      failureAssistance: { support: "Synthetic support assistance.", adultPolicy: "Synthetic adult assistance.",
        supportAndAdultPolicy: "Synthetic combined assistance.", temporarilyUnavailable: "Synthetic unavailable assistance." },
      render: async () => { throw new Error("synthetic_ordinary_reply_must_not_render_trusted_support"); },
      pauseNotice: () => "Synthetic pause notice." },
    buildContext: async (input) => {
      const authorizedContext = JSON.stringify({ contractVersion: "wi007-v0.1+onboarding-fields-v2+compass-v1",
        globalPolicy: { version: configuration.globalPolicy.version, text: configuration.globalPolicy.text },
        roleBehavior: { version: configuration.roleBehavior.version, text: configuration.roleBehavior.text },
        crisisBehavior: { version: configuration.crisisBehavior.version, text: configuration.crisisBehavior.text },
        compassContext: { version: "explorer-compass-context.v1", points: [{ id: id(9), label: "Money worries", order: 0,
          formation: "saved", anchor: null, emphasis: null }], priorityId: null, attentionId: null, recentRoute: [], waypoints: [], drafts: [] },
        immediateExplorerMessage: { messageId: input.ids.messageId, content: input.command.body }, outputRequirements: { format: "plain_text" } });
      return { request: { contractVersion: EXPLORER_SAFETY_REQUEST_VERSION, invocationId: input.ids.invocationId,
        explorerId: id(4), sessionId: input.ids.conversationId, contextSnapshotId: input.ids.snapshotId,
        contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex").toUpperCase(), authorizedContext,
        mode: input.mode, classificationPolicyVersion: readiness.modelPolicyVersion,
        fallbackPolicyVersion: configuration.fallback.version, instructionVersion: configuration.instructionVersion },
      evidence: { p_context_source_ids: [input.ids.messageId, id(5), id(7), id(9), id(10)].sort(), p_authorization_version: "AV3:" + SHA,
        p_intake_response_set_id: id(5), p_prompt_version: configuration.promptVersion, p_policy_version: configuration.globalPolicy.version,
        p_behavior_version: configuration.roleBehavior.version, p_crisis_version: configuration.crisisBehavior.version,
        p_role_version: configuration.roleVersion, p_instruction_version: configuration.instructionVersion } };
    },
  };
  return { dependencies, rpc, fetchImpl };
}

describe("S4 joined current private path, with injected synthetic HTTP and RPC results", () => {
  it("admits v2 proposals once, calls the exact v4 port and retains choices through browser decoding and replay", async () => {
    const f = fixture({ compass: { attention: id(9) }, choices: CHOICES });
    const result = await commandExplorerPrivateConversation({ command: COMMAND, dependencies: f.dependencies });
    expect(result.assistance).toBeNull(); expect(result.result.ok).toBe(true); expect(f.fetchImpl).toHaveBeenCalledOnce();
    const preparations = f.rpc.mock.calls.filter(([name]) => name === "solmind_prepare_explorer_conversation_turn_v3");
    expect(preparations).toHaveLength(1); expect(Object.keys(preparations[0][1])).toHaveLength(37);
    const terminals = f.rpc.mock.calls.filter(([name]) => name === "solmind_settle_explorer_conversation_turn_v4");
    expect(terminals).toHaveLength(1);
    expect(terminals[0][1]).toMatchObject({ p_protocol_version: "explorer-safety-reply.v2", p_attention_item_id: id(9),
      p_choices: CHOICES, p_status: "completed", p_reply_kind: "ordinary", p_delivery_interested: true });
    expect(f.rpc.mock.calls.some(([name]) => name === "solmind_settle_explorer_conversation_turn_v3")).toBe(false);
    const browser = parseExplorerPrivateConversationResponse(JSON.parse(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, ...result })));
    expect(browser?.result.ok && browser.result.state.attentionId).toBe(id(9));
    expect(browser?.result.ok && browser.result.state.messages.at(-1)?.choices).toEqual(CHOICES);
    expect(browser?.result.ok && browser.result.state.route?.[0]).toMatchObject({ kind: "attention_changed", actor: "virtual_guide", compassItemId: id(9) });
    const replay = await commandExplorerPrivateConversation({ command: COMMAND, dependencies: f.dependencies });
    expect(replay.assistance).toBeNull(); expect(replay.result.ok && replay.result.state.messages).toEqual(result.result.ok && result.result.state.messages);
    expect(f.fetchImpl).toHaveBeenCalledOnce();
    expect(f.rpc.mock.calls.filter(([name]) => name === "solmind_settle_explorer_conversation_turn_v4")).toHaveLength(1);
    expect(f.rpc.mock.calls.filter(([name]) => name === "solmind_prepare_explorer_conversation_turn_v3")).toHaveLength(1);
  });

  it("keeps the usable reply when both optional proposal groups are malformed", async () => {
    const f = fixture({ compass: { attention: "unknown" }, choices: [{ label: "x".repeat(41) }] });
    const result = await commandExplorerPrivateConversation({ command: COMMAND, dependencies: f.dependencies });
    expect(result.assistance).toBeNull(); expect(result.result.ok).toBe(true);
    const terminal = f.rpc.mock.calls.find(([name]) => name === "solmind_settle_explorer_conversation_turn_v4");
    expect(terminal?.[1]).toMatchObject({ p_attention_item_id: null, p_choices: null, p_reply_kind: "ordinary" });
    const browser = parseExplorerPrivateConversationResponse(JSON.parse(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, ...result })));
    expect(browser?.result.ok && browser.result.state.messages.at(-1)?.body).toBe("We can explore what matters about that topic.");
    expect(browser?.result.ok && browser.result.state.messages.at(-1)).not.toHaveProperty("choices");
    expect(f.fetchImpl).toHaveBeenCalledOnce();
  });
});
