// Synthetic HTTP responses prove browser behavior only. The Executor runs this suite.
// These tests prove no SQL persistence, provider calls or genuine Virtual Guide replies.
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationCommand,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const FOLLOW_UP_EXPLORER = "20000000-0000-4000-8000-000000000002";
const FOLLOW_UP_GUIDE = "30000000-0000-4000-8000-000000000002";
const POINT = "40000000-0000-4000-8000-000000000001";
const OTHER_POINT = "40000000-0000-4000-8000-000000000002";
const LAST_POINT = "40000000-0000-4000-8000-000000000003";
const LABEL = "Making time to rest";
const REFINED_LABEL = "Rest without pressure";
const DRAFT = "Keep this unfinished typed thought exactly.";
const REPLIES = { right: "That's right", close: "Close, not quite", not_it: "That's not it" } as const;
type Reply = keyof typeof REPLIES;
type SuggestionCommand = Extract<ExplorerConversationCommand, { kind: "respond_compass_suggestion" }>;

function savedState(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 5,
    pendingTurn: false,
    turnedDownLimitReached: false, waypointDraft: null,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: "A synthetic question", createdAt: "2026-11-04T18:00:00.000Z" },
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic suggestion reply", createdAt: "2026-11-04T18:00:01.000Z" },
    ],
    compassItems: [{ id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE,
      label: LABEL, formation: "forming" }],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    route: [],
    sessionStatus: "active",
    ending: null,
    ...overrides,
  };
}

const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});
const failure = (error: "refresh_required" | "provider_unavailable") => ({
  version: "explorer-private-conversation-response.v1", result: { ok: false, state: null, error }, assistance: null,
});
const fulfill = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const transcript = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const row = (page: Page, label = LABEL) => page.getByRole("group", { name: `Reply to Compass suggestion: ${label}`, exact: true });

async function openPage(page: Page, read: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => {
    expect(route.request().method()).toBe("GET");
    return fulfill(route, success(read()));
  });
  await page.goto("/explorer/conversation");
  await expect(row(page)).toBeVisible();
}

async function compass(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    return page.locator("#conversation-preview-panel").getByRole("region", { name: "Compass", exact: true });
  }
  await page.locator("#conversation-preview-drawer-opener").click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint", exact: true });
  await expect(drawer).toBeVisible();
  return drawer.getByRole("region", { name: "Compass", exact: true });
}

function checkReply(command: ExplorerConversationCommand, response: Reply, pointId = POINT): asserts command is SuggestionCommand {
  expect(command.kind).toBe("respond_compass_suggestion");
  if (command.kind !== "respond_compass_suggestion") throw new Error("unexpected_command");
  expect(Object.keys(command).sort()).toEqual(["expectedRevision", "itemId", "kind", "operationId", "response"]);
  expect(command.itemId).toBe(pointId);
  expect(command.response).toBe(response);
  expect(command.expectedRevision).toBe(5);
  expect(command.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
}

function afterReply(current: ExplorerConversationState, response: Reply): ExplorerConversationState {
  return { ...current, revision: 6,
    compassItems: response === "not_it" ? [] : current.compassItems.map(point => {
      if (response !== "right") return point;
      const confirmed = { ...point, formation: "saved" as const };
      delete confirmed.wordingMessageId;
      return confirmed;
    }),
  };
}

function afterSend(current: ExplorerConversationState, response: Exclude<Reply, "right">): ExplorerConversationState {
  return {
    ...current, revision: 7,
    messages: [...current.messages,
      { id: FOLLOW_UP_EXPLORER, role: "explorer", body: `${REPLIES[response]}: "${LABEL}"`, createdAt: "2026-11-04T18:01:00.000Z" },
      { id: FOLLOW_UP_GUIDE, role: "virtualGuide", body: response === "close" ? "Synthetic follow-up: what would you change?"
        : "Synthetic follow-up: what matters to you now?", createdAt: "2026-11-04T18:01:01.000Z" },
    ],
    compassItems: response === "close" ? current.compassItems.map(point =>
      ({ ...point, label: REFINED_LABEL, wordingMessageId: FOLLOW_UP_GUIDE })) : [],
  };
}

test("S6a the turned-down limit disables only That's not it and explains the row while typing stays available", async ({ page }) => {
  const current = savedState({ turnedDownLimitReached: true });
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(route.request().postDataJSON() as ExplorerConversationCommand);
    return fulfill(route, success(current));
  });
  await openPage(page, () => current);
  const suggestion = row(page);
  const reason = 'Because this conversation already keeps the most turned-down suggestions it can, "That\'s not it" is not available here. You can still choose another reply or type what you would change.';
  await expect(suggestion.getByRole("button")).toHaveCount(3);
  const turnedDown = suggestion.getByRole("button", { name: "That's not it", exact: true });
  await expect(turnedDown).toBeVisible();
  await expect(turnedDown).toBeDisabled();
  await expect(suggestion.getByRole("button", { name: "That's right", exact: true })).toBeEnabled();
  await expect(suggestion.getByRole("button", { name: "Close, not quite", exact: true })).toBeEnabled();
  await expect(suggestion.getByText(reason, { exact: true })).toHaveCount(1);
  await expect(suggestion.getByText(reason, { exact: true })).toBeVisible();
  await expect(suggestion).toHaveAccessibleDescription(reason);
  await expect(composer(page)).toBeEnabled();
  await composer(page).fill(DRAFT);
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(0);
});

