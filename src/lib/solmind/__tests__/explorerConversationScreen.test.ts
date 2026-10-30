import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as wording from "../explorerConversationScreen";
import * as sample from "../explorerConversationScreenSample";
import { SOLMIND_TERMS } from "../terms";

const {
  CONVERSATION_FOOTER,
  LAYOUT_ONLY_CONTROLS,
  LAYOUT_ONLY_LABEL,
  NOT_YET_IMPLEMENTED,
  NOT_YET_IMPLEMENTED_PREFIX,
  PREVIEW_BAND_TEXT,
  aiDisclosure,
  notYetImplementedNotes,
} = wording;
const { SAMPLE_COMPASS, SAMPLE_GUIDE_NAME, SAMPLE_HEADER, SAMPLE_TURNS, SAMPLE_WAYPOINT } = sample;
// The fixed notes plus the five naming the Guide, resolved with the sample Guide name.
const ALL_NOTES = Object.values(notYetImplementedNotes(SAMPLE_GUIDE_NAME));

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");

function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, found));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, found));
  }
  return found;
}

const allStrings = [
  ...collectStrings({ ...wording }),
  ...collectStrings({ ...sample }),
  aiDisclosure(SAMPLE_HEADER.virtualGuideName),
  ...ALL_NOTES,
];

describe("interim conversation screen wording", () => {
  it("CS01 every placeholder sentence starts with the agreed prefix and says something after it", () => {
    const values = ALL_NOTES;
    expect(values.length).toBeGreaterThanOrEqual(45);
    for (const value of values) {
      expect(value.startsWith(`${NOT_YET_IMPLEMENTED_PREFIX} `), value).toBe(true);
      expect(value.slice(NOT_YET_IMPLEMENTED_PREFIX.length).trim().length, value).toBeGreaterThan(20);
      expect(value.endsWith("."), value).toBe(true);
    }
    expect(NOT_YET_IMPLEMENTED_PREFIX).toBe("Not yet implemented:");
  });

  it("CS02 placeholder sentences are unique", () => {
    const values = ALL_NOTES;
    expect(new Set(values).size).toBe(values.length);
  });

  it("CS03 no banned or superseded wording appears in any wording or sample value", () => {
    const banned: RegExp[] = [
      /\bclients?\b/i,
      /Not connected yet/,
      /Not implemented yet/,
      /\bCaptured\b/,
      /\bPaused\b/,
      /\bIn progress\b/,
      /\bprototype\b/i,
      /cannot be unshared/i,
      /saved privately/i,
      /\bVG\b/,
    ];
    for (const text of allStrings) {
      for (const pattern of banned) {
        expect(pattern.test(text), `${pattern} in: ${text}`).toBe(false);
      }
    }
  });

  it("CS04 fixed disclosures match the plan and the approved live footer", () => {
    expect(PREVIEW_BAND_TEXT).toBe(
      "Interim design review. Nothing here is connected: no AI, no Guide, and nothing is saved or shared. Messages are written samples. Each 'Not yet implemented' note says what that part will do.",
    );
    // The disclosure takes the Virtual Guide name passed in the header props.
    expect(SAMPLE_HEADER.virtualGuideName).toBe("Mary");
    expect(aiDisclosure(SAMPLE_HEADER.virtualGuideName)).toBe(
      "Mary is an AI companion, not your Guide, a therapist or a crisis service.",
    );
    expect(aiDisclosure("Nivan")).toBe("Nivan is an AI companion, not your Guide, a therapist or a crisis service.");
    expect(CONVERSATION_FOOTER).toBe(
      `The ${SOLMIND_TERMS.virtualGuide} supports reflection. It is not a therapist or crisis service.`,
    );
    const liveSource = readFileSync(path.join(appRoot, "src", "components", "solmind", "ExplorerConversation.tsx"), "utf8");
    expect(liveSource).toContain(
      "The {SOLMIND_TERMS.virtualGuide} supports reflection. It is not a therapist or crisis service.",
    );
  });

  it("CS05 layout-only controls are listed once each and share one tag", () => {
    expect(LAYOUT_ONLY_LABEL).toBe("Layout only: works in this preview");
    const keys = LAYOUT_ONLY_CONTROLS.map((control) => control.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      "skipLink",
      "conversationSpaces",
      "panelToggle",
      "drawerOpen",
      "drawerClose",
      "compassView",
      "quoteList",
      "escape",
      "speakerStyle",
    ]);
  });

  it("CS06 the sample Compass keeps the fixed Priority-up frame, one point per zone", () => {
    const { points, priorityId, attentionId } = SAMPLE_COMPASS;
    expect(points.map((point) => point.zone).sort()).toEqual(["detourLeft", "detourRight", "excursion", "priority"]);
    const priority = points.find((point) => point.id === priorityId);
    expect(priority?.category).toBe("Priority");
    expect(priority?.zone).toBe("priority");
    for (const point of points) {
      expect(point.category === "Detour", point.id).toBe(point.zone === "detourLeft" || point.zone === "detourRight");
    }
    expect(points.some((point) => point.id === attentionId && point.id !== priorityId)).toBe(true);
    expect(points.filter((point) => point.forming).length).toBe(1);
    expect(SAMPLE_COMPASS.otherPathsCount).toBe(1);
  });

  it("CS07 the sample Waypoint uses a sample status word (recommended, pending Paul) and quotes exact Explorer words", () => {
    expect(["Forming", "Formed", "Reached", "Released"]).toContain(SAMPLE_WAYPOINT.status);
    const explorerText = SAMPLE_TURNS.filter((turn) => turn.speaker === "explorer").map((turn) => turn.body);
    for (const quote of [...SAMPLE_WAYPOINT.quotes, ...SAMPLE_WAYPOINT.replacedQuotes]) {
      expect(explorerText.some((body) => body.includes(quote)), quote).toBe(true);
    }
  });

  it("CS09 review fixes: message field, navigation, review and Priority wording", () => {
    expect(NOT_YET_IMPLEMENTED.message).toBe(
      "Not yet implemented: You will be able to type your message here, and nothing is saved until you press Send.",
    );
    expect(NOT_YET_IMPLEMENTED.finishReview).toContain(
      "Reviewing does not stop existing live sharing or change your sharing choices.",
    );
    expect(NOT_YET_IMPLEMENTED.finishReview).not.toContain("Nothing is shared");
    expect(NOT_YET_IMPLEMENTED.makePriority).toBe(
      "Not yet implemented: Proposed direct Priority control, pending design approval. Priority changes only when you confirm.",
    );
    expect(NOT_YET_IMPLEMENTED.newConversation).toContain("without choosing a Waypoint first");
    expect(NOT_YET_IMPLEMENTED.virtualGuideSpace).not.toContain("new conversation");
    expect(NOT_YET_IMPLEMENTED.virtualGuideSpace).toContain("open the space for your conversations");
  });

  it("CS08 the last Virtual Guide turn asks rather than claims a capture", () => {
    const last = SAMPLE_TURNS[SAMPLE_TURNS.length - 1];
    expect(last.speaker).toBe("virtualGuide");
    expect(last.extra).toBe("check");
    expect(last.body.includes("?")).toBe(true);
    expect(/I've captured|I captured/i.test(last.body)).toBe(false);
  });
});
