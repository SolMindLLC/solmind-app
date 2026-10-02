// Test-only PRODUCTION observer of the running local Supabase stack (backlog item 70's
// "observed resolved workdir/project-id/API-URL comparison"), for PP-00 only.
//
// It is the only module in this folder that may start a process
// (`providerProbeModuleBoundary.test.ts` allows `node:child_process`, and only its
// `execFile`, here and nowhere else). It runs exactly two fixed, read-only `docker`
// commands, with fixed arguments, no shell, a timeout and an output cap:
//
//   docker --host <the local engine> ps --no-trunc --quiet --filter label=com.supabase.cli.project
//   docker --host <the local engine> container inspect --format <the fixed template> <the ids>
//
// The template prints, per container, only its id, name, labels, published ports and
// running state, so a container's environment (which holds the stack's JWT secret and
// keys) never reaches this process. Nothing is started, stopped or changed, and no
// Supabase CLI command is run. The child gets only an allowlisted set of environment
// variables (the ones the docker CLI needs to find its program), never a SOLMIND_*
// setting or key.
//
// (R7) A local Docker engine only. The engine is pinned with `--host`, which the docker
// CLI uses instead of any context, so a saved current context or DOCKER_CONFIG cannot
// redirect it: on Windows a local named pipe (a `\\.\pipe\` name is on this machine by
// construction), by default `npipe:////./pipe/dockerDesktopLinuxEngine`, the endpoint of
// Docker Desktop's `desktop-linux` context; elsewhere the local socket
// `unix:///var/run/docker.sock`. DOCKER_HOST, DOCKER_CONTEXT, DOCKER_CONFIG,
// DOCKER_CERT_PATH and DOCKER_TLS_VERIFY never reach the child. Before docker runs, and
// so before any Auth request, the environment is checked without running anything: a
// DOCKER_HOST other than one of the fixed local endpoints, or a DOCKER_CONTEXT other than
// "default", is refused (`provider_probe_stack_engine_not_local`; a named context could
// point anywhere, and deciding where would mean reading its metadata). A DOCKER_HOST
// equal to a fixed local endpoint (for example the classic `npipe:////./pipe/docker_engine`)
// is used as the pinned engine.
//
// What it observes, and from where. Supabase CLI 2.115.0 (the npm package's bundled
// start code, read as source; never run by this harness) labels every container it starts
// with `com.supabase.cli.project=<project id>`, `com.docker.compose.project=<project id>`
// and `com.supabase.cli.workdir=<the workdir it resolved>`, names its API gateway
// `supabase_kong_<project id>` and its Auth server `supabase_auth_<project id>`, and
// publishes the gateway's container port 8000/tcp on the configured API port. The
// observation is:
// - the API URL: the one running CLI-labelled container that publishes the kernel's API
//   port must be that project's `supabase_kong_` container, on 8000/tcp, with a host IP a
//   request to the kernel's own loopback address reaches (for 127.0.0.1: 0.0.0.0 or
//   127.0.0.1; for [::1]: :: or ::1). (R8) An empty host IP is refused as undecidable:
//   these two reads cannot establish which address, or address family, it binds, and
//   `NetworkSettings.Ports` is expected to report the resolved address (Docker writes an
//   empty one in a container's requested bindings, not its published ones; UNVERIFIED
//   until the preview, which stops with no effect if Docker reports one). Because the
//   engine is local, that binding is on this machine, so the observed URL is the kernel's
//   own origin. (Two things stay outside this proof: that the pinned engine is the one the
//   stack was started on, which fails closed when it is not, as no labelled container is
//   found; and that no other local process also binds the port; PP-00 separately checks
//   that an Auth API answers there.)
// - the project id: that container's project label;
// - the workdir: its workdir label, which the running `supabase_auth_` container and
//   every other container of that project must carry with the same value.
//
// UNVERIFIED until the preview runs: these labels, names and output shapes come from the
// CLI's source and Docker's documented formats; Docker was not running while this was
// written, so no real output was captured. Every read is parsed fail-closed: any output
// that does not have exactly the expected shape throws a value-free code, and PP-00 then
// stops with no effect and says so (stop code "environment-unobserved").

import { execFile } from "node:child_process";

import { isAcceptedRootPathSyntax } from "./providerProbeLocalRoot";
import type { ProviderProbeObservedEnvironment } from "./providerProbeEnvironment";

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

