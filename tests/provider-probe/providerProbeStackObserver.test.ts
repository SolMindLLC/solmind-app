import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compareProviderProbeEnvironment } from "./providerProbeEnvironment";
import { PROVIDER_PROBE_APP_ROOT } from "./providerProbeLocalRoot";
import {
  observeProviderProbeStack,
  observeProviderProbeStackFromContainers,
  parseProviderProbeContainerIds,
  parseProviderProbeContainerInspection,
  PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS,
  PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT,
  PROVIDER_PROBE_STACK_INSPECT_FORMAT,
  PROVIDER_PROBE_STACK_LIST_ARGUMENTS,
  PROVIDER_PROBE_STACK_OBSERVER_LIMITS,
  providerProbeLocalDockerEngine,
  providerProbeStackChildEnvironment,
} from "./providerProbeStackObserver";
import { gatedTestEnvironment, testConfig } from "./providerProbeTestSupport";

// The observer against FIXTURE outputs only. Every test replaces `execFile` with a spy
// before anything can run (the default spy throws), so no test starts docker or any
// other process. The fixtures follow Docker's documented formats (`docker ps --quiet
// --no-trunc`: one 64-character id per line; `docker container inspect --format` with
// the observer's template: one JSON array per container) and the labels Supabase CLI
// 2.115.0's bundled start code applies. They are UNVERIFIED against a running stack:
// Docker was not running while this was written.

const CONFIG = testConfig(gatedTestEnvironment("stack-observer"));
const WORKDIR = path.resolve(PROVIDER_PROBE_APP_ROOT);
const PROJECT = "solmind-app";
// The kernel's API origin in these tests (the gated test environment's URL).
const ORIGIN = "http://127.0.0.1:54321";
// R7: the local engine pinned on this platform, and a remote one (a TEST-NET documentation
// address; nothing is ever contacted).
const LOCAL_ENGINE = PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS[process.platform === "win32" ? "win32" : "posix"]![0]!;
const REMOTE_ENGINE = "tcp://192.0.2.10:2376";

type Binding = { HostIp: string; HostPort: string };

function id(index: number): string {
  return index.toString(16).padStart(2, "0").repeat(32);
}

function line(
  options: Readonly<{
    index: number;
    name: string;
    project?: string | null;
    workdir?: string | null;
    ports?: Record<string, Binding[] | null> | null;
    running?: boolean;
  }>,
): string {
  const labels: Record<string, string> = { "com.docker.compose.project": options.project ?? PROJECT };
  if (options.project !== null) {
    labels["com.supabase.cli.project"] = options.project ?? PROJECT;
  }
  if (options.workdir !== null) {
    labels["com.supabase.cli.workdir"] = options.workdir ?? WORKDIR;
  }
  return JSON.stringify([id(options.index), options.name, labels, options.ports ?? null, options.running ?? true]);
}

const KONG_PORTS = {
  "8000/tcp": [
    { HostIp: "0.0.0.0", HostPort: "54321" },
    { HostIp: "::", HostPort: "54321" },
  ],
  "8443/tcp": null,
};

function stack(overrides: Readonly<{ kong?: string; auth?: string | null; extra?: string[] }> = {}): { ids: string; inspect: string } {
  const entries = [
    overrides.kong ?? line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: KONG_PORTS }),
    ...(overrides.auth === null ? [] : [overrides.auth ?? line({ index: 2, name: `/supabase_auth_${PROJECT}` })]),
    line({ index: 3, name: `/supabase_db_${PROJECT}`, ports: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "54322" }] } }),
    ...(overrides.extra ?? []),
  ];
  const ids = entries.map((entry) => (JSON.parse(entry) as string[])[0]!);
  return { ids: `${ids.join("\n")}\n`, inspect: `${entries.join("\n")}\n` };
}

function observe(fixture: { ids: string; inspect: string }, origin: string = ORIGIN) {
  const ids = parseProviderProbeContainerIds(fixture.ids);
  return observeProviderProbeStackFromContainers(parseProviderProbeContainerInspection(fixture.inspect, ids), origin);
}

