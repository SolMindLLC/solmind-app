import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PROVIDER_PROBE_APP_ROOT } from "./providerProbeLocalRoot";
import {
  providerProbeOutputFileName,
  resolveProviderProbeOutputDirectory,
  writeProviderProbeOutputFile,
  type ProviderProbeOutputExpectation,
  type ProviderProbeOutputFileKind,
} from "./providerProbeOutputFile";
import { gatedTestEnvironment } from "./providerProbeTestSupport";

// The writer is exercised with `writeFileSync` replaced by a spy: no file is created
// anywhere, and every directory named here does not exist, so even a failed spy could
// not create one. `realpathSync` is a spy too, which EMULATES the real locations: a
// folder outside the app root that is a link or junction into it is emulated by mapping
// its path into the root. No real link is made: a test that made one would create and
// delete a link into the app root on every test run (including the executor's clean
// copy) and could leave it behind if interrupted. Any other path goes to the real
// `realpathSync`. The modules use named `fs` imports; syncing the built-in ESM exports
// makes those bindings see the spies (the positive controls prove they do).

const RUN_ID = "P28-20261001-output-file";
const ROOT = path.resolve(PROVIDER_PROBE_APP_ROOT);
const OUTSIDE = path.resolve(ROOT, "..", "provider-probe-output-not-created");
const LINKED = path.resolve(ROOT, "..", "provider-probe-output-link-not-created");
const ROOT_LINK = path.resolve(ROOT, "..", "provider-probe-app-root-link-not-created");
const MISSING = path.resolve(ROOT, "..", "provider-probe-output-missing-not-created");
const INSIDE_TARGET = path.join(ROOT, "tests", "provider-probe");
const KINDS: readonly (readonly [ProviderProbeOutputFileKind, "preview" | "run"])[] = [
  ["impact-display", "preview"],
  ["evidence", "run"],
];
const realRealpath = fs.realpathSync;

let beforeResolving: (() => void) | null = null;

