import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compareProviderProbeEnvironment,
  describeProviderProbeImpact,
  expectedProviderProbeWorkdir,
  readVerifiedProviderProbeConfigDigest,
} from "./providerProbeEnvironment";
import {
  assertAcceptedRootPathSyntax,
  isAcceptedRootPathSyntax,
  PROVIDER_PROBE_APP_ROOT,
  providerProbeAppRoot,
} from "./providerProbeLocalRoot";
import { computeProviderProbeConfigDigest, scanProviderProbeOutput } from "./providerProbeRunEnvelope";
import { gatedTestEnvironment, testConfig } from "./providerProbeTestSupport";

// Plainly fake, in-memory configurations; nothing here reads process.env or any
// path outside the pinned app root.
const CONFIG = testConfig(gatedTestEnvironment("environment"));
const LOCKED_DOWN = testConfig(
  gatedTestEnvironment("environment", {
    SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
    SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
  }),
);
const APP_ROOT = path.resolve(PROVIDER_PROBE_APP_ROOT);
const MATCHING = { workdir: APP_ROOT, projectId: "solmind-app", apiUrl: "http://127.0.0.1:54321" } as const;
const PLAN = { authUsersCreated: 3, authSessionsCreated: 2, mailpitMessagesCaptured: 4 } as const;

afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

// The module under test uses a named `readFileSync` import; syncing the built-in ESM
// exports makes that binding see the spy (each test also proves it does).
function spyOnFileReads() {
  const readSpy = vi.spyOn(fs, "readFileSync");
  syncBuiltinESMExports();
  return readSpy;
}

describe("root path guard: UNC, device-path and relative-root rejection (syntax only)", () => {
  it.each([
    ["C:\\_Apollo\\Projects\\Solmind\\solmind-app", "win32", true],
    ["c:/repo", "win32", true],
    ["\\\\server\\share\\solmind-app", "win32", false],
    ["//server/share/solmind-app", "win32", false],
    ["\\\\?\\C:\\repo", "win32", false],
    ["\\\\.\\C:\\repo", "win32", false],
    ["C:\\\\server\\share", "win32", false],
    ["C:repo", "win32", false],
    ["solmind-app", "win32", false],
    ["/home/runner/solmind-app", "linux", true],
    ["//server/share", "linux", false],
    ["relative/path", "linux", false],
    ["", "linux", false],
    ["/repo\0x", "linux", false],
  ] as const)("%j on %s is accepted=%s", (candidate, platform, accepted) => {
    expect(isAcceptedRootPathSyntax(candidate, platform)).toBe(accepted);
  });

  it("accepts a mapped-drive-style path and a mounted POSIX path: it proves syntax, not locality", () => {
    expect(isAcceptedRootPathSyntax("Z:\\repo", "win32")).toBe(true);
    expect(isAcceptedRootPathSyntax("/mnt/network-share/repo", "linux")).toBe(true);
  });

  it("pins the harness to its own app root", () => {
    expect(path.basename(APP_ROOT)).not.toBe("provider-probe");
    expect(providerProbeAppRoot()).toBe(APP_ROOT);
    expect(() => assertAcceptedRootPathSyntax("\\\\server\\share")).toThrow("provider_probe_root_path_refused");
  });
});

