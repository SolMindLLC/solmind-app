// Test-only root-path guard for the future local Supabase Auth provider probes.
//
// What this guarantees, exactly: the production harness's two filesystem readers
// (providerProbeEnvironment.ts and providerProbeRunEnvelope.ts) read only under one
// pinned root (the solmind-app repository root that contains this folder), and they
// check that root's path text before their own filesystem calls. The unit tests' own
// reads (for example the boundary test's folder scan) are not guarded by it. The
// check rejects Windows UNC paths (`\\server\share`, `//server/share`), device and
// long-path prefixes (`\\?\`, `\\.\`), drive-relative paths (`C:repo`) and relative
// paths; on POSIX it rejects relative paths and `//`-prefixed paths.
//
// What it does NOT guarantee: that the path is on a local disk. It is a lexical check
// only. A mapped network drive letter (for example `Z:\repo`), a junction or symbolic
// link inside an accepted path that points at a share, and a POSIX mount of a network
// filesystem all pass it. Detecting those would mean resolving or querying the path,
// which can itself reach the share, so it is deliberately not done.

import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROVIDER_PROBE_APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const MAX_ROOT_LENGTH = 1_024;

export function isAcceptedRootPathSyntax(candidate: unknown, platform: NodeJS.Platform = process.platform): boolean {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.length > MAX_ROOT_LENGTH ||
    candidate.includes("\0")
  ) {
    return false;
  }
  if (platform === "win32") {
    // A drive letter, a colon and one separator, and nothing UNC-like after it.
    return /^[A-Za-z]:[\\/](?![\\/])/.test(candidate);
  }
  return candidate.startsWith("/") && !candidate.startsWith("//");
}

export function assertAcceptedRootPathSyntax(candidate: unknown): string {
  if (!isAcceptedRootPathSyntax(candidate)) {
    throw new Error("provider_probe_root_path_refused");
  }
  return path.resolve(candidate as string);
}

// The only root the harness reads from.
export function providerProbeAppRoot(): string {
  return assertAcceptedRootPathSyntax(PROVIDER_PROBE_APP_ROOT);
}
