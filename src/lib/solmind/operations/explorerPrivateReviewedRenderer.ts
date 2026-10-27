import "server-only";
import { explorerSafetyUnicodeValid } from "../virtual-guide/explorerSafetyReplyContract";
import type { ExplorerPrivateConversationDependencies, ExplorerPrivateOperationalReadiness } from "../virtual-guide/explorerPrivateConversationComposition";
import type { ExplorerSafetyReplyPlan } from "../virtual-guide/explorerConversationSafety";

type Renderer = NonNullable<ExplorerPrivateConversationDependencies["renderer"]>;
const FAILURE = "explorer_private_renderer_unavailable";
function body(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 8192 && explorerSafetyUnicodeValid(value) &&
    !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(value);
}
/** Actual rendering mechanism; injected receipts/text still require genuine review/adoption. */
export function createExplorerPrivateReviewedRenderer(input: Readonly<{
  verificationReceiptSha256: string; resourcePolicyVersion: string;
  adultResources: string; ageAppropriateResources: string;
  failureAssistance: Renderer["failureAssistance"];
}>): Renderer {
  if (!/^[0-9A-F]{64}$/.test(input.verificationReceiptSha256) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(input.resourcePolicyVersion) ||
    !body(input.adultResources) || !body(input.ageAppropriateResources) ||
    Object.keys(input.failureAssistance).sort().join("|") !== "adultPolicy|support|supportAndAdultPolicy|temporarilyUnavailable" ||
    !Object.values(input.failureAssistance).every(body)) throw new Error(FAILURE);
  const resources = Object.freeze({ adult: input.adultResources, age: input.ageAppropriateResources });
  const resourcePolicyVersion = input.resourcePolicyVersion;
  const verificationReceiptSha256 = input.verificationReceiptSha256;
  const failureAssistance = Object.freeze({ ...input.failureAssistance });
  return Object.freeze({ verificationReceiptSha256, failureAssistance,
    async render(plan: ExplorerSafetyReplyPlan, readiness: ExplorerPrivateOperationalReadiness, signal: AbortSignal) {
      if (signal.aborted || readiness.resourcePolicyVersion !== resourcePolicyVersion ||
        readiness.rendererVerificationReceiptSha256 !== verificationReceiptSha256 ||
        plan.configurationVersion !== readiness.configuration.trustedResponses.version || plan.ordinaryCandidate !== null ||
        plan.operationalFailureSignalRequired || plan.requiredPersistenceConfirmed) throw new Error(FAILURE);
      const trusted = readiness.configuration.trustedResponses;
      let before: readonly string[]; let after: readonly string[] = [];
      let requirement: ExplorerSafetyReplyPlan["resourceRequirement"] = null;
      let kind: "urgent" | "crisis" | "restricted" | "adult_only";
      if (plan.kind === "urgent" || plan.kind === "crisis") {
        kind = plan.kind; const selected = trusted[kind];
        before = [selected.acknowledgment, selected.limits];
        after = [selected.humanConnection, ...(plan.adultBoundaryIncluded ? [trusted.adultOnly] : [])];
        requirement = plan.adultBoundaryIncluded ? "reviewed_age_appropriate" : "reviewed_adult";
      } else if (plan.kind === "adult_only" && plan.adultBoundaryIncluded) {
        kind = "adult_only"; before = [trusted.adultOnly]; requirement = "reviewed_age_appropriate";
      } else if (plan.kind === "restricted_followup" && !plan.adultBoundaryIncluded) {
        kind = "restricted"; before = [trusted.restrictedFollowup];
      } else throw new Error(FAILURE);
      // A caller cannot smuggle unreviewed segments through a plan-shaped object.
      if (JSON.stringify(plan.beforeResources) !== JSON.stringify(before) || JSON.stringify(plan.afterResources) !== JSON.stringify(after) ||
        plan.resourceRequirement !== requirement) throw new Error(FAILURE);
      const rendered = [...before, ...(requirement === null ? [] : [requirement === "reviewed_adult" ? resources.adult : resources.age]), ...after].join("\n\n");
      if (!body(rendered) || signal.aborted) throw new Error(FAILURE);
      return Object.freeze({ kind, body: rendered, trustedResponseVersion: trusted.version, resourcePolicyVersion });
    },
  });
}