function kongPublishing(bindings: Binding[]): string {
  return line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: { "8000/tcp": bindings } });
}

type ExecCall = { file: string; args: string[]; options: Record<string, unknown> };

function stubExecFile(answer: (call: ExecCall) => { error?: Error; stdout?: string }) {
  const calls: ExecCall[] = [];
  const spy = vi.spyOn(childProcess, "execFile").mockImplementation(((
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const call = { file, args: [...args], options };
    calls.push(call);
    const result = answer(call);
    queueMicrotask(() => callback(result.error ?? null, result.stdout ?? "", "fake standard error, never read"));
    return {} as childProcess.ChildProcess;
  }) as unknown as typeof childProcess.execFile);
  syncBuiltinESMExports();
  return { spy, calls };
}

beforeEach(() => {
  // The default: any process start fails the test loudly.
  vi.spyOn(childProcess, "execFile").mockImplementation((() => {
    throw new Error("a unit test tried to start a real process");
  }) as unknown as typeof childProcess.execFile);
  syncBuiltinESMExports();
});

afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

describe("parsing the two fixed outputs, fail-closed", () => {
  it("reads one full id per line, each once", () => {
    expect(parseProviderProbeContainerIds(`${id(1)}\r\n${id(2)}\n`)).toEqual([id(1), id(2)]);
    expect(parseProviderProbeContainerIds("")).toEqual([]);
  });

  it.each([
    ["a short id", "abc123\n"],
    ["an upper-case id", `${id(171).toUpperCase()}\n`],
    ["a repeated id", `${id(1)}\n${id(1)}\n`],
    ["an error text", "Cannot connect to the Docker daemon\n"],
    ["not text", 42],
    ["too many containers", Array.from({ length: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxContainers + 1 }, (_, index) => id(index + 1)).join("\n")],
  ])("refuses %s", (_label, stdout) => {
    expect(() => parseProviderProbeContainerIds(stdout)).toThrow("provider_probe_stack_format_unrecognized");
  });

  it("reads one inspection array per container, for exactly the ids asked about", () => {
    const fixture = stack();
    const containers = parseProviderProbeContainerInspection(fixture.inspect, parseProviderProbeContainerIds(fixture.ids));

    expect(containers.map((container) => container.name)).toEqual([
      `/supabase_kong_${PROJECT}`,
      `/supabase_auth_${PROJECT}`,
      `/supabase_db_${PROJECT}`,
    ]);
    expect(containers[0]!.ports["8000/tcp"]).toEqual([
      { hostIp: "0.0.0.0", hostPort: "54321" },
      { hostIp: "::", hostPort: "54321" },
    ]);
    expect(containers[0]!.labels["com.supabase.cli.workdir"]).toBe(WORKDIR);
  });

  it.each([
    ["text that is not JSON", "{not json}"],
    ["an array of the wrong length", JSON.stringify([id(1), "/x", {}, null])],
    ["a name without its leading slash", JSON.stringify([id(1), "supabase_kong_x", {}, null, true])],
    ["a label that is not text", JSON.stringify([id(1), "/x", { a: 1 }, null, true])],
    ["a port key that is not a port", JSON.stringify([id(1), "/x", {}, { "8000": [] }, true])],
    ["a binding without its host port", JSON.stringify([id(1), "/x", {}, { "8000/tcp": [{ HostIp: "0.0.0.0" }] }, true])],
    ["a running state that is not a boolean", JSON.stringify([id(1), "/x", {}, null, "true"])],
  ])("refuses %s", (_label, inspect) => {
    expect(() => parseProviderProbeContainerInspection(`${inspect}\n`, [id(1)])).toThrow("provider_probe_stack_format_unrecognized");
  });

  it("refuses an inspection that misses or adds a container", () => {
    const fixture = stack();
    const ids = parseProviderProbeContainerIds(fixture.ids);

    expect(() => parseProviderProbeContainerInspection(fixture.inspect, ids.slice(1))).toThrow(
      "provider_probe_stack_format_unrecognized",
    );
    expect(() => parseProviderProbeContainerInspection(fixture.inspect, [...ids, id(9)])).toThrow(
      "provider_probe_stack_format_unrecognized",
    );
  });
});

