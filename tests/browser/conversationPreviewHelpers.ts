// Shared helpers for the interim conversation screen and speaker label browser
// tests. Not a test file itself (no .pw.ts suffix).
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { SPEAKER_LABEL_STYLE } from "../../src/lib/solmind/explorerSpeakerStyle";

export { SPEAKER_LABEL_STYLE };

export const ROUTE = "/explorer/conversation-preview";
export const SEPTEMBER_ROUTE = "/explorer/compass-comparison";
export const CAPTURES = path.resolve(__dirname, "..", "..", "captures");
export const UNWIRED = '[data-preview-control="unwired"]';
export const MIND_ORANGE = "rgb(245, 118, 2)";
export const SKY_BLUE = "rgb(139, 198, 238)";

export type Guard = { blocked: string[]; errors: string[]; origin: string };

export async function guardPage(page: Page, baseURL: string | undefined, route = ROUTE): Promise<Guard> {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const blocked: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", (request) => {
    const url = new URL(request.request().url());
    const allowed = url.origin === origin && (
      url.pathname === route || url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/solmind-dark-logo.png" || url.pathname === "/favicon.ico");
    if (allowed) return request.continue();
    blocked.push(`${request.request().method()} ${url.href}`);
    return request.abort();
  });
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1, name: "Today's Reflection Journey" })).toBeVisible();
  return { blocked, errors, origin };
}

export async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(({ id, help, nodes }) => ({ id, help, targets: nodes.map((node) => node.target) }));
  expect(serious).toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
}

// Every visible unwired control is aria-disabled and described by a visible note.
export async function checkAndUseUnwiredControls(page: Page, scope: string) {
  const controls = page.locator(`${scope} ${UNWIRED}`);
  const count = await controls.count();
  let used = 0;
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    await expect(control).toHaveAttribute("aria-disabled", "true");
    const describedBy = (await control.getAttribute("aria-describedby")) ?? "";
    expect(describedBy).not.toBe("");
    for (const id of describedBy.split(" ")) {
      const note = page.locator(`[id="${id}"]`);
      await expect(note).toBeVisible();
      await expect(note).toContainText("Not yet implemented:");
    }
    await control.focus();
    await page.keyboard.press("Enter");
    await control.click({ force: true });
    used += 1;
  }
  return used;
}

export async function expectNothingKept(page: Page, guard: Guard, route = ROUTE) {
  const storage = await page.evaluate(async () => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
    databases: (await window.indexedDB.databases()).length,
    url: window.location.pathname + window.location.search + window.location.hash,
  }));
  expect(storage).toEqual({ local: 0, session: 0, databases: 0, url: route });
  expect(await page.context().cookies()).toEqual([]);
  expect(guard.blocked).toEqual([]);
  expect(guard.errors).toEqual([]);
}

// Tab reaches each visible unwired control, so each note is announced in turn.
export async function expectTabReachesControls(page: Page) {
  const expected = await page.evaluate((selector) => {
    let next = 0;
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.offsetParent !== null || element.getClientRects().length > 0) element.dataset.tabProbe = String(next++);
    }
    return next;
  }, UNWIRED);
  const reached = new Set<string>();
  for (let step = 0; step < 400 && reached.size < expected; step += 1) {
    await page.keyboard.press("Tab");
    const probe = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.tabProbe ?? null);
    if (probe !== null) reached.add(probe);
  }
  expect(reached.size).toBe(expected);
}

// Speaker labels: in the new style each label and its small drawn icon share the speaker's colour.
export async function readSpeakers(page: Page) {
  return page.evaluate(() => {
    const icons = [...document.querySelectorAll<Element>("[data-speaker-icon]")]
      .filter((icon) => icon.getClientRects().length > 0)
      .map((icon) => {
        const style = getComputedStyle(icon);
        const box = icon.getBoundingClientRect();
        return {
          speaker: icon.getAttribute("data-speaker-icon") ?? "",
          tag: icon.tagName.toLowerCase(),
          colour: style.color,
          image: style.backgroundImage,
          width: box.width,
          height: box.height,
        };
      });
    const labels = [...document.querySelectorAll<HTMLElement>("article p[id$='-speaker']")].map((label) => ({
      text: label.textContent ?? "",
      colour: getComputedStyle(label).color,
    }));
    return { icons, labels };
  });
}

