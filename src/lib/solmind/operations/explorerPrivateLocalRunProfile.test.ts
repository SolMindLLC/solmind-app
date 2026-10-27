// Synthetic local files/receipts only. No actual approval, account, provider or DB.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadExplorerPrivateLocalRun, parseExplorerPrivateLocalRunProfile } from "./explorerPrivateLocalRunProfile";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA = "A".repeat(64);
const roots: string[] = [];
afterEach(() => {
  // Framework-owned disposable roots only; no retained/workspace path is accepted.
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), "solmind-private-profile-"))) throw new Error("unsafe_test_root");
    rmSync(root, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "solmind-private-profile-")); roots.push(directory);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const refs: Record<string, { file: string; sha256: string }> = {};
  const save = (name: string, value: unknown) => {
    const bytes = JSON.stringify(value) + "\n";
    writeFileSync(join(directory, name + ".json"), bytes);
    refs[name] = { file: name + ".json", sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase() };
  };
  save("policy", { humanAccepted: true, requestSha256: "6DFBFFC629426F8AF3B67B83963CC8E24327D44F14CE36B66146C702F43BD520",
    sourceDraftSha256: "ED89374CF34C1AD8A7C33AC836140FB8A114D98BB095B31A81789CE14216E94E",
    amendedResourceSelection: { adultResources: "Synthetic adult help.", ageAppropriateResources: "Synthetic general help." },
    amendedFailureAssistance: { support: "Synthetic support.", adultPolicy: "Synthetic adult boundary.",
      supportAndAdultPolicy: "Synthetic support and boundary.", temporarilyUnavailable: "Synthetic unavailable." } });
  for (const key of ["source", "resources", "renderer", "signal"]) save(key, { fixtureOnly: true });
  save("target", { kind: "solmind-private-isolated-target.v1", result: "PASS", runId: uuid(1), artifactDirectory: directory,
    appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431", actorAccountId: uuid(2), explorerId: uuid(3), guideId: uuid(4) });
  save("provider", { kind: "solmind-private-explorer-provider-grant.v1", humanApproved: true,
    runId: uuid(1), expiresAt, artifactDirectory: directory, model: "gpt-5.6-luna", endpoint: "https://api.openai.com/v1/responses",
    reasoningEffort: "medium", maxOutputTokens: 4096, store: false, timeoutMilliseconds: 60_000,
    maximumExplorerCalls: 1, noRetry: true, noFallback: true, credentialSource: "OPENAI_API_KEY",
    explorerMessageSha256: SHA, methodologyContentSha256: SHA, packId: uuid(5), methodologyVersionId: uuid(6),
    modelPolicyVersion: "synthetic-model-policy", resourcePolicyVersion: "synthetic-resource-policy", targetReceiptSha256: refs.target.sha256 });
  const profile = { version: "explorer-private-local-run.v1", runId: uuid(1), expiresAt,
    appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431", actorAccountId: uuid(2),
    explorerId: uuid(3), guideId: uuid(4), packId: uuid(5), methodologyVersionId: uuid(6), methodologyContentSha256: SHA,
    methodologyAuthorizationVersion: "MV1:" + SHA, explorerMessageSha256: SHA,
    modelPolicyVersion: "synthetic-model-policy", resourcePolicyVersion: "synthetic-resource-policy", receipts: refs };
  const file = join(directory, "RUN_PROFILE.json");
  const environment: Record<string, string> = { SOLMIND_TRUSTED_APP_ORIGIN: profile.appOrigin, NEXT_PUBLIC_SUPABASE_URL: profile.supabaseOrigin };
  const freeze = () => {
    const raw = JSON.stringify(profile); writeFileSync(file, raw);
    environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE = file;
    environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE_SHA256 = createHash("sha256").update(raw).digest("hex").toUpperCase();
  };
  freeze(); return { directory, profile, environment, freeze, save };
}

describe("private local run data and durable finite admission", () => {
  it("does not read a provider credential when no profile is configured", () => {
    const secret = vi.fn(() => { throw new Error("must_not_read"); });
    const environment = Object.defineProperty({}, "OPENAI_API_KEY", { get: secret });
    expect(loadExplorerPrivateLocalRun(environment)).toBeNull(); expect(secret).not.toHaveBeenCalled();
  });
  it("loads pinned synthetic evidence and consumes the single allowance across reloads", () => {
    const f = fixture(); const run = loadExplorerPrivateLocalRun(f.environment)!;
    expect(run.adultResources).toBe("Synthetic adult help."); expect(run.available()).toBe(true);
    run.claim(); expect(run.available()).toBe(false); expect(() => run.claim()).toThrow();
    expect(loadExplorerPrivateLocalRun(f.environment)!.available()).toBe(false);
    expect(readFileSync(join(f.directory, `explorer-send-${uuid(1)}.claimed`), "utf8")).toBe("consumed\n");
  });
  it.each(["policy", "source", "resources", "renderer", "signal", "provider", "target"])("holds on changed %s evidence", name => {
    const f = fixture(); writeFileSync(join(f.directory, name + ".json"), "{}");
    expect(loadExplorerPrivateLocalRun(f.environment)).toBeNull();
  });
  it("rejects a stale or widened provider grant even when its new bytes are pinned", () => {
    const f = fixture(); f.save("provider", { maximumExplorerCalls: 2 }); f.freeze();
    expect(loadExplorerPrivateLocalRun(f.environment)).toBeNull();
  });
  it("refuses a different trusted application or database target", () => {
    const f = fixture(); expect(loadExplorerPrivateLocalRun({ ...f.environment, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toBeNull();
    expect(loadExplorerPrivateLocalRun({ ...f.environment, SOLMIND_TRUSTED_APP_ORIGIN: "https://example.com" })).toBeNull();
  });
  it("does not transfer an existing provider grant to a changed target receipt", () => {
    const f = fixture();
    const target = JSON.parse(readFileSync(join(f.directory, "target.json"), "utf8"));
    f.save("target", { ...target, changedEvidence: true }); f.freeze();
    expect(loadExplorerPrivateLocalRun(f.environment)).toBeNull();
  });
  it("rejects expiry, remote origins, path traversal, unknown fields and malformed JSON", () => {
    const f = fixture(); const raw = (patch: Record<string, unknown>) => JSON.stringify({ ...f.profile, ...patch });
    for (const value of [raw({ expiresAt: "2000-01-01T00:00:00.000Z" }), raw({ appOrigin: "https://example.com" }),
      raw({ extra: true }), "{", raw({ receipts: { ...f.profile.receipts, provider: { file: "../secret.json", sha256: SHA } } })]) {
      expect(parseExplorerPrivateLocalRunProfile(value, Date.now())).toBeNull();
    }
  });
});