describe("the observation", () => {
  it("is the API container's workdir and project labels and its published port, and matches this checkout", () => {
    const observed = observe(stack());

    expect(observed).toEqual({ workdir: WORKDIR, projectId: PROJECT, apiUrl: "http://127.0.0.1:54321/" });
    expect(compareProviderProbeEnvironment(CONFIG, observed)).toMatchObject({ matches: true });
  });

  it("reports a stack started from another folder, which the comparison then refuses", () => {
    const elsewhere = path.resolve(PROVIDER_PROBE_APP_ROOT, "..", "another-checkout");
    const entries = [
      line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: KONG_PORTS, workdir: elsewhere }),
      line({ index: 2, name: `/supabase_auth_${PROJECT}`, workdir: elsewhere }),
    ];
    const observed = observe({ ids: `${id(1)}\n${id(2)}\n`, inspect: `${entries.join("\n")}\n` });

    expect(observed.workdir).toBe(elsewhere);
    expect(compareProviderProbeEnvironment(CONFIG, observed)).toMatchObject({ matches: false, workdir: "differs" });
  });

  it.each([
    ["no container publishes the API port", { kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: null }) }, "provider_probe_stack_not_found"],
    [
      "two containers publish it",
      { extra: [line({ index: 4, name: "/supabase_kong_other-project", project: "other-project", ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "54321" }] } })] },
      "provider_probe_stack_ambiguous",
    ],
    ["the publisher is not the project's API gateway", { kong: line({ index: 1, name: `/supabase_rest_${PROJECT}`, ports: KONG_PORTS }) }, "provider_probe_stack_api_unrecognized"],
    [
      "the gateway publishes its TLS port instead",
      { kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: { "8443/tcp": [{ HostIp: "0.0.0.0", HostPort: "54321" }] } }) },
      "provider_probe_stack_api_unrecognized",
    ],
    [
      "the port is published only on an address loopback does not reach",
      { kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: { "8000/tcp": [{ HostIp: "192.168.1.20", HostPort: "54321" }] } }) },
      "provider_probe_stack_api_unrecognized",
    ],
    ["the Auth container is missing", { auth: null }, "provider_probe_stack_not_found"],
    ["the Auth container is stopped", { auth: line({ index: 2, name: `/supabase_auth_${PROJECT}`, running: false }) }, "provider_probe_stack_not_found"],
    [
      "the Auth container carries another workdir",
      { auth: line({ index: 2, name: `/supabase_auth_${PROJECT}`, workdir: path.resolve(PROVIDER_PROBE_APP_ROOT, "..", "elsewhere") }) },
      "provider_probe_stack_ambiguous",
    ],
    [
      "another container of the project carries another workdir",
      { extra: [line({ index: 4, name: `/supabase_studio_${PROJECT}`, workdir: path.resolve(PROVIDER_PROBE_APP_ROOT, "..", "elsewhere") })] },
      "provider_probe_stack_ambiguous",
    ],
    ["the gateway has no workdir label", { kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: KONG_PORTS, workdir: null }) }, "provider_probe_stack_workdir_unrecognized"],
    [
      "the workdir label is in a form the root check does not accept",
      {
        kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: KONG_PORTS, workdir: "_Apollo/Projects/Solmind/solmind-app" }),
        auth: line({ index: 2, name: `/supabase_auth_${PROJECT}`, workdir: "_Apollo/Projects/Solmind/solmind-app" }),
      },
      "provider_probe_stack_workdir_unrecognized",
    ],
    ["the gateway has no project label", { kong: line({ index: 1, name: `/supabase_kong_${PROJECT}`, ports: KONG_PORTS, project: null }) }, "provider_probe_stack_project_unrecognized"],
  ] as const)("is refused when %s", (_label, overrides, code) => {
    expect(() => observe(stack(overrides as Parameters<typeof stack>[0]))).toThrow(code);
  });

  // R7: the observed binding must be one a request to the kernel's own loopback origin
  // reaches, per address family; the observed URL is then that origin.
  it.each([
    ["127.0.0.1 reached through 0.0.0.0", ORIGIN, [{ HostIp: "0.0.0.0", HostPort: "54321" }], "http://127.0.0.1:54321/"],
    ["127.0.0.1 reached through 127.0.0.1", ORIGIN, [{ HostIp: "127.0.0.1", HostPort: "54321" }], "http://127.0.0.1:54321/"],
    ["[::1] reached through ::", "http://[::1]:54321", [{ HostIp: "::", HostPort: "54321" }], "http://[::1]:54321/"],
    ["[::1] reached through ::1", "http://[::1]:54321", [{ HostIp: "::1", HostPort: "54321" }], "http://[::1]:54321/"],
  ])("R7: accepts %s", (_label, origin, bindings, apiUrl) => {
    expect(observe(stack({ kong: kongPublishing(bindings) }), origin).apiUrl).toBe(apiUrl);
  });

  it.each([
    ["127.0.0.1 with the port published only on ::", ORIGIN, [{ HostIp: "::", HostPort: "54321" }]],
    ["127.0.0.1 with the port published only on ::1", ORIGIN, [{ HostIp: "::1", HostPort: "54321" }]],
    ["[::1] with the port published only on 0.0.0.0", "http://[::1]:54321", [{ HostIp: "0.0.0.0", HostPort: "54321" }]],
    ["[::1] with the port published only on 127.0.0.1", "http://[::1]:54321", [{ HostIp: "127.0.0.1", HostPort: "54321" }]],
    ["127.0.0.1 with the port published only on another interface", ORIGIN, [{ HostIp: "10.0.0.5", HostPort: "54321" }]],
    // R8: an empty host IP is undecidable (which address, or family, it binds is unknown).
    ["127.0.0.1 with the port published only on an empty host IP (R8)", ORIGIN, [{ HostIp: "", HostPort: "54321" }]],
    ["[::1] with the port published only on an empty host IP (R8)", "http://[::1]:54321", [{ HostIp: "", HostPort: "54321" }]],
  ])("R7: refuses %s", (_label, origin, bindings) => {
    expect(() => observe(stack({ kong: kongPublishing(bindings) }), origin)).toThrow("provider_probe_stack_api_unrecognized");
  });

  it.each([
    ["a host name", "http://localhost:54321"],
    ["a non-loopback address", "http://192.0.2.10:54321"],
    ["https", "https://127.0.0.1:54321"],
    ["no port", "http://127.0.0.1"],
    ["a path", "http://127.0.0.1:54321/auth"],
    ["not a URL", "127.0.0.1:54321"],
  ])("R7: refuses an expected origin with %s", (_label, origin) => {
    expect(() => observe(stack(), origin)).toThrow("provider_probe_stack_invalid_input");
  });
});

