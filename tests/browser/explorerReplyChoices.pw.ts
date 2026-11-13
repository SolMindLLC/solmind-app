// Synthetic HTTP responses prove browser behavior only. The Executor runs this suite.
// These tests prove no SQL persistence, provider calls or genuine Virtual Guide replies.
// Round r2: local calm prompts use synthetic fixtures and never call a provider.
import { expect, test, type Page, type Route } from "@playwright/test";
import { cardState } from "./connectedCardFixture";
import { CALM_REPLY_PROMPTS } from "../../src/lib/solmind/explorerReplyChoices";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationCommand,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const CHOSEN_EXPLORER = "20000000-0000-4000-8000-000000000002";
const NEXT_GUIDE = "30000000-0000-4000-8000-000000000002";
const CHOICES = ["Show me around", "I have a question", "Let's begin"];
const DRAFT = "Keep this unfinished typed thought exactly.";

test("REV306 Show me around opens a fixed keyboard tour with no request or chat line", async ({ page }) => {
  const current = savedState();
  const requests: string[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postData()!);
    return route.abort();
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  const opener = choices(page).getByRole("button", { name: "Show me around", exact: true });
  const dialog = page.getByRole("dialog", { name: "A look around your conversation", exact: true });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole("heading", { name: "A look around your conversation", exact: true });
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-describedby", "conversation-tour-step");
  await expect(dialog.getByRole("status")).toHaveCount(1);
  await expect(dialog.getByRole("status")).toHaveAttribute("aria-live", "polite");
  await expect(dialog.getByRole("status")).toBeEmpty();
  await expect(dialog.locator("#conversation-tour-step")).toContainText("saved messages");
  await expect(dialog.locator("#conversation-tour-step")).not.toContainText("A Compass point");
  const next = dialog.getByRole("button", { name: "Next step", exact: true });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(next).toBeFocused();
  await expect(dialog.getByRole("heading", { name: "How the Compass works", exact: true })).toBeVisible();
  const compassParagraphs = [
    "A Compass point names something that may matter to you, so you can keep it in view while the conversation moves.",
    "Points appear by themselves: when a topic has clearly come up a few times, your Virtual Guide adds it to the Compass.",
    "When a reply changes your Compass, quiet text below that reply explains the change and stays for this visit.",
    "The order can change as your Virtual Guide learns what matters most to you. An early topic can also start at the top without being what matters most.",
    "If a point does not fit, tell your Virtual Guide what needs changing so it can correct the Compass. If your meaning is unclear, it asks.",
    "To turn the conversation to another point, choose it on the dial or in Compact view when the point controls are available.",
  ];
  await expect(dialog.locator("#conversation-tour-step > ul > li")).toHaveText(compassParagraphs);
  await expect(dialog.getByRole("status")).toHaveText(["How the Compass works", ...compassParagraphs].join(" "));
  await expect(dialog.locator("#conversation-tour-step")).not.toContainText('Choose "That\'s right" to confirm');
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "Back to the conversation", exact: true })).toBeFocused();
  await expect(dialog.getByRole("heading", { name: "How Waypoints work", exact: true })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText('Choose "That\'s right" to confirm the Waypoint');
  await dialog.getByRole("button", { name: "How Waypoints work", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "How Waypoints work", exact: true })).toBeFocused();
  await expect(dialog.getByRole("status")).toContainText("why it matters");
  await dialog.getByRole("button", { name: "How the conversation works", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "How the conversation works", exact: true })).toBeFocused();
  await expect(dialog.getByRole("status")).toContainText("saved messages");
  // Native modal keyboard focus stays within the tour in both directions.
  await dialog.getByRole("button", { name: "Back to the conversation", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "How the conversation works", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Back to the conversation", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(current.messages.length);
  expect(requests).toHaveLength(0);

  for (const fromTheLastStep of [false, true]) {
    await opener.click();
    if (fromTheLastStep) await dialog.getByRole("button", { name: "How Waypoints work", exact: true }).click();
    await dialog.getByRole("button", { name: "Back to the conversation", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(current.messages.length);
  expect(requests).toHaveLength(0);
});

function savedState(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 3,
    pendingTurn: false,
    turnedDownLimitReached: false,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: "A synthetic first message", createdAt: "2026-11-05T08:00:00.000Z" },
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic reply with choices", createdAt: "2026-11-05T08:00:01.000Z",
        choices: CHOICES.map(label => ({ label })) },
    ],
    compassItems: [],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    waypointDraft: null,
    route: [],
    sessionStatus: "active",
    ending: null,
    ...overrides,
  };
}