for (const response of ["right", "close", "not_it"] as const) {
  test(`S6a ${response} uses the closed reply command, updates the card and preserves the typed draft`, async ({ page }) => {
    let current = savedState();
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      expect(route.request().method()).toBe("POST");
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      if (requests.length === 1) {
        checkReply(command, response);
        current = afterReply(current, response);
        // Formation results do not check provider readiness; retain the last read's availability.
        return fulfill(route, success({ ...current, providerState: "unavailable" }));
      }
      expect(response).not.toBe("right");
      expect(requests).toHaveLength(2);
      expect(command.kind).toBe("send");
      if (command.kind !== "send" || response === "right") throw new Error("unexpected_follow_up");
      expect(Object.keys(command).sort()).toEqual(["body", "expectedRevision", "kind", "operationId"]);
      expect(command.body).toBe(`${REPLIES[response]}: "${LABEL}"`);
      expect(command.expectedRevision).toBe(6);
      expect(command.operationId).not.toBe(requests[0].operationId);
      current = afterSend(current, response);
      return fulfill(route, success(current));
    });
    await openPage(page, () => current);
    await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
    await expect(transcript(page).getByRole("listitem").nth(0).getByRole("button")).toHaveCount(0);
    await expect(transcript(page).getByRole("listitem").nth(1).getByRole("button")).toHaveCount(3);
    await composer(page).fill(DRAFT);
    await row(page).getByRole("button", { name: REPLIES[response], exact: true }).click();
    await expect.poll(() => requests.length).toBe(response === "right" ? 1 : 2);
    await expect(composer(page)).toHaveValue(DRAFT);
    await expect(row(page)).toHaveCount(0);
    await expect(transcript(page).getByRole("listitem").nth(1)).toBeFocused();
    await expect(transcript(page)).not.toContainText(DRAFT);
    if (response === "right") {
      await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
      const card = await compass(page);
      await expect(card).toContainText(LABEL);
      await expect(card.getByRole("button", { name: new RegExp(`^${LABEL}`) })).not.toHaveAccessibleName(/Forming/);
    } else {
      await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
      await expect(transcript(page).getByRole("listitem").nth(2)).toContainText(`${REPLIES[response]}: "${LABEL}"`);
      await expect(transcript(page).getByRole("listitem").nth(1).getByRole("button")).toHaveCount(0);
      if (response === "close") {
        await expect(row(page, REFINED_LABEL)).toBeVisible();
        await expect(transcript(page).getByRole("listitem").nth(3).getByRole("button")).toHaveCount(3);
        await expect(await compass(page)).toContainText("Forming");
      } else {
        await expect(page.getByRole("group", { name: /^Reply to Compass suggestion:/ })).toHaveCount(0);
        await expect(await compass(page)).not.toContainText(LABEL);
      }
    }
  });
}