export async function expectLogoSpeakers(page: Page) {
  const { icons, labels } = await readSpeakers(page);
  expect(icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of icons) {
    expect(icon.tag, icon.speaker).toBe("svg");
    expect(icon.image, icon.speaker).toBe("none");
    expect(icon.colour, icon.speaker).toBe(icon.speaker === "explorer" ? SKY_BLUE : MIND_ORANGE);
    expect(icon.width, icon.speaker).toBeGreaterThanOrEqual(24);
    expect(icon.height, icon.speaker).toBe(icon.width);
  }
  expect([...new Set(icons.map((icon) => icon.speaker))].sort()).toEqual(["explorer", "virtualGuide"]);
  expect(labels.length).toBeGreaterThanOrEqual(2);
  for (const label of labels) {
    expect(label.colour, label.text).toBe(label.text.endsWith("You") ? SKY_BLUE : MIND_ORANGE);
  }
}

export async function expectOriginalSpeakers(page: Page) {
  const { icons, labels } = await readSpeakers(page);
  expect(icons).toEqual([]);
  expect(labels.length).toBeGreaterThanOrEqual(2);
  for (const label of labels) expect([MIND_ORANGE, SKY_BLUE], label.text).not.toContain(label.colour);
}

// On load both screens follow SPEAKER_LABEL_STYLE, so setting it to "original"
// (the documented revert) keeps these checks valid.
export async function expectSpeakersFollowConstant(page: Page) {
  if (SPEAKER_LABEL_STYLE === "logo") await expectLogoSpeakers(page);
  else await expectOriginalSpeakers(page);
}

// No choice label, badge or lane overlaps another, and nothing overflows its button.
export async function expectChoicesDoNotOverlap(page: Page) {
  const result = await page.evaluate(() => {
    const issues: string[] = [];
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const inside = (inner: DOMRect, outer: DOMRect) =>
      inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
    const group = document.querySelector('[aria-label="Suggested starting topics"]');
    if (!group) return { issues: ["no group"], columns: 0, laneWidth: 0 };
    const lanes = [...group.querySelectorAll("[data-choice-lane]")].map((lane) => lane.getBoundingClientRect());
    if (lanes.length !== 2 || overlaps(lanes[0], lanes[1])) issues.push("lanes overlap");
    for (const button of group.querySelectorAll<HTMLElement>("[data-choice-lane] button")) {
      const box = button.getBoundingClientRect();
      const lane = button.closest("[data-choice-lane]")?.getBoundingClientRect();
      if (lane && !inside(box, lane)) issues.push(`button outside lane: ${button.textContent}`);
      if (button.scrollWidth > button.clientWidth + 1) issues.push(`button overflows: ${button.textContent}`);
      const label = button.querySelector<HTMLElement>("[data-choice-label]");
      const badge = button.querySelector<HTMLElement>("[data-choice-badge]");
      if (!label) continue;
      const labelBox = label.getBoundingClientRect();
      if (!inside(labelBox, box) || label.scrollWidth > label.clientWidth + 1) issues.push(`label overflows: ${label.textContent}`);
      if (badge) {
        const badgeBox = badge.getBoundingClientRect();
        if (!inside(badgeBox, box)) issues.push(`badge outside: ${badge.textContent}`);
        if (overlaps(labelBox, badgeBox)) issues.push(`label and badge overlap: ${label.textContent}`);
      }
    }
    return { issues, columns: Math.abs(lanes[0].top - lanes[1].top) < 1 ? 2 : 1, laneWidth: Math.round(lanes[0].width) };
  });
  expect(result.issues).toEqual([]);
  return result;
}

// With 1px tolerance: whether the focused box meets the composer bar, is inside
// the screen and, inside the transcript, is inside the transcript's visible area.
export type FocusStop = {
  probe: number; label: string; pinned: boolean; top: number; bottom: number;
  overlap: boolean; inViewport: boolean; inTranscriptView: boolean;
};
export type FocusWalk = { stops: FocusStop[]; composer: string[]; composerOff: string[] };

