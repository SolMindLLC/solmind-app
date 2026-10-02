import childProcess from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PROVIDER_PROBE_APP_ROOT } from "./providerProbeLocalRoot";
import { PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS, PROVIDER_PROBE_STACK_LIST_ARGUMENTS } from "./providerProbeStackObserver";
import {
  createProviderProbeSession,
  createProviderProbeSessionSeams,
  PROVIDER_PROBE_STEPS,
  readProviderProbeSuiteState,
  verifyProviderProbeWiring,
} from "./providerProbeSuiteGate";
import { gatedTestEnvironment, testConfig } from "./providerProbeTestSupport";

// Both sides of the integration file's gate, with plainly fake, in-memory
// environments. The enabled branch's own functions run here with the network blocked.
// The only step run on a production session is PP-00, with `execFile` replaced by a spy
// (no process starts) and the network blocked: it must stop before any request.

const GATED = gatedTestEnvironment("suite-gate", { SOLMIND_PROVIDER_PROBE_PHASE: "preview" });
// Resolved only, never created or written: a directory outside the app root.
const OUTPUT_DIRECTORY = process.platform === "win32" ? "C:\\provider-probe-test-output" : "/provider-probe-test-output";
const SESSION = {
  ...GATED,
  SOLMIND_PROVIDER_PROBE_ANON_KEY: "fake-anon-key-for-tests-only",
  SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY: "fake-service-role-key-for-tests-only",
  SOLMIND_PROVIDER_PROBE_CLI_VERSION: "2.115.0",
  SOLMIND_PROVIDER_PROBE_OUTPUT_DIR: OUTPUT_DIRECTORY,
};
const FAKE_DIGEST = `sha256:${"ab".repeat(32)}`;
// R7: the local engine every docker read is pinned to (this platform's first fixed endpoint).
const LOCAL_ENGINE = PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS[process.platform === "win32" ? "win32" : "posix"]![0]!;
// R7: a remote engine (a TEST-NET documentation address; nothing is ever contacted).
const REMOTE_ENGINE = "tcp://192.0.2.10:2376";

function blockNetwork() {
  const requestSpy = vi.spyOn(http, "request").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  const connectSpy = vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  return { requestSpy, connectSpy };
}

afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

type ExecCall = { file: string; args: string[]; options: Record<string, unknown> };

// Replaces execFile: no process ever starts. `answer` gives standard output, or throws to
// stand in for a docker that cannot be read.
function stubExecFile(answer: (call: ExecCall) => string) {
  const calls: ExecCall[] = [];
  vi.spyOn(childProcess, "execFile").mockImplementation(((
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const call = { file, args: [...args], options };
    calls.push(call);
    let stdout = "";
    let failure: Error | null = null;
    try {
      stdout = answer(call);
    } catch (error) {
      failure = error as Error;
    }
    queueMicrotask(() => callback(failure, stdout, ""));
    return {} as childProcess.ChildProcess;
  }) as unknown as typeof childProcess.execFile);
  syncBuiltinESMExports();
  return calls;
}

// Fixture docker output: a running stack labelled with another checkout's folder.
function otherFolderStack(call: ExecCall): string {
  // (R7) Each command starts with the pinned engine: --host <engine> <command> ...
  if (call.args[2] === "ps") {
    return `${"11".repeat(32)}\n${"22".repeat(32)}\n`;
  }
  const labels = {
    "com.supabase.cli.project": "solmind-app",
    "com.supabase.cli.workdir": path.resolve(PROVIDER_PROBE_APP_ROOT, "..", "another-checkout"),
  };
  return [
    JSON.stringify(["11".repeat(32), "/supabase_kong_solmind-app", labels, { "8000/tcp": [{ HostIp: "0.0.0.0", HostPort: "54321" }] }, true]),
    JSON.stringify(["22".repeat(32), "/supabase_auth_solmind-app", labels, null, true]),
    "",
  ].join("\n");
}

