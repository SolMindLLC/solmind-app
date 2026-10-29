import "server-only";
import { composeRequestAuthContext } from "../auth/composeRequestAuthContext";
import { noopCookieSetAll, type RequestCookie } from "../auth/requestCookieAccessor";
import { createSupabaseRequestAuthPrincipalSource } from "./requestAuthClient";
import { createServiceRoleClient } from "./serviceRoleClient";
import { createServiceRoleRpcExecutor } from "./serviceRoleRpcExecutor";
import { createSupabaseAuthQueryClient } from "./supabaseAuthQueryClient";
import { createSupabaseAuthSource } from "./serverAuthSourceAdapter";
import { createExplorerConversationRepository } from "./explorerConversationRepository";
import { createExplorerPrivateConversationRepository } from "./explorerPrivateConversationRepository";
import type { ExplorerConversationDependencies } from "../virtual-guide/explorerConversationComposition";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";
import { withExplorerPrivateRequestBudgets } from "../operations/explorerPrivateRequestBudgets";
import { loadExplorerPrivateLocalRun } from "../operations/explorerPrivateLocalRunProfile";
import { withExplorerPrivateLocalDispatch } from "../operations/explorerPrivateLocalDispatch";
import { createExplorerPrivateReviewedRenderer } from "../operations/explorerPrivateReviewedRenderer";
import { createExplorerPrivateFileSignal } from "../operations/explorerPrivateOperationalSignal";
import { getExplorerPrivateConfigurationCandidate } from "../virtual-guide/explorerPrivateConfiguration";
import { createExplorerPrivateGovernedCapabilities } from "../virtual-guide/explorerPrivateGovernedCapabilities";
import { createOpenAiLunaExplorerSafetyTransport } from "../virtual-guide/openAiLunaExplorerSafetyTransport";
import { createEffectiveMethodologySource } from "./effectiveMethodologySource";
import { join } from "node:path";
import { readOpenAiModelName } from "../virtual-guide/openAiModelConfiguration";

// Preserve duplicate wire names and exact values. Framework cookie maps cannot
// establish the raw-cookie ambiguity check owned by the banked login boundary.
export function readExplorerConversationCookies(raw: string | null): readonly RequestCookie[] | null {
  if (raw === null || raw === "") return [];
  if (raw.length > 16_384) return null;
  const parts = raw.split(";");
  if (parts.length > 128) return null;
  const result: RequestCookie[] = [];
  for (const segment of parts) {
    const pair = segment.replace(/^[\t ]+/, "");
    const equals = pair.indexOf("=");
    if (equals < 1) return null;
    const name = pair.slice(0, equals), value = pair.slice(equals + 1);
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) ||
        !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/.test(value)) return null;
    result.push({ name, value });
  }
  return result;
}