// One Tab or Shift+Tab walk through the conversation section, until focus
// leaves it. The composer bar's own controls are listed separately.
async function walkConversation(page: Page, key: "Tab" | "Shift+Tab", lastProbe: number, onLast?: () => Promise<void>) {
  const walk: FocusWalk = { stops: [], composer: [], composerOff: [] };
  let entered = false;
  for (let step = 0; step < 200; step += 1) {
    await page.keyboard.press(key);
    const stop = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const section = document.querySelector('section[aria-labelledby="conversation-preview-heading"]')!;
      const sticky = document.getElementById("conversation-preview-composer")!.closest<HTMLElement>("[data-composer-bar]")!;
      const log = document.querySelector<HTMLElement>('[role="log"][aria-label="Conversation transcript"]')!;
      if (!active || !section.contains(active)) return null;
      const label = ((active.getAttribute("aria-label") ?? active.textContent ?? "").trim() || active.tagName).slice(0, 40);
      const a = active.getBoundingClientRect();
      // Fully on screen, except a box taller than the screen and the text box (Chrome scrolls
      // only to its caret line): those keep the WCAG 2.4.11 floor of being at least partly visible.
      const onScreen = a.height > window.innerHeight || active.tagName === "TEXTAREA"
        ? a.bottom > 1 && a.top < window.innerHeight - 1 : a.top >= -1 && a.bottom <= window.innerHeight + 1;
      if (sticky.contains(active)) return { composer: label, off: !onScreen };
      const s = sticky.getBoundingClientRect();
      const viewTop = log.getBoundingClientRect().top + log.clientTop;
      const viewBottom = viewTop + log.clientHeight;
      const inLog = active !== log && log.contains(active);
      return {
        probe: Number(active.dataset.composerProbe ?? -1),
        label,
        pinned: Math.abs(s.bottom - window.innerHeight) < 1,
        overlap: a.left < s.right - 1 && s.left < a.right - 1 && a.top < s.bottom - 1 && s.top < a.bottom - 1,
        inViewport: onScreen,
        inTranscriptView: !inLog || (a.top >= viewTop - 1 && a.bottom <= viewBottom + 1),
        top: Math.round(a.top * 10) / 10,
        bottom: Math.round(a.bottom * 10) / 10,
      };
    });
    if (stop === null) {
      if (entered) break;
      continue;
    }
    entered = true;
    if (stop.composer !== undefined) {
      walk.composer.push(stop.composer);
      if (stop.off) walk.composerOff.push(stop.composer);
      continue;
    }
    walk.stops.push(stop);
    if (onLast && stop.probe === lastProbe) await onLast();
  }
  return walk;
}

// From the top of the page, Tab through every control in the conversation
// section, then Shift+Tab back through it from the control after it,
// measuring each focused control. onLast runs, on the forward walk, on the
// last control before the composer bar.
export async function tabThroughConversationControls(page: Page, onLast?: () => Promise<void>) {
  const setup = await page.evaluate(() => {
    const section = document.querySelector('section[aria-labelledby="conversation-preview-heading"]')!;
    const sticky = document.getElementById("conversation-preview-composer")!.closest<HTMLElement>("[data-composer-bar]")!;
    const log = document.querySelector<HTMLElement>('[role="log"][aria-label="Conversation transcript"]')!;
    let next = 0;
    let before = 0;
    for (const element of section.querySelectorAll<HTMLElement>("button, textarea, input, select, summary, a[href], [tabindex]")) {
      if (sticky.contains(element) || element.tabIndex < 0 || element.getClientRects().length === 0) continue;
      if (element.compareDocumentPosition(sticky) & Node.DOCUMENT_POSITION_FOLLOWING) before += 1;
      element.dataset.composerProbe = String(next++);
    }
    return {
      count: next, before, position: getComputedStyle(sticky).position, scrollY: window.scrollY,
      stickyHeight: sticky.getBoundingClientRect().height, transcriptHeight: log.getBoundingClientRect().height,
      scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
    };
  });
  const forward = await walkConversation(page, "Tab", setup.before - 1, onLast);
  const reverse = await walkConversation(page, "Shift+Tab", -1);
  return { ...setup, forward, reverse };
}

// Every focus stop that meets the composer bar, leaves the screen or is cut by
// the transcript's own scroll box, described for the failure message.
export function focusProblems(size: string, direction: string, walk: FocusWalk) {
  return [...walk.stops.flatMap((stop) => [
    ...(stop.overlap ? ["meets the composer bar"] : []),
    ...(stop.inViewport ? [] : ["is outside the screen"]),
    ...(stop.inTranscriptView ? [] : ["is cut by the transcript box"]),
  ].map((problem) => `${size} ${direction} ${stop.label} ${problem} (box ${stop.top}..${stop.bottom})`)),
  ...walk.composerOff.map((label) => `${size} ${direction} composer ${label} is outside the screen`)];
}

export function capture(name: string) {
  mkdirSync(CAPTURES, { recursive: true });
  return path.join(CAPTURES, `review-${name}.png`);
}

export async function captureFullPage(page: Page, name: string, scroll: "top" | "bottom") {
  await page.evaluate((where) => window.scrollTo(0, where === "top" ? 0 : document.documentElement.scrollHeight), scroll);
  await page.screenshot({ fullPage: true, path: capture(name) });
  await page.evaluate(() => window.scrollTo(0, 0));
}
