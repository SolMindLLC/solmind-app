// Synthetic local files/receipts only. No actual approval, account, provider or DB.
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT, loadExplorerPrivateLocalRun, parseExplorerPrivateLocalRunProfile } from "./explorerPrivateLocalRunProfile";
import {
  EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT as LEDGER_MODULE_ROOT, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING, explorerPrivateLocalLedgerDay,
} from "./explorerPrivateLocalCallLedger";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA = "A".repeat(64);
const roots: string[] = [];
afterEach(() => {
  // Framework-owned disposable roots only; no retained/workspace path is accepted.
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), "solmind-private-profile-"))) throw new Error("unsafe_test_root");
    rmSync(root, { recursive: true, force: true });
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function disposable() {
  const root = mkdtempSync(join(tmpdir(), "solmind-private-profile-")); roots.push(root); return root;
}
function ledger() {
  const root = join(disposable(), "ledger"); mkdirSync(root); return root;
}
function fixture(options: { limit?: unknown; runId?: number; ttl?: number; grant?: Record<string, unknown> } = {}) {
  const directory = disposable();
  const runId = uuid(options.runId ?? 1);
  const expiresAt = new Date(Date.now() + (options.ttl ?? 60_000)).toISOString();
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
  save("target", { kind: "solmind-private-isolated-target.v1", result: "PASS", runId, artifactDirectory: directory,
    appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431", actorAccountId: uuid(2), explorerId: uuid(3), guideId: uuid(4) });
  const grant: Record<string, unknown> = { kind: "solmind-private-explorer-provider-grant.v2", humanApproved: true,
    runId, expiresAt, artifactDirectory: directory, model: "gpt-5.6-luna", endpoint: "https://api.openai.com/v1/responses",
    reasoningEffort: "medium", maxOutputTokens: 4096, store: false, timeoutMilliseconds: 60_000,
    dailyConversationCallLimit: options.limit === undefined ? 3 : options.limit, noRetry: true, noFallback: true,
    credentialSource: "OPENAI_API_KEY", methodologyContentSha256: SHA, packId: uuid(5), methodologyVersionId: uuid(6),
    modelPolicyVersion: "synthetic-model-policy", resourcePolicyVersion: "synthetic-resource-policy", targetReceiptSha256: refs.target.sha256,
    ...options.grant };
  if (options.limit === "absent") delete grant.dailyConversationCallLimit;
  save("provider", grant);
  const profile = { version: "explorer-private-local-run.v2", runId, expiresAt,
    appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431", actorAccountId: uuid(2),
    explorerId: uuid(3), guideId: uuid(4), packId: uuid(5), methodologyVersionId: uuid(6), methodologyContentSha256: SHA,
    methodologyAuthorizationVersion: "MV1:" + SHA,
    modelPolicyVersion: "synthetic-model-policy", resourcePolicyVersion: "synthetic-resource-policy", receipts: refs };
  const file = join(directory, "RUN_PROFILE.json");
  const environment: Record<string, string> = { SOLMIND_TRUSTED_APP_ORIGIN: profile.appOrigin, NEXT_PUBLIC_SUPABASE_URL: profile.supabaseOrigin };
  const freeze = () => {
    const raw = JSON.stringify(profile); writeFileSync(file, raw);
    environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE = file;
    environment.SOLMIND_PRIVATE_EXPLORER_RUN_PROFILE_SHA256 = createHash("sha256").update(raw).digest("hex").toUpperCase();
  };
  freeze(); return { directory, profile, environment, freeze, save, grant };
}

describe("private local run data and the shared daily test allowance", () => {
  it("gives the request factory the ledger module's one fixed folder", () => {
    expect(EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT).toBe(LEDGER_MODULE_ROOT);
  });
  it("does not read a provider credential when no profile is configured", () => {
    const secret = vi.fn(() => { throw new Error("must_not_read"); });
    const environment = Object.defineProperty({}, "OPENAI_API_KEY", { get: secret });
    expect(loadExplorerPrivateLocalRun(environment, ledger())).toBeNull(); expect(secret).not.toHaveBeenCalled();
  });
  it("loads pinned synthetic evidence and counts places that persist across reloads", () => {
    const root = ledger(); const f = fixture(); const run = loadExplorerPrivateLocalRun(f.environment, root)!;
    expect(run.adultResources).toBe("Synthetic adult help."); expect(run.dailyConversationCallLimit).toBe(3);
    expect(run.available()).toBe(true); expect(run.usage()?.reserved).toBe(0);
    expect(run.reserve().slot).toBe(1); expect(run.reserve().slot).toBe(2);
    const reloaded = loadExplorerPrivateLocalRun(f.environment, root)!;
    expect(reloaded.usage()).toEqual({ day: explorerPrivateLocalLedgerDay(Date.now()), reserved: 2, limit: 3 });
    expect(reloaded.reserve().slot).toBe(3);
    expect(run.available()).toBe(false); expect(reloaded.available()).toBe(false);
    expect(() => reloaded.reserve()).toThrow("explorer_private_local_run_unavailable");
    expect(() => run.reserve()).toThrow("explorer_private_local_run_unavailable");
    expect(readdirSync(root)).toHaveLength(3);
  });
  it("records only the version, day, slot, time and run in each place", () => {
    const root = ledger(); const f = fixture(); const run = loadExplorerPrivateLocalRun(f.environment, root)!;
    const { day, slot } = run.reserve();
    const record = JSON.parse(readFileSync(join(root, `${day}.slot-0001.json`), "utf8"));
    expect(Object.keys(record).sort()).toEqual(["day", "reservedAt", "runId", "slot", "version"]);
    expect(record).toMatchObject({ version: "explorer-private-local-call-slot.v1", day, slot, runId: uuid(1) });
  });
  it("shares one count across a new run, folder and grant, so a new setup adds no calls", () => {
    const root = ledger();
    const first = loadExplorerPrivateLocalRun(fixture({ limit: 2 }).environment, root)!;
    const second = loadExplorerPrivateLocalRun(fixture({ limit: 2, runId: 7 }).environment, root)!;
    first.reserve(); second.reserve();
    expect(first.usage()?.reserved).toBe(2); expect(second.available()).toBe(false);
    expect(() => second.reserve()).toThrow("explorer_private_local_run_unavailable");
    // A larger grant still cannot pass the places already used today.
    const larger = loadExplorerPrivateLocalRun(fixture({ limit: 3, runId: 8 }).environment, root)!;
    expect(larger.reserve().slot).toBe(3);
    expect(() => larger.reserve()).toThrow("explorer_private_local_run_unavailable");
  });
  // Sequential calls through three loaded runs; the true cross-process race is in the ledger tests.
  it("never exceeds the limit when separately loaded runs take turns reserving", () => {
    const root = ledger(); const runs = [1, 2, 3].map(n => loadExplorerPrivateLocalRun(fixture({ limit: 5, runId: n }).environment, root)!);
    const slots: number[] = []; let refused = 0;
    for (let round = 0; round < 4; round += 1) for (const run of runs) {
      try { slots.push(run.reserve().slot); } catch { refused += 1; }
    }
    expect(slots.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]); expect(refused).toBe(7);
  });
  it("starts a fresh count on the next America/Chicago day, including the 25-hour 1 November", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T04:59:00.000Z")); // 23:59 CDT on 31 October
    const root = ledger(); const run = loadExplorerPrivateLocalRun(fixture({ limit: 1, ttl: 3 * 86_400_000 }).environment, root)!;
    expect(run.reserve()).toEqual({ day: "2026-10-31", slot: 1, limit: 1 });
    expect(run.available()).toBe(false);
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z")); // 00:00 CDT on 1 November
    expect(run.available()).toBe(true); expect(run.reserve().day).toBe("2026-11-01");
    vi.setSystemTime(new Date("2026-11-02T05:59:00.000Z")); // 23:59 CST, still 1 November
    expect(explorerPrivateLocalLedgerDay(Date.now())).toBe("2026-11-01"); expect(run.available()).toBe(false);
    vi.setSystemTime(new Date("2026-11-02T06:00:00.000Z")); // 00:00 CST on 2 November
    expect(run.reserve().day).toBe("2026-11-02");
  });
  it("holds a run whose setup expires after loading", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const root = ledger(); const run = loadExplorerPrivateLocalRun(fixture({ ttl: 1000 }).environment, root)!;
    expect(run.available()).toBe(true);
    vi.setSystemTime(Date.now() + 2000);
    expect(run.available()).toBe(false); expect(() => run.reserve()).toThrow("explorer_private_local_run_unavailable");
    expect(readdirSync(root)).toHaveLength(0);
  });
  it("stays held when the shared ledger folder is missing, and never creates it", () => {
    const missing = join(disposable(), "absent-ledger"); const run = loadExplorerPrivateLocalRun(fixture().environment, missing)!;
    expect(run.available()).toBe(false); expect(run.usage()).toBeNull();
    expect(() => run.reserve()).toThrow("explorer_private_local_run_unavailable");
    expect(() => readdirSync(missing)).toThrow();
  });
  it("rejects a relative, network or control-character ledger location", () => {
    const f = fixture();
    for (const root of ["ledger", "\\\\server\\share\\ledger", "//server/share/ledger", join(disposable(), "bad\nname")]) {
      expect(loadExplorerPrivateLocalRun(f.environment, root)).toBeNull();
    }
  });
  it("writes nothing while loading or checking availability and usage", () => {
    const root = ledger(); const run = loadExplorerPrivateLocalRun(fixture().environment, root)!;
    run.available(); run.usage(); loadExplorerPrivateLocalRun(fixture({ runId: 9 }).environment, root);
    expect(readdirSync(root)).toHaveLength(0);
  });
  it("does not transfer a pinned grant when the server model setting differs or is malformed", () => {
    const root = ledger(); const f = fixture();
    const credential = vi.fn(() => { throw new Error("must_not_read_credential"); });
    for (const modelName of ["synthetic-compatible-model", "", "gpt-5.6-luna\n"]) {
      const environment = Object.defineProperty({ ...f.environment, SOLMIND_OPENAI_MODEL: modelName }, "OPENAI_API_KEY", { get: credential });
      expect(loadExplorerPrivateLocalRun(environment, root)).toBeNull();
    }
    expect(loadExplorerPrivateLocalRun(f.environment, root)?.modelName).toBe("gpt-5.6-luna");
    expect(credential).not.toHaveBeenCalled();
  });
  it.each(["policy", "source", "resources", "renderer", "signal", "provider", "target"])("holds on changed %s evidence", name => {
    const f = fixture(); writeFileSync(join(f.directory, name + ".json"), "{}");
    expect(loadExplorerPrivateLocalRun(f.environment, ledger())).toBeNull();
  });
  it("accepts a daily limit from 1 to the 1,000 ceiling", () => {
    const root = ledger();
    for (const limit of [1, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING]) {
      expect(loadExplorerPrivateLocalRun(fixture({ limit }).environment, root)?.dailyConversationCallLimit).toBe(limit);
    }
  });
  it.each<[string, Parameters<typeof fixture>[0]]>([
    ["a zero limit", { limit: 0 }], ["a limit above the ceiling", { limit: EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING + 1 }],
    ["a fractional limit", { limit: 1.5 }], ["a text limit", { limit: "1000" }], ["a missing limit", { limit: "absent" }],
    ["the old one-call grant kind", { grant: { kind: "solmind-private-explorer-provider-grant.v1" } }],
    ["a leftover one-call field", { grant: { maximumExplorerCalls: 1 } }],
    ["a leftover exact-message field", { grant: { explorerMessageSha256: SHA } }],
    ["a retrying grant", { grant: { noRetry: false } }], ["a fallback grant", { grant: { noFallback: false } }],
  ])("rejects %s even when its new bytes are pinned", (_name, options) => {
    expect(loadExplorerPrivateLocalRun(fixture(options).environment, ledger())).toBeNull();
  });
  it("refuses a different trusted application or database target", () => {
    const root = ledger(); const f = fixture();
    expect(loadExplorerPrivateLocalRun({ ...f.environment, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, root)).toBeNull();
    expect(loadExplorerPrivateLocalRun({ ...f.environment, SOLMIND_TRUSTED_APP_ORIGIN: "https://example.com" }, root)).toBeNull();
  });
  it("does not transfer an existing provider grant to a changed target receipt", () => {
    const f = fixture();
    const target = JSON.parse(readFileSync(join(f.directory, "target.json"), "utf8"));
    f.save("target", { ...target, changedEvidence: true }); f.freeze();
    expect(loadExplorerPrivateLocalRun(f.environment, ledger())).toBeNull();
  });
  it("rejects expiry, remote origins, path traversal, unknown fields, old versions and malformed JSON", () => {
    const f = fixture(); const raw = (patch: Record<string, unknown>) => JSON.stringify({ ...f.profile, ...patch });
    expect(parseExplorerPrivateLocalRunProfile(raw({}), Date.now())).not.toBeNull();
    for (const value of [raw({ expiresAt: "2000-01-01T00:00:00.000Z" }), raw({ appOrigin: "https://example.com" }),
      raw({ extra: true }), "{", raw({ receipts: { ...f.profile.receipts, provider: { file: "../secret.json", sha256: SHA } } }),
      raw({ version: "explorer-private-local-run.v1" }), raw({ explorerMessageSha256: SHA })]) {
      expect(parseExplorerPrivateLocalRunProfile(value, Date.now())).toBeNull();
    }
  });
});
