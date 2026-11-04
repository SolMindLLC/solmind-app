// The release-candidate check: node scripts/checkReleaseCandidate.mjs
//
// Paul's rule (decision queue 2026-11-03 18:32:04 and 18:33:15 CST): a Test
// version that is a candidate for UAT or production has no blue build notes
// and no violet removal markers, and is not promoted until this check passes.
// It fails, naming each place, while any marker (scripts/releaseCandidateScan.mjs)
// is present in the app source under src/ (tests left out; the mockup routes
// and files are scanned too, because they ship with every build) or in the
// built pages of every route (.next/server and .next/static, from
// `next build`). It also fails when there is no build, or
// when the build is older than the source, because then the built pages were
// not checked. It passes only when none remain. It reads files only; it
// changes nothing, starts nothing and uses no network. Run it after the
// release candidate's own `next build`. Not part of package.json (adding a
// script there needs Paul's approval, AGENTS.md rule 7).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isScannedBuilt, isScannedSource, scanFiles } from "./releaseCandidateScan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every file under folder, as paths relative to the app root. Names starting
// with ".env" are never opened.
function listFiles(folder) {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".env")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  };
  if (existsSync(path.join(root, folder))) walk(path.join(root, folder));
  return found;
}

function read(paths, keep) {
  return paths.filter(keep).map((file) => ({ path: file, text: readFileSync(path.join(root, file), "utf8") }));
}

const problems = [];
const sourcePaths = listFiles("src");
const source = scanFiles(read(sourcePaths, isScannedSource), isScannedSource);

const buildId = path.join(root, ".next", "BUILD_ID");
let built = null;
if (!existsSync(buildId)) {
  problems.push("No built pages: .next/BUILD_ID is missing. Run `next build` for this release candidate first.");
} else {
  const builtAt = statSync(buildId).mtimeMs;
  const newer = sourcePaths.filter((file) => statSync(path.join(root, file)).mtimeMs > builtAt);
  if (newer.length > 0) {
    problems.push(`The build is older than ${newer.length} source file(s), for example ${newer[0]}. Run \`next build\` again.`);
  }
  const builtPaths = [...listFiles(".next/server"), ...listFiles(".next/static")];
  built = scanFiles(read(builtPaths, isScannedBuilt), isScannedBuilt);
}

const report = (title, result) => {
  console.log(`${title}: ${result.markers} marker(s) in ${new Set(result.findings.map((f) => f.place.replace(/:\d+$/, ""))).size} file(s)`);
  for (const finding of result.findings) console.log(`  ${finding.place}  ${finding.marker}${finding.count > 1 ? ` x${finding.count}` : ""}`);
};

console.log("Release-candidate check: no blue build notes or violet removal markers may remain.");
report("Source (src/)", source);
if (built !== null) report("Built pages (.next/server, .next/static)", built);
for (const problem of problems) console.log(`Problem: ${problem}`);

const passed = source.passed && built !== null && built.passed && problems.length === 0;
console.log(passed ? "PASS: none remain." : "FAIL: this is not a release candidate for UAT or production.");
process.exitCode = passed ? 0 : 1;