export const PROVIDER_PROBE_STACK_OBSERVER_LIMITS = Object.freeze({
  timeoutMilliseconds: 10_000,
  maxOutputBytes: 1_048_576,
  maxContainers: 64,
  maxLabelValueLength: 1_024,
});

export const PROVIDER_PROBE_STACK_LABELS = Object.freeze({
  project: "com.supabase.cli.project",
  workdir: "com.supabase.cli.workdir",
});

// No double quote anywhere, so no Windows argument quoting is involved.
export const PROVIDER_PROBE_STACK_INSPECT_FORMAT =
  "[{{json .Id}},{{json .Name}},{{json .Config.Labels}},{{json .NetworkSettings.Ports}},{{json .State.Running}}]";

export const PROVIDER_PROBE_STACK_LIST_ARGUMENTS = Object.freeze([
  "ps",
  "--no-trunc",
  "--quiet",
  "--filter",
  `label=${PROVIDER_PROBE_STACK_LABELS.project}`,
]);

// The only environment variables the docker child receives (when set): how Windows and
// POSIX find a program and the user's home. (R7) No DOCKER_* variable.
export const PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT = Object.freeze([
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "windir",
  "USERPROFILE",
  "HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "TEMP",
  "TMP",
]);

// R7: the fixed local engine endpoints. The first is the one pinned unless DOCKER_HOST
// names another of them.
export const PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS: Readonly<Record<"win32" | "posix", readonly string[]>> = Object.freeze({
  win32: Object.freeze(["npipe:////./pipe/dockerDesktopLinuxEngine", "npipe:////./pipe/docker_engine"]),
  posix: Object.freeze(["unix:///var/run/docker.sock"]),
});

const CONTAINER_ID_PATTERN = /^[0-9a-f]{64}$/;
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const API_CONTAINER_PORT = "8000/tcp";
// R7: the binding host IPs a request to each kernel loopback host reaches. (R8) Never the
// empty host IP: what it binds cannot be decided from these reads.
const REACHING_HOST_IPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "127.0.0.1": Object.freeze(["0.0.0.0", "127.0.0.1"]),
  "[::1]": Object.freeze(["::", "::1"]),
});

export type ProviderProbeStackContainer = Readonly<{
  id: string;
  name: string;
  labels: Readonly<Record<string, string>>;
  ports: Readonly<Record<string, readonly Readonly<{ hostIp: string; hostPort: string }>[]>>;
  running: boolean;
}>;

function fail(code: string): never {
  throw new Error(code);
}

function lines(stdout: unknown): string[] {
  if (typeof stdout !== "string" || stdout.length > PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxOutputBytes) {
    fail("provider_probe_stack_format_unrecognized");
  }
  return stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

// `docker ps --quiet --no-trunc`: one full 64-character id per line, each once.
export function parseProviderProbeContainerIds(stdout: unknown): readonly string[] {
  const ids = lines(stdout);
  if (
    ids.length > PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxContainers ||
    ids.some((id) => !CONTAINER_ID_PATTERN.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    fail("provider_probe_stack_format_unrecognized");
  }
  return Object.freeze(ids);
}

function parseLabels(raw: unknown): Readonly<Record<string, string>> {
  if (raw === null) {
    return Object.freeze({});
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_stack_format_unrecognized");
  }
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string" || value.length > PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxLabelValueLength) {
      fail("provider_probe_stack_format_unrecognized");
    }
    labels[key] = value;
  }
  return Object.freeze(labels);
}

function parsePorts(raw: unknown): ProviderProbeStackContainer["ports"] {
  if (raw === null) {
    return Object.freeze({});
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_stack_format_unrecognized");
  }
  const ports: Record<string, readonly Readonly<{ hostIp: string; hostPort: string }>[]> = {};
  for (const [key, bindings] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[0-9]{1,5}\/(?:tcp|udp|sctp)$/.test(key)) {
      fail("provider_probe_stack_format_unrecognized");
    }
    if (bindings === null) {
      ports[key] = Object.freeze([]);
      continue;
    }
    if (!Array.isArray(bindings)) {
      fail("provider_probe_stack_format_unrecognized");
    }
    ports[key] = Object.freeze(
      bindings.map((binding: unknown) => {
        const value = binding as { HostIp?: unknown; HostPort?: unknown } | null;
        if (
          !value ||
          typeof value !== "object" ||
          typeof value.HostIp !== "string" ||
          typeof value.HostPort !== "string" ||
          !/^[0-9]{1,5}$/.test(value.HostPort)
        ) {
          fail("provider_probe_stack_format_unrecognized");
        }
        return Object.freeze({ hostIp: value.HostIp, hostPort: value.HostPort });
      }),
    );
  }
  return Object.freeze(ports);
}

