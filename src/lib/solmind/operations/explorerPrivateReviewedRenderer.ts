import "server-only";
import { explorerSafetyUnicodeValid } from "../virtual-guide/explorerSafetyReplyContract";
import type { ExplorerPrivateConversationDependencies, ExplorerPrivateOperationalReadiness, ExplorerPrivatePauseNotice } from "../virtual-guide/explorerPrivateConversationComposition";
import type { ExplorerSafetyReplyPlan } from "../virtual-guide/explorerConversationSafety";

type Renderer = NonNullable<ExplorerPrivateConversationDependencies["renderer"]>;
const FAILURE = "explorer_private_renderer_unavailable";
// Hard-stop pause notices (decision queue 2026-11-01 01:07:27), each giving the true restart condition (13:26:32):
// the individual stop waits for an Admin's lift, the shared stop ends at midnight, Chicago time, and with both,
// sending resumes only once both are over.
const PAUSE_TEXT: Readonly<Record<ExplorerPrivatePauseNotice["kind"], string>> = Object.freeze({
  individual: "Sending to the Virtual Guide is paused because this account has reached its daily limit for AI use. " +
    "Sending can start again once a SolMind Admin lifts the pause. Your saved messages remain available.",
  shared: "SolMind has reached its shared daily limit for AI use, so sending to the Virtual Guide is paused. " +
    "You can try again after midnight, Chicago time. Your saved messages remain available.",
  individual_and_shared: "Sending to the Virtual Guide is paused because this account has reached its daily limit for AI use " +
    "and SolMind has reached its shared daily limit. Sending can start again only after both pauses have ended: SolMind's " +
    "shared pause ends at midnight, Chicago time, and this account's pause must also be lifted. A SolMind Admin can lift " +
    "this account's pause. Your saved messages remain available.",
});
const PAUSE_REFUSED = "The message in the box has not been sent or saved.";
const PAUSE_HELP = "If you need help right now:";
// A data copy of the notice, read once from plain data properties (no getters), or null when it is malformed.
function pauseNoticeCopy(notice: unknown): ExplorerPrivatePauseNotice | null {
  if (notice === null || typeof notice !== "object" || Array.isArray(notice) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(notice))) return null;
  if (Reflect.ownKeys(notice).length !== 4 || Object.keys(notice).sort().join("|") !== "adultsOnly|crisis|kind|refused") return null;
  const copy: Record<string, unknown> = {};
  for (const key of ["kind", "crisis", "adultsOnly", "refused"]) {
    const descriptor = Object.getOwnPropertyDescriptor(notice, key);
    if (!descriptor || !("value" in descriptor)) return null;
    copy[key] = descriptor.value;
  }
  if (typeof copy.kind !== "string" || !Object.hasOwn(PAUSE_TEXT, copy.kind) || ![null, "crisis", "urgent"].includes(copy.crisis as string | null) ||
    typeof copy.adultsOnly !== "boolean" || typeof copy.refused !== "boolean") return null;
  return Object.freeze(copy) as ExplorerPrivatePauseNotice;
}
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
    // The pause notice for the Explorer's own screen. A crisis notice leads with the trusted crisis parts in the
    // reply order (acknowledgment, limits, help resources, human contact), then the adults-only paragraph where it
    // applies, then the pause (00:39:51); the ordinary notice ends with the help resources. Adults-only uses the
    // age-appropriate resources.
    pauseNotice(input: ExplorerPrivatePauseNotice, readiness: ExplorerPrivateOperationalReadiness): string {
      const notice = pauseNoticeCopy(input);
      if (notice === null || readiness.resourcePolicyVersion !== resourcePolicyVersion ||
        readiness.rendererVerificationReceiptSha256 !== verificationReceiptSha256) throw new Error(FAILURE);
      const trusted = readiness.configuration.trustedResponses;
      const help = notice.adultsOnly ? resources.age : resources.adult;
      const pause = [PAUSE_TEXT[notice.kind], ...(notice.refused ? [PAUSE_REFUSED] : [])];
      const parts = notice.crisis === null
        ? [...pause, ...(notice.adultsOnly ? [trusted.adultOnly] : []), `${PAUSE_HELP}\n${help}`]
        : [trusted[notice.crisis].acknowledgment, trusted[notice.crisis].limits, help, trusted[notice.crisis].humanConnection,
          ...(notice.adultsOnly ? [trusted.adultOnly] : []), ...pause];
      const rendered = parts.join("\n\n");
      if (!parts.every(body) || !body(rendered)) throw new Error(FAILURE);
      return rendered;
    },
  });
}
