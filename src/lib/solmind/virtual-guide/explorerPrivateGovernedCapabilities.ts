import "server-only";
import { createHash } from "node:crypto";
import { parseOpenAiModelName } from "./openAiModelConfiguration";
import { parseExplorerPrivateConfigurationCandidate, type ExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import { adaptPrivateGovernedExplorerContextBuilder, type ExplorerPrivateConversationDependencies,
  type ExplorerPrivateOperationalReadiness, type ExplorerPrivateConversationRepository } from "./explorerPrivateConversationComposition";
import { createPrivateGovernedExplorerConversationContextBuilder } from "./explorerConversationContext";
import { parseEffectiveMethodologyScope, parseEffectiveMethodologySelection,
  type EffectiveMethodologyScope, type EffectiveMethodologySource } from "./effectiveMethodologyContext";

type Capabilities = Required<Omit<ExplorerPrivateConversationDependencies, "authenticate" | "repository">>;
const FAILURE = "explorer_private_governed_capabilities_unavailable";
const SHA = /^[0-9A-F]{64}$/;
/**
 * Explicit server composition only. Receipt labels are bindings, never approval
 * evidence manufactured by this factory. The operator must supply genuinely
 * accepted policy/resources/source/signal/renderer evidence before injection.
 * Real effective-methodology lookup remains mandatory on every readiness/turn.
 */
export function createExplorerPrivateGovernedCapabilities(input: Readonly<{
  repository: ExplorerPrivateConversationRepository; methodologySource: EffectiveMethodologySource;
  packId: string; expectedScope: EffectiveMethodologyScope; configuration: ExplorerPrivateConfigurationCandidate;
  acceptanceReceiptSha256: string; sourceVerificationReceiptSha256: string; resourceVerificationReceiptSha256: string;
  modelPolicyVersion: string; resourcePolicyVersion: string; modelName: string;
  provider: NonNullable<ExplorerPrivateConversationDependencies["provider"]>;
  renderer: NonNullable<ExplorerPrivateConversationDependencies["renderer"]>;
  operationalSignal: NonNullable<ExplorerPrivateConversationDependencies["operationalSignal"]>;
}>): Capabilities {
  const configuration = parseExplorerPrivateConfigurationCandidate(input.configuration);
  const modelName = parseOpenAiModelName(input.modelName);
  const expectedScope = parseEffectiveMethodologyScope(input.expectedScope); const packId = input.packId;
  const { acceptanceReceiptSha256, sourceVerificationReceiptSha256, resourceVerificationReceiptSha256,
    modelPolicyVersion, resourcePolicyVersion } = input;
  const rendererVerificationReceiptSha256 = input.renderer.verificationReceiptSha256;
  const signalVerificationReceiptSha256 = input.operationalSignal.verificationReceiptSha256;
  if (!configuration || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(packId) ||
    ![acceptanceReceiptSha256, sourceVerificationReceiptSha256, resourceVerificationReceiptSha256,
      rendererVerificationReceiptSha256, signalVerificationReceiptSha256].every(value => typeof value === "string" && SHA.test(value)) ||
    ![modelPolicyVersion, resourcePolicyVersion].every(value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value))) throw new Error(FAILURE);
  const provider = Object.freeze({ generate: input.provider.generate });
  const renderer = Object.freeze({ verificationReceiptSha256: rendererVerificationReceiptSha256,
    failureAssistance: Object.freeze({ ...input.renderer.failureAssistance }), render: input.renderer.render });
  const operationalSignal = Object.freeze({ verificationReceiptSha256: signalVerificationReceiptSha256, emit: input.operationalSignal.emit });
  const methodologySource = Object.freeze({ read: input.methodologySource.read });
  const configurationFingerprint = createHash("sha256").update(JSON.stringify({ configuration, packId, expectedScope,
    acceptanceReceiptSha256, sourceVerificationReceiptSha256, resourceVerificationReceiptSha256,
    rendererVerificationReceiptSha256, signalVerificationReceiptSha256, modelPolicyVersion, resourcePolicyVersion, modelName })).digest("hex").toUpperCase();
  const builder = createPrivateGovernedExplorerConversationContextBuilder({ repository: { read: input.repository.read },
    packId, expectedScope, methodologySource, configuration: {
      promptVersion: configuration.promptVersion, instructionVersion: configuration.instructionVersion, roleVersion: configuration.roleVersion,
      globalPolicy: { version: configuration.globalPolicy.version, text: configuration.globalPolicy.text },
      roleBehavior: { version: configuration.roleBehavior.version, text: configuration.roleBehavior.text },
      crisisBehavior: { version: configuration.crisisBehavior.version, text: configuration.crisisBehavior.text },
    } });
  return Object.freeze({ provider, renderer, operationalSignal, buildContext: adaptPrivateGovernedExplorerContextBuilder(builder),
    async resolveOperationalReadiness(actor: Parameters<Capabilities["resolveOperationalReadiness"]>[0]): Promise<ExplorerPrivateOperationalReadiness | null> {
      try {
        const selection = parseEffectiveMethodologySelection(await methodologySource.read({ actor, packId, expectedScope }), { packId, expectedScope });
        if (selection.contentSha256 !== configuration.methodologySubjectSha256) return null;
        return Object.freeze({ configuration, configurationFingerprint, modelPolicyVersion, resourcePolicyVersion, modelName,
          sourceVerificationReceiptSha256, resourceVerificationReceiptSha256,
          rendererVerificationReceiptSha256, signalVerificationReceiptSha256,
          methodology: Object.freeze({ packId: selection.packId, versionId: selection.versionId, contentSha256: selection.contentSha256,
            authorizationVersion: selection.methodologyAuthorizationVersion }) });
      } catch { return null; }
    },
  });
}