const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});
const fulfill = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const transcript = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const choices = (page: Page) => page.getByRole("group", { name: "Suggested replies", exact: true });

async function openPage(page: Page, read: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => {
    expect(route.request().method()).toBe("GET");
    return fulfill(route, success(read()));
  });
  await page.goto("/explorer/conversation");
  await expect(transcript(page)).toBeVisible();
}

test("R01 a tapped choice sends exactly its label with the choice marker, keeps the typed draft and ends the offer", async ({ page }) => {
  let current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    expect(route.request().method()).toBe("POST");
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    expect(command.kind).toBe("send");
    if (command.kind !== "send") throw new Error("unexpected_command");
    expect(Object.keys(command).sort()).toEqual(["body", "expectedRevision", "kind", "operationId", "replyChoice"]);
    expect(command.replyChoice).toBe(true);
    expect(command.body).toBe("I have a question");
    expect(command.expectedRevision).toBe(3);
    expect(command.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    current = { ...current, revision: 4, messages: [...current.messages,
      { id: CHOSEN_EXPLORER, role: "explorer", body: command.body, createdAt: "2026-11-05T08:01:00.000Z" },
      { id: NEXT_GUIDE, role: "virtualGuide", body: "Synthetic answer: what would you like to know?",
        createdAt: "2026-11-05T08:01:01.000Z" },
    ] };
    return fulfill(route, success(current));
  });
  await openPage(page, () => current);
  await expect(choices(page)).toHaveCount(1);
  await expect(transcript(page).getByRole("listitem").nth(1).getByRole("group", { name: "Suggested replies" })).toBeVisible();
  await expect(choices(page).getByRole("button")).toHaveText([...CHOICES, "Something else"]);
  await composer(page).fill(DRAFT);
  await choices(page).getByRole("button", { name: "I have a question", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(transcript(page).getByRole("listitem").nth(2)).toContainText("I have a question");
  await expect(choices(page)).toHaveCount(0);
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(transcript(page).getByRole("listitem").nth(1)).toBeFocused();
  await expect(page.locator("[data-reply-choices] [data-build-note]")).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test("R02 an ordinary typed Send also ends the offer", async ({ page }) => {
  let current = savedState();
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    if (command.kind !== "send") throw new Error("unexpected_command");
    expect(command.body).toBe("Something else on my mind");
    expect(Object.hasOwn(command, "replyChoice")).toBe(false);
    current = { ...current, revision: 4, messages: [...current.messages,
      { id: CHOSEN_EXPLORER, role: "explorer", body: command.body, createdAt: "2026-11-05T08:01:00.000Z" },
      { id: NEXT_GUIDE, role: "virtualGuide", body: "Synthetic answer", createdAt: "2026-11-05T08:01:01.000Z" },
    ] };
    return fulfill(route, success(current));
  });
  await openPage(page, () => current);
  await expect(choices(page)).toHaveCount(1);
  await composer(page).fill("Something else on my mind");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(choices(page)).toHaveCount(0);
});

test("R03 an unavailable Virtual Guide gates Send choices but keeps the local tour available", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/explorer/conversation/commands", route => { requests.push(route.request().method()); return route.abort(); });
  await openPage(page, () => savedState({ providerState: "unavailable" }));
  await expect(choices(page).getByRole("button")).toHaveCount(4);
  await expect(choices(page).getByRole("button", { name: "Something else", exact: true })).toBeDisabled();
  for (const label of CHOICES.slice(1)) await expect(choices(page).getByRole("button", { name: label, exact: true })).toBeDisabled();
  const opener = choices(page).getByRole("button", { name: "Show me around", exact: true });
  await expect(opener).toBeEnabled();
  await opener.click();
  await expect(page.getByRole("dialog", { name: "A look around your conversation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to the conversation", exact: true }).click();
  await expect(opener).toBeFocused();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  expect(requests).toEqual([]);
});

test("REV306b the shown tour remains available during End review without changing the draft or sending", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/explorer/conversation/commands", route => { requests.push(route.request().method()); return route.abort(); });
  await openPage(page, () => savedState());
  await composer(page).fill(DRAFT);
  await page.getByRole("button", { name: "End this conversation", exact: true }).click();
  await expect(page.getByRole("group", { name: "Review End Session", exact: true })).toBeVisible();
  for (const label of CHOICES.slice(1)) await expect(choices(page).getByRole("button", { name: label, exact: true })).toBeDisabled();
  const opener = choices(page).getByRole("button", { name: "Show me around", exact: true });
  await expect(opener).toBeEnabled();
  await opener.click();
  await expect(page.getByRole("dialog", { name: "A look around your conversation", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(page.getByRole("group", { name: "Review End Session", exact: true })).toBeVisible();
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  expect(requests).toEqual([]);
});

test("R04 a restricted or adults-only conversation shows no choices", async ({ page }) => {
  let availability: ExplorerConversationState["compassSuggestionReplies"] = "support";
  await openPage(page, () => savedState({ compassSuggestionReplies: availability }));
  await expect(choices(page)).toHaveCount(0);
  availability = "adult_policy";
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  await expect(choices(page)).toHaveCount(0);
});

test("R05 Something else uses the existing card fixture, preserves a draft and offers local accessible prompts until Send", async ({ page }) => {
  let current = cardState({ providerState: "available", compassSuggestionReplies: "available" });
  current = { ...current, messages: current.messages.map((message, index) =>
    index === current.messages.length - 1 ? { ...message, choices: CHOICES.map(label => ({ label })) } : message) };
  const requests: ExplorerConversationCommand[] = [];
  const pending: { route: Route | null } = { route: null };
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postDataJSON() as ExplorerConversationCommand);
    pending.route = route;
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  const descriptionBefore = (await composer(page).getAttribute("aria-describedby"))?.split(" ") ?? [];
  const requestsAfterLoad: string[] = [];
  page.on("request", request => {
    if (["fetch", "xhr"].includes(request.resourceType())) requestsAfterLoad.push(request.url());
  });
  const other = choices(page).getByRole("button", { name: "Something else", exact: true });
  await other.focus();
  await other.press("Enter");
  const prompt = page.locator("#conversation-calm-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveAttribute("role", "status");
  const first = await prompt.textContent();
  expect(CALM_REPLY_PROMPTS).toContain(first);
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveValue(DRAFT);
  const describedBy = (await composer(page).getAttribute("aria-describedby"))?.split(" ") ?? [];
  expect(describedBy).toContain("conversation-calm-prompt");
  for (const id of descriptionBefore) expect(describedBy).toContain(id);
  await expect(composer(page)).toHaveAccessibleDescription(new RegExp(first!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  expect(await prompt.evaluate(node => (node.compareDocumentPosition(document.querySelector("textarea")!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true);
  await expect(transcript(page)).not.toContainText(first!);
  await other.click();
  await expect(prompt).not.toHaveText(first!);
  expect(CALM_REPLY_PROMPTS).toContain(await prompt.textContent());
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(choices(page).getByRole("button")).toHaveText([...CHOICES, "Something else"]);
  expect(requests).toEqual([]);
  expect(requestsAfterLoad).toEqual([]);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ kind: "send", body: DRAFT, expectedRevision: 12 });
  expect(Object.hasOwn(requests[0], "replyChoice")).toBe(false);
  await expect(prompt).toHaveCount(0);
  await expect(choices(page)).toHaveCount(0);
  expect((await composer(page).getAttribute("aria-describedby")) ?? "").not.toContain("conversation-calm-prompt");
  current = { ...current, revision: 13, messages: [...current.messages,
    { id: "20000000-0000-4000-8000-000000000099", role: "explorer", body: DRAFT, createdAt: "2026-11-05T08:01:00.000Z" },
    { id: "30000000-0000-4000-8000-000000000099", role: "virtualGuide", body: "A synthetic saved reply after typed Send", createdAt: "2026-11-05T08:01:01.000Z" },
  ] };
  await fulfill(pending.route!, success(current));
  await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
  await expect(composer(page)).toHaveValue("");
  expect(requests).toHaveLength(1);
});

test("R06 a new saved reply clears the prompt, and its next prompt remembers the last line in this conversation", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  let current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postDataJSON() as ExplorerConversationCommand);
    return route.abort();
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await choices(page).getByRole("button", { name: "Something else", exact: true }).click();
  const prompt = page.locator("#conversation-calm-prompt");
  await expect(prompt).toBeVisible();
  const previous = await prompt.textContent();
  expect(CALM_REPLY_PROMPTS).toContain(previous);
  current = { ...current, revision: 4, messages: [...current.messages,
    { id: NEXT_GUIDE, role: "virtualGuide", body: "A newly loaded synthetic reply", createdAt: "2026-11-05T08:01:01.000Z",
      choices: CHOICES.map(label => ({ label })) },
  ] };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(3);
  await expect(prompt).toHaveCount(0);
  expect((await composer(page).getAttribute("aria-describedby")) ?? "").not.toContain("conversation-calm-prompt");
  await expect(composer(page)).toHaveValue(DRAFT);
  await choices(page).getByRole("button", { name: "Something else", exact: true }).click();
  await expect(prompt).toBeVisible();
  await expect(prompt).not.toHaveText(previous!);
  expect(CALM_REPLY_PROMPTS).toContain(await prompt.textContent());
  await expect(composer(page)).toBeFocused();
  expect(requests).toEqual([]);
});

test("R07 a choice clears the calm prompt immediately and makes only its one ordinary Send", async ({ page }) => {
  let current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  const pending: { route: Route | null } = { route: null };
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postDataJSON() as ExplorerConversationCommand);
    pending.route = route;
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await choices(page).getByRole("button", { name: "Something else", exact: true }).click();
  await expect(page.locator("#conversation-calm-prompt")).toBeVisible();
  await choices(page).getByRole("button", { name: "Let's begin", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ kind: "send", body: "Let's begin", replyChoice: true, expectedRevision: 3 });
  await expect(choices(page)).toHaveCount(0);
  await expect(page.locator("#conversation-calm-prompt")).toHaveCount(0);
  current = { ...current, revision: 4, messages: [...current.messages,
    { id: CHOSEN_EXPLORER, role: "explorer", body: "Let's begin", createdAt: "2026-11-05T08:01:00.000Z" },
    { id: NEXT_GUIDE, role: "virtualGuide", body: "A synthetic saved choice reply", createdAt: "2026-11-05T08:01:01.000Z" },
  ] };
  await fulfill(pending.route!, success(current));
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(composer(page)).toHaveValue(DRAFT);
  expect(requests).toHaveLength(1);
});

test("R08 Something else stays off Waypoint replies, pending turns and withheld reply availability", async ({ page }) => {
  let current = savedState({ waypointDraft: {
    id: "80000000-0000-4000-8000-000000000001", suggestionMessageId: GUIDE_MESSAGE,
    title: "Making time to rest", destination: "Take a walk", whyItMatters: "Room to think", arrivalSignal: "A walk completed",
  } });
  await openPage(page, () => current);
  const compassRow = page.getByRole("group", { name: "Reply to Waypoint suggestion: Making time to rest", exact: true });
  await expect(compassRow).toBeVisible();
  await expect(compassRow.getByRole("button", { name: "Something else", exact: true })).toHaveCount(0);
  // One group of buttons per reply (2026-11-10, item 14): the reply choices are held back beside a suggestion.
  await expect(choices(page)).toHaveCount(0);
  for (const availability of ["support", "adult_policy", "unavailable", undefined] as const) {
    current = { ...current, compassSuggestionReplies: availability };
    await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
    await expect(choices(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Something else", exact: true })).toHaveCount(0);
  }
  current = { ...current, compassSuggestionReplies: "available", pendingTurn: true };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByText(/^A saved message is still awaiting a confirmed result\./)).toBeVisible();
  await expect(choices(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Something else", exact: true })).toHaveCount(0);
});

test("R09 a Waypoint Close follow-up sends while the same reply's choices stay held back (one group per reply)", async ({ page }) => {
  let current = savedState({ waypointDraft: {
    id: "80000000-0000-4000-8000-000000000001", suggestionMessageId: GUIDE_MESSAGE,
    title: "Making time to rest", destination: "Take a walk", whyItMatters: "Room to think", arrivalSignal: "A walk completed",
  } });
  const requests: ExplorerConversationCommand[] = [];
  const pending: { route: Route | null } = { route: null };
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    if (requests.length === 1) {
      expect(command).toMatchObject({ kind: "respond_waypoint_draft", response: "close", expectedRevision: 3 });
      current = { ...current, revision: 4 };
      return fulfill(route, success({ ...current, providerState: "unavailable" }));
    }
    expect(requests).toHaveLength(2);
    expect(command).toMatchObject({ kind: "send", body: 'Close, not quite: "Making time to rest"', expectedRevision: 4 });
    expect(Object.hasOwn(command, "replyChoice")).toBe(false);
    expect(command.operationId).not.toBe(requests[0].operationId);
    pending.route = route;
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await expect(choices(page)).toHaveCount(0);
  await page.getByRole("group", { name: "Reply to Waypoint suggestion: Making time to rest", exact: true })
    .getByRole("button", { name: "Close, not quite", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#conversation-calm-prompt")).toHaveCount(0);
  await expect(choices(page)).toHaveCount(0);
  await expect(composer(page)).toHaveValue(DRAFT);
  current = { ...current, revision: 5, messages: [...current.messages,
    { id: CHOSEN_EXPLORER, role: "explorer", body: 'Close, not quite: "Making time to rest"', createdAt: "2026-11-05T08:01:00.000Z" },
    { id: NEXT_GUIDE, role: "virtualGuide", body: "A synthetic saved Waypoint follow-up", createdAt: "2026-11-05T08:01:01.000Z" },
  ] };
  await fulfill(pending.route!, success(current));
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(composer(page)).toHaveValue(DRAFT);
  expect(requests.filter(command => command.kind === "send")).toHaveLength(1);
});

test("R10 a failed reload followed by the same saved reply does not resurrect a dismissed offer", async ({ page }) => {
  const current = savedState();
  let failedRead = false;
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/state", route => failedRead
    ? fulfill(route, { version: "explorer-private-conversation-response.v1",
      result: { ok: false, state: null, error: "unavailable" }, assistance: null }, 503)
    : fulfill(route, success(current)));
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postDataJSON() as ExplorerConversationCommand);
    return fulfill(route, { version: "explorer-private-conversation-response.v1",
      result: { ok: false, state: null, error: "provider_unavailable" }, assistance: null });
  });
  await page.goto("/explorer/conversation");
  await expect(transcript(page)).toBeVisible();
  await composer(page).fill(DRAFT);
  await choices(page).getByRole("button", { name: "Something else", exact: true }).click();
  await expect(page.locator("#conversation-calm-prompt")).toBeVisible();
  await choices(page).getByRole("button", { name: "I have a question", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(choices(page)).toHaveCount(0);
  failedRead = true;
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(transcript(page)).toHaveCount(0);
  failedRead = false;
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  await expect(choices(page)).toHaveCount(0);
  await expect(page.locator("#conversation-calm-prompt")).toHaveCount(0);
  await expect(composer(page)).toHaveValue(DRAFT);
  expect(requests).toHaveLength(1);
});

test("R11 an uncertain tapped Send retries its exact flagged bytes and keeps the typed draft", async ({ page }) => {
  let current = savedState();
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    bodies.push(route.request().postData()!);
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    expect(command).toMatchObject({ kind: "send", body: "I have a question", replyChoice: true, expectedRevision: 3 });
    if (bodies.length === 1) return route.abort();
    expect(bodies[1]).toBe(bodies[0]);
    current = { ...current, revision: 4, messages: [...current.messages,
      { id: CHOSEN_EXPLORER, role: "explorer", body: "I have a question", createdAt: "2026-11-05T08:01:00.000Z" },
      { id: NEXT_GUIDE, role: "virtualGuide", body: "A synthetic reply after the exact retry", createdAt: "2026-11-05T08:01:01.000Z" },
    ] };
    return fulfill(route, success(current));
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await choices(page).getByRole("button", { name: "I have a question", exact: true }).click();
  await expect.poll(() => bodies.length).toBe(1);
  await expect(choices(page)).toHaveCount(0);
  await expect(composer(page)).toHaveValue(DRAFT);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(composer(page)).toHaveValue(DRAFT);
  expect(bodies).toHaveLength(2);
});

test("R12 typing an exact choice label still sends no tapped-choice marker", async ({ page }) => {
  let current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    expect(command).toMatchObject({ kind: "send", body: "I have a question", expectedRevision: 3 });
    expect(Object.hasOwn(command, "replyChoice")).toBe(false);
    current = { ...current, revision: 4, messages: [...current.messages,
      { id: CHOSEN_EXPLORER, role: "explorer", body: "I have a question", createdAt: "2026-11-05T08:01:00.000Z" },
      { id: NEXT_GUIDE, role: "virtualGuide", body: "A synthetic reply to typed text", createdAt: "2026-11-05T08:01:01.000Z" },
    ] };
    return fulfill(route, success(current));
  });
  await openPage(page, () => current);
  await composer(page).fill("I have a question");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  await expect(choices(page)).toHaveCount(0);
  await expect(composer(page)).toHaveValue("");
  expect(requests).toHaveLength(1);
});