for (const response of ["close", "not_it"] as const) {
  test(`S6a ${response} names the selected point's current wording among several suggestions`, async ({ page }) => {
    let current = savedState({ revision: 4, compassItems: [
      { id: POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE, label: "Work pressure", formation: "forming" },
      { id: OTHER_POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE, label: LABEL, formation: "forming" },
      { id: LAST_POINT, sourceMessageId: GUIDE_MESSAGE, wordingMessageId: GUIDE_MESSAGE, label: "Family", formation: "forming" },
    ] });
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      if (requests.length === 1) {
        checkReply(command, response, OTHER_POINT);
        current = { ...current, revision: 6,
          compassItems: response === "not_it" ? current.compassItems.filter(point => point.id !== OTHER_POINT) : current.compassItems,
        };
        return fulfill(route, success({ ...current, providerState: "unavailable" }));
      }
      expect(requests).toHaveLength(2);
      expect(command.kind).toBe("send");
      if (command.kind !== "send") throw new Error("unexpected_follow_up");
      expect(Object.keys(command).sort()).toEqual(["body", "expectedRevision", "kind", "operationId"]);
      expect(command.body).toBe(`${REPLIES[response]}: "${REFINED_LABEL}"`);
      expect(command.expectedRevision).toBe(6);
      expect(command.operationId).not.toBe(requests[0].operationId);
      current = { ...current, revision: 7, messages: [...current.messages,
        { id: "20000000-0000-4000-8000-000000000003", role: "explorer", body: command.body,
          createdAt: "2026-11-04T18:02:00.000Z" },
        { id: "30000000-0000-4000-8000-000000000003", role: "virtualGuide", body: "Synthetic selected-point follow-up",
          createdAt: "2026-11-04T18:02:01.000Z" },
      ] };
      return fulfill(route, success(current));
    });
    await openPage(page, () => current);
    await expect(page.getByRole("group", { name: /^Reply to Compass suggestion:/ })).toHaveCount(3);
    await composer(page).fill(DRAFT);
    current = { ...current, revision: 5,
      compassItems: current.compassItems.map(point => point.id === OTHER_POINT
        ? { ...point, label: REFINED_LABEL, wordingMessageId: FOLLOW_UP_GUIDE } : point),
      messages: [...current.messages,
        { id: FOLLOW_UP_EXPLORER, role: "explorer", body: "Synthetic clarification", createdAt: "2026-11-04T18:01:00.000Z" },
        { id: FOLLOW_UP_GUIDE, role: "virtualGuide", body: "Synthetic refined wording", createdAt: "2026-11-04T18:01:01.000Z" },
      ],
    };
    await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
    await expect(row(page, REFINED_LABEL)).toBeVisible();
    await expect(row(page)).toHaveCount(0);
    await expect(transcript(page).getByRole("listitem").nth(1).getByRole("button")).toHaveCount(6);
    await expect(transcript(page).getByRole("listitem").nth(3).getByRole("button")).toHaveCount(3);
    await row(page, REFINED_LABEL).getByRole("button", { name: REPLIES[response], exact: true }).click();
    await expect(transcript(page)).toContainText("Synthetic selected-point follow-up");
    await expect(transcript(page).getByRole("listitem").nth(4)).toContainText(`${REPLIES[response]}: "${REFINED_LABEL}"`);
    await expect(composer(page)).toHaveValue(DRAFT);
    await expect(row(page, "Work pressure")).toBeVisible();
    await expect(row(page, "Family")).toBeVisible();
    await expect(row(page, REFINED_LABEL)).toHaveCount(response === "close" ? 1 : 0);
    expect(requests).toHaveLength(2);
  });
}

