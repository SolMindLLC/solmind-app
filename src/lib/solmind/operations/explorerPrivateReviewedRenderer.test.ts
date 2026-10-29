import { describe, expect, it } from "vitest";
import { createExplorerPrivateReviewedRenderer } from "./explorerPrivateReviewedRenderer";
import { getExplorerPrivateConfigurationCandidate } from "../virtual-guide/explorerPrivateConfiguration";
import { combineExplorerSafety, selectExplorerSafetyReply, type ExplorerSafetyReplyPlan } from "../virtual-guide/explorerConversationSafety";
import type { ExplorerPrivateOperationalReadiness } from "../virtual-guide/explorerPrivateConversationComposition";

// Synthetic text and receipts only: no verified service, human adoption,
// notification, provider, persistence or clinical suitability is established.
const SHA = "A".repeat(64);
const ID = "10000000-0000-4000-8000-000000000001";
const ADULT = "SYNTHETIC ADULT RESOURCE BLOCK: not a real service.";
const YOUTH = "SYNTHETIC AGE-APPROPRIATE RESOURCE BLOCK: not a real service.";
const FAILURE = "explorer_private_renderer_unavailable";
function fixture() {
  const configuration = getExplorerPrivateConfigurationCandidate();
  if (!configuration) throw new Error("synthetic_configuration_missing");
  const failureAssistance = { support: "Synthetic support.", adultPolicy: "Synthetic adult boundary.",
    supportAndAdultPolicy: "Synthetic support and adult boundary.", temporarilyUnavailable: "Synthetic unavailable." };
  const input = { verificationReceiptSha256: SHA, resourcePolicyVersion: "synthetic-resources.v1",
    adultResources: ADULT, ageAppropriateResources: YOUTH, failureAssistance };
  const renderer = createExplorerPrivateReviewedRenderer(input);
  const readiness: ExplorerPrivateOperationalReadiness = {
    configuration, configurationFingerprint: SHA, modelName: "gpt-5.6-luna", modelPolicyVersion: "synthetic-model.v1",
    resourcePolicyVersion: input.resourcePolicyVersion, sourceVerificationReceiptSha256: SHA,
    resourceVerificationReceiptSha256: SHA, rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: ID, versionId: ID, contentSha256: SHA, authorizationVersion: "MV1:" + SHA },
  };
  function plan(level: 0 | 3 | 4, minor = false, previousFloor: 3 | 4 | null = null): ExplorerSafetyReplyPlan {
    return selectExplorerSafetyReply({
      safety: combineExplorerSafety({ policy: { status: "known", restrictedLevel: previousFloor,
        adultReflectionStopped: false, safetyVersion: 0 },
        fallback: { status: "available", policyVersion: configuration!.fallback.version,
          classification: { level, minorIndicated: minor } }, model: { level, minorIndicated: minor } }),
      candidate: { kind: "not_requested" }, trusted: configuration!.trustedResponses, persistence: "pending",
    });
  }
  return { input, renderer, readiness, configuration, plan };
}

describe("explicit private reviewed renderer with synthetic resources", () => {
  it.each([
    { level: 3 as const, minor: false, kind: "urgent", resources: ADULT },
    { level: 4 as const, minor: true, kind: "crisis", resources: YOUTH },
    { level: 0 as const, minor: true, kind: "adult_only", resources: YOUTH },
  ])("renders pinned $kind segments with the selected resource block in order", async ({ level, minor, kind, resources }) => {
    const f = fixture(); const plan = f.plan(level, minor);
    const result = await f.renderer.render(plan, f.readiness, new AbortController().signal);
    expect(result.kind).toBe(kind);
    expect(result.body).toBe([...plan.beforeResources, resources, ...plan.afterResources].join("\n\n"));
    expect(result.body).toContain(resources);
    expect(result.body).not.toContain(resources === ADULT ? YOUTH : ADULT);
    expect(result.trustedResponseVersion).toBe(f.configuration.trustedResponses.version);
    expect(result.resourcePolicyVersion).toBe("synthetic-resources.v1");
    if (minor) expect(result.body).toContain(f.configuration.trustedResponses.adultOnly);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("keeps continuing restricted presence free of an automatically repeated resource block", async () => {
    const f = fixture(); const plan = f.plan(0, false, 3);
    const result = await f.renderer.render(plan, f.readiness, new AbortController().signal);
    expect(plan.kind).toBe("restricted_followup"); expect(result.kind).toBe("restricted");
    expect(result.body).toBe(f.configuration.trustedResponses.restrictedFollowup);
    expect(result.body).not.toContain(ADULT); expect(result.body).not.toContain(YOUTH);
  });

  it("refuses unreviewed plan segments, resource selection, version and ordinary generated prose", async () => {
    const f = fixture(); const plan = f.plan(3);
    const invalid: ExplorerSafetyReplyPlan[] = [
      { ...plan, beforeResources: ["An unreviewed caller-inserted segment."] },
      { ...plan, afterResources: ["A fabricated notification promise."] },
      { ...plan, resourceRequirement: "reviewed_age_appropriate" },
      { ...plan, configurationVersion: "unreviewed-version.v1" },
      { ...plan, kind: "ordinary", ordinaryCandidate: "Synthetic generated prose.", beforeResources: [], afterResources: [], resourceRequirement: null },
    ];
    for (const altered of invalid) {
      await expect(f.renderer.render(altered, f.readiness, new AbortController().signal)).rejects.toThrow(FAILURE);
    }
  });

  it("binds renderer receipt and resource version and honors pre-render cancellation", async () => {
    const f = fixture(); const plan = f.plan(4);
    for (const readiness of [
      { ...f.readiness, rendererVerificationReceiptSha256: "B".repeat(64) },
      { ...f.readiness, resourcePolicyVersion: "unreviewed-resources.v1" },
    ]) await expect(f.renderer.render(plan, readiness, new AbortController().signal)).rejects.toThrow(FAILURE);
    const canceled = new AbortController(); canceled.abort();
    await expect(f.renderer.render(plan, f.readiness, canceled.signal)).rejects.toThrow(FAILURE);
  });

  it("keeps an immutable assistance copy and supplies no notification/adoption capability", () => {
    const f = fixture(); f.input.failureAssistance.support = "Changed outside the renderer.";
    expect(f.renderer.failureAssistance.support).toBe("Synthetic support.");
    expect(Object.keys(f.renderer).sort()).toEqual(["failureAssistance", "render", "verificationReceiptSha256"]);
    expect(Object.isFrozen(f.renderer)).toBe(true); expect(Object.isFrozen(f.renderer.failureAssistance)).toBe(true);
    expect(() => createExplorerPrivateReviewedRenderer({ ...f.input, adultResources: "" })).toThrow(FAILURE);
    expect(() => createExplorerPrivateReviewedRenderer({ ...f.input, ageAppropriateResources: "\ud800" })).toThrow(FAILURE);
  });
});