describe("provider probe environment comparison", () => {
  it("expects the app root for current-config and leaves locked-down undecided", () => {
    expect(expectedProviderProbeWorkdir(CONFIG)).toBe(APP_ROOT);
    expect(expectedProviderProbeWorkdir(LOCKED_DOWN)).toBeNull();
  });

  it("matches only when workdir, project id and API URL all match", () => {
    expect(compareProviderProbeEnvironment(CONFIG, MATCHING)).toEqual({
      matches: true,
      workdir: "matches",
      projectId: "matches",
      apiUrl: "matches",
    });
    expect(compareProviderProbeEnvironment(CONFIG, { ...MATCHING, apiUrl: "http://127.0.0.1:54321/" }).matches).toBe(true);
    expect(compareProviderProbeEnvironment(CONFIG, { ...MATCHING, workdir: `${APP_ROOT}${path.sep}` }).matches).toBe(true);
  });

  it.runIf(process.platform === "win32")("compares Windows workdirs without regard to case or separators", () => {
    expect(
      compareProviderProbeEnvironment(CONFIG, { ...MATCHING, workdir: APP_ROOT.toUpperCase().replaceAll("\\", "/") }).workdir,
    ).toBe("matches");
  });

  it.each([
    ["a different workdir", { workdir: path.join(APP_ROOT, "supabase") }, "workdir"],
    ["a parent workdir", { workdir: path.dirname(APP_ROOT) }, "workdir"],
    ["a relative workdir", { workdir: "solmind-app" }, "workdir"],
    ["a UNC workdir", { workdir: "\\\\server\\share\\solmind-app" }, "workdir"],
    ["a device-path workdir", { workdir: `\\\\?\\${APP_ROOT}` }, "workdir"],
    ["another project", { projectId: "solmind-provider-probe-locked-down" }, "projectId"],
    ["a project id differing in case", { projectId: "SolMind-App" }, "projectId"],
    ["localhost", { apiUrl: "http://localhost:54321" }, "apiUrl"],
    ["IPv6 when IPv4 is expected", { apiUrl: "http://[::1]:54321" }, "apiUrl"],
    ["another port", { apiUrl: "http://127.0.0.1:54322" }, "apiUrl"],
    ["TLS", { apiUrl: "https://127.0.0.1:54321" }, "apiUrl"],
    ["a path", { apiUrl: "http://127.0.0.1:54321/rest/v1" }, "apiUrl"],
    ["a query", { apiUrl: "http://127.0.0.1:54321?linked=true" }, "apiUrl"],
    ["a hosted URL", { apiUrl: "https://example.supabase.co" }, "apiUrl"],
    ["not a URL", { apiUrl: "127.0.0.1:54321" }, "apiUrl"],
  ])("fails closed on %s", (_label, change, field) => {
    const comparison = compareProviderProbeEnvironment(CONFIG, { ...MATCHING, ...change });

    expect(comparison.matches).toBe(false);
    expect(comparison[field as "workdir" | "projectId" | "apiUrl"]).toBe("differs");
  });

  it("never reads a file while comparing, even for a UNC observation", () => {
    const readSpy = spyOnFileReads();

    compareProviderProbeEnvironment(CONFIG, { ...MATCHING, workdir: "\\\\server\\share\\solmind-app" });
    const comparison = compareProviderProbeEnvironment(CONFIG, MATCHING);
    expect(readSpy).not.toHaveBeenCalled();

    // Positive control: the spy does see the module's one read.
    readVerifiedProviderProbeConfigDigest(comparison);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("never matches the locked-down profile while its workdir is undecided", () => {
    expect(
      compareProviderProbeEnvironment(LOCKED_DOWN, {
        workdir: APP_ROOT,
        projectId: "solmind-provider-probe-locked-down",
        apiUrl: "http://127.0.0.1:55421",
      }),
    ).toEqual({ matches: false, workdir: "undecided", projectId: "matches", apiUrl: "matches" });
  });

  it.each([
    null,
    "x",
    [],
    { workdir: APP_ROOT, projectId: "solmind-app" },
    { ...MATCHING, serviceRoleKey: "fake" },
    { ...MATCHING, workdir: "" },
    { ...MATCHING, projectId: 1 },
    { ...MATCHING, apiUrl: "x".repeat(4_097) },
  ])("refuses a malformed observation %#", (observed) => {
    expect(() => compareProviderProbeEnvironment(CONFIG, observed)).toThrow(
      "provider_probe_environment_observation_malformed",
    );
  });

  it("reports the comparison without echoing any observed value", () => {
    const comparison = compareProviderProbeEnvironment(CONFIG, {
      workdir: "C:\\OBSERVEDCANARY",
      projectId: "PROJECTCANARY",
      apiUrl: "http://127.0.0.1:54321/?q=URLCANARY",
    });

    const rendered = JSON.stringify(comparison);
    for (const canary of ["OBSERVEDCANARY", "PROJECTCANARY", "URLCANARY"]) {
      expect(rendered).not.toContain(canary);
    }
  });
});

describe("config digest bound to a successful comparison", () => {
  it("reads the verified workdir's config exactly as stored", () => {
    const comparison = compareProviderProbeEnvironment(CONFIG, MATCHING);

    expect(readVerifiedProviderProbeConfigDigest(comparison)).toBe(
      computeProviderProbeConfigDigest(fs.readFileSync(path.join(APP_ROOT, "supabase", "config.toml"))),
    );
  });

  it("refuses a failed comparison, an undecided one and a hand-made one, reading nothing", () => {
    const readSpy = spyOnFileReads();
    const failed = compareProviderProbeEnvironment(CONFIG, { ...MATCHING, projectId: "other" });
    const undecided = compareProviderProbeEnvironment(LOCKED_DOWN, {
      workdir: APP_ROOT,
      projectId: "solmind-provider-probe-locked-down",
      apiUrl: "http://127.0.0.1:55421",
    });
    const forged = { matches: true, workdir: "matches", projectId: "matches", apiUrl: "matches" };
    const copied = { ...compareProviderProbeEnvironment(CONFIG, MATCHING) };

    for (const candidate of [failed, undecided, forged, copied, null, "matches"]) {
      expect(() => readVerifiedProviderProbeConfigDigest(candidate)).toThrow("provider_probe_config_digest_unverified");
    }
    expect(readSpy).not.toHaveBeenCalled();
    readVerifiedProviderProbeConfigDigest(compareProviderProbeEnvironment(CONFIG, MATCHING));
    expect(readSpy).toHaveBeenCalledTimes(1);
  });
});

describe("provider probe impact display", () => {
  it("shows counts and categories only", () => {
    const lines = describeProviderProbeImpact(CONFIG, PLAN, compareProviderProbeEnvironment(CONFIG, MATCHING));

    expect(lines).toEqual([
      "Provider probe run: what it would create and delete (counts and categories only)",
      "Profile: current-config",
      "Reaches: the local Auth API and the local mail catcher, on a literal loopback address only",
      "Would create: 3 local Auth users, with reserved synthetic addresses",
      "Would create: 2 local Auth sessions, held in memory only, never in a cookie or file",
      "May capture: up to 4 local test messages, to reserved synthetic addresses",
      "Would delete: at most 3 local Auth users and 4 local test messages, only those this run created, by their exact IDs, once each; nothing is listed and deleted",
      "Would not touch: any SolMind database function, the hosted project, or any real address",
      "Environment check: workdir matches, project matches, API URL matches",
    ]);
    expect(Object.isFrozen(lines)).toBe(true);
    const text = lines.join("\n");
    expect(scanProviderProbeOutput(text).passed).toBe(true);
    for (const value of ["P28-20261001-environment", "p28-20261001-environment", "synthetic.invalid", "54321", "127.0.0.1"]) {
      expect(text).not.toContain(value);
    }
  });

  it("uses singular wording for one item and omits the check when none is given", () => {
    const lines = describeProviderProbeImpact(CONFIG, { authUsersCreated: 1, authSessionsCreated: 0, mailpitMessagesCaptured: 1 });

    expect(lines).toContain("Would create: 1 local Auth user, with reserved synthetic addresses");
    expect(lines).toContain("May capture: up to 1 local test message, to reserved synthetic addresses");
    expect(lines.some((line) => line.startsWith("Environment check"))).toBe(false);
  });

  it.each([
    { ...PLAN, authUsersCreated: 11 },
    { ...PLAN, authSessionsCreated: -1 },
    { ...PLAN, mailpitMessagesCaptured: 101 },
    { ...PLAN, authUsersCreated: 1.5 },
    { ...PLAN, recipients: 1 },
    { authUsersCreated: 1 },
    null,
  ])("refuses an unbounded or widened plan %#", (plan) => {
    expect(() => describeProviderProbeImpact(CONFIG, plan)).toThrow("provider_probe_impact_plan_invalid");
  });
});