describe("R7: the local engine, decided from the environment alone (no process runs)", () => {
  it.each([
    ["win32", {}, PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32[0]],
    ["linux", {}, PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.posix[0]],
    ["win32", { DOCKER_HOST: "", DOCKER_CONTEXT: "" }, PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32[0]],
    ["win32", { DOCKER_CONTEXT: "default" }, PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32[0]],
    ["win32", { DOCKER_HOST: "npipe:////./pipe/docker_engine" }, "npipe:////./pipe/docker_engine"],
    ["linux", { DOCKER_HOST: "unix:///var/run/docker.sock", DOCKER_CONTEXT: "default" }, "unix:///var/run/docker.sock"],
  ] as const)("on %s with %j pins %s", (platform, environment, engine) => {
    expect(providerProbeLocalDockerEngine(environment, platform)).toBe(engine);
  });

  it("pins Docker Desktop's Linux engine pipe on Windows by default, and only local endpoints are listed", () => {
    expect(PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32[0]).toBe("npipe:////./pipe/dockerDesktopLinuxEngine");
    expect(PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32.every((endpoint) => endpoint.startsWith("npipe:////./pipe/"))).toBe(true);
    expect(PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.posix.every((endpoint) => endpoint.startsWith("unix:///"))).toBe(true);
  });

  it.each([
    ["win32", { DOCKER_HOST: REMOTE_ENGINE }],
    ["win32", { DOCKER_HOST: "tcp://127.0.0.1:2375" }],
    ["win32", { DOCKER_HOST: "ssh://fake-user@192.0.2.10" }],
    ["win32", { DOCKER_HOST: "npipe:////fake-remote-host/pipe/docker_engine" }],
    ["win32", { DOCKER_HOST: "unix:///var/run/docker.sock" }],
    ["linux", { DOCKER_HOST: "npipe:////./pipe/docker_engine" }],
    ["linux", { DOCKER_HOST: "unix:///tmp/fake-other.sock" }],
    ["win32", { DOCKER_CONTEXT: "fake-remote-context" }],
    ["win32", { DOCKER_CONTEXT: "desktop-linux" }],
    ["win32", { DOCKER_HOST: PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS.win32[0], DOCKER_CONTEXT: "fake-remote-context" }],
  ] as const)("on %s refuses %j", (platform, environment) => {
    expect(() => providerProbeLocalDockerEngine(environment, platform)).toThrow(/^provider_probe_stack_engine_not_local$/);
  });
});

