// Synthetic HTTP fixtures only. The Executor runs the browser suite.
import { expect, test, type Route } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { cardState, cardStateAtWaypointLimit } from "./connectedCardFixture";

test.use({ trace: "off", screenshot: "off", video: "off" });
const DRAFT_ID = "80000000-0000-4000-8000-000000000001";
const NEXT_DRAFT_ID = "80000000-0000-4000-8000-000000000002";
const WAYPOINT_ID = "60000000-0000-4000-8000-000000000099";
const TITLE = "Make room for a calm conversation";
const REFINED_TITLE = "A calmer talk with my sister";
const TYPED_DRAFT = "Keep this unfinished thought exactly.";
const LIMIT_REASON = 'Because you already have the most Waypoints SolMind keeps, "That\'s right" is not available here. You can still choose another reply or type what you would change.';
const fulfill = (route: Route, state: ExplorerConversationState) => route.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify({
    version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
  }),
});

test("S7a a saved Waypoint draft refines after an exact answer retry, confirms into Waypoints, and withdraws with an open follow-up", async ({ page }) => {
  const base = cardState({ providerState: "available", compassSuggestionReplies: "available",
    compassItems: [], priorityId: null, attentionId: null, waypoints: [] });
  const initial = { id: DRAFT_ID, title: TITLE, destination: "Talk with my sister without rushing",
    whyItMatters: "I want us both to feel heard", arrivalSignal: "We each finish our thought",
    suggestionMessageId: base.messages.at(-1)!.id };
  let current: ExplorerConversationState = { ...base, waypointDraft: initial };
  const requests: ExplorerConversationCommand[] = [];
  const closeBytes: string[] = [];
  let sendCount = 0;
  await page.route("**/explorer/conversation/state", route => fulfill(route, current));
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    requests.push(command);
    expect(route.request().method()).toBe("POST");
    if (command.kind === "respond_waypoint_draft") {
      expect(Object.keys(command).sort()).toEqual(["draftId", "expectedRevision", "kind", "operationId", "response"]);
      expect(command.draftId).toBe(command.response === "not_it" ? NEXT_DRAFT_ID : DRAFT_ID);
      if (command.response === "close") {
        expect(command.expectedRevision).toBe(12);
        closeBytes.push(route.request().postData()!);
        current = { ...current, revision: 13 };
        if (closeBytes.length === 1) return route.abort("failed");
        expect(closeBytes).toHaveLength(2);
        expect(closeBytes[1]).toBe(closeBytes[0]);
      } else if (command.response === "right") {
        expect(command.expectedRevision).toBe(14);
        const draft = current.waypointDraft!;
        current = { ...current, revision: 15, waypointDraft: null,
          waypoints: [{ id: WAYPOINT_ID, sourceMessageId: initial.suggestionMessageId,
            title: draft.title!, destination: draft.destination!, meaning: draft.whyItMatters!,
            arrivalSignal: draft.arrivalSignal!, status: "chosen" }] };
      } else {
        expect(command.expectedRevision).toBe(16);
        current = { ...current, revision: 17, waypointDraft: null };
      }
      return fulfill(route, { ...current, providerState: "unavailable" });
    }
    expect(command.kind).toBe("send");
    if (command.kind !== "send") throw new Error("unexpected_command");
    sendCount += 1;
    const close = sendCount === 1;
    expect(command.expectedRevision).toBe(close ? 13 : 17);
    expect(command.body).toBe(`${close ? "Close, not quite" : "That's not it"}: "${TITLE}"`);
    expect(command.operationId).not.toBe(requests.at(-2)!.operationId);
    const replyId = `30000000-0000-4000-8000-00000000009${sendCount}`;
    current = { ...current, revision: command.expectedRevision + 1,
      messages: [...current.messages,
        { id: `20000000-0000-4000-8000-00000000009${sendCount}`, role: "explorer", body: command.body, createdAt: close ? "2026-11-05T15:00:00Z" : "2026-11-05T15:02:00Z" },
        { id: replyId, role: "virtualGuide", body: close ? "Synthetic refinement after asking what to change."
          : "Synthetic open question: what matters to you now?", createdAt: close ? "2026-11-05T15:00:01Z" : "2026-11-05T15:02:01Z" }],
      waypointDraft: close ? { ...initial, title: REFINED_TITLE, suggestionMessageId: replyId } : null };
    return fulfill(route, current);
  });
  await page.goto("/explorer/conversation");
  const row = (title: string) => page.getByRole("group", { name: `Reply to Waypoint suggestion: ${title}`, exact: true });
  const transcript = page.getByRole("list", { name: "Saved conversation", exact: true });
  const composer = page.getByLabel("Continue the conversation", { exact: true });
  await expect(row(TITLE)).toBeVisible();
  for (const text of ["Forming", "Where you're heading:", initial.destination, "Why it matters:", initial.whyItMatters,
    "Reached looks like:", initial.arrivalSignal]) await expect(row(TITLE)).toContainText(text);
  await expect(transcript.getByRole("listitem").nth(3).getByRole("button")).toHaveCount(3);
  await composer.fill(TYPED_DRAFT);
  await row(TITLE).getByRole("button", { name: "Close, not quite", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  expect(sendCount).toBe(0);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect(row(REFINED_TITLE)).toBeVisible();
  await expect(row(TITLE)).toHaveCount(0);
  await expect(transcript.getByRole("listitem").nth(3).getByRole("button")).toHaveCount(0);
  await expect(transcript.getByRole("listitem").nth(5).getByRole("button")).toHaveCount(3);
  await expect(composer).toHaveValue(TYPED_DRAFT);
  await row(REFINED_TITLE).getByRole("button", { name: "That's right", exact: true }).click();
  await expect(row(REFINED_TITLE)).toHaveCount(0);
  await expect(transcript.getByRole("listitem").nth(5)).toBeFocused();
  expect(sendCount).toBe(1);
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.locator("#conversation-preview-drawer-opener").click();
  const panel = page.locator((page.viewportSize()?.width ?? 0) < 1024 ? "#conversation-preview-drawer" : "#conversation-preview-panel");
  const waypoints = panel.getByRole("region", { name: "Waypoints", exact: true });
  await expect(waypoints.getByRole("heading", { name: REFINED_TITLE, exact: true })).toBeVisible();
  await expect(waypoints).toContainText("Formed");
  await expect(waypoints).toContainText(initial.destination);
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.keyboard.press("Escape");
  const nextSuggestionId = "30000000-0000-4000-8000-000000000093";
  current = { ...current, revision: 16, messages: [...current.messages,
    { id: "20000000-0000-4000-8000-000000000093", role: "explorer", body: "Synthetic later goal", createdAt: "2026-11-05T15:01:00Z" },
    { id: nextSuggestionId, role: "virtualGuide", body: "Synthetic later Waypoint suggestion", createdAt: "2026-11-05T15:01:01Z" }],
    waypointDraft: { ...initial, id: NEXT_DRAFT_ID, suggestionMessageId: nextSuggestionId } };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(row(TITLE)).toBeVisible();
  await row(TITLE).getByRole("button", { name: "That's not it", exact: true }).click();
  await expect(row(TITLE)).toHaveCount(0);
  await expect(transcript).toContainText("Synthetic open question: what matters to you now?");
  await expect(composer).toHaveValue(TYPED_DRAFT);
  await expect(transcript).not.toContainText(TYPED_DRAFT);
  expect(requests).toHaveLength(6);
  expect(sendCount).toBe(2);
});

