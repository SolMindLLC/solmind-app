// Shared browser-test helpers for the compact conversation header (Paul's decisions, PRJ01-SPR002 decision
// record 2026-11-16 17:53:42 and 21:27:10 CST). Mounted UI with mocked endpoints only.
import { expect, type Page, type Route } from "@playwright/test";

export const UP_TO_DATE = "Up to date at last check";
export const RELOAD_NEEDED = "Reload needed";
export const RELOAD_CHECKING = "Checking your saved conversation...";
export const CHANGE_CHECKING = "Checking your change...";
export const LOADING = "Loading your saved conversation...";
export const STATE_URL = "**/explorer/conversation/state";
export const COMMANDS_URL = "**/explorer/conversation/commands";

// The strip's one polite status region: the light's words, the busy sentence, or nothing.
export const savedStatus = (page: Page) => page.locator("#conversation-saved-status");
export const savedLight = (page: Page) => savedStatus(page).locator("[data-saved-light]");
export const reloadButton = (page: Page) => page.getByRole("button", { name: "Reload saved conversation", exact: true });
export const reloadHelpButton = (page: Page) => page.getByRole("button", { name: "About Reload saved conversation", exact: true });
export const reloadHelpLine = (page: Page) => page.locator("#conversation-reload-help");
export const privacyButton = (page: Page) => page.getByRole("button", { name: "Privacy and sharing", exact: true });
export const privacyExplanation = (page: Page) => page.locator("#conversation-privacy-explanation");

// Holds the next request to a URL until released, then hands it to the test's own route (or to the network).
// The green light is on screen before a Reload or a change starts, so "Up to date at last check" alone does
// not prove a request finished: a test holds the answer, sees the busy state, releases it, then checks the result.
export async function holdNextRequest(page: Page, url: string) {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let arrive: () => void = () => {};
  const arrived = new Promise<void>(resolve => { arrive = resolve; });
  await page.route(url, async (route: Route) => { arrive(); await gate; await route.fallback(); }, { times: 1 });
  return { arrived, release: () => release() };
}

// Chooses Reload saved conversation and proves that Reload was checked: the busy sentence and the disabled
// button (still with its full name) while the read is held, then the given settled status.
export async function reloadAndExpect(page: Page, settled: string, busySentence = RELOAD_CHECKING) {
  const held = await holdNextRequest(page, STATE_URL);
  await reloadButton(page).click();
  await held.arrived;
  await expect(savedStatus(page)).toHaveText(busySentence);
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeDisabled();
  held.release();
  await expect(savedStatus(page)).toHaveText(settled);
  await expect(reloadButton(page)).toBeEnabled();
}