describe("the two fixed commands (execFile replaced by a spy in every test)", () => {
  const ENVIRONMENT = {
    PATH: "C:\\fake\\bin",
    USERPROFILE: "C:\\Users\\fake",
    SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY: "fake-service-role-key-for-tests-only",
    SOLMIND_PROVIDER_PROBE_ANON_KEY: "fake-anon-key-for-tests-only",
    UNRELATED_SETTING: "not passed on",
  };

  // (R7) Each command starts with the pinned engine: --host <engine> <command> ...
  const isList = (call: ExecCall) => call.args[2] === "ps";

  it("runs exactly docker ps then docker container inspect, pinned to the local engine, with fixed arguments, no shell and allowlisted variables", async () => {
    const fixture = stack();
    const { calls } = stubExecFile((call) => ({ stdout: isList(call) ? fixture.ids : fixture.inspect }));

    const observed = await observeProviderProbeStack({ environment: ENVIRONMENT, expectedApiOrigin: ORIGIN });

    expect(observed).toEqual({ workdir: WORKDIR, projectId: PROJECT, apiUrl: "http://127.0.0.1:54321/" });
    expect(calls.map((call) => [call.file, call.args])).toEqual([
      ["docker", ["--host", LOCAL_ENGINE, ...PROVIDER_PROBE_STACK_LIST_ARGUMENTS]],
      ["docker", ["--host", LOCAL_ENGINE, "container", "inspect", "--format", PROVIDER_PROBE_STACK_INSPECT_FORMAT, id(1), id(2), id(3)]],
    ]);
    expect(PROVIDER_PROBE_STACK_INSPECT_FORMAT).not.toContain('"');
    expect(PROVIDER_PROBE_STACK_INSPECT_FORMAT).not.toMatch(/Env|Config\}\}/);
    for (const call of calls) {
      expect(call.options).toMatchObject({
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.timeoutMilliseconds,
        maxBuffer: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxOutputBytes,
      });
      expect(call.options.env).toEqual({ PATH: "C:\\fake\\bin", USERPROFILE: "C:\\Users\\fake" });
    }
  });

  it("passes no SOLMIND_* variable and nothing outside the allowlist to the child", () => {
    const child = providerProbeStackChildEnvironment(ENVIRONMENT);

    expect(Object.keys(child).every((name) => PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT.includes(name))).toBe(true);
    expect(Object.keys(child).some((name) => name.startsWith("SOLMIND_"))).toBe(false);
    expect(PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT.some((name) => name.toUpperCase().startsWith("SOLMIND_"))).toBe(false);
  });

  it("R7: passes no DOCKER_* variable to the child, and the allowlist names none", () => {
    const child = providerProbeStackChildEnvironment({
      ...ENVIRONMENT,
      DOCKER_HOST: LOCAL_ENGINE,
      DOCKER_CONTEXT: "default",
      DOCKER_CONFIG: "C:\\fake\\docker-config",
      DOCKER_CERT_PATH: "C:\\fake\\docker-certs",
      DOCKER_TLS_VERIFY: "1",
    });

    expect(child).toEqual({ PATH: "C:\\fake\\bin", USERPROFILE: "C:\\Users\\fake" });
    expect(PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT.some((name) => name.toUpperCase().startsWith("DOCKER"))).toBe(false);
  });

  it("R7: pins a local DOCKER_HOST it was given, and passes it on only as --host", async () => {
    const fixture = stack();
    const endpoints = PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS[process.platform === "win32" ? "win32" : "posix"]!;
    const alternative = endpoints[endpoints.length - 1]!;
    const { calls } = stubExecFile((call) => ({ stdout: isList(call) ? fixture.ids : fixture.inspect }));

    await observeProviderProbeStack({ environment: { ...ENVIRONMENT, DOCKER_HOST: alternative }, expectedApiOrigin: ORIGIN });

    expect(calls.map((call) => call.args.slice(0, 2))).toEqual([
      ["--host", alternative],
      ["--host", alternative],
    ]);
    expect(calls.every((call) => !("DOCKER_HOST" in (call.options.env as Record<string, string>)))).toBe(true);
  });

  it.each([
    ["a remote DOCKER_HOST", { DOCKER_HOST: REMOTE_ENGINE }],
    ["a non-default DOCKER_CONTEXT", { DOCKER_CONTEXT: "fake-remote-context" }],
  ])("R7: refuses %s before starting any process", async (_label, engineSettings) => {
    const fixture = stack();
    // Would answer with a matching stack if it were ever asked; it must not be.
    const { calls } = stubExecFile((call) => ({ stdout: isList(call) ? fixture.ids : fixture.inspect }));

    await expect(
      observeProviderProbeStack({ environment: { ...ENVIRONMENT, ...engineSettings }, expectedApiOrigin: ORIGIN }),
    ).rejects.toThrow(/^provider_probe_stack_engine_not_local$/);
    expect(calls).toHaveLength(0);
  });

  it("R7: refuses an expected origin that is not a loopback origin before starting any process", async () => {
    const { calls } = stubExecFile(() => ({ stdout: "" }));

    await expect(observeProviderProbeStack({ environment: ENVIRONMENT, expectedApiOrigin: "http://localhost:54321" })).rejects.toThrow(
      "provider_probe_stack_invalid_input",
    );
    expect(calls).toHaveLength(0);
  });

  it("stops with one value-free code when docker cannot be read (for example, Docker is not running)", async () => {
    const { calls } = stubExecFile(() => ({ error: new Error("error during connect: fake daemon text") }));

    await expect(observeProviderProbeStack({ environment: ENVIRONMENT, expectedApiOrigin: ORIGIN })).rejects.toThrow(
      /^provider_probe_stack_unreadable$/,
    );
    expect(calls).toHaveLength(1);
  });

  it("does not inspect anything when no CLI-labelled container is running", async () => {
    const { calls } = stubExecFile(() => ({ stdout: "" }));

    await expect(observeProviderProbeStack({ environment: ENVIRONMENT, expectedApiOrigin: ORIGIN })).rejects.toThrow(
      "provider_probe_stack_not_found",
    );
    expect(calls).toHaveLength(1);
  });

  it("stops when the inspection output is not in the expected form", async () => {
    const fixture = stack();
    stubExecFile((call) => ({ stdout: isList(call) ? fixture.ids : "[]\n" }));

    await expect(observeProviderProbeStack({ environment: ENVIRONMENT, expectedApiOrigin: ORIGIN })).rejects.toThrow(
      "provider_probe_stack_format_unrecognized",
    );
  });
});