// `docker container inspect --format <PROVIDER_PROBE_STACK_INSPECT_FORMAT>`: one JSON array
// per line, for exactly the ids asked about, in any order.
export function parseProviderProbeContainerInspection(
  stdout: unknown,
  ids: readonly string[],
): readonly ProviderProbeStackContainer[] {
  const containers: ProviderProbeStackContainer[] = [];
  for (const line of lines(stdout)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      fail("provider_probe_stack_format_unrecognized");
    }
    if (!Array.isArray(parsed) || parsed.length !== 5) {
      fail("provider_probe_stack_format_unrecognized");
    }
    const [id, name, labels, ports, running] = parsed as unknown[];
    if (
      typeof id !== "string" ||
      !CONTAINER_ID_PATTERN.test(id) ||
      typeof name !== "string" ||
      !/^\/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name) ||
      typeof running !== "boolean"
    ) {
      fail("provider_probe_stack_format_unrecognized");
    }
    containers.push(Object.freeze({ id, name, labels: parseLabels(labels), ports: parsePorts(ports), running }));
  }
  const seen = new Set(containers.map((container) => container.id));
  if (containers.length !== ids.length || seen.size !== ids.length || ids.some((id) => !seen.has(id))) {
    fail("provider_probe_stack_format_unrecognized");
  }
  return Object.freeze(containers);
}

function normalizedWorkdir(raw: string): string {
  // Lexical only, as in providerProbeEnvironment.ts: a label in any other form (a
  // Docker-style or relative path, a UNC or device path) is not a recognized workdir.
  if (!isAcceptedRootPathSyntax(raw)) {
    fail("provider_probe_stack_workdir_unrecognized");
  }
  const trimmed = raw.replace(/[\\/]+$/, "");
  return process.platform === "win32" ? trimmed.toLowerCase() : trimmed;
}

// The kernel's API origin as a loopback host and a port, or a value-free refusal.
function loopbackTarget(expectedApiOrigin: unknown): Readonly<{ origin: string; host: string; port: string }> {
  let url: URL;
  try {
    url = new URL(String(expectedApiOrigin));
  } catch {
    fail("provider_probe_stack_invalid_input");
  }
  if (url.protocol !== "http:" || url.origin !== expectedApiOrigin || !(url.hostname in REACHING_HOST_IPS) || url.port === "") {
    fail("provider_probe_stack_invalid_input");
  }
  return Object.freeze({ origin: url.origin, host: url.hostname, port: url.port });
}

// The observation, from parsed containers (read from the local engine). Throws a value-free
// code unless the API port's publisher, its project and its workdir are each confirmed,
// and the publisher's binding is one a request to the kernel's own loopback origin reaches.
export function observeProviderProbeStackFromContainers(
  containers: readonly ProviderProbeStackContainer[],
  expectedApiOrigin: string,
): ProviderProbeObservedEnvironment {
  const target = loopbackTarget(expectedApiOrigin);
  const port = target.port;
  const reaching = REACHING_HOST_IPS[target.host]!;
  const publishers = containers.filter(
    (container) =>
      container.running &&
      Object.values(container.ports).some((bindings) => bindings.some((binding) => binding.hostPort === port)),
  );
  if (publishers.length === 0) {
    fail("provider_probe_stack_not_found");
  }
  if (publishers.length > 1) {
    fail("provider_probe_stack_ambiguous");
  }
  const api = publishers[0]!;
  const projectId = api.labels[PROVIDER_PROBE_STACK_LABELS.project];
  if (typeof projectId !== "string" || !PROJECT_ID_PATTERN.test(projectId)) {
    fail("provider_probe_stack_project_unrecognized");
  }
  const publishedHere = Object.entries(api.ports).filter(([, bindings]) => bindings.some((binding) => binding.hostPort === port));
  if (
    api.name !== `/supabase_kong_${projectId}` ||
    publishedHere.length !== 1 ||
    publishedHere[0]![0] !== API_CONTAINER_PORT ||
    publishedHere[0]![1].some((binding) => binding.hostPort !== port) ||
    !publishedHere[0]![1].some((binding) => reaching.includes(binding.hostIp))
  ) {
    fail("provider_probe_stack_api_unrecognized");
  }
  const project = containers.filter((container) => container.labels[PROVIDER_PROBE_STACK_LABELS.project] === projectId);
  const auth = project.filter((container) => container.name === `/supabase_auth_${projectId}`);
  if (auth.length !== 1 || !auth[0]!.running) {
    fail("provider_probe_stack_not_found");
  }
  const workdirs = project.map((container) => container.labels[PROVIDER_PROBE_STACK_LABELS.workdir]);
  if (workdirs.some((workdir) => typeof workdir !== "string" || workdir.length === 0)) {
    fail("provider_probe_stack_workdir_unrecognized");
  }
  const normalized = new Set(workdirs.map((workdir) => normalizedWorkdir(workdir as string)));
  if (normalized.size !== 1) {
    fail("provider_probe_stack_ambiguous");
  }
  return Object.freeze({
    workdir: api.labels[PROVIDER_PROBE_STACK_LABELS.workdir]!,
    projectId,
    apiUrl: `${target.origin}/`,
  });
}