for (const response of ["right", "not_it"] as const) {
  test(`S7b a typed ${response} updates the forming draft and Waypoints only after Send returns saved state`, async ({ page }) => {
    const base = cardState({ providerState: "available", compassSuggestionReplies: "available",
      compassItems: [], priorityId: null, attentionId: null, waypoints: [] });
    const draft = { id: DRAFT_ID, title: TITLE, destination: "Talk with my sister without rushing",
      whyItMatters: "I want us both to feel heard", arrivalSignal: "We each finish our thought",
      suggestionMessageId: base.messages.at(-1)!.id };
    let current: ExplorerConversationState = { ...base, waypointDraft: draft };
    const typedAnswer = response === "right" ? "Yes, that exact Waypoint is what I want."
      : "No, that Waypoint is not what I want.";
    const savedReply = "Synthetic saved reply after the typed answer.";
    const requests: ExplorerConversationCommand[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/explorer/conversation/state", route => fulfill(route, current));
    await page.route("**/explorer/conversation/commands", async route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      expect(route.request().method()).toBe("POST");
      expect(Object.keys(command).sort()).toEqual(["body", "expectedRevision", "kind", "operationId"]);
      expect(command.kind).toBe("send");
      if (command.kind !== "send") throw new Error("unexpected_command");
      expect(command.expectedRevision).toBe(base.revision);
      expect(command.body).toBe(typedAnswer);
      await held;
      current = { ...current, revision: base.revision + 1, waypointDraft: null,
        waypoints: response === "right" ? [{ id: WAYPOINT_ID, sourceMessageId: draft.suggestionMessageId,
          title: draft.title, destination: draft.destination, meaning: draft.whyItMatters,
          arrivalSignal: draft.arrivalSignal, status: "chosen" }] : [],
        messages: [...base.messages,
          { id: "20000000-0000-4000-8000-000000000097", role: "explorer", body: command.body, createdAt: "2026-11-05T15:00:00Z" },
          { id: "30000000-0000-4000-8000-000000000097", role: "virtualGuide", body: savedReply, createdAt: "2026-11-05T15:00:01Z" },
        ] };
      await fulfill(route, current);
    });
    await page.goto("/explorer/conversation");
    const row = page.getByRole("group", { name: `Reply to Waypoint suggestion: ${TITLE}`, exact: true });
    const transcript = page.getByRole("list", { name: "Saved conversation", exact: true });
    const composer = page.getByLabel("Continue the conversation", { exact: true });
    await expect(row).toBeVisible();
    await composer.fill(typedAnswer);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Forming");
    await expect(transcript).not.toContainText(typedAnswer);
    await expect(transcript).not.toContainText(savedReply);
    release();
    await expect(transcript).toContainText(savedReply);
    await expect(transcript).toContainText(typedAnswer);
    await expect(row).toHaveCount(0);
    await expect(composer).toHaveValue("");
    if ((page.viewportSize()?.width ?? 0) < 1024) await page.locator("#conversation-preview-drawer-opener").click();
    const panel = page.locator((page.viewportSize()?.width ?? 0) < 1024 ? "#conversation-preview-drawer" : "#conversation-preview-panel");
    const waypoints = panel.getByRole("region", { name: "Waypoints", exact: true });
    await expect(waypoints).toBeVisible();
    if (response === "right") {
      await expect(waypoints.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
      await expect(waypoints.getByRole("article")).toHaveCount(1);
      for (const text of ["Formed", draft.destination, draft.whyItMatters, draft.arrivalSignal]) {
        await expect(waypoints).toContainText(text);
      }
    } else {
      await expect(waypoints.getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0);
      await expect(waypoints.getByRole("article")).toHaveCount(0);
    }
    expect(requests).toHaveLength(1);
    expect(requests[0].kind).toBe("send");
  });
}

for (const response of ["close", "not_it", "send"] as const) {
  test(`S7a the full stored-row limit holds confirmation and keeps ${response} available`, async ({ page }) => {
    const base = cardStateAtWaypointLimit();
    let current: ExplorerConversationState = { ...base, providerState: "available", compassSuggestionReplies: "available",
      waypointDraft: { id: DRAFT_ID, title: TITLE, destination: "Talk without rushing",
        whyItMatters: "I want to feel heard", arrivalSignal: "We each finish our thought",
        suggestionMessageId: base.messages.at(-1)!.id } };
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/state", route => fulfill(route, current));
    await page.route("**/explorer/conversation/commands", route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      expect(command.expectedRevision).toBe(current.revision);
      if (command.kind === "respond_waypoint_draft") {
        expect(command.response).toBe(response);
        expect(command.draftId).toBe(DRAFT_ID);
        current = { ...current, revision: current.revision + 1,
          waypointDraft: response === "not_it" ? null : current.waypointDraft };
        return fulfill(route, { ...current, providerState: "unavailable" });
      }
      expect(command.kind).toBe("send");
      if (command.kind !== "send") throw new Error("unexpected_command");
      expect(command.body).toBe(response === "send" ? TYPED_DRAFT
        : `${response === "close" ? "Close, not quite" : "That's not it"}: "${TITLE}"`);
      current = { ...current, revision: current.revision + 1, messages: [...current.messages,
        { id: "20000000-0000-4000-8000-000000000098", role: "explorer", body: command.body, createdAt: "2026-11-05T15:00:00Z" },
        { id: "30000000-0000-4000-8000-000000000098", role: "virtualGuide", body: "Synthetic reply at capacity.", createdAt: "2026-11-05T15:00:01Z" },
      ] };
      return fulfill(route, current);
    });
    await page.goto("/explorer/conversation");
    const row = page.getByRole("group", { name: `Reply to Waypoint suggestion: ${TITLE}`, exact: true });
    const right = row.getByRole("button", { name: "That's right", exact: true });
    const composer = page.getByLabel("Continue the conversation", { exact: true });
    await expect(right).toBeVisible();
    await expect(right).toBeDisabled();
    await expect(row.getByText(LIMIT_REASON, { exact: true })).toHaveCount(1);
    await expect(row).toHaveAccessibleDescription(LIMIT_REASON);
    for (const label of ["Close, not quite", "That's not it"]) {
      await expect(row.getByRole("button", { name: label, exact: true })).toBeEnabled();
    }
    await right.evaluate(button => (button as HTMLButtonElement).click());
    expect(requests).toHaveLength(0);
    await expect(composer).toBeEnabled();
    await composer.fill(TYPED_DRAFT);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
    if (response === "send") await page.getByRole("button", { name: "Send", exact: true }).click();
    else await row.getByRole("button", { name: response === "close" ? "Close, not quite" : "That's not it", exact: true }).click();
    await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("Synthetic reply at capacity.");
    expect(requests).toHaveLength(response === "send" ? 1 : 2);
    expect(requests.some(command => command.kind === "respond_waypoint_draft" && command.response === "right")).toBe(false);
    await expect(composer).toHaveValue(response === "send" ? "" : TYPED_DRAFT);
    await expect(composer).toBeEnabled();
  });
}