// (R8) Fixture docker output: a running stack labelled with this checkout's own folder,
// whose gateway publishes the API port on the given host IP only.
function thisCheckoutStack(hostIp: string) {
  return (call: ExecCall): string => {
    if (call.args[2] === "ps") {
      return `${"11".repeat(32)}\n${"22".repeat(32)}\n`;
    }
    const labels = { "com.supabase.cli.project": "solmind-app", "com.supabase.cli.workdir": path.resolve(PROVIDER_PROBE_APP_ROOT) };
    return [
      JSON.stringify(["11".repeat(32), "/supabase_kong_solmind-app", labels, { "8000/tcp": [{ HostIp: hostIp, HostPort: "54321" }] }, true]),
      JSON.stringify(["22".repeat(32), "/supabase_auth_solmind-app", labels, null, true]),
      "",
    ].join("\n");
  };
}

describe("integration suite state", () => {
  it.each([
    ["no interlocks", {}],
    ["only the approval interlock", { SOLMIND_PROVIDER_PROBE_APPROVAL: GATED.SOLMIND_PROVIDER_PROBE_APPROVAL }],
    ["a near-miss effect interlock", { ...GATED, SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: ` ${GATED.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS}` }],
  ])("is skipped with %s", (_label, environment) => {
    expect(readProviderProbeSuiteState(environment)).toEqual({ state: "skipped" });
  });

  it.each(["preview", "run"])("is enabled with both interlocks, valid settings and the %s phase", (phase) => {
    const state = readProviderProbeSuiteState({ ...GATED, SOLMIND_PROVIDER_PROBE_PHASE: phase });

    expect(state.state).toBe("enabled");
    expect(state.state === "enabled" ? [state.config.runId, state.phase] : null).toEqual(["P28-20261001-suite-gate", phase]);
  });

  it.each([
    [{ SOLMIND_LOCAL_SUPABASE_URL: "http://localhost:54321" }, "provider_probe_non_loopback_or_ambiguous_url"],
    [{ SOLMIND_PROVIDER_PROBE_RUN_ID: undefined }, "provider_probe_missing_solmind_provider_probe_run_id"],
    [{ SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: "person@example.com" }, "provider_probe_recipient_not_reserved_synthetic_domain"],
    [{ SOLMIND_PROVIDER_PROBE_PHASE: undefined }, "provider_probe_invalid_phase"],
    [{ SOLMIND_PROVIDER_PROBE_PHASE: "Run" }, "provider_probe_invalid_phase"],
  ])("is refused, without throwing, for unsafe enabled settings %j", (change, code) => {
    expect(() => readProviderProbeSuiteState({ ...GATED, ...change })).not.toThrow();
    expect(readProviderProbeSuiteState({ ...GATED, ...change })).toEqual({ state: "refused", code });
  });
});