afterEach(() => {
  beforeResolving = null;
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

function environmentFor(phase: "preview" | "run"): Record<string, string | undefined> {
  return gatedTestEnvironment("output-file", { SOLMIND_PROVIDER_PROBE_PHASE: phase });
}

function expectationFor(phase: "preview" | "run"): ProviderProbeOutputExpectation {
  return { runId: RUN_ID, phase };
}

function spyOnFileSystem() {
  const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
  const realpathSpy = vi.spyOn(fs, "realpathSync").mockImplementation(((target: fs.PathLike) => {
    beforeResolving?.();
    const resolved = path.resolve(String(target));
    if (resolved === LINKED) {
      return INSIDE_TARGET;
    }
    if (resolved === ROOT_LINK) {
      return ROOT;
    }
    if (resolved === OUTSIDE || resolved === ROOT) {
      return resolved;
    }
    return realRealpath(target);
  }) as typeof fs.realpathSync);
  syncBuiltinESMExports();
  return { writeSpy, realpathSpy };
}

function write(
  kind: ProviderProbeOutputFileKind,
  phase: "preview" | "run",
  options: Readonly<{ environment?: Record<string, string | undefined>; directory?: string; text?: string }> = {},
) {
  writeProviderProbeOutputFile({
    environment: options.environment ?? environmentFor(phase),
    expected: expectationFor(phase),
    directory: options.directory ?? OUTSIDE,
    kind,
    text: options.text ?? '{"evidence":[]}',
  });
}

describe("output directory (lexical, at session build)", () => {
  it("accepts an absolute directory outside the app root", () => {
    expect(resolveProviderProbeOutputDirectory(OUTSIDE)).toBe(OUTSIDE);
  });

  it.each([
    ["the app root itself", PROVIDER_PROBE_APP_ROOT],
    ["a folder inside the app root", path.join(PROVIDER_PROBE_APP_ROOT, "tests", "provider-probe")],
    ["the app root in another letter case", process.platform === "win32" ? PROVIDER_PROBE_APP_ROOT.toUpperCase() : PROVIDER_PROBE_APP_ROOT],
  ])("refuses %s, so the live tree stays clean", (_label, directory) => {
    expect(() => resolveProviderProbeOutputDirectory(directory)).toThrow("provider_probe_output_directory_inside_app_root");
  });

  it.each([["relative/output"], [""], ["\\\\server\\share\\output"], [undefined], [42]])(
    "refuses %j by its path syntax",
    (directory) => {
      expect(() => resolveProviderProbeOutputDirectory(directory, "win32")).toThrow("provider_probe_output_directory_refused");
    },
  );
});

describe("the canonical check, immediately before the create", () => {
  it.each(KINDS)("positive control: writes the %s exclusively into a real directory outside the app root", (kind, phase) => {
    const { writeSpy, realpathSpy } = spyOnFileSystem();

    write(kind, phase);

    expect(realpathSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith(path.join(OUTSIDE, providerProbeOutputFileName(kind, RUN_ID)), '{"evidence":[]}', {
      encoding: "utf8",
      flag: "wx",
    });
  });

  it.each(KINDS)("refuses a linked directory outside the app root that resolves into it (%s)", (kind, phase) => {
    const { writeSpy } = spyOnFileSystem();

    // Lexically it is outside the root, so the session-build check accepts it.
    expect(resolveProviderProbeOutputDirectory(LINKED)).toBe(LINKED);
    expect(() => write(kind, phase, { directory: LINKED })).toThrow("provider_probe_output_directory_inside_app_root");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("refuses a directory that resolves to the app root itself", () => {
    const { writeSpy } = spyOnFileSystem();

    expect(() => write("evidence", "run", { directory: ROOT_LINK })).toThrow("provider_probe_output_directory_inside_app_root");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("refuses a directory that does not exist, with its own code (the real realpathSync)", () => {
    const { writeSpy } = spyOnFileSystem();

    expect(() => write("evidence", "run", { directory: MISSING })).toThrow(/^provider_probe_output_directory_unresolvable$/);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe("the live gate: both interlocks, this run id and this file's phase", () => {
  const CHANGES: readonly (readonly [string, Record<string, string | undefined>])[] = [
    ["the approval interlock removed", { SOLMIND_PROVIDER_PROBE_APPROVAL: undefined }],
    ["the effect interlock removed", { SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: undefined }],
    ["a near-miss effect interlock", { SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: "approved-exact-id-local-auth-cleanup " }],
    ["another run id", { SOLMIND_PROVIDER_PROBE_RUN_ID: "P28-20261001-another-run", SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: "probe+p28-20261001-another-run@synthetic.invalid" }],
    ["the phase removed", { SOLMIND_PROVIDER_PROBE_PHASE: undefined }],
    ["a malformed configuration", { SOLMIND_LOCAL_SUPABASE_URL: "http://localhost:54321" }],
  ];

  it.each(KINDS.flatMap(([kind, phase]) => CHANGES.map(([label, change]) => [label, kind, phase, change] as const)))(
    "refuses with %s before the %s is written",
    (_label, kind, phase, change) => {
      const { writeSpy } = spyOnFileSystem();

      expect(() => write(kind, phase, { environment: { ...environmentFor(phase), ...change } })).toThrow(
        /^provider_probe_output_gate_closed$/,
      );
      expect(writeSpy).not.toHaveBeenCalled();
    },
  );

  it.each(KINDS.flatMap(([kind, phase]) => CHANGES.map(([label, change]) => [label, kind, phase, change] as const)))(
    "refuses with %s immediately before the %s is created (removed during the canonical check)",
    (_label, kind, phase, change) => {
      const { writeSpy, realpathSpy } = spyOnFileSystem();
      const environment = environmentFor(phase);
      beforeResolving = () => {
        Object.assign(environment, change);
      };

      expect(() => write(kind, phase, { environment })).toThrow(/^provider_probe_output_gate_closed$/);
      expect(realpathSpy).toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    },
  );

  it("writes each file only in its own phase", () => {
    const { writeSpy } = spyOnFileSystem();

    expect(() =>
      writeProviderProbeOutputFile({
        environment: environmentFor("run"),
        expected: expectationFor("run"),
        directory: OUTSIDE,
        kind: "impact-display",
        text: "display",
      }),
    ).toThrow("provider_probe_output_gate_closed");
    expect(() =>
      writeProviderProbeOutputFile({
        environment: environmentFor("run"),
        expected: expectationFor("preview"),
        directory: OUTSIDE,
        kind: "evidence",
        text: "{}",
      }),
    ).toThrow("provider_probe_output_gate_closed");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("cannot be called without its environment, run id or phase", () => {
    const { writeSpy } = spyOnFileSystem();
    const missing = [
      { environment: undefined, expected: expectationFor("run") },
      { environment: environmentFor("run"), expected: undefined },
      { environment: environmentFor("run"), expected: { runId: RUN_ID } },
      { environment: environmentFor("run"), expected: { phase: "run" } },
      { environment: {}, expected: expectationFor("run") },
    ];

    for (const input of missing) {
      expect(() =>
        writeProviderProbeOutputFile({
          ...(input as unknown as { environment: Record<string, string>; expected: ProviderProbeOutputExpectation }),
          directory: OUTSIDE,
          kind: "evidence",
          text: "{}",
        }),
      ).toThrow("provider_probe_output_gate_closed");
    }
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe("output files", () => {
  it("uses two fixed names that carry the run id", () => {
    expect(providerProbeOutputFileName("impact-display", RUN_ID)).toBe(`provider-probe-impact-${RUN_ID}.txt`);
    expect(providerProbeOutputFileName("evidence", RUN_ID)).toBe(`provider-probe-evidence-${RUN_ID}.json`);
    expect(() => providerProbeOutputFileName("evidence", "../escape")).toThrow("provider_probe_output_invalid_run_id");
  });

  it.each([
    ["an address", "contact person@example.test"],
    ["a JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.c2lnbmF0dXJlLWZha2U"],
    ["the word token", "a token value"],
    ["nothing at all", ""],
  ])("refuses text containing %s before writing anything", (_label, text) => {
    const { writeSpy } = spyOnFileSystem();

    expect(() => write("impact-display", "preview", { text })).toThrow("provider_probe_output_text_refused");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("reports a failed write with one value-free code", () => {
    spyOnFileSystem();
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("EEXIST: file already exists, C:\\some\\path");
    });
    syncBuiltinESMExports();

    expect(() => write("evidence", "run", { text: "{}" })).toThrow(/^provider_probe_output_write_failed$/);
  });
});