// R7: the local engine to pin, from the environment alone (no docker run), or a refusal:
// DOCKER_HOST must be unset or one of the fixed local endpoints, and DOCKER_CONTEXT unset
// or "default".
export function providerProbeLocalDockerEngine(
  environment: ProbeEnvironment,
  platform: NodeJS.Platform = process.platform,
): string {
  const endpoints = PROVIDER_PROBE_LOCAL_DOCKER_ENDPOINTS[platform === "win32" ? "win32" : "posix"];
  const host = environment.DOCKER_HOST;
  const context = environment.DOCKER_CONTEXT;
  if (host !== undefined && host !== "" && !endpoints.includes(host)) {
    fail("provider_probe_stack_engine_not_local");
  }
  if (context !== undefined && context !== "" && context !== "default") {
    fail("provider_probe_stack_engine_not_local");
  }
  return host !== undefined && host !== "" ? host : endpoints[0]!;
}

export function providerProbeStackChildEnvironment(environment: ProbeEnvironment): Record<string, string> {
  const child: Record<string, string> = {};
  for (const name of PROVIDER_PROBE_STACK_CHILD_ENVIRONMENT) {
    const value = environment[name];
    if (typeof value === "string" && value.length > 0) {
      child[name] = value;
    }
  }
  return child;
}

function runDocker(args: readonly string[], childEnvironment: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      execFile(
        "docker",
        [...args],
        {
          encoding: "utf8",
          // Exactly the allowlisted variables (the app's typing adds NODE_ENV to ProcessEnv).
          env: childEnvironment as unknown as NodeJS.ProcessEnv,
          shell: false,
          timeout: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.timeoutMilliseconds,
          maxBuffer: PROVIDER_PROBE_STACK_OBSERVER_LIMITS.maxOutputBytes,
          windowsHide: true,
        },
        (error, stdout) => {
          // Standard error is never read, kept or printed.
          if (error) {
            reject(new Error("provider_probe_stack_unreadable"));
            return;
          }
          resolve(typeof stdout === "string" ? stdout : "");
        },
      );
    } catch {
      reject(new Error("provider_probe_stack_unreadable"));
    }
  });
}

// The production observer. `environment` is the process environment, passed in by the
// suite gate (this module never reads it itself); only the allowlisted names reach the
// child, and the engine is pinned to the local one.
export async function observeProviderProbeStack(
  input: Readonly<{ environment: ProbeEnvironment; expectedApiOrigin: string }>,
): Promise<ProviderProbeObservedEnvironment> {
  if (!input || !input.environment || typeof input.environment !== "object") {
    fail("provider_probe_stack_invalid_input");
  }
  loopbackTarget(input.expectedApiOrigin);
  // Checked from the environment alone, before docker runs.
  const engine = providerProbeLocalDockerEngine(input.environment);
  const childEnvironment = providerProbeStackChildEnvironment(input.environment);
  const ids = parseProviderProbeContainerIds(
    await runDocker(["--host", engine, ...PROVIDER_PROBE_STACK_LIST_ARGUMENTS], childEnvironment),
  );
  if (ids.length === 0) {
    fail("provider_probe_stack_not_found");
  }
  const inspected = await runDocker(
    ["--host", engine, "container", "inspect", "--format", PROVIDER_PROBE_STACK_INSPECT_FORMAT, ...ids],
    childEnvironment,
  );
  return observeProviderProbeStackFromContainers(parseProviderProbeContainerInspection(inspected, ids), input.expectedApiOrigin);
}