describe("the integration file's enabled branch (run here with a fake environment)", () => {
  it("builds the run wiring and sends no request", () => {
    const { requestSpy, connectSpy } = blockNetwork();

    expect(verifyProviderProbeWiring(GATED)).toEqual({
      profile: "current-config",
      recordedAuthUsers: 0,
      recordedMailpitMessages: 0,
      mailInventoryBuilt: true,
    });
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("leaves the mail inventory unbuilt for the locked-down profile", () => {
    blockNetwork();
    const lockedDown = gatedTestEnvironment("suite-gate", {
      SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
      SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
    });

    expect(verifyProviderProbeWiring(lockedDown)).toMatchObject({ profile: "locked-down", mailInventoryBuilt: false });
  });

  it("refuses without the interlocks", () => {
    expect(() => verifyProviderProbeWiring({})).toThrow("provider_probe_run_ungated");
  });
});

describe("the probe session (built; only PP-00 runs here, with execFile and the network blocked)", () => {
  it("builds a preview session and a run session without sending a request", () => {
    const { requestSpy, connectSpy } = blockNetwork();

    expect(createProviderProbeSession(SESSION).phase).toBe("preview");
    expect(
      createProviderProbeSession({ ...SESSION, SOLMIND_PROVIDER_PROBE_PHASE: "run", SOLMIND_PROVIDER_PROBE_APPROVED_IMPACT: FAKE_DIGEST })
        .phase,
    ).toBe("run");
    expect(Object.keys(createProviderProbeSession(SESSION)).sort()).toEqual(["finish", "phase", "runStep"]);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it.each([
    [{ SOLMIND_PROVIDER_PROBE_ANON_KEY: undefined }, "provider_probe_missing_anon_key"],
    [{ SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY: " padded-fake-key-for-tests " }, "provider_probe_missing_service_role_key"],
    [{ SOLMIND_PROVIDER_PROBE_CLI_VERSION: "" }, "provider_probe_missing_cli_version"],
    [{ SOLMIND_PROVIDER_PROBE_PHASE: "run" }, "provider_probe_missing_approved_impact"],
    [{ SOLMIND_PROVIDER_PROBE_PHASE: "run", SOLMIND_PROVIDER_PROBE_APPROVED_IMPACT: "sha256:abc" }, "provider_probe_missing_approved_impact"],
    [{ SOLMIND_PROVIDER_PROBE_OUTPUT_DIR: "relative/output" }, "provider_probe_output_directory_refused"],
    [{ SOLMIND_PROVIDER_PROBE_OUTPUT_DIR: undefined }, "provider_probe_output_directory_refused"],
    [{ SOLMIND_PROVIDER_PROBE_PHASE: undefined }, "provider_probe_session_not_enabled"],
  ])("refuses to build a session for %j", (change, code) => {
    const { requestSpy } = blockNetwork();

    expect(() => createProviderProbeSession({ ...SESSION, ...change })).toThrow(code);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("R6: PP-00 on a real preview session observes the stack first; an unreadable docker stops it with no request", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const calls = stubExecFile(() => {
      throw new Error("Cannot connect to the Docker daemon (fake)");
    });
    const session = createProviderProbeSession({ ...SESSION });

    expect(await session.runStep("PP-00")).toMatchObject({ step: "PP-00", outcome: "blocked", code: "environment-unobserved" });
    expect(calls.map((call) => [call.file, call.args])).toEqual([["docker", ["--host", LOCAL_ENGINE, ...PROVIDER_PROBE_STACK_LIST_ARGUMENTS]]]);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("R6: PP-00 on a real preview session stops a stack started from another folder, with no request", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const calls = stubExecFile(otherFolderStack);
    const session = createProviderProbeSession({ ...SESSION });

    expect(await session.runStep("PP-00")).toMatchObject({ step: "PP-00", outcome: "blocked", code: "environment-mismatch" });
    expect(calls.map((call) => call.args.slice(0, 3))).toEqual([
      ["--host", LOCAL_ENGINE, "ps"],
      ["--host", LOCAL_ENGINE, "container"],
    ]);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("R8: PP-00 on a real preview session refuses an API port published only on an empty host IP, before any request", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const calls = stubExecFile(thisCheckoutStack(""));
    const session = createProviderProbeSession({ ...SESSION });

    expect(await session.runStep("PP-00")).toMatchObject({ step: "PP-00", outcome: "blocked", code: "environment-unobserved" });
    // Both fixed reads ran; the observation itself refused the binding.
    expect(calls.map((call) => call.args[2])).toEqual(["ps", "container"]);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("R8: positive control: the same stack published on 0.0.0.0 passes the observation and reaches the (blocked) health request", async () => {
    const { requestSpy } = blockNetwork();
    stubExecFile(thisCheckoutStack("0.0.0.0"));
    const session = createProviderProbeSession({ ...SESSION });

    // The comparison matched, so PP-00 went on to its first request, which the blocked
    // network refused; it then stops before any effect.
    expect(await session.runStep("PP-00")).toMatchObject({ step: "PP-00", outcome: "blocked", code: "preflight-refused" });
    expect(requestSpy).toHaveBeenCalled();
  });

  it.each([
    ["a remote DOCKER_HOST", { DOCKER_HOST: REMOTE_ENGINE }],
    ["a DOCKER_HOST naming another machine's pipe", { DOCKER_HOST: "npipe:////fake-remote-host/pipe/docker_engine" }],
    ["an ssh DOCKER_HOST", { DOCKER_HOST: "ssh://fake-user@192.0.2.10" }],
    ["a non-default DOCKER_CONTEXT", { DOCKER_CONTEXT: "fake-remote-context" }],
    ["a local DOCKER_HOST with a non-default DOCKER_CONTEXT", { DOCKER_HOST: LOCAL_ENGINE, DOCKER_CONTEXT: "fake-remote-context" }],
  ])(
    "R7: PP-00 on a real preview session refuses %s before running docker and before any request",
    async (_label, engineSettings) => {
      const { requestSpy, connectSpy } = blockNetwork();
      // Would answer with a matching stack if it were ever asked; it must not be.
      const calls = stubExecFile(() => {
        throw new Error("docker must not run for a non-local engine setting");
      });
      const session = createProviderProbeSession({ ...SESSION, ...engineSettings });

      expect(await session.runStep("PP-00")).toMatchObject({ step: "PP-00", outcome: "blocked", code: "environment-unobserved" });
      expect(calls).toHaveLength(0);
      expect(requestSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
    },
  );

  it("lists the steps in their fixed order", () => {
    expect(PROVIDER_PROBE_STEPS).toEqual([
      "PP-00",
      "PP-01",
      "PP-02",
      "PP-03",
      "PP-04",
      "PP-06",
      "PP-07",
      "PP-08",
      "PP-09",
      "PP-10",
      "PP-06-rate",
      "PP-11",
      "PP-12",
      "evidence",
    ]);
  });
});

describe("the production session seams (R6)", () => {
  const ROOT = path.resolve(PROVIDER_PROBE_APP_ROOT);

  function seamsFor(environment: Record<string, string | undefined>) {
    return createProviderProbeSessionSeams({
      environment,
      config: testConfig(environment),
      phase: "preview",
      directory: OUTPUT_DIRECTORY,
    });
  }

  it("the writer re-reads the very environment object it was given, so removing an interlock refuses the next write", () => {
    const realRealpath = fs.realpathSync;
    vi.spyOn(fs, "realpathSync").mockImplementation(((target: fs.PathLike) => {
      const resolved = path.resolve(String(target));
      // Never created: the output folder is mapped to itself; everything else is real.
      return resolved === path.resolve(OUTPUT_DIRECTORY) || resolved === ROOT ? resolved : realRealpath(target);
    }) as typeof fs.realpathSync);
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    syncBuiltinESMExports();
    // A fresh mutable object stands in for the live process environment.
    const environment: Record<string, string | undefined> = { ...SESSION };
    const seams = seamsFor(environment);

    seams.writeOutput("impact-display", "Provider probe display text");
    expect(writeSpy).toHaveBeenCalledTimes(1);

    delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    expect(() => seams.writeOutput("impact-display", "Provider probe display text")).toThrow("provider_probe_output_gate_closed");
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it("the observer runs the fixed docker read, passing on only allowlisted variables from that environment", async () => {
    const calls = stubExecFile(() => {
      throw new Error("Cannot connect to the Docker daemon (fake)");
    });
    const seams = seamsFor({ ...SESSION, PATH: "C:\\fake\\bin" });

    await expect(seams.observeStack()).rejects.toThrow("provider_probe_stack_unreadable");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual(["--host", LOCAL_ENGINE, ...PROVIDER_PROBE_STACK_LIST_ARGUMENTS]);
    expect(calls[0]!.options.env).toEqual({ PATH: "C:\\fake\\bin" });
  });

  it("R7: the observer pins a local DOCKER_HOST it was given with --host, and passes no DOCKER_* variable on", async () => {
    const calls = stubExecFile(() => {
      throw new Error("Cannot connect to the Docker daemon (fake)");
    });
    const seams = seamsFor({
      ...SESSION,
      PATH: "C:\\fake\\bin",
      DOCKER_HOST: LOCAL_ENGINE,
      DOCKER_CONTEXT: "default",
      DOCKER_CONFIG: "C:\\fake\\docker-config",
      DOCKER_CERT_PATH: "C:\\fake\\docker-certs",
      DOCKER_TLS_VERIFY: "1",
    });

    await expect(seams.observeStack()).rejects.toThrow("provider_probe_stack_unreadable");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args.slice(0, 2)).toEqual(["--host", LOCAL_ENGINE]);
    expect(calls[0]!.options.env).toEqual({ PATH: "C:\\fake\\bin" });
  });

  it("R7: the observer refuses a remote DOCKER_HOST from that environment without starting any process", async () => {
    const calls = stubExecFile(() => "");
    const seams = seamsFor({ ...SESSION, DOCKER_HOST: REMOTE_ENGINE });

    await expect(seams.observeStack()).rejects.toThrow(/^provider_probe_stack_engine_not_local$/);
    expect(calls).toHaveLength(0);
  });
});