function createRequestAuthentication(rawCookieHeader: string | null) {
  const snapshot = readExplorerConversationCookies(rawCookieHeader);
  if (snapshot === null) throw new Error("explorer_conversation_request_unavailable");
  const cookies = { getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll };
  const principalSource = createSupabaseRequestAuthPrincipalSource({ cookies });
  const client = createServiceRoleClient();
  const authSource = createSupabaseAuthSource(createSupabaseAuthQueryClient({
    client: createServiceRoleRpcExecutor(client), now: () => new Date(),
  }));
  return Object.freeze({
    client,
    authenticate: async () => {
      const access = await composeRequestAuthContext({ principalSource, authSource }, {
        selectors: { requestedRoute: "/explorer/home" },
      });
      if (!access.allowed) return null;
      const expiresAt = Date.parse(access.context.session.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
      return Object.freeze({ accountId: access.context.identity.userAccountId,
        applicationSessionId: access.context.session.userSessionId });
    },
  });
}

// Retain the predecessor interface for its explicitly scoped historical proof.
export function createExplorerConversationRequestDependencies(rawCookieHeader: string | null): ExplorerConversationDependencies {
  const { authenticate, client } = createRequestAuthentication(rawCookieHeader);
  return Object.freeze({ authenticate, repository: createExplorerConversationRepository(client) });
}

export type ExplorerPrivateRequestCapabilities = Omit<ExplorerPrivateConversationDependencies, "authenticate" | "repository">;
export function createExplorerPrivateConversationRequestDependencies(
  rawCookieHeader: string | null,
  capabilities?: ExplorerPrivateRequestCapabilities,
): ExplorerPrivateConversationDependencies {
  const { authenticate, client } = createRequestAuthentication(rawCookieHeader);
  const base = { authenticate, repository: createExplorerPrivateConversationRepository(client) };
  // Only explicit server injection can supply operational ports. No environment,
  // credential lookup, candidate-ready flag, synthetic default or activation.
  if (capabilities === undefined) return withExplorerPrivateRequestBudgets(base);
  return withExplorerPrivateRequestBudgets({ ...base,
    resolveOperationalReadiness: capabilities.resolveOperationalReadiness,
    provider: capabilities.provider, buildContext: capabilities.buildContext,
    renderer: capabilities.renderer, operationalSignal: capabilities.operationalSignal });
}

/**
 * The actual local HTTP composition. Absent/invalid/expired pinned run data
 * leaves the ordinary auth+repository path held. No import/startup activation,
 * browser-selected profile, synthetic methodology or approval is supplied.
 */
export function createExplorerPrivateLocalRequestDependencies(
  rawCookieHeader: string | null,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ExplorerPrivateConversationDependencies {
  const { authenticate, client } = createRequestAuthentication(rawCookieHeader);
  const repository = createExplorerPrivateConversationRepository(client);
  const base = withExplorerPrivateRequestBudgets({ authenticate, repository });
  const run = loadExplorerPrivateLocalRun(environment);
  if (!run) return base;
  try {
    const { profile } = run;
    const configuration = getExplorerPrivateConfigurationCandidate();
    if (!configuration || configuration.methodologySubjectSha256 !== profile.methodologyContentSha256) return base;
    const methodologySource = createEffectiveMethodologySource(client);
    const renderer = createExplorerPrivateReviewedRenderer({ verificationReceiptSha256: profile.receipts.renderer.sha256,
      resourcePolicyVersion: profile.resourcePolicyVersion, adultResources: run.adultResources,
      ageAppropriateResources: run.ageAppropriateResources, failureAssistance: run.failureAssistance });
    const operationalSignal = createExplorerPrivateFileSignal({ filePath: join(run.directory, "explorer-private-signals.jsonl"),
      verificationReceiptSha256: profile.receipts.signal.sha256 });
    const credentialReady = () => {
      if (readOpenAiModelName(environment) !== run.modelName) return false;
      const key = environment.OPENAI_API_KEY;
      return typeof key === "string" && key.length >= 1 && key.length <= 4096 &&
        !/[\s\u0000-\u001f\u007f-\u009f]/u.test(key);
    };
    const generate: NonNullable<ExplorerPrivateConversationDependencies["provider"]>["generate"] = async (request, signal) => {
      // Called only through the authority preflight and durable one-call claim.
      // This exact credential source needs a later explicit provider grant.
      const apiKey = environment.OPENAI_API_KEY;
      if (!apiKey) throw new Error("explorer_private_local_dispatch_unavailable");
      return createOpenAiLunaExplorerSafetyTransport({ apiKey, fetchImpl: fetch, modelName: run.modelName }).generate(request, signal);
    };
    const governed = createExplorerPrivateGovernedCapabilities({ repository: base.repository, methodologySource,
      packId: profile.packId, expectedScope: { type: "guide", id: profile.guideId }, configuration,
      acceptanceReceiptSha256: profile.receipts.policy.sha256, sourceVerificationReceiptSha256: profile.receipts.source.sha256,
      resourceVerificationReceiptSha256: profile.receipts.resources.sha256, modelPolicyVersion: profile.modelPolicyVersion,
      resourcePolicyVersion: profile.resourcePolicyVersion, modelName: run.modelName, renderer, operationalSignal, provider: { generate } });
    const bound = withExplorerPrivateLocalDispatch({ run, authenticate: base.authenticate, repository: base.repository,
      methodologySource, buildContext: governed.buildContext, credentialReady, generate });
    return withExplorerPrivateRequestBudgets({ authenticate, repository,
      ...governed, ...bound,
      resolveOperationalReadiness: async (actor, row) => {
        if (!run.available() || actor.accountId !== profile.actorAccountId) return null;
        const ready = await governed.resolveOperationalReadiness(actor, row);
        return run.available() && ready?.methodology.versionId === profile.methodologyVersionId &&
          ready.methodology.authorizationVersion === profile.methodologyAuthorizationVersion ? ready : null;
      } });
  } catch { return base; }
}
