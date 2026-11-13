// Authored only: the Executor runs this suite. Synthetic HTTP results prove
// screen behavior, not evidence semantics, database commits or provider calls.
import { expect, test, type Page, type Route } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { compassChangeText } from "../../src/lib/solmind/explorerCompassChanges";
import { automaticId, automaticMultiChangeState, automaticState, AUTOMATIC_LABEL } from "./automaticCompassFixture";
import { expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });
const fulfill = (route: Route, state: ExplorerConversationState) => route.fulfill({ json: {
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
} });
const transcript = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const reload = (page: Page) => page.getByRole("button", { name: "Reload saved conversation", exact: true });
const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
async function card(page: Page) {
  if (!wide(page)) await page.locator("#conversation-preview-drawer-opener").click();
  return page.locator(wide(page) ? "#conversation-preview-panel" : "#conversation-preview-drawer")
    .getByRole("region", { name: "Compass", exact: true });
}
async function closeCard(page: Page) {
  if (!wide(page)) await page.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
}
async function open(page: Page, state: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => fulfill(route, state()));
  await page.goto("/explorer/conversation");
  await expect(composer(page)).toBeEnabled();
}

test("controlled first two replies leave the dial empty; the third places a point and visit lines follow their own replies", async ({ page }) => {
  let current = automaticState();
  let sends = 0;
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    expect(command.kind).toBe("send");
    expect(command.expectedRevision).toBe(current.revision);
    current = automaticState(++sends);
    return fulfill(route, current);
  });
  await open(page, () => current);
  for (let turn = 1; turn <= 5; turn += 1) {
    await composer(page).fill(`Invented message ${turn}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(turn * 2);
    const compass = await card(page);
    if (turn < 3) {
      await expect(compass).toContainText("No Compass point is saved yet.");
      await expect(compass.getByRole("img")).toHaveCount(0);
      await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(0);
    } else {
      await expect(compass.getByRole("img", { name: "Your Compass", exact: true })).toBeVisible();
      await expect(compass.locator("button[aria-pressed]")).toHaveCount(turn - 2);
      await expect(compass).not.toContainText(/Priority|Forming|Other paths|Not yet arranged/);
      await expect(compass.locator('[id$="-connected-needle-current"]')).toHaveText(`Pointing to: ${AUTOMATIC_LABEL}`);
      await expect(compass.locator('[id$="-connected-needle-current"]')).toHaveClass(/text-xs.*font-normal.*text-stone-400/);
    }
    await closeCard(page);
    if (turn >= 3) {
      const bundles = current.compassChanges!;
      await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(turn - 2);
      for (const [index, bundle] of bundles.entries()) {
        const item = transcript(page).getByRole("listitem").nth(5 + index * 2);
        await expect(item.locator("[data-compass-change]")).toHaveText(compassChangeText(bundle.changes[0]));
        await expect(item.locator("[data-compass-change] p")).toHaveClass(/mt-2.*text-xs leading-5 text-stone-400/);
        await expect(item.locator("[data-compass-change]")).toHaveAttribute("aria-live", "off");
        const bubble = await item.locator("article").boundingBox();
        const line = await item.locator("[data-compass-change]").boundingBox();
        expect(bubble).not.toBeNull(); expect(line).not.toBeNull();
        expect(Math.abs(bubble!.x - line!.x)).toBeLessThan(1);
      }
      const announcement = page.locator("[data-compass-change-announcement]");
      await expect(announcement).toHaveCount(1);
      await expect(announcement).toHaveAttribute("aria-live", "polite");
      await expect(announcement).toHaveText(compassChangeText(bundles.at(-1)!.changes[0]));
      await expect(announcement).not.toContainText("The needle now points");
    }
  }
  await expect(page.getByRole("group", { name: /^Reply to Compass suggestion:/ })).toHaveCount(0);
  await expect(page.locator('#nyi-composer-latestChange')).toHaveCount(0);
  await reload(page).click();
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await page.reload();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(10);
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(0);
  await expect(page.locator("[data-compass-change-announcement]")).toBeEmpty();
  const saved = await card(page);
  await expect(saved.locator("button[aria-pressed]")).toHaveCount(3);
  await closeCard(page);
  await page.goto("about:blank");
  await page.goto("/explorer/conversation");
  await expect(transcript(page).getByRole("listitem")).toHaveCount(10);
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(0);
  expect(sends).toBe(5);
});

for (const key of ["Enter", "Space"]) {
  test(`each reply shows two Compass explanations and ${key} reveals its remaining change without another announcement or request`, async ({ page }) => {
    let turns = 2;
    let current = automaticMultiChangeState(turns);
    const commands: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      commands.push(command);
      expect(command.kind).toBe("send");
      expect(command.expectedRevision).toBe(current.revision);
      current = automaticMultiChangeState(++turns);
      return fulfill(route, current);
    });
    await open(page, () => current);
    const requests: string[] = [];
    page.on("request", request => {
      if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url());
    });
    const announcement = page.locator("[data-compass-change-announcement]");
    await expect(announcement).toBeEmpty();
    await announcement.evaluate(node => {
      const compassAnnouncementMutations: string[] = [];
      Object.assign(window, { compassAnnouncementMutations });
      new MutationObserver(() => { compassAnnouncementMutations.push(node.textContent ?? ""); })
        .observe(node, { childList: true, characterData: true, subtree: true });
    });
    const announcementMutations = () => page.evaluate(() =>
      (window as Window & { compassAnnouncementMutations?: string[] }).compassAnnouncementMutations);

    await composer(page).fill("Invented message 3");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
    const firstTexts = current.compassChanges![0].changes.map(compassChangeText);
    const first = transcript(page).getByRole("listitem").nth(5).locator("[data-compass-change]");
    await expect(first).toHaveCount(1);
    await expect(first).toHaveAttribute("aria-live", "off");
    await expect(first.locator("p:visible")).toHaveText(firstTexts.slice(0, 2));
    await expect(first.locator("p")).toHaveText(firstTexts);
    const showAll = first.getByRole("button", { name: "Show all Compass changes", exact: true });
    await expect(showAll).toHaveAttribute("aria-expanded", "false");
    const remainderId = await showAll.getAttribute("aria-controls");
    expect(remainderId).toBeTruthy();
    const remainder = first.locator(`[id="${remainderId}"]`);
    await expect(remainder).toBeHidden();
    await expect(remainder.locator("p")).toHaveText(firstTexts.slice(2));
    await expect(announcement).toHaveText(firstTexts.join(" "));
    expect(await announcementMutations()).toEqual([firstTexts.join(" ")]);

    const requestsBeforeReveal = [...requests];
    await showAll.focus();
    await page.keyboard.press(key);
    await expect(showAll).toBeFocused();
    await expect(showAll).toHaveAttribute("aria-expanded", "true");
    await expect(remainder).toBeVisible();
    await expect(first.locator("p:visible")).toHaveText(firstTexts);
    const wrapped = await remainder.locator("p").evaluate(node => {
      const element = node as HTMLElement;
      const style = getComputedStyle(element);
      return { height: element.getBoundingClientRect().height, lineHeight: Number.parseFloat(style.lineHeight),
        scrollWidth: element.scrollWidth, width: element.clientWidth,
        scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
        whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, textOverflow: style.textOverflow };
    });
    expect(wrapped.height).toBeGreaterThan(wrapped.lineHeight + 1);
    expect(wrapped.scrollWidth).toBeLessThanOrEqual(wrapped.width + 1);
    expect(wrapped.scrollHeight).toBeLessThanOrEqual(wrapped.clientHeight + 1);
    expect(wrapped.whiteSpace).not.toBe("nowrap");
    expect(wrapped.overflowWrap).toBe("anywhere");
    expect(wrapped.textOverflow).not.toBe("ellipsis");
    await expect(announcement).toHaveText(firstTexts.join(" "));
    expect(await announcementMutations()).toEqual([firstTexts.join(" ")]);
    expect(requests).toEqual(requestsBeforeReveal);
    expect(commands).toHaveLength(1);

    // The disclosure stays open for this visit, including repeated activation
    // and a read of the same saved state; neither action reannounces old text.
    await page.keyboard.press(key);
    await expect(showAll).toBeFocused();
    await expect(showAll).toHaveAttribute("aria-expanded", "true");
    expect(requests).toEqual(requestsBeforeReveal);
    const sameStateRead = page.waitForResponse("**/explorer/conversation/state");
    await reload(page).click();
    await sameStateRead;
    await expect(composer(page)).toBeEnabled();
    await expect(showAll).toHaveAttribute("aria-expanded", "true");
    await expect(first.locator("p:visible")).toHaveText(firstTexts);
    expect(await announcementMutations()).toEqual([firstTexts.join(" ")]);
    expect(commands).toHaveLength(1);

    await composer(page).fill("Invented message 4");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(8);
    const secondTexts = current.compassChanges![1].changes.map(compassChangeText);
    const second = transcript(page).getByRole("listitem").nth(7).locator("[data-compass-change]");
    await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(2);
    await expect(first.locator("p:visible")).toHaveText(firstTexts);
    await expect(showAll).toHaveAttribute("aria-expanded", "true");
    await expect(second.locator("p:visible")).toHaveText(secondTexts.slice(0, 2));
    const secondShowAll = second.getByRole("button", { name: "Show all Compass changes", exact: true });
    await expect(secondShowAll).toHaveAttribute("aria-expanded", "false");
    expect(await secondShowAll.getAttribute("aria-controls")).not.toBe(remainderId);
    await expect(announcement).toHaveText(secondTexts.join(" "));
    await expect(announcement).not.toContainText(firstTexts[0]);
    expect(await announcementMutations()).toEqual([firstTexts.join(" "), secondTexts.join(" ")]);
    expect(commands).toHaveLength(2);
    await expectNoSidewaysScroll(page);
    await expectNoSeriousAxeViolations(page);
  });
}

test("an uncertain third Send retries identical bytes with one modeled counted Send and one point", async ({ page }) => {
  let current = automaticState(2);
  const requests: string[] = [];
  const operations = new Set<string>();
  await page.route("**/explorer/conversation/commands", route => {
    const bytes = route.request().postData()!;
    const command = JSON.parse(bytes) as ExplorerConversationCommand;
    requests.push(bytes);
    expect(command.kind).toBe("send");
    if (!operations.has(command.operationId)) {
      operations.add(command.operationId);
      current = automaticState(3);
    }
    if (requests.length === 1) return route.abort("failed");
    return fulfill(route, current);
  });
  await open(page, () => current);
  await composer(page).fill("Invented message 3");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(1);
  expect(requests).toHaveLength(2); expect(requests[1]).toBe(requests[0]); expect(operations.size).toBe(1);
  await reload(page).click();
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(1);
  const compass = await card(page);
  await expect(compass.locator("button[aria-pressed]")).toHaveCount(1);
});

test("full, compact and narrow views retain keyboard needle selection, full labels and focus", async ({ page }) => {
  let current = automaticState(4);
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    expect(command.kind).toBe("set_attention");
    if (command.kind !== "set_attention") throw new Error("unexpected_command");
    expect(command.expectedRevision).toBe(current.revision);
    current = { ...current, revision: current.revision + 1, attentionId: command.itemId };
    return fulfill(route, { ...current, providerState: "unavailable" });
  });
  await open(page, () => current);
  const compass = await card(page);
  await expect(compass.getByRole("img")).toHaveAccessibleDescription(new RegExp(`^Top position: ${AUTOMATIC_LABEL}`));
  const second = compass.getByRole("button", { name: "Ordinary topic 2 Upper left", exact: true });
  await second.focus();
  await page.keyboard.press("Enter");
  const line = compass.locator('[id$="-connected-needle-current"]');
  await expect(line).toBeFocused();
  await expect(line).toHaveText("Pointing to: Ordinary topic 2");
  await compass.getByRole("button", { name: "Compact view of the Compass", exact: true }).click();
  await expect(compass.getByRole("img")).toHaveCount(0);
  await compass.getByRole("button", { name: `${AUTOMATIC_LABEL} Top position`, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(line).toBeFocused();
  await expect(line).toHaveText(`Pointing to: ${AUTOMATIC_LABEL}`);
  await expect(compass).not.toContainText(/Priority|Forming|Other paths|Not yet arranged/);
  await expectNoSidewaysScroll(page);
  await closeCard(page);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  expect(requests.map(command => command.kind)).toEqual(["set_attention", "set_attention"]);
});

test("saved points with no needle target hide the supplemental line in both Compass views", async ({ page }) => {
  const current = { ...automaticState(4), attentionId: null };
  const requests: string[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postData()!);
    return route.abort();
  });
  await open(page, () => current);
  const compass = await card(page);
  await expect(compass.getByRole("img", { name: "Your Compass", exact: true })).toBeVisible();
  await expect(compass.locator("button[aria-pressed]")).toHaveCount(2);
  await expect(compass.locator('[id$="-connected-needle-current"]')).toHaveCount(0);
  await expect(compass).not.toContainText(/Pointing to:|No point chosen yet|Priority/);
  await compass.getByRole("button", { name: "Compact view of the Compass", exact: true }).click();
  await expect(compass.getByRole("img")).toHaveCount(0);
  await expect(compass.locator("button[aria-pressed]")).toHaveCount(2);
  await expect(compass.locator('[id$="-connected-needle-current"]')).toHaveCount(0);
  await expect(compass).not.toContainText(/Pointing to:|No point chosen yet|Priority/);
  await expectNoSidewaysScroll(page);
  await closeCard(page);
  expect(requests).toEqual([]);
});

test("Waypoint draft buttons still own one reply group and one confirmed follow-up Send, keeping the typed draft", async ({ page }) => {
  const initial = automaticState(3);
  let current: ExplorerConversationState = { ...initial,
    messages: initial.messages.map((message, index) => index === 5 ? { ...message, choices: [{ label: "An ordinary choice" }] } : message),
    waypointDraft: { id: automaticId(900), title: "Take a quiet walk", destination: "A short walk",
      whyItMatters: "Room to think", arrivalSignal: "One walk completed", suggestionMessageId: initial.messages[5].id } };
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    if (command.kind === "respond_waypoint_draft") {
      expect(command).toMatchObject({ response: "close", draftId: automaticId(900), expectedRevision: 6 });
      current = { ...current, revision: 7 };
      return fulfill(route, { ...current, providerState: "unavailable" });
    }
    expect(command).toMatchObject({ kind: "send", body: 'Close, not quite: "Take a quiet walk"', expectedRevision: 7 });
    expect(command.operationId).not.toBe(requests[0].operationId);
    const later = automaticState(4);
    current = { ...later, waypointDraft: null, messages: later.messages.map((message, index) =>
      index === 6 ? { ...message, body: 'Close, not quite: "Take a quiet walk"' } : message) };
    return fulfill(route, current);
  });
  await open(page, () => current);
  const item = transcript(page).getByRole("listitem").nth(5);
  await expect(item.getByRole("group")).toHaveCount(1);
  await expect(item.getByRole("button")).toHaveText(["That's right", "Close, not quite", "That's not it"]);
  await expect(item.getByRole("group", { name: "Suggested replies", exact: true })).toHaveCount(0);
  await composer(page).fill("An unfinished invented thought.");
  await item.getByRole("button", { name: "Close, not quite", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(8);
  await expect(transcript(page).getByRole("listitem").nth(6)).toContainText('Close, not quite: "Take a quiet walk"');
  await expect(composer(page)).toHaveValue("An unfinished invented thought.");
  await expect(transcript(page).locator("[data-compass-change]")).toHaveCount(1);
  expect(requests.map(command => command.kind)).toEqual(["respond_waypoint_draft", "send"]);
});
