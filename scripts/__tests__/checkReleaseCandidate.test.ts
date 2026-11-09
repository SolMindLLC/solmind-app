import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// The release-candidate check run on small fixture apps (REV335d finding 3, correction D-4): a build is accepted only
// with served pages under both .next/server and .next/static. Each fixture is a temporary folder holding copies of
// the two scripts, one clean source file and the chosen build output; the check reads only that folder.

const appRoot = path.resolve(__dirname, "..", "..");
const fixtures: string[] = [];

function fixture(build: { buildId: boolean; server?: readonly string[]; static?: readonly string[] }): string {
  const root = mkdtempSync(path.join(tmpdir(), "solmind-release-check-"));
  fixtures.push(root);
  mkdirSync(path.join(root, "scripts"));
  for (const name of ["checkReleaseCandidate.mjs", "releaseCandidateScan.mjs"]) {
    copyFileSync(path.join(appRoot, "scripts", name), path.join(root, "scripts", name));
  }
  mkdirSync(path.join(root, "src", "app"), { recursive: true });
  writeFileSync(path.join(root, "src", "app", "page.tsx"), "export default function Page() { return null; }\n");
  for (const [folder, files] of [["server", build.server], ["static", build.static]] as const) {
    if (files === undefined) continue;
    mkdirSync(path.join(root, ".next", folder), { recursive: true });
    for (const file of files) writeFileSync(path.join(root, ".next", folder, file), "<p>built</p>\n");
  }
  if (build.buildId) {
    mkdirSync(path.join(root, ".next"), { recursive: true });
    writeFileSync(path.join(root, ".next", "BUILD_ID"), "fixture\n");
    const later = new Date(Date.now() + 60_000);
    utimesSync(path.join(root, ".next", "BUILD_ID"), later, later);
  }
  return root;
}

function check(root: string) {
  const run = spawnSync(process.execPath, [path.join(root, "scripts", "checkReleaseCandidate.mjs")], { encoding: "utf8" });
  return { status: run.status, output: run.stdout };
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("release-candidate check (script)", () => {
  it("RC07 refuses a build with only BUILD_ID", () => {
    const result = check(fixture({ buildId: true }));
    expect(result.status).toBe(1);
    expect(result.output).toContain("No built pages: .next/server and .next/static missing.");
    expect(result.output).toContain("FAIL");
  });

  it.each([
    ["the server folder", { static: ["chunk.js"] }, ".next/server missing"],
    ["the static folder", { server: ["page.html"] }, ".next/static missing"],
  ] as const)("RC08 refuses a build missing %s", (_case, output, message) => {
    const result = check(fixture({ buildId: true, ...output }));
    expect(result.status).toBe(1);
    expect(result.output).toContain(message);
  });

  it("RC09 refuses a build whose output folders hold no served pages", () => {
    const result = check(fixture({ buildId: true, server: [], static: [] }));
    expect(result.status).toBe(1);
    expect(result.output).toContain("No built pages to check under .next/server and .next/static.");
  });

  it("RC10 passes a clean build with served pages in both folders", () => {
    const result = check(fixture({ buildId: true, server: ["page.html"], static: ["chunk.js"] }));
    expect(result.output).toContain("PASS: none remain.");
    expect(result.status).toBe(0);
  });
});
