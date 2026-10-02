// Test-only PRODUCTION writer for the provider probes' two output files: the impact
// display (preview phase) and the one evidence document (run phase). It is the only
// module in this folder that may write a file (`providerProbeModuleBoundary.test.ts`
// allows `writeFileSync` here and nowhere else).
//
// - The directory must be an accepted absolute root path (providerProbeLocalRoot.ts's
//   syntax check) outside the pinned app root, so the live tree stays clean (PP-12 and
//   the run procedure check its git status). It must already exist.
// - (R6) Immediately before the exclusive create, with nothing asynchronous in between,
//   the writer:
//   - resolves the real (canonical) locations of the directory and of the app root, and
//     refuses a directory that is, or is inside, the app root once links and junctions
//     are followed; the file is then created in the resolved directory;
//   - re-reads the live kernel configuration from the environment it is given (both
//     interlocks, through `readProviderProbeSafetyConfig`), and refuses unless it holds,
//     its run id is the run's own, and the environment's phase is the phase this file
//     belongs to (the impact display only in "preview", the evidence only in "run").
//   The environment, the run id and the phase are required inputs: the writer cannot be
//   called without them. The suite gate passes the live process environment itself, so
//   removing an interlock at any moment before the write refuses it.
// - The file names are fixed and carry the run id; a file is created exclusively, so an
//   existing file (or link) at that path is never overwritten and a run id cannot be
//   reused.
// - The text is scanned once more (the kernel's patterns and the stricter ones) before
//   anything is written; the evidence text was already scanned against the run's
//   registry by `assembleOutput`.
//
// A limit that remains: between the canonical check and the create, a local process
// could replace the resolved directory itself with a link. Nothing in this harness
// does, and the run procedure names a directory the operator owns.

import { realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import { isAcceptedRootPathSyntax, providerProbeAppRoot } from "./providerProbeLocalRoot";
import { scanProviderProbeOutput } from "./providerProbeRunEnvelope";

export type ProviderProbeOutputFileKind = "impact-display" | "evidence";

export type ProviderProbeOutputPhase = "preview" | "run";

export type ProviderProbeOutputExpectation = Readonly<{ runId: string; phase: ProviderProbeOutputPhase }>;

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

const RUN_ID_PATTERN = /^P28-[0-9]{8}-[a-z0-9][a-z0-9-]{5,31}$/;
const PHASE_OF_KIND: Readonly<Record<ProviderProbeOutputFileKind, ProviderProbeOutputPhase>> = {
  "impact-display": "preview",
  evidence: "run",
};

function fail(code: string): never {
  throw new Error(code);
}

export function providerProbeOutputFileName(kind: ProviderProbeOutputFileKind, runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    fail("provider_probe_output_invalid_run_id");
  }
  return kind === "impact-display" ? `provider-probe-impact-${runId}.txt` : `provider-probe-evidence-${runId}.json`;
}

function comparable(value: string, platform: NodeJS.Platform): string {
  const trimmed = value.replace(/[\\/]+$/, "");
  return platform === "win32" ? trimmed.toLowerCase() : trimmed;
}

function isInsideRoot(root: string, directory: string, platform: NodeJS.Platform): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const relative = pathApi.relative(comparable(root, platform), comparable(directory, platform));
  return relative === "" || (!relative.startsWith("..") && !pathApi.isAbsolute(relative));
}

// Lexical check, at session build: returns the resolved directory, or throws a
// value-free code. The canonical check happens again at write time.
export function resolveProviderProbeOutputDirectory(raw: unknown, platform: NodeJS.Platform = process.platform): string {
  if (typeof raw !== "string" || !isAcceptedRootPathSyntax(raw, platform)) {
    fail("provider_probe_output_directory_refused");
  }
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const directory = pathApi.resolve(raw);
  if (isInsideRoot(pathApi.resolve(providerProbeAppRoot()), directory, platform)) {
    fail("provider_probe_output_directory_inside_app_root");
  }
  return directory;
}

// The real locations, links and junctions followed. Returns the canonical directory.
function canonicalDirectoryOutsideRoot(directory: string): string {
  let realDirectory: string;
  let realRoot: string;
  try {
    realDirectory = realpathSync(directory);
    realRoot = realpathSync(providerProbeAppRoot());
  } catch {
    fail("provider_probe_output_directory_unresolvable");
  }
  if (!isAcceptedRootPathSyntax(realDirectory) || isInsideRoot(realRoot, realDirectory, process.platform)) {
    fail("provider_probe_output_directory_inside_app_root");
  }
  return realDirectory;
}

// The live gate: both interlocks (the kernel returns a configuration), the same run id,
// and the phase this kind of file belongs to, in both the caller's expectation and the
// environment.
function liveGateHolds(
  environment: unknown,
  expected: unknown,
  kind: ProviderProbeOutputFileKind,
): boolean {
  if (!environment || typeof environment !== "object" || !expected || typeof expected !== "object") {
    return false;
  }
  const { runId, phase } = expected as { runId?: unknown; phase?: unknown };
  let config: ReturnType<typeof readProviderProbeSafetyConfig>;
  try {
    config = readProviderProbeSafetyConfig(environment as ProbeEnvironment);
  } catch {
    return false;
  }
  return (
    config !== null &&
    typeof runId === "string" &&
    config.runId === runId &&
    phase === PHASE_OF_KIND[kind] &&
    (environment as ProbeEnvironment).SOLMIND_PROVIDER_PROBE_PHASE === phase
  );
}

export function writeProviderProbeOutputFile(
  input: Readonly<{
    environment: ProbeEnvironment;
    expected: ProviderProbeOutputExpectation;
    directory: unknown;
    kind: ProviderProbeOutputFileKind;
    text: string;
  }>,
): void {
  if (!input || (input.kind !== "impact-display" && input.kind !== "evidence")) {
    fail("provider_probe_output_kind_refused");
  }
  // Not callable without the live gate, the run id and the phase.
  if (!liveGateHolds(input.environment, input.expected, input.kind)) {
    fail("provider_probe_output_gate_closed");
  }
  const directory = resolveProviderProbeOutputDirectory(input.directory);
  if (typeof input.text !== "string" || input.text.length === 0 || !scanProviderProbeOutput(input.text).passed) {
    fail("provider_probe_output_text_refused");
  }
  const name = providerProbeOutputFileName(input.kind, input.expected.runId);
  // From here to the create, everything is synchronous: nothing can change in between.
  const realDirectory = canonicalDirectoryOutsideRoot(directory);
  // The gate again, immediately before the exclusive create.
  if (!liveGateHolds(input.environment, input.expected, input.kind)) {
    fail("provider_probe_output_gate_closed");
  }
  try {
    writeFileSync(path.join(realDirectory, name), input.text, { encoding: "utf8", flag: "wx" });
  } catch {
    fail("provider_probe_output_write_failed");
  }
}
