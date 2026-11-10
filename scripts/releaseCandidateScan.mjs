// The core of the release-candidate check (scripts/checkReleaseCandidate.mjs).
//
// Paul's rule (decision queue 2026-11-03 18:32:04 and 18:33:15 CST; solmind-docs
// ai-assistant/02 "Pages under development: build notes"): blue build notes and
// violet removal markers are for Test versions still being worked on. They are
// never released, and a Test version that is a candidate for UAT or production
// has none, so this check runs on every release candidate and fails, naming
// each place, while any marker remains in the app source or in the built pages.
//
// Every build note, label, box, removal marker and the page toggle carries one
// of the fixed attributes below (src/components/solmind/
// ExplorerConversationScreenBuildNotes.tsx and the screens that use it). The
// scan looks for the attribute names as text, so a marker is found in the
// source and in the built pages alike. Pure functions only: nothing here reads
// a file, so the unit test runs it on fixture text.

// Debug code (Paul's decision, PRJ01-SPR002 decision queue, morning meeting entry of 2026-11-10, item 12) carries the
// fixed tag SOLMIND-DEBUG on every line and call site, so a release candidate fails while any of it remains.
export const RELEASE_MARKERS = Object.freeze(["data-build-note", "data-removal-marker", "SOLMIND-DEBUG"]);

// Nothing in the app is exempt (amended 2026-11-03, review REV224): the
// mockup routes and files ship with every build, and Paul's rule is never to
// release with the notes (decision queue 2026-11-03 18:32:04 CST), so they are
// scanned like every other part of the app. Only tests, which are not the
// app, are left out.

const SOURCE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|json|html|md)$/;
const BUILT_EXTENSIONS = /\.(?:html|rsc|js|mjs|cjs|json|meta|body|txt)$/;

function posix(path) {
  return path.replaceAll("\\", "/");
}

function isEnvFile(path) {
  return /(?:^|\/)\.env/.test(path);
}

// path is relative to the app root, for example "src/app/explorer/conversation/page.tsx".
export function isScannedSource(path) {
  const file = posix(path);
  if (!file.startsWith("src/") || isEnvFile(file) || !SOURCE_EXTENSIONS.test(file)) return false;
  // Tests are not the app.
  return !(/(?:^|\/)__tests__\//.test(file) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
}

// path is relative to the app root, for example ".next/static/chunks/abc.js".
// All the served output under .next/server and .next/static is scanned, every
// route included: not the build cache, traces, types or source maps.
export function isScannedBuilt(path) {
  const file = posix(path);
  if (isEnvFile(file) || !BUILT_EXTENSIONS.test(file) || file.endsWith(".nft.json")) return false;
  return file.startsWith(".next/server/") || file.startsWith(".next/static/");
}

// Each line of text that holds a marker: { place: "<name>:<line>", marker, count }.
export function findMarkers(text, name) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const marker of RELEASE_MARKERS) {
      const count = line.split(marker).length - 1;
      if (count > 0) found.push({ place: `${name}:${index + 1}`, marker, count });
    }
  });
  return found;
}

// The core scan: files is a list of { path, text } (path relative to the app
// root); keep says which paths count (isScannedSource or isScannedBuilt).
export function scanFiles(files, keep) {
  const findings = files.filter((file) => keep(file.path)).flatMap((file) => findMarkers(file.text, posix(file.path)));
  return { passed: findings.length === 0, findings, markers: findings.reduce((sum, finding) => sum + finding.count, 0) };
}