for (const response of ["close", "not_it"] as const) {
  for (const uncertainStage of ["reply", "send"] as const) {
    test(`S6a ${response} retries the uncertain ${uncertainStage} with identical bytes and no duplicate other stage`, async ({ page }) => {
      let current = savedState();
      const bodies: string[] = [];
      let replies = 0;
      let sends = 0;
      await page.route("**/explorer/conversation/commands", route => {
        const body = route.request().postData() ?? "";
        bodies.push(body);
        const command = JSON.parse(body) as ExplorerConversationCommand;
        if (command.kind === "respond_compass_suggestion") {
          replies += 1;
          checkReply(command, response);
          if (uncertainStage === "reply" && replies === 1) return route.abort("failed");
          current = afterReply(current, response);
          return fulfill(route, success({ ...current, providerState: "unavailable" }));
        }
        expect(command.kind).toBe("send");
        if (command.kind !== "send") throw new Error("unexpected_command");
        sends += 1;
        expect(command.body).toBe(`${REPLIES[response]}: "${LABEL}"`);
        expect(command.expectedRevision).toBe(6);
        if (uncertainStage === "send" && sends === 1) return route.abort("failed");
        current = afterSend(current, response);
        return fulfill(route, success(current));
      });
      await openPage(page, () => current);
      await composer(page).fill(DRAFT);
      await row(page).getByRole("button", { name: REPLIES[response], exact: true }).click();
      const retry = page.getByRole("button", { name: "Retry the same request", exact: true });
      await expect(retry).toBeVisible();
      await expect(composer(page)).toHaveValue(DRAFT);
      await expect(composer(page)).toBeDisabled();
      expect(sends).toBe(uncertainStage === "reply" ? 0 : 1);
      await expect(transcript(page)).not.toContainText("Synthetic follow-up:");
      await retry.click();
      await expect(transcript(page)).toContainText("Synthetic follow-up:");
      await expect(composer(page)).toHaveValue(DRAFT);
      await expect(composer(page)).toBeEnabled();
      expect(bodies).toHaveLength(3);
      const index = uncertainStage === "reply" ? 0 : 1;
      expect(bodies[index + 1]).toBe(bodies[index]);
      expect(replies).toBe(uncertainStage === "reply" ? 2 : 1);
      expect(sends).toBe(uncertainStage === "send" ? 2 : 1);
      expect((JSON.parse(bodies[0]) as ExplorerConversationCommand).operationId)
        .not.toBe((JSON.parse(bodies[2]) as ExplorerConversationCommand).operationId);
    });
  }
}

test("S6a a stale reply requires reload and makes no follow-up Send or optimistic confirmation", async ({ page }) => {
  const current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    checkReply(command, "close");
    return fulfill(route, failure("refresh_required"), 409);
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await row(page).getByRole("button", { name: "Close, not quite", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Your conversation has changed");
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(row(page)).toBeVisible();
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  expect(requests).toHaveLength(1);
});

for (const response of ["right", "close", "not_it"] as const) {
  test(`S6a a definite ${response} refusal allows reload without an automatic retry or follow-up Send`, async ({ page }) => {
    const current = savedState();
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      checkReply(command, response);
      // SQL and composition tests prove the 24-rejection cap and forming-point
      // refusals reach this definite result; rejected rows stay server-only.
      return fulfill(route, failure("refresh_required"), 409);
    });
    await openPage(page, () => current);
    await composer(page).fill(DRAFT);
    await row(page).getByRole("button", { name: REPLIES[response], exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Your conversation has changed. Reload the saved conversation before making another change.",
    );
    await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toHaveCount(0);
    expect(requests).toHaveLength(1);
    await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
    await expect(row(page)).toBeVisible();
    await expect(composer(page)).toHaveValue(DRAFT);
    await expect(composer(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
    await expect(transcript(page)).not.toContainText(`${REPLIES[response]}: "${LABEL}"`);
    await expect(row(page).getByRole("button", { name: REPLIES[response], exact: true })).toBeEnabled();
    expect(requests).toHaveLength(1);
  });
}

test("S6a an unavailable follow-up keeps the recorded rejection, the draft and no invented reply", async ({ page }) => {
  let current = savedState();
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    if (requests.length === 1) {
      checkReply(command, "not_it");
      current = afterReply(current, "not_it");
      return fulfill(route, success({ ...current, providerState: "unavailable" }));
    }
    expect(command.kind).toBe("send");
    if (command.kind !== "send") throw new Error("unexpected_command");
    expect(command.body).toBe(`That's not it: "${LABEL}"`);
    expect(command.expectedRevision).toBe(6);
    return fulfill(route, failure("provider_unavailable"), 503);
  });
  await openPage(page, () => current);
  await composer(page).fill(DRAFT);
  await row(page).getByRole("button", { name: "That's not it", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No new message or reply has been confirmed saved");
  await expect(composer(page)).toHaveValue(DRAFT);
  await expect(row(page)).toHaveCount(0);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  expect(requests).toHaveLength(2);
});
