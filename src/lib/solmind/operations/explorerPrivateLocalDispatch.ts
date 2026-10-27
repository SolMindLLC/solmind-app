import "server-only";
import { createHash } from "node:crypto";
import { parseExplorerConversationResult } from "../explorerConversationContract";
import { parseExplorerPrivatePolicy } from "../virtual-guide/explorerPrivateConversationComposition";
import { parseEffectiveMethodologySelection } from "../virtual-guide/effectiveMethodologyContext";
import { parseExplorerSafetyReplyRequest } from "../virtual-guide/explorerSafetyReplyContract";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";
import type { EffectiveMethodologySource } from "../virtual-guide/effectiveMethodologyContext";
import type { ExplorerPrivateLocalRun } from "./explorerPrivateLocalRunProfile";

type Dependencies = ExplorerPrivateConversationDependencies;
type Build = NonNullable<Dependencies["buildContext"]>;
const FAILURE = "explorer_private_local_dispatch_unavailable";
function fail(): never { throw new Error(FAILURE); }

/** Request-scoped authority preflight, not an independent snapshot-scanning service. */
export function withExplorerPrivateLocalDispatch(input: Readonly<{
  run: ExplorerPrivateLocalRun; authenticate: Dependencies["authenticate"];
  repository: Dependencies["repository"]; methodologySource: EffectiveMethodologySource;
  buildContext: Build; generate: NonNullable<Dependencies["provider"]>["generate"];
}>): Readonly<{ buildContext: Build; provider: NonNullable<Dependencies["provider"]> }> {
  let captured: Readonly<{ args: Parameters<Build>[0]; result: Awaited<ReturnType<Build>> }> | null = null;
  let attempted = false;
  const { profile } = input.run;
  const expectedScope = Object.freeze({ type: "guide" as const, id: profile.guideId });
  return Object.freeze({
    async buildContext(args: Parameters<Build>[0]) {
      if (captured || args.actor.accountId !== profile.actorAccountId || args.signal?.aborted) fail();
      const result = await input.buildContext(args);
      if (args.signal?.aborted || result.request.explorerId !== profile.explorerId ||
        createHash("sha256").update(args.command.body, "utf8").digest("hex").toUpperCase() !== profile.explorerMessageSha256) fail();
      // Compare the contract parser's copied representation on both sides;
      // property insertion order is not prepared-turn identity.
      const copied = Object.freeze({ request: parseExplorerSafetyReplyRequest(result.request), evidence: result.evidence });
      captured = Object.freeze({ args, result: copied });
      return copied;
    },
    provider: Object.freeze({
      async generate(raw: Parameters<NonNullable<Dependencies["provider"]>["generate"]>[0], signal: AbortSignal) {
        const frame = captured;
        const request = parseExplorerSafetyReplyRequest(raw);
        let sessionExpiresAt = Number.POSITIVE_INFINITY;
        const alive = () => !attempted && !signal.aborted && !frame?.args.signal?.aborted &&
          Date.now() < Date.parse(profile.expiresAt) && Date.now() < sessionExpiresAt;
        if (!frame || !alive() || JSON.stringify(request) !== JSON.stringify(frame.result.request)) fail();
        const actor = await input.authenticate();
        if (!alive() || !actor || actor.accountId !== frame.args.actor.accountId ||
          actor.applicationSessionId !== frame.args.actor.applicationSessionId) fail();
        const row = await input.repository.read(actor);
        if (!alive() || row.outcome !== "ok" || !row.authority_context || typeof row.authority_context !== "object") fail();
        const authority = row.authority_context as Record<string, unknown>;
        sessionExpiresAt = typeof authority.applicationSessionExpiresAt === "string" ? Date.parse(authority.applicationSessionExpiresAt) : Number.NaN;
        const state = parseExplorerConversationResult({ ok: true, state: row.conversation_state, error: null });
        const policy = parseExplorerPrivatePolicy(row.policy_state);
        const expectedPolicy = parseExplorerPrivatePolicy(frame.args.row.policy_state);
        if (!Number.isFinite(sessionExpiresAt) || !alive() || !state?.ok || state.state.conversationId !== request.sessionId || !state.state.pendingTurn ||
          state.state.revision !== frame.args.command.expectedRevision + 1 ||
          !state.state.messages.some(message => message.id === frame.args.ids.messageId && message.role === "explorer" && message.body === frame.args.command.body) ||
          authority.accountId !== actor.accountId || authority.applicationSessionId !== actor.applicationSessionId ||
          authority.explorerId !== profile.explorerId || authority.guideId !== profile.guideId ||
          authority.authorizationVersion !== frame.result.evidence.p_authorization_version ||
          policy.status !== "known" || expectedPolicy.status !== "known" || policy.safetyVersion !== expectedPolicy.safetyVersion) fail();
        const mode = policy.restrictedLevel !== null || policy.adultReflectionStopped ? "classification_only" : "classification_and_reply";
        if (mode !== request.mode) fail();
        const selected = parseEffectiveMethodologySelection(await input.methodologySource.read({ actor,
          packId: profile.packId, expectedScope, signal }), { packId: profile.packId, expectedScope });
        if (!alive() || selected.versionId !== profile.methodologyVersionId ||
          selected.contentSha256 !== profile.methodologyContentSha256 ||
          selected.methodologyAuthorizationVersion !== profile.methodologyAuthorizationVersion) fail();
        // A second authenticated read follows the awaited methodology check.
        const finalActor = await input.authenticate();
        if (!alive() || !finalActor || finalActor.accountId !== actor.accountId ||
          finalActor.applicationSessionId !== actor.applicationSessionId) fail();
        const finalRow = await input.repository.read(finalActor);
        if (!alive() || finalRow.outcome !== "ok" ||
          JSON.stringify(finalRow.authority_context) !== JSON.stringify(row.authority_context) ||
          JSON.stringify(finalRow.policy_state) !== JSON.stringify(row.policy_state) ||
          JSON.stringify(finalRow.conversation_state) !== JSON.stringify(row.conversation_state)) fail();
        // Consume before forwarding. Unknown transport outcomes never grant retry.
        input.run.claim();
        if (!alive()) fail();
        attempted = true;
        const remaining = Math.floor(Math.min(sessionExpiresAt, Date.parse(profile.expiresAt)) - Date.now());
        if (remaining <= 0) fail();
        const expiry = AbortSignal.timeout(Math.min(remaining, 2_147_483_647));
        return input.generate(request, AbortSignal.any([signal, expiry]));
      },
    }),
  });
}
