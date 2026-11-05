import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as scan from "../releaseCandidateScan.mjs";
import {
  RELEASE_MARKERS,
  findMarkers,
  isScannedBuilt,
  isScannedSource,
  scanFiles,
} from "../releaseCandidateScan.mjs";

// The release-candidate check's core scan on fixture text (Paul's rule, decision queue 2026-11-03 18:32:04 and
// 18:33:15 CST: a release candidate for UAT or production has no build notes or removal markers).

const appRoot = path.resolve(__dirname, "..", "..");

describe("release-candidate scan", () => {
  it("RC01 a file with a build note or a removal marker fails, naming each place", () => {
    const result = scanFiles(
      [
        { path: "src/components/solmind/Example.tsx", text: 'const a = 1;\n<span data-build-note="label">Not connected yet</span>\n' },
        { path: "src/components/solmind/Other.tsx", text: '<section data-removal-marker="outline">\n<div data-removal-marker="tag" />' },
      ],
      isScannedSource,
    );
    expect(result.passed).toBe(false);
    expect(result.markers).toBe(3);
    expect(result.findings).toEqual([
      { place: "src/components/solmind/Example.tsx:2", marker: "data-build-note", count: 1 },
      { place: "src/components/solmind/Other.tsx:1", marker: "data-removal-marker", count: 1 },
      { place: "src/components/solmind/Other.tsx:2", marker: "data-removal-marker", count: 1 },
    ]);
  });

  it("RC02 files without any marker pass", () => {
    const result = scanFiles(
      [
        { path: "src/components/solmind/Example.tsx", text: '<span className="text-[11px]">Settings</span>\n' },
        { path: ".next/static/chunks/page.js", text: 'children:"Your conversation",className:"font-serif"' },
      ],
      (file: string) => isScannedSource(file) || isScannedBuilt(file),
    );
    expect(result).toEqual({ passed: true, findings: [], markers: 0 });
  });

  it("RC03 counts every marker on one minified line of a built page", () => {
    const line = '"data-build-note":"label"},"x"),y("span",{"data-build-note":"box"}),z({"data-removal-marker":"tag"})';
    expect(findMarkers(line, ".next/static/chunks/a.js")).toEqual([
      { place: ".next/static/chunks/a.js:1", marker: "data-build-note", count: 2 },
      { place: ".next/static/chunks/a.js:1", marker: "data-removal-marker", count: 1 },
    ]);
    expect(RELEASE_MARKERS).toEqual(["data-build-note", "data-removal-marker"]);
  });

  it("RC04 the source scan covers the whole app under src/, the mockups included, and leaves out only tests", () => {
    for (const file of [
      "src/components/solmind/ExplorerConversationScreenBuildNotes.tsx",
      "src/components/solmind/ExplorerConversationConnectedScreen.tsx",
      "src/components/solmind/ExplorerConversationScreenNotYetImplemented.tsx",
      "src/components/solmind/WorkspaceFrame.tsx",
      "src/app/explorer/conversation/page.tsx",
      "src/app/globals.css",
      "src/lib/solmind/explorerCompassComparison.ts",
    ]) expect(isScannedSource(file), file).toBe(true);
    // The mockup routes and files ship with every build, so they are scanned too (amended 2026-11-03, review
    // REV224; Paul, decision queue 2026-11-03 18:32:04 CST: never release with the notes). Each exists, so a
    // renamed mockup does not leave this list pointing at nothing.
    for (const file of [
      "src/app/explorer/conversation-preview/page.tsx",
      "src/app/explorer/compass-comparison/page.tsx",
      "src/app/explorer/page.tsx",
      "src/app/guide/page.tsx",
      "src/app/admin/page.tsx",
      "src/app/guide/explorers/avery/waypoint-suggestions/page.tsx",
      "src/components/solmind/ExplorerConversationScreenPreview.tsx",
      "src/lib/solmind/explorerConversationScreenSample.ts",
      "src/components/solmind/ExplorerCompassComparison.tsx",
      "src/components/solmind/ExplorerCompassComparisonParts.tsx",
      "src/components/solmind/GuideSuggestedWaypointWorkspace.tsx",
      "src/lib/solmind/guideSuggestedWaypointFixtures.ts",
      "src/components/solmind/ExplorerSuggestedWaypointWorkspace.tsx",
    ]) {
      expect(existsSync(path.join(appRoot, file)), file).toBe(true);
      expect(isScannedSource(file), file).toBe(true);
    }
    for (const file of [
      "src/components/solmind/__tests__/ExplorerConversationConnectedScreen.test.tsx",
      "src/lib/solmind/virtual-guide/explorerPrivateConversationComposition.test.ts",
      "scripts/checkReleaseCandidate.mjs",
      "tests/browser/explorerConversationScreen.pw.ts",
      "src/.env.local",
      "public/solmind-dark-logo.png",
    ]) expect(isScannedSource(file), file).toBe(false);
    // A marker in a mockup fails the check like any other.
    const mockup = scanFiles(
      [{ path: "src/app/explorer/conversation-preview/page.tsx", text: '<div data-build-note="box" />' }],
      isScannedSource,
    );
    expect(mockup.passed).toBe(false);
    expect(mockup.findings).toEqual([{ place: "src/app/explorer/conversation-preview/page.tsx:1", marker: "data-build-note", count: 1 }]);
    // The scan has no exemption list.
    expect(Object.keys(scan).sort()).toEqual(["RELEASE_MARKERS", "findMarkers", "isScannedBuilt", "isScannedSource", "scanFiles"]);
  });

  it("RC05 the built scan covers all the served output, every route included, and leaves out the cache and maps", () => {
    for (const file of [
      ".next/static/chunks/0abc.js",
      ".next/server/chunks/ssr/1def.js",
      ".next/server/app/explorer/conversation.html",
      ".next/server/app/explorer/conversation.rsc",
      ".next/server/app/explorer/waypoints/page.js",
      ".next/server/app/admin/home/page.js",
      ".next/server/app/guide/home.html",
      // The mockup routes' pages ship with every build, so they are scanned too (amended 2026-11-03, REV224).
      ".next/server/app/explorer/conversation-preview.html",
      ".next/server/app/explorer/conversation-preview/page.js",
      ".next/server/app/explorer/compass-comparison.rsc",
      ".next/server/app/explorer.html",
      ".next/server/app/explorer/page.js",
      ".next/server/app/explorer/page_client-reference-manifest.js",
      ".next/server/app/guide.html",
      ".next/server/app/admin/page.js",
      ".next/server/app/guide/explorers/avery/waypoint-suggestions.html",
    ]) expect(isScannedBuilt(file), file).toBe(true);
    for (const file of [
      ".next/cache/webpack/x.js",
      ".next/trace",
      ".next/static/chunks/0abc.js.map",
      ".next/server/app/explorer/page.js.nft.json",
      "src/components/solmind/ExplorerConversationScreenBuildNotes.tsx",
    ]) expect(isScannedBuilt(file), file).toBe(false);
    // A marker in a mockup route's built page fails the check like any other.
    const built = scanFiles([{ path: ".next/server/app/explorer/conversation-preview.html", text: '<p data-removal-marker="tag"></p>' }], isScannedBuilt);
    expect(built.passed).toBe(false);
    expect(built.markers).toBe(1);
  });

  it("RC06 the check is a standalone script, not a package.json script, and the scan reads no file itself", () => {
    const packageJson = readFileSync(path.join(appRoot, "package.json"), "utf8");
    expect(packageJson).not.toContain("checkReleaseCandidate");
    const scan = readFileSync(path.join(appRoot, "scripts/releaseCandidateScan.mjs"), "utf8");
    expect(/^import\b/m.test(scan)).toBe(false);
    const check = readFileSync(path.join(appRoot, "scripts/checkReleaseCandidate.mjs"), "utf8");
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(scan) && /^[\x09\x0a\x0d\x20-\x7e]*$/.test(check)).toBe(true);
    expect(/\bfetch\s*\(|child_process|writeFile|rmSync|unlink/.test(check)).toBe(false);
  });
});
