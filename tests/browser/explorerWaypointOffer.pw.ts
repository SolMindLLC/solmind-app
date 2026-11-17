// Synthetic HTTP fixtures only: invented states and routed responses, no provider and no live database.
// The Executor runs the browser suite. Offers build, step 5: the saved offer's box in the conversation
// (mark a Waypoint Reached, change its wording, take it up again), on both browser projects.
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationCommand,
  type ExplorerConversationState,
  type ExplorerConversationWaypoint,
  type ExplorerConversationWaypointOffer,
  type ExplorerWaypointOfferOperationResult,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-0000000000d1";
const message = (role: "explorer" | "virtualGuide", index: number) =>
  `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-0000000000d${index}`;
const EXPLORER_MESSAGE = message("explorer", 1);
const REPLY = message("virtualGuide", 2);
const WAYPOINT = "60000000-0000-4000-8000-0000000000d1";
const NEXT_WAYPOINT = "60000000-0000-4000-8000-0000000000d2";
const DRAFT_WAYPOINT = "60000000-0000-4000-8000-0000000000d3";
const OFFER = "80000000-0000-4000-8000-0000000000d1";
const OTHER_OFFER = "80000000-0000-4000-8000-0000000000d2";
const DRAFT = "81000000-0000-4000-8000-0000000000d1";
const OTHER_DRAFT = "81000000-0000-4000-8000-0000000000d2";

// Invented content.
const TITLE = "Walk each morning";
const SAVED = { destination: "Walk before work", meaning: "I think more clearly after", arrivalSignal: "Five walks in one week" };
const NEW_DESTINATION = "Walk before breakfast";
const REFINED_DESTINATION = "Walk right after waking";
const EVIDENCE = "I walked five times this week";
const DRAFT_TITLE = "Rest on Sundays";
const TYPED_DRAFT = "Keep this unfinished thought exactly.";
const GUIDE_REPLY = "A synthetic saved reply after the message.";

// Paul's approved wording (the Reached sheet, the Clarify and Revisit sheet, the offers decisions of 2026-11-16).
const REACHED_HEADING = "Mark this Waypoint Reached?";
const REACHED_WHY = "To make sure Reached reflects your progress, check the arrival signal and your words below before you choose.";
const CHANGE_WHY = "To make sure the change says what you mean, compare your Waypoint as it is now with the proposed wording before you choose.";
const CHANGE_YES = 'Choosing "That\'s right" saves this as a new version and keeps the earlier wording saved in your private history. Nothing is shared.';
const REVISIT_WHY = "To make sure you are taking up the Waypoint you mean, check its wording and what happened to it before you choose.";
const REVISIT_YES = 'Choosing "That\'s right" makes this Waypoint in progress again. Its earlier Reached evidence and release history stay saved as private history; they do not show that you have reached it this time. Nothing is shared.';
const SAVED_LINE = { reached: "Saved. This Waypoint is marked Reached.", change: "Saved. This Waypoint has its new wording.",
  revisit: "Saved. This Waypoint is in progress again." } as const;
const HISTORY_LIMIT_REASON = '"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.';
const REVISIT_LIMIT_REASON = '"That\'s right" is unavailable because you have 20 active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before bringing back another. This limit does not block other replies or typing what you would change.';
const TYPED_LIMIT_PASSED = "Your typed answer did not save this offer because a Waypoint limit applied when you sent it. Nothing was changed by it. That limit no longer applies, so you can choose again here.";
const TYPED_TARGET_CHANGED = "This offer was not saved because the Waypoint changed after the offer was shown. To keep your Waypoint as you last saw it, nothing was changed by this offer.";
const QUIET_REST = "No change was made by this offer. Check the Waypoint's current wording and status before asking again.";
const CHANGED_CONVERSATION = "Your conversation has changed. Reload the saved conversation before making another change.";
const FAILED_REPLY_BUTTON_NOTE = "The reply did not come through. You can try again.";
// Compact header (Paul, 2026-11-16): the strip's green words replace the old "up to date" sentence.
const UP_TO_DATE = "Up to date at last check";
// Paul's decisions of 2026-11-16 21:52:56 CST (sheet "When an offer no longer matches its Waypoint", revision 3):
// the reason for a Waypoint that changed after the offer was shown (decision 1), the invitation shown while a message
// can be sent, and the earlier answer's status line after a Retry (decision 5).
const TARGET_CHANGED_REASON = (kind: ExplorerConversationWaypointOffer["kind"]) =>
  `This Waypoint changed after this offer was shown. To keep those changes, "${kind === "reached" ? "Yes, mark it Reached" : "That's right"}" is unavailable.`;
const TARGET_CHANGED_DISCUSS = "To discuss what you want now, write to the Virtual Guide.";
const EARLIER_CHANGE_SAVED = 'Your earlier answer to change "Walk each morning" was saved.';

type Kind = ExplorerConversationWaypointOffer["kind"];
type Answer = "right" | "close" | "not_it";
type Offer = ExplorerConversationWaypointOffer;
type Draft = NonNullable<ExplorerConversationState["waypointDraft"]>;
const LABELS = { right: "That's right", close: "Close, not quite", not_it: "That's not it" } as const;
const REACHED_LABELS = { right: "Yes, mark it Reached", not_it: "Not yet" } as const;
const label = (kind: Kind, answer: Answer) => kind === "reached" ? REACHED_LABELS[answer as "right" | "not_it"] : LABELS[answer];
const OUTCOME = { right: "confirmed", close: "kept_open", not_it: "declined" } as const;

function waypoint(stage: "formed" | "reached", overrides: Partial<ExplorerConversationWaypoint> = {}): ExplorerConversationWaypoint {
  return { id: WAYPOINT, isCurrent: true, createdAt: "2026-11-16T08:00:00.000Z", sourceMessageId: EXPLORER_MESSAGE,
    title: TITLE, ...SAVED, status: stage === "reached" ? "reached" : "chosen",
    ...(stage === "reached" ? { reachedEvidence: "An invented earlier observation.", reachedAt: "2026-11-16T08:30:00.000Z" } : {}),
    ...overrides };
}
// The Waypoint as the state shows it once an offer of each kind is confirmed.
function waypointAfter(kind: Kind, destination = NEW_DESTINATION): ExplorerConversationWaypoint {
  if (kind === "reached") return waypoint("formed", { status: "reached", reachedEvidence: EVIDENCE, reachedAt: "2026-11-16T09:10:00.000Z" });
  return waypoint("formed", { id: NEXT_WAYPOINT, createdAt: "2026-11-16T09:10:00.000Z",
    ...(kind === "change" ? { destination } : {}),
    lifecycle: { predecessorWaypointId: WAYPOINT, creationReason: kind === "change" ? "revision" : "revisit",
      clarifications: kind === "change" ? [{ component: "destination", questionKey: "waypoint.destination.offer.v1",
        answer: destination, recordedAt: "2026-11-16T09:10:00.000Z" }] : [] } });
}
function offer(kind: Kind, overrides: Record<string, unknown> = {}): Offer {
  const shared = { id: OFFER, status: "proposed", waypointId: WAYPOINT,
    targetBefore: { title: TITLE, destination: SAVED.destination, whyItMatters: SAVED.meaning,
      arrivalSignal: SAVED.arrivalSignal, stage: kind === "revisit" ? "reached" : "formed" },
    suggestionMessageId: REPLY, resultWaypointId: null, targetCurrent: true, typedAnswerEligible: true, typedAnswerRefusal: null };
  return (kind === "reached" ? { ...shared, kind, evidence: EVIDENCE, ...overrides }
    : { ...shared, kind, title: TITLE, destination: kind === "change" ? NEW_DESTINATION : SAVED.destination,
      whyItMatters: SAVED.meaning, arrivalSignal: SAVED.arrivalSignal, ...overrides }) as Offer;
}
function stored(kind: Kind, answer: Answer, overrides: Partial<ExplorerWaypointOfferOperationResult> = {}): ExplorerWaypointOfferOperationResult {
  return { offerId: OFFER, kind, waypointId: WAYPOINT, suggestionMessageId: REPLY, response: answer, typed: false, outcome: OUTCOME[answer],
    resultWaypointId: answer === "right" ? (kind === "reached" ? WAYPOINT : NEXT_WAYPOINT) : null, ...overrides };
}
function savedState(kind: Kind, overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return {
    waypointCapacity: { activeCount: kind === "revisit" ? 0 : 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 1, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 5,
    pendingTurn: false,
    turnedDownLimitReached: false,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: `A synthetic test message. ${EVIDENCE}.`, createdAt: "2026-11-16T09:00:00.000Z" },
      { id: REPLY, role: "virtualGuide", body: "A synthetic saved reply that carries an offer.", createdAt: "2026-11-16T09:00:01.000Z" },
    ],
    compassItems: [],
    priorityId: null,
    attentionId: null,
    waypoints: [waypoint(kind === "revisit" ? "reached" : "formed")],
    waypointDraft: null,
    waypointOffer: offer(kind),
    waypointOfferDrop: null,
    reachedOfferedWaypointIds: kind === "reached" ? [WAYPOINT] : [],
    route: [],
    sessionStatus: "active",
    ending: null,
    ...overrides,
  };
}
// The saved state one revision after a button answer, with nothing else changed.
function answered(state: ExplorerConversationState, kind: Kind, answer: Answer): ExplorerConversationState {
  const next = { ...state, revision: state.revision + 1 };
  if (answer === "close") return { ...next, waypointOffer: offer(kind, { ...state.waypointOffer, typedAnswerEligible: false }) };
  if (answer === "not_it") return { ...next, waypointOffer: offer(kind, { ...state.waypointOffer, status: "declined", typedAnswerEligible: false }) };
  return { ...next, waypoints: [waypointAfter(kind)],
    waypointCapacity: { ...state.waypointCapacity, activeCount: kind === "reached" ? 0 : 1 },
    waypointOffer: offer(kind, { ...state.waypointOffer, status: "confirmed", typedAnswerEligible: false,
      resultWaypointId: kind === "reached" ? WAYPOINT : NEXT_WAYPOINT }) };
}
// The saved state after an ordinary Send: the Explorer's message and one Virtual Guide reply.
function afterSend(state: ExplorerConversationState, body: string, index: number, reply: string | null = GUIDE_REPLY): ExplorerConversationState {
  return { ...state, revision: state.revision + 1, messages: [...state.messages,
    { id: message("explorer", index), role: "explorer", body, createdAt: `2026-11-16T09:2${index}:00.000Z` },
    ...(reply === null ? [] : [{ id: message("virtualGuide", index + 1), role: "virtualGuide" as const, body: reply, createdAt: `2026-11-16T09:2${index}:01.000Z` }])] };
}

const success = (state: ExplorerConversationState, result?: ExplorerWaypointOfferOperationResult, assistance: unknown = null) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance,
  ...(result === undefined ? {} : { waypointOfferResult: result }),
});
const fulfill = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
const commandOf = (route: Route) => route.request().postDataJSON() as ExplorerConversationCommand;

const box = (page: Page, kind: Kind) => page.locator(`[data-waypoint-offer="${kind}"]`);
const anyBox = (page: Page) => page.locator("[data-waypoint-offer]");
const button = (within: Locator, kind: Kind, answer: Answer) => within.getByRole("button", { name: label(kind, answer), exact: true });
const transcript = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const retry = (page: Page) => page.getByRole("button", { name: "Retry the same request", exact: true });
const reload = (page: Page) => page.getByRole("button", { name: "Reload saved conversation", exact: true });
const statusLine = (page: Page) => page.getByRole("status").first();
const draftRow = (page: Page, title: string) => page.getByRole("group", { name: `Reply to Waypoint suggestion: ${title}`, exact: true });
const narrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
async function openCard(page: Page) {
  if (narrow(page)) await page.locator("#conversation-preview-drawer-opener").click();
  return page.locator(narrow(page) ? "#conversation-preview-drawer" : "#conversation-preview-panel")
    .getByRole("region", { name: "Waypoints", exact: true });
}
async function closeCard(page: Page) {
  if (narrow(page)) await page.keyboard.press("Escape");
}
async function open(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => fulfill(route, success(current())));
  await page.goto("/explorer/conversation");
  await expect(transcript(page)).toBeVisible();
}
// No follow-up Send is in flight or was sent: the strip shows its settled green words (the status region holds
// the busy sentence while a change is checked and is blank while a Send waits), nothing is marked busy and Reload
// is enabled again. Every caller has first seen the answer's own result on screen, so the green is not the one
// from before the answer.
async function expectSettledWithoutSend(page: Page, sends: readonly unknown[]) {
  await expect(statusLine(page)).toHaveText(UP_TO_DATE);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(reload(page)).toBeEnabled();
  expect(sends).toHaveLength(0);
}

// Plan line 658: each kind confirmed by button. Plan line 668 (first result) for "That's right".
for (const kind of ["reached", "change", "revisit"] as const) {
  test(`O01 a ${kind} offer shows its approved box, saves on its yes button and shows the Saved line`, async ({ page }) => {
    let current = savedState(kind);
    const requests: ExplorerConversationCommand[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/explorer/conversation/commands", async route => {
      const command = commandOf(route);
      requests.push(command);
      expect(route.request().method()).toBe("POST");
      if (command.kind === "respond_waypoint_offer") {
        expect(Object.keys(command).sort()).toEqual(["expectedRevision", "kind", "offerId", "operationId", "response"]);
        expect(command).toMatchObject({ offerId: OFFER, response: "right", expectedRevision: 5 });
        await held;
        current = answered(current, kind, "right");
        return fulfill(route, success(current, stored(kind, "right")));
      }
      expect(kind).not.toBe("reached");
      expect(command).toMatchObject({ kind: "send", body: `That's right: "${TITLE}"`, expectedRevision: 6 });
      expect(Object.hasOwn(command, "replyChoice")).toBe(false);
      expect(command.operationId).not.toBe(requests[0].operationId);
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    const offerBox = box(page, kind);
    await expect(offerBox).toBeVisible();
    await expect(anyBox(page)).toHaveCount(1);
    // The box is inside the list item of the reply that carries the offer.
    await expect(transcript(page).getByRole("listitem").nth(1).locator("[data-waypoint-offer]")).toHaveCount(1);
    const words = kind === "reached"
      ? [REACHED_HEADING, REACHED_WHY, TITLE, "Reached looks like:", SAVED.arrivalSignal, "What showed you reached it:", `"${EVIDENCE}"`]
      : kind === "change"
        ? [TITLE, "Proposed change", CHANGE_WHY, "Where you're heading:", "Now", SAVED.destination, "Proposed", NEW_DESTINATION,
          "Why it matters:", SAVED.meaning, "No change", "Reached looks like:", SAVED.arrivalSignal, CHANGE_YES]
        : [TITLE, "Take up again", REVISIT_WHY, "Now: Reached", "Where you're heading:", SAVED.destination, "Why it matters:", SAVED.meaning,
          "Reached looks like:", SAVED.arrivalSignal, REVISIT_YES];
    for (const text of words) await expect(offerBox).toContainText(text);
    // A revisit that changes no wording shows its parts once (step 4 fix round 1).
    if (kind === "revisit") await expect(offerBox).not.toContainText("No change");
    await expect(offerBox.getByRole("button")).toHaveText(kind === "reached" ? ["Yes, mark it Reached", "Not yet"]
      : ["That's right", "Close, not quite", "That's not it"]);
    await expect(offerBox).not.toContainText("Saved.");
    await composer(page).fill(TYPED_DRAFT);

    await button(offerBox, kind, "right").click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(offerBox).toContainText("Saving...");
    for (const control of await offerBox.getByRole("button").all()) await expect(control).toBeDisabled();
    await expect(offerBox).not.toContainText("Saved.");
    release();

    await expect(offerBox).toContainText(SAVED_LINE[kind]);
    await expect(offerBox).not.toContainText("Saving...");
    await expect(offerBox.getByRole("button")).toHaveCount(0);
    for (const gone of [REACHED_WHY, CHANGE_WHY, CHANGE_YES, REVISIT_WHY, REVISIT_YES]) await expect(offerBox).not.toContainText(gone);
    if (kind === "reached") {
      // The approved Reached sheet names no message in the Explorer's name.
      await expectSettledWithoutSend(page, requests.slice(1));
      await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
    } else {
      await expect(transcript(page).getByRole("listitem").nth(2)).toContainText(`That's right: "${TITLE}"`);
      await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
      expect(requests).toHaveLength(2);
      // The Saved line stays under the carrying reply after the follow-up.
      await expect(transcript(page).getByRole("listitem").nth(1)).toContainText(SAVED_LINE[kind]);
    }
    await expect(composer(page)).toHaveValue(TYPED_DRAFT);

    // The Compass & Waypoint card follows the saved state; it has no new control.
    const waypoints = await openCard(page);
    if (kind === "reached") {
      await expect(waypoints.getByRole("button", { name: "Reached and released (1)", exact: true })).toBeVisible();
      await expect(waypoints.getByRole("heading", { name: `${TITLE} Formed`, exact: true })).toHaveCount(0);
    } else {
      await expect(waypoints.getByRole("button", { name: /^Reached and released/ })).toHaveCount(0);
      await expect(waypoints.getByRole("heading", { name: `${TITLE} Formed`, exact: true })).toBeVisible();
      await waypoints.getByRole("button", { name: `${TITLE} Formed`, exact: true }).click();
      if (kind === "change") await expect(waypoints).toContainText(NEW_DESTINATION);
      await expect(waypoints.getByRole("button", { name: "That's right", exact: true })).toHaveCount(0);
    }
    await closeCard(page);
  });
}

// Plan line 658: each kind declined.
for (const kind of ["reached", "change", "revisit"] as const) {
  test(`O02 declining a ${kind} offer removes its box and changes no Waypoint`, async ({ page }) => {
    let current = savedState(kind);
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      requests.push(command);
      if (command.kind === "respond_waypoint_offer") {
        expect(command).toMatchObject({ offerId: OFFER, response: "not_it", expectedRevision: 5 });
        current = answered(current, kind, "not_it");
        return fulfill(route, success(current, stored(kind, "not_it")));
      }
      expect(kind).not.toBe("reached");
      expect(command).toMatchObject({ kind: "send", body: `That's not it: "${TITLE}"`, expectedRevision: 6 });
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await button(box(page, kind), kind, "not_it").click();
    await expect(anyBox(page)).toHaveCount(0);
    if (kind === "reached") await expectSettledWithoutSend(page, requests.slice(1));
    else {
      await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
      expect(requests).toHaveLength(2);
    }
    await expect(page.getByText(/^Saved\. This Waypoint/)).toHaveCount(0);
    const waypoints = await openCard(page);
    if (kind === "revisit") await expect(waypoints.getByRole("button", { name: "Reached and released (1)", exact: true })).toBeVisible();
    else await expect(waypoints.getByRole("heading", { name: `${TITLE} Formed`, exact: true })).toBeVisible();
    await closeCard(page);
  });
}

// Plan line 658 ("Close, not quite" for change and revisit) and line 668 (each sends its follow-up, on a first
// result and on a Retry in an unchanged conversation; REV473b).
for (const kind of ["change", "revisit"] as const) for (const answer of ["close", "not_it"] as const) for (const mode of ["first", "retry"] as const) {
  test(`O03 ${LABELS[answer]} on a ${kind} offer sends its follow-up message (${mode} result, unchanged conversation)`, async ({ page }) => {
    let current = savedState(kind);
    const answers: string[] = [];
    const sends: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      if (command.kind === "respond_waypoint_offer") {
        expect(command).toMatchObject({ offerId: OFFER, response: answer, expectedRevision: 5 });
        answers.push(route.request().postData()!);
        // The answer is saved; in "retry" mode only its first response is lost.
        if (answers.length === 1) current = answered(current, kind, answer);
        if (mode === "retry" && answers.length === 1) return route.abort("failed");
        return fulfill(route, success(current, stored(kind, answer)));
      }
      sends.push(command);
      expect(command).toMatchObject({ kind: "send", body: `${LABELS[answer]}: "${TITLE}"`, expectedRevision: 6 });
      if (command.kind !== "send") throw new Error("unexpected_command");
      // After "Close, not quite" the Virtual Guide asks what to change and, here, offers refined wording in its reply.
      current = afterSend(current, command.body, 3);
      if (answer === "close") current = { ...current, waypointOffer: offer(kind, { destination: REFINED_DESTINATION,
        suggestionMessageId: current.messages.at(-1)!.id, typedAnswerEligible: true }) };
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await composer(page).fill(TYPED_DRAFT);
    await button(box(page, kind), kind, answer).click();
    if (mode === "retry") {
      await expect(retry(page)).toBeVisible();
      expect(sends).toHaveLength(0);
      await retry(page).click();
    }
    await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
    await expect(transcript(page).getByRole("listitem").nth(2)).toContainText(`${LABELS[answer]}: "${TITLE}"`);
    expect(sends).toHaveLength(1);
    expect(answers).toHaveLength(mode === "retry" ? 2 : 1);
    if (mode === "retry") expect(answers[1]).toBe(answers[0]);
    if (answer === "close") {
      // The refined offer shows in a new box under the new reply; the earlier reply carries none.
      await expect(anyBox(page)).toHaveCount(1);
      await expect(transcript(page).getByRole("listitem").nth(3).locator("[data-waypoint-offer]")).toContainText(REFINED_DESTINATION);
      await expect(transcript(page).getByRole("listitem").nth(1).locator("[data-waypoint-offer]")).toHaveCount(0);
    } else await expect(anyBox(page)).toHaveCount(0);
    await expect(page.getByText(/^Saved\. This Waypoint/)).toHaveCount(0);
    await expect(composer(page)).toHaveValue(TYPED_DRAFT);
  });
}

// Plan line 659: a typed yes that saved.
test("O04 a typed yes that saved shows the reply and the Saved line, with one Send and no button request", async ({ page }) => {
  let current = savedState("change");
  const requests: ExplorerConversationCommand[] = [];
  const typed = "Yes, change it to that wording.";
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    requests.push(command);
    expect(command).toMatchObject({ kind: "send", body: typed, expectedRevision: 5 });
    current = { ...afterSend(current, typed, 3), waypoints: [waypointAfter("change")],
      waypointOffer: offer("change", { status: "confirmed", typedAnswerEligible: false, resultWaypointId: NEXT_WAYPOINT }) };
    return fulfill(route, success(current));
  });
  await open(page, () => current);
  await composer(page).fill(typed);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
  const offerBox = transcript(page).getByRole("listitem").nth(1).locator('[data-waypoint-offer="change"]');
  await expect(offerBox).toContainText(SAVED_LINE.change);
  await expect(offerBox.getByRole("button")).toHaveCount(0);
  await expect(composer(page)).toHaveValue("");
  expect(requests).toHaveLength(1);
});

// Plan lines 659-660: a typed yes refused at a limit (reply shown, reason in the box, no Saved line); then the
// limit passes (the past-tense sentence, the yes button available again); then a refined offer in a later reply
// carries no refusal sentence.
test("O05 a typed yes refused at a limit shows the reply and the reason in the box, never a Saved line; a refined offer shows no refusal", async ({ page }) => {
  let current = savedState("change");
  const requests: ExplorerConversationCommand[] = [];
  const typed = "Yes, change it to that wording.";
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    requests.push(command);
    expect(command).toMatchObject({ kind: "send", body: typed, expectedRevision: 5 });
    // The message and the reply are saved; the change is not: this conversation holds 200 saved versions.
    current = { ...afterSend(current, typed, 3),
      waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: false, conversationRoom: true },
      waypointOffer: offer("change", { typedAnswerEligible: false, typedAnswerRefusal: "history_limit" }) };
    return fulfill(route, success(current));
  });
  await open(page, () => current);
  await composer(page).fill(typed);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
  await expect(transcript(page).getByRole("listitem").nth(2)).toContainText(typed);
  const offerBox = box(page, "change");
  // The offer still waits under its own reply.
  await expect(transcript(page).getByRole("listitem").nth(1).locator("[data-waypoint-offer]")).toHaveCount(1);
  await expect(offerBox.getByText(HISTORY_LIMIT_REASON, { exact: true })).toHaveCount(1);
  await expect(offerBox).toHaveAccessibleDescription(HISTORY_LIMIT_REASON);
  await expect(button(offerBox, "change", "right")).toBeDisabled();
  await expect(button(offerBox, "change", "close")).toBeEnabled();
  await expect(button(offerBox, "change", "not_it")).toBeEnabled();
  await expect(offerBox).not.toContainText("Saved.");
  await expect(offerBox).not.toContainText(TYPED_LIMIT_PASSED);
  // The message is saved: it is not asked for again.
  await expect(composer(page)).toHaveValue("");
  expect(requests).toHaveLength(1);

  // The limit no longer applies and the same presentation still waits: the past-tense sentence, yes available.
  current = { ...current, revision: current.revision + 1,
    waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true } };
  await reload(page).click();
  await expect(offerBox.getByText(TYPED_LIMIT_PASSED, { exact: true })).toHaveCount(1);
  await expect(offerBox.getByText(HISTORY_LIMIT_REASON, { exact: true })).toHaveCount(0);
  await expect(button(offerBox, "change", "right")).toBeEnabled();
  await expect(offerBox).not.toContainText("Saved.");

  // A refined offer in a later reply: the server gives no refusal for the new presentation.
  const refinedAt = { ...afterSend(current, "A synthetic request to word it differently.", 5) };
  current = { ...refinedAt, waypointOffer: offer("change", { destination: REFINED_DESTINATION,
    suggestionMessageId: refinedAt.messages.at(-1)!.id, typedAnswerEligible: true, typedAnswerRefusal: null }) };
  await reload(page).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
  const refined = transcript(page).getByRole("listitem").nth(5).locator('[data-waypoint-offer="change"]');
  await expect(refined).toContainText(REFINED_DESTINATION);
  await expect(anyBox(page)).toHaveCount(1);
  for (const absent of [TYPED_LIMIT_PASSED, TYPED_TARGET_CHANGED, HISTORY_LIMIT_REASON, "Saved."]) await expect(refined).not.toContainText(absent);
  await expect(button(refined, "change", "right")).toBeEnabled();
  expect(requests).toHaveLength(1);
});

// Plan lines 660-661: a confirmed change whose follow-up message fails.
test("O06 a confirmed change keeps its Saved line when the follow-up message's reply fails, and the message notice shows", async ({ page }) => {
  let current = savedState("change");
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    requests.push(command);
    if (command.kind === "respond_waypoint_offer") {
      current = answered(current, "change", "right");
      return fulfill(route, success(current, stored("change", "right")));
    }
    expect(command).toMatchObject({ kind: "send", body: `That's right: "${TITLE}"`, expectedRevision: 6 });
    if (command.kind !== "send") throw new Error("unexpected_command");
    // The Explorer's message is saved, the reply is not.
    current = afterSend(current, command.body, 3, null);
    return fulfill(route, success(current, undefined, { kind: "reply_failed", body: "A synthetic failed-reply sentence from the server.", persisted: false }));
  });
  await open(page, () => current);
  await composer(page).fill(TYPED_DRAFT);
  await button(box(page, "change"), "change", "right").click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(FAILED_REPLY_BUTTON_NOTE);
  await expect(box(page, "change")).toContainText(SAVED_LINE.change);
  await expect(box(page, "change").getByRole("button")).toHaveCount(0);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(3);
  await expect(composer(page)).toHaveValue(TYPED_DRAFT);
  expect(requests).toHaveLength(2);
  const waypoints = await openCard(page);
  await waypoints.getByRole("button", { name: `${TITLE} Formed`, exact: true }).click();
  await expect(waypoints).toContainText(NEW_DESTINATION);
  await closeCard(page);
});

// Plan line 661: the dropped-offer quiet line.
test("O07 a reply whose offer could not be shown gets the quiet line, with the reason clause when it is known", async ({ page }) => {
  let current = savedState("change", { waypointOffer: null, waypointOfferDrop: { kind: "change", reason: "no_change" } });
  let writes = 0;
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await open(page, () => current);
  const line = page.locator("[data-waypoint-offer-drop]");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(`SolMind could not show this offer for you to confirm because the proposed wording was the same as the saved wording. ${QUIET_REST}`);
  await expect(transcript(page).getByRole("listitem").nth(1).locator("[data-waypoint-offer-drop]")).toHaveCount(1);
  await expect(anyBox(page)).toHaveCount(0);
  for (const [reason, clause] of [
    ["target_not_available", " because the Waypoint is no longer available for this offer"],
    ["already_offered", " because Reached was already offered for this Waypoint in this conversation"],
    ["evidence_not_found", " because the quoted words were not found in your messages"],
    ["not_allowed_now", ""],
  ] as const) {
    current = { ...current, revision: current.revision + 1, waypointOfferDrop: { kind: reason === "not_allowed_now" ? null : "reached", reason } };
    await reload(page).click();
    await expect(line).toHaveText(`SolMind could not show this offer for you to confirm${clause}. ${QUIET_REST}`);
  }
  current = { ...current, revision: current.revision + 1, waypointOfferDrop: null };
  await reload(page).click();
  await expect(line).toHaveCount(0);
  expect(writes).toBe(0);
});

// Plan lines 661-662: reload keeps a pending box and a confirmed box.
for (const kind of ["reached", "change", "revisit"] as const) {
  test(`O08 a reload keeps a waiting ${kind} box and a confirmed one`, async ({ page }) => {
    let current = savedState(kind);
    let writes = 0;
    await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
    await open(page, () => current);
    await expect(button(box(page, kind), kind, "right")).toBeEnabled();
    await page.reload();
    await expect(button(box(page, kind), kind, "right")).toBeEnabled();
    await expect(box(page, kind)).not.toContainText("Saved.");
    // Confirmed elsewhere. The state carries only current versions: the box still draws "Now" from its own snapshot.
    current = answered(current, kind, "right");
    await page.reload();
    await expect(box(page, kind)).toContainText(SAVED_LINE[kind]);
    await expect(box(page, kind).getByRole("button")).toHaveCount(0);
    await expect(box(page, kind)).toContainText(TITLE);
    if (kind === "change") {
      await expect(box(page, kind)).toContainText(SAVED.destination);
      await expect(box(page, kind)).toContainText(NEW_DESTINATION);
    }
    await page.reload();
    await expect(box(page, kind)).toContainText(SAVED_LINE[kind]);
    expect(writes).toBe(0);
  });
}

// Plan line 662: a stale result shows the changed-conversation notice.
test("O09 a stale answer shows the changed-conversation notice, saves nothing here and sends no message", async ({ page }) => {
  const current = savedState("change");
  const requests: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    requests.push(commandOf(route));
    return fulfill(route, { version: "explorer-private-conversation-response.v1",
      result: { ok: false, state: null, error: "refresh_required" }, assistance: null }, 409);
  });
  await open(page, () => current);
  await button(box(page, "change"), "change", "right").click();
  await expect(page.getByRole("alert").filter({ hasText: CHANGED_CONVERSATION })).toBeVisible();
  await expect(page.getByText(/^Saved\. This Waypoint/)).toHaveCount(0);
  await expect(reload(page)).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].kind).toBe("respond_waypoint_offer");
  await reload(page).click();
  await expect(button(box(page, "change"), "change", "right")).toBeEnabled();
  expect(requests).toHaveLength(1);
});

// Plan lines 662-663: an uncertain result retried with identical bytes.
for (const kind of ["reached", "change", "revisit"] as const) {
  test(`O10 an uncertain ${kind} answer is retried with identical bytes, then shows its Saved line`, async ({ page }) => {
    let current = savedState(kind);
    const answers: string[] = [];
    const sends: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      if (command.kind === "respond_waypoint_offer") {
        answers.push(route.request().postData()!);
        if (answers.length === 1) { current = answered(current, kind, "right"); return route.abort("failed"); }
        return fulfill(route, success(current, stored(kind, "right")));
      }
      sends.push(command);
      expect(command).toMatchObject({ kind: "send", body: `That's right: "${TITLE}"`, expectedRevision: 6 });
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await button(box(page, kind), kind, "right").click();
    await expect(retry(page)).toBeVisible();
    // Nothing is claimed while the outcome is unknown, and the box cannot be answered a second time.
    await expect(box(page, kind)).not.toContainText("Saved.");
    for (const control of await box(page, kind).getByRole("button").all()) await expect(control).toBeDisabled();
    expect(answers).toHaveLength(1);
    expect(sends).toHaveLength(0);
    await retry(page).click();
    await expect(box(page, kind)).toContainText(SAVED_LINE[kind]);
    expect(answers).toHaveLength(2);
    expect(answers[1]).toBe(answers[0]);
    if (kind === "reached") await expectSettledWithoutSend(page, sends);
    else {
      await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
      expect(sends).toHaveLength(1);
    }
  });
}

// Plan lines 663-667, with the Executor's amendment: a lost response to "That's right", then a newer offer with the
// same title from another tab, then Retry. The state holds one offer and the newer waiting one takes its place, so
// the original box cannot render: the Waypoint shows the saved change, no message is sent in the Explorer's name,
// and the newer offer is still waiting, unconfirmed. (Also line 663: a retry after a newer offer replaced the one
// answered.)
test("O11 Retry after a lost yes and a newer same-title offer: the earlier answer's result is shown, the Waypoint shows the saved change, no message is sent, the newer offer still waits", async ({ page }) => {
  let current = savedState("change");
  const answers: string[] = [];
  const sends: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    if (command.kind !== "respond_waypoint_offer") { sends.push(command); return route.abort("failed"); }
    answers.push(route.request().postData()!);
    expect(command).toMatchObject({ offerId: OFFER, response: "right", expectedRevision: 5 });
    if (answers.length === 1) {
      // The answer is saved and its response is lost. Then another tab continues the conversation: a message, a
      // reply, and a newer change offer to the new version, with the same title.
      const saved = answered(current, "change", "right");
      const later = afterSend(saved, "A synthetic message from another tab.", 3, "A synthetic reply that carries a newer offer.");
      current = { ...later, revision: later.revision + 1, waypointOffer: offer("change", { id: OTHER_OFFER, waypointId: NEXT_WAYPOINT,
        targetBefore: { title: TITLE, destination: NEW_DESTINATION, whyItMatters: SAVED.meaning, arrivalSignal: SAVED.arrivalSignal, stage: "formed" },
        destination: REFINED_DESTINATION, suggestionMessageId: later.messages.at(-1)!.id }) };
      return route.abort("failed");
    }
    // The exact Retry returns the original answer's own stored result with the current state.
    return fulfill(route, success(current, stored("change", "right")));
  });
  await open(page, () => current);
  await button(box(page, "change"), "change", "right").click();
  await expect(retry(page)).toBeVisible();
  await retry(page).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  expect(answers).toHaveLength(2);
  expect(answers[1]).toBe(answers[0]);
  // The newer offer, same title, still waits under the newer reply: not confirmed, and answerable.
  const newer = transcript(page).getByRole("listitem").nth(3).locator('[data-waypoint-offer="change"]');
  await expect(anyBox(page)).toHaveCount(1);
  await expect(newer).toContainText(TITLE);
  await expect(newer).toContainText(REFINED_DESTINATION);
  await expect(newer).not.toContainText("Saved.");
  await expect(page.getByText(/^Saved\. This Waypoint/)).toHaveCount(0);
  for (const answer of ["right", "close", "not_it"] as const) await expect(button(newer, "change", answer)).toBeEnabled();
  // The original answer's result is shown (decision 5 of 2026-11-16 21:52:56): the settled status line names the
  // earlier answer and the Waypoint by the title its box showed. No message was sent in the Explorer's name.
  // Compact header: the line stands beside the strip's green words in the one status region.
  await expect(statusLine(page)).toHaveText(`${UP_TO_DATE} ${EARLIER_CHANGE_SAVED}`);
  expect(sends).toHaveLength(0);
  await expect(transcript(page)).not.toContainText(`That's right: "${TITLE}"`);
  // The Waypoint shows the saved change.
  const waypoints = await openCard(page);
  await waypoints.getByRole("button", { name: `${TITLE} Formed`, exact: true }).click();
  await expect(waypoints).toContainText(NEW_DESTINATION);
  await expect(waypoints).not.toContainText(REFINED_DESTINATION);
  await closeCard(page);
  expect(sends).toHaveLength(0);
});

// Plan line 667: the same for a forming Waypoint (REV473 finding 1).
test("O12 Retry after a lost yes to a forming Waypoint and a newer same-title one: the Waypoint is formed, no message is sent, the newer one still waits", async ({ page }) => {
  const draft = (overrides: Partial<Draft> = {}): Draft => ({ id: DRAFT, title: DRAFT_TITLE, destination: "Keep Sunday free",
    whyItMatters: "I start the week calmer", arrivalSignal: "Three free Sundays", suggestionMessageId: REPLY, typedAnswerEligible: true, ...overrides });
  let current = savedState("change", { waypointOffer: null, waypoints: [], waypointDraft: draft(),
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false } });
  const answers: string[] = [];
  const sends: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    if (command.kind !== "respond_waypoint_draft") { sends.push(command); return route.abort("failed"); }
    answers.push(route.request().postData()!);
    expect(command).toMatchObject({ draftId: DRAFT, response: "right", expectedRevision: 5 });
    if (answers.length === 1) {
      const later = afterSend({ ...current, revision: current.revision + 1 }, "A synthetic message from another tab.", 3, "A synthetic reply that suggests it again.");
      current = { ...later, revision: later.revision + 1,
        waypoints: [{ id: DRAFT_WAYPOINT, isCurrent: true, createdAt: "2026-11-16T09:10:00.000Z", sourceMessageId: EXPLORER_MESSAGE,
          title: DRAFT_TITLE, destination: "Keep Sunday free", meaning: "I start the week calmer", arrivalSignal: "Three free Sundays", status: "chosen" }],
        waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
        waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 1, hasMore: false },
        waypointDraft: draft({ id: OTHER_DRAFT, suggestionMessageId: later.messages.at(-1)!.id }) };
      return route.abort("failed");
    }
    return fulfill(route, success(current));
  });
  await open(page, () => current);
  await draftRow(page, DRAFT_TITLE).getByRole("button", { name: "That's right", exact: true }).click();
  await expect(retry(page)).toBeVisible();
  await retry(page).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  expect(answers).toHaveLength(2);
  expect(answers[1]).toBe(answers[0]);
  // The newer forming Waypoint, same title, still waits under the newer reply.
  await expect(draftRow(page, DRAFT_TITLE)).toHaveCount(1);
  await expect(transcript(page).getByRole("listitem").nth(3).getByRole("group", { name: `Reply to Waypoint suggestion: ${DRAFT_TITLE}`, exact: true })).toContainText("Forming");
  for (const name of ["That's right", "Close, not quite", "That's not it"]) {
    await expect(draftRow(page, DRAFT_TITLE).getByRole("button", { name, exact: true })).toBeEnabled();
  }
  await expectSettledWithoutSend(page, sends);
  await expect(transcript(page)).not.toContainText(`That's right: "${DRAFT_TITLE}"`);
  const waypoints = await openCard(page);
  await expect(waypoints.getByRole("heading", { name: `${DRAFT_TITLE} Formed`, exact: true })).toBeVisible();
  await closeCard(page);
});

// Plan lines 668-670 (REV473c): "Close, not quite" on a change offer while an older forming Waypoint is still
// waiting, and on an older offer after a later ordinary reply, each sends its follow-up; a reply added after the
// button press sends none.
test("O13 Close on a change offer sends its follow-up while an older forming Waypoint still waits under an earlier reply", async ({ page }) => {
  const base = savedState("change");
  const earlier = afterSend({ ...base, messages: base.messages.slice(0, 1) }, "A synthetic message that led to a suggestion.", 3, "A synthetic reply that carries a newer change offer.");
  // Order: the Explorer's message, the reply carrying the forming Waypoint, a message, the reply carrying the offer.
  const messages = [base.messages[0], base.messages[1], earlier.messages[1], earlier.messages[2]];
  let current: ExplorerConversationState = { ...base, messages,
    waypointDraft: { id: DRAFT, title: DRAFT_TITLE, destination: "Keep Sunday free", whyItMatters: "I start the week calmer",
      arrivalSignal: "Three free Sundays", suggestionMessageId: REPLY, typedAnswerEligible: false },
    waypointOffer: offer("change", { suggestionMessageId: messages[3].id }) };
  const sends: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    if (command.kind === "respond_waypoint_offer") {
      expect(command).toMatchObject({ offerId: OFFER, response: "close", expectedRevision: 5 });
      current = { ...current, revision: 6, waypointOffer: offer("change", { suggestionMessageId: messages[3].id, typedAnswerEligible: false }) };
      return fulfill(route, success(current, stored("change", "close", { suggestionMessageId: messages[3].id })));
    }
    sends.push(command);
    expect(command).toMatchObject({ kind: "send", body: `Close, not quite: "${TITLE}"`, expectedRevision: 6 });
    if (command.kind !== "send") throw new Error("unexpected_command");
    current = afterSend(current, command.body, 5);
    return fulfill(route, success(current));
  });
  await open(page, () => current);
  await expect(draftRow(page, DRAFT_TITLE)).toBeVisible();
  await expect(transcript(page).getByRole("listitem").nth(3).locator('[data-waypoint-offer="change"]')).toHaveCount(1);
  await button(box(page, "change"), "change", "close").click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
  await expect(transcript(page).getByRole("listitem").nth(4)).toContainText(`Close, not quite: "${TITLE}"`);
  expect(sends).toHaveLength(1);
  // Both presentations still wait where they were.
  await expect(draftRow(page, DRAFT_TITLE)).toBeVisible();
  await expect(transcript(page).getByRole("listitem").nth(3).locator('[data-waypoint-offer="change"]')).toHaveCount(1);
});

for (const advance of [false, true]) {
  test(`O14 Close on an older offer after a later ordinary reply ${advance ? "sends no follow-up when a reply was added after the press" : "sends its follow-up"}`, async ({ page }) => {
    // The offer still waits under the first reply; a later ordinary exchange follows it.
    let current: ExplorerConversationState = { ...afterSend(savedState("change", { revision: 4 }), "A synthetic later message.", 3, "A synthetic later ordinary reply."),
      waypointOffer: offer("change", { typedAnswerEligible: false }) };
    const sends: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      if (command.kind === "respond_waypoint_offer") {
        expect(command).toMatchObject({ offerId: OFFER, response: "close", expectedRevision: 5 });
        current = { ...current, revision: 6 };
        // In the "advance" case another tab's exchange is saved before this answer's result is read.
        if (advance) current = afterSend(current, "A synthetic message from another tab.", 5, "A synthetic reply added after the button press.");
        return fulfill(route, success(current, stored("change", "close")));
      }
      sends.push(command);
      expect(advance).toBe(false);
      expect(command).toMatchObject({ kind: "send", body: `Close, not quite: "${TITLE}"`, expectedRevision: 6 });
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 5);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
    const offerBox = transcript(page).getByRole("listitem").nth(1).locator('[data-waypoint-offer="change"]');
    await expect(button(offerBox, "change", "close")).toBeEnabled();
    await button(offerBox, "change", "close").click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(6);
    if (advance) {
      await expect(transcript(page).getByRole("listitem").nth(5)).toContainText("A synthetic reply added after the button press.");
      await expectSettledWithoutSend(page, sends);
      await expect(transcript(page)).not.toContainText(`Close, not quite: "${TITLE}"`);
    } else {
      await expect(transcript(page).getByRole("listitem").nth(4)).toContainText(`Close, not quite: "${TITLE}"`);
      expect(sends).toHaveLength(1);
    }
    // The answered offer still waits under its own reply.
    await expect(offerBox).toHaveCount(1);
    await expect(offerBox).not.toContainText("Saved.");
  });
}

// Plan line 670: both limits.
for (const limit of ["history", "active", "both"] as const) {
  test(`O15 at the ${limit} limit a revisit's yes button is unavailable with its reason, and the other replies stay available`, async ({ page }) => {
    const capacity = { activeCount: limit === "history" ? 0 : 20, activeLimit: 20, historyRoom: limit === "active", conversationRoom: true };
    let current = savedState("revisit", { waypointCapacity: capacity });
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      requests.push(command);
      if (command.kind === "respond_waypoint_offer") {
        expect(command.response).toBe("not_it");
        current = answered(current, "revisit", "not_it");
        return fulfill(route, success(current, stored("revisit", "not_it")));
      }
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    const offerBox = box(page, "revisit");
    const reason = limit === "active" ? REVISIT_LIMIT_REASON : HISTORY_LIMIT_REASON;
    const shown = offerBox.getByText(reason, { exact: true });
    await expect(shown).toHaveCount(1);
    await expect(shown).toHaveAttribute("role", "status");
    await expect(offerBox).toHaveAccessibleDescription(reason);
    // The 200-version sentence comes first, alone, when both limits apply.
    await expect(offerBox.getByText(limit === "active" ? HISTORY_LIMIT_REASON : REVISIT_LIMIT_REASON, { exact: true })).toHaveCount(0);
    await expect(offerBox).not.toContainText("before adding another");
    await expect(button(offerBox, "revisit", "right")).toBeDisabled();
    await expect(button(offerBox, "revisit", "close")).toBeEnabled();
    await expect(button(offerBox, "revisit", "not_it")).toBeEnabled();
    await button(offerBox, "revisit", "right").evaluate(control => (control as HTMLButtonElement).click());
    expect(requests).toHaveLength(0);
    await expect(composer(page)).toBeEnabled();
    await button(offerBox, "revisit", "not_it").click();
    await expect(transcript(page).getByRole("listitem").nth(3)).toContainText(GUIDE_REPLY);
    expect(requests.map(command => command.kind)).toEqual(["respond_waypoint_offer", "send"]);
  });
}
test("O16 a change offer is held only by the 200-version limit; 20 active Waypoints or five in the conversation never hold it or a Reached offer", async ({ page }) => {
  let current = savedState("change", { waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true, conversationRoom: false } });
  let writes = 0;
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await open(page, () => current);
  await expect(button(box(page, "change"), "change", "right")).toBeEnabled();
  await expect(box(page, "change")).not.toContainText("is unavailable because");
  current = { ...current, revision: 6, waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: false, conversationRoom: false } };
  await reload(page).click();
  await expect(button(box(page, "change"), "change", "right")).toBeDisabled();
  await expect(box(page, "change").getByText(HISTORY_LIMIT_REASON, { exact: true })).toHaveCount(1);
  current = { ...savedState("reached"), revision: 7, waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: false, conversationRoom: false } };
  await reload(page).click();
  await expect(button(box(page, "reached"), "reached", "right")).toBeEnabled();
  await expect(box(page, "reached")).not.toContainText("is unavailable because");
  expect(writes).toBe(0);
});

// The Executor's addition: the Waypoint changed after the offer was shown, with no typed refusal.
for (const kind of ["reached", "change", "revisit"] as const) {
  test(`O17 when the Waypoint changed after a ${kind} offer was shown, its yes button is off and the other replies stay available`, async ({ page }) => {
    let current = savedState(kind, { waypointOffer: offer(kind, { targetCurrent: false, typedAnswerEligible: false }) });
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      requests.push(command);
      if (command.kind === "respond_waypoint_offer") {
        expect(command).toMatchObject({ offerId: OFFER, response: "not_it" });
        current = { ...current, revision: current.revision + 1,
          waypointOffer: offer(kind, { status: "declined", targetCurrent: false, typedAnswerEligible: false }) };
        return fulfill(route, success(current, stored(kind, "not_it")));
      }
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    const offerBox = box(page, kind);
    await expect(button(offerBox, kind, "right")).toBeDisabled();
    for (const answer of (kind === "reached" ? ["not_it"] : ["close", "not_it"]) as Answer[]) await expect(button(offerBox, kind, answer)).toBeEnabled();
    // No refusal happened: neither typed-answer sentence shows, and no Saved line.
    for (const absent of [TYPED_TARGET_CHANGED, TYPED_LIMIT_PASSED, "is unavailable because", "Saved."]) await expect(offerBox).not.toContainText(absent);
    // Decision 1: the reason, named for the box and for its yes button, and the invitation while a message can be
    // sent. Decision 2: the snapshot column of a change or revisit reads "When offered".
    await expect(offerBox.getByText(TARGET_CHANGED_REASON(kind), { exact: true })).toHaveCount(1);
    await expect(offerBox).toHaveAccessibleDescription(TARGET_CHANGED_REASON(kind));
    await expect(button(offerBox, kind, "right")).toHaveAccessibleDescription(TARGET_CHANGED_REASON(kind));
    await expect(offerBox.getByText(TARGET_CHANGED_DISCUSS, { exact: true })).toHaveCount(1);
    if (kind !== "reached") {
      await expect(offerBox).toContainText("When offered");
      await expect(offerBox.getByText("Now", { exact: true })).toHaveCount(0);
    }
    await button(offerBox, kind, "right").evaluate(control => (control as HTMLButtonElement).click());
    expect(requests).toHaveLength(0);
    await button(offerBox, kind, "not_it").click();
    await expect(anyBox(page)).toHaveCount(0);
    expect(requests[0]).toMatchObject({ kind: "respond_waypoint_offer", response: "not_it" });
  });
}

// Plan line 672: a narrow screen. "Now" above "Proposed" on a narrow screen, side by side on a wide one.
test("O18 the change box puts Now above Proposed on a narrow screen and beside it on a wide one, inside the transcript's width", async ({ page }) => {
  const current = savedState("change", { waypointOffer: offer("change", { destination: "Walk before breakfast, every weekday, whatever the weather is like that morning" }) });
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await open(page, () => current);
  const offerBox = box(page, "change");
  const now = await offerBox.getByText("Now", { exact: true }).first().boundingBox();
  const proposed = await offerBox.getByText("Proposed", { exact: true }).first().boundingBox();
  expect(now).not.toBeNull();
  expect(proposed).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) < 640) {
    expect(proposed!.y).toBeGreaterThan(now!.y + now!.height);
    expect(Math.abs(proposed!.x - now!.x)).toBeLessThanOrEqual(1);
  } else {
    expect(proposed!.x).toBeGreaterThan(now!.x + now!.width);
    expect(Math.abs(proposed!.y - now!.y)).toBeLessThanOrEqual(1);
  }
  // Nothing in the box is wider than the box, and the box stays inside the window.
  const frame = await offerBox.boundingBox();
  expect(frame!.x).toBeGreaterThanOrEqual(0);
  expect(frame!.x + frame!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await offerBox.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

// Plan line 672: the page staying put (step 4 item 9, tests/browser/explorerOpenAtNewest.pw.ts): the application
// does not move the page on a command or a Send. Each run measures the window, the document and the answered
// reply's list item before and after, so that a failure says which of two things happened:
//   - a clamp: the document got shorter while the page was at its largest scroll, and the browser itself brought
//     the window back inside it (documentHeight falls, scrollY ends at the new largest scroll). This is accepted;
//   - an application scroll: the document kept its height and the window moved anyway, for example because focus
//     was put on a list item that was not fully in view (itemTop below 0 or itemBottom beyond the window before the
//     press, and scrollY changed by about that much). This fails.
// Two starting positions: where the page opens (at the newest messages), and mid-way with the answered reply
// centred in the window, away from the largest scroll.
type PageMeasure = Readonly<{ scrollY: number; largestScroll: number; documentHeight: number; windowHeight: number;
  itemTop: number; itemBottom: number; itemDocumentTop: number; itemFocused: boolean }>;
const measurePage = (item: Locator): Promise<PageMeasure> => item.evaluate(element => {
  const rectangle = element.getBoundingClientRect();
  const root = document.documentElement;
  return { scrollY: Math.round(window.scrollY), largestScroll: Math.round(root.scrollHeight - root.clientHeight),
    documentHeight: root.scrollHeight, windowHeight: root.clientHeight,
    itemTop: Math.round(rectangle.top), itemBottom: Math.round(rectangle.bottom),
    itemDocumentTop: Math.round(rectangle.top + window.scrollY), itemFocused: document.activeElement === element };
});
function expectPageDidNotMove(before: PageMeasure, after: PageMeasure, moment: string) {
  const evidence = `${moment}. before ${JSON.stringify(before)} after ${JSON.stringify(after)}`;
  if (before.scrollY <= after.largestScroll - 1) {
    // The earlier position still exists in the document: the window must be exactly where it was.
    expect(after.scrollY, `the application moved the page: ${evidence}`).toBe(before.scrollY);
  } else {
    // The document got shorter than the earlier position: only the browser's clamp to its new end is accepted.
    expect(after.documentHeight, `the page moved without the document getting shorter: ${evidence}`).toBeLessThan(before.documentHeight);
    expect(Math.abs(after.scrollY - after.largestScroll), `the page moved further than a clamp: ${evidence}`).toBeLessThanOrEqual(1);
  }
}
for (const kind of ["reached", "change"] as const) for (const start of ["where the page opens", "mid-way"] as const) {
  test(`O19 answering a ${kind} offer and its follow-up do not move the page (from ${start})`, async ({ page }) => {
    // A longer saved conversation, so that the page has somewhere to move to.
    const base = savedState(kind);
    const filler: ExplorerConversationState["messages"][number][] = [];
    for (let index = 1; index <= 8; index += 1) {
      filler.push({ id: `20000000-0000-4000-8000-0000000000e${index}`, role: "explorer",
        body: `A synthetic earlier message number ${index}: invented words about an ordinary day, long enough to wrap onto a second line.`,
        createdAt: `2026-11-16T07:0${index}:00.000Z` });
      filler.push({ id: `30000000-0000-4000-8000-0000000000e${index}`, role: "virtualGuide",
        body: `A synthetic earlier reply number ${index}: an invented reflection of a few sentences. It is here only to fill the page.`,
        createdAt: `2026-11-16T07:0${index}:30.000Z` });
    }
    let current: ExplorerConversationState = { ...base, messages: [...filler, ...base.messages] };
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      requests.push(command);
      if (command.kind === "respond_waypoint_offer") {
        current = answered(current, kind, "right");
        return fulfill(route, success(current, stored(kind, "right")));
      }
      if (command.kind !== "send") throw new Error("unexpected_command");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await expect(box(page, kind)).toBeVisible();
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    // The list item of the reply that carries the offer: the box's buttons put keyboard focus on it.
    const item = transcript(page).getByRole("listitem").nth(17);
    await expect(item.locator("[data-waypoint-offer]")).toHaveCount(1);
    if (start === "mid-way") {
      // Centre the answered reply in the window, from inside the page, then step off the largest scroll if needed.
      await item.evaluate(element => {
        element.scrollIntoView({ block: "center" });
        const root = document.documentElement;
        if (window.scrollY >= root.scrollHeight - root.clientHeight - 1) window.scrollBy(0, -40);
      });
    }
    const before = await measurePage(item);
    test.info().annotations.push({ type: "page before the press", description: JSON.stringify(before) });
    if (start === "mid-way") expect(before.scrollY, `not away from the largest scroll: ${JSON.stringify(before)}`).toBeLessThan(before.largestScroll);
    // Pressed from inside the page, so that the test itself never scrolls the window.
    await button(box(page, kind), kind, "right").evaluate(control => (control as HTMLButtonElement).click());
    await expect(box(page, kind)).toContainText(SAVED_LINE[kind]);
    const saved = await measurePage(item);
    test.info().annotations.push({ type: "page after the Saved line", description: JSON.stringify(saved) });
    expectPageDidNotMove(before, saved, "after the Saved line");
    if (kind === "change") {
      await expect(transcript(page).getByRole("listitem")).toHaveCount(20);
      expect(requests).toHaveLength(2);
    } else await expectSettledWithoutSend(page, requests.slice(1));
    const settled = await measurePage(item);
    test.info().annotations.push({ type: "page when settled", description: JSON.stringify(settled) });
    expectPageDidNotMove(before, settled, "when settled");
  });
}

// Compact header step B (the transcript sized to the window; REV486 finding 2): inside the transcript, an answer
// that is not followed by a message keeps the Explorer's reading position (the application writes no scroll
// position and the message count does not change), while an answer followed by the automatic Send keeps ordinary
// Send scrolling (to the newest end when the Send starts and when its reply arrives). Neither moves the page.
const historyBox = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
type HistoryMeasure = Readonly<{ top: number; range: number; height: number; box: number }>;
const measureHistory = (page: Page): Promise<HistoryMeasure> => historyBox(page).evaluate(element => ({
  top: Math.round(element.scrollTop), range: Math.round(element.scrollHeight - element.clientHeight), height: element.scrollHeight,
  box: element.clientHeight }));
// What happened to the transcript since the watch began, recorded inside the page (GPT-6 Astra REV494c finding 1).
// - scrollWrites: every scroll position written on the transcript by script (its scrollTop, scrollTo, scrollBy,
//   scroll, or scrollIntoView on anything inside it). The application's one write is the move to the newest end.
// - samples: states the browser was really in, each read in one go (content height, the transcript's own height
//   and the offset together): each time the application measures the transcript (the sizer does, right after a
//   render, and by then the browser has laid out the new content in the transcript's present height), immediately
//   before each height the application writes on it, at each frame, and at each scroll event. Nothing is paired
//   from different moments.
type HistorySample = Readonly<{ at: string; content: number; box: number; top: number }>;
type HistoryWatch = Readonly<{ scrollWrites: number; heightWrites: number; samples: readonly HistorySample[] }>;
type WatchRecord = { scrollWrites: number; heightWrites: number; samples: HistorySample[] };
async function watchHistory(page: Page) {
  await historyBox(page).evaluate(element => {
    const holder = window as unknown as { historyWatch?: WatchRecord };
    if (holder.historyWatch !== undefined) {
      holder.historyWatch.scrollWrites = 0;
      holder.historyWatch.heightWrites = 0;
      holder.historyWatch.samples = [];
      return;
    }
    const record: WatchRecord = { scrollWrites: 0, heightWrites: 0, samples: [] };
    holder.historyWatch = record;
    const native = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")!;
    const sample = (at: string) => {
      const now = { at, content: element.scrollHeight, box: element.clientHeight, top: Math.round(native.get!.call(element) as number) };
      const last = record.samples[record.samples.length - 1];
      if (last !== undefined && last.content === now.content && last.box === now.box && last.top === now.top) return;
      if (record.samples.length < 400) record.samples.push(now);
    };
    Object.defineProperty(element, "scrollTop", { configurable: true,
      get() { return native.get!.call(element) as number; },
      set(value: number) { record.scrollWrites += 1; native.set!.call(element, value); sample("scroll write"); } });
    for (const name of ["scrollTo", "scrollBy", "scroll"] as const) {
      const own = element[name].bind(element) as (...parts: unknown[]) => void;
      (element as unknown as Record<string, unknown>)[name] = (...parts: unknown[]) => { record.scrollWrites += 1; own(...parts); };
    }
    const intoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoViewCounted(this: Element, ...parts: [(boolean | ScrollIntoViewOptions)?]) {
      if (element.contains(this)) record.scrollWrites += 1;
      intoView.apply(this, parts);
    };
    // The application measures the transcript: the browser has just laid it out.
    const measureOwn = Element.prototype.getBoundingClientRect;
    (element as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => {
      const place = measureOwn.call(element);
      sample("measured by the application");
      return place;
    };
    // The application writes the transcript's height: the state immediately before it.
    const style = (element as HTMLElement).style;
    Object.defineProperty(style, "height", { configurable: true,
      get() { return style.getPropertyValue("height"); },
      set(value: string) { sample("before a height write"); record.heightWrites += 1; style.setProperty("height", value); } });
    element.addEventListener("scroll", () => sample("scroll event"));
    const step = () => { sample("frame"); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const readWatch = (page: Page): Promise<HistoryWatch> => page.evaluate(() => {
  const record = (window as unknown as { historyWatch: WatchRecord }).historyWatch;
  return { scrollWrites: record.scrollWrites, heightWrites: record.heightWrites, samples: [...record.samples] };
});
function longOfferState(kind: Kind): ExplorerConversationState {
  const base = savedState(kind);
  const filler: ExplorerConversationState["messages"][number][] = [];
  for (let index = 1; index <= 8; index += 1) {
    filler.push({ id: `20000000-0000-4000-8000-0000000000f${index}`, role: "explorer",
      body: `A synthetic earlier message number ${index}: invented words about an ordinary day, long enough to wrap onto a second line.`,
      createdAt: `2026-11-16T07:0${index}:00.000Z` });
    filler.push({ id: `30000000-0000-4000-8000-0000000000f${index}`, role: "virtualGuide",
      body: `A synthetic earlier reply number ${index}: an invented reflection of a few sentences. It is here only to fill the page.`,
      createdAt: `2026-11-16T07:0${index}:30.000Z` });
  }
  return { ...base, messages: [...filler, ...base.messages] };
}
// A reading position the given distance above the newest end, set from inside the page; the watch begins after it.
async function readAboveTheEnd(page: Page, above = 160): Promise<HistoryMeasure> {
  await historyBox(page).evaluate((element, distance) => { element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - distance); }, above);
  const at = await measureHistory(page);
  expect(at.range, `the transcript has nothing to scroll: ${JSON.stringify(at)}`).toBeGreaterThan(160);
  expect(Math.abs(at.range - at.top - above)).toBeLessThanOrEqual(1);
  await watchHistory(page);
  return at;
}
// Scroll anchoring off, for the tests that measure the offset alone: what remains is the application's writes and
// the browser's own return to a largest offset. The first step B run failed on the narrow project with the offset
// 124 px lower and the second on the desktop project with it 14 px lower. Scroll anchoring was the first, likely
// explanation and was never proven; the second failure happened with anchoring off. The same scenarios also run
// with the browser's anchoring left on.
const withoutScrollAnchoring = (page: Page) => page.addStyleTag({ content: "html, body, body * { overflow-anchor: none !important; }" });

// The reader's position, measured by the text itself and not by the offset (REV494c, REV494d). A snapshot remembers
// every element of the transcript with its place in the content, and every line of text; the lines that were
// wholly in view are the reader's. Afterwards, for each such line that still exists:
// - where it is and whether it is wholly in view;
// - how far it moved inside the content (measured on the line itself); and
// - how far it had to move inside the content, derived without looking at the line: from the blocks above it, at
//   each level of the page's structure up to the transcript (a block that went gives up the room it took, a new
//   block takes its room, a block that stayed counts with its change of height).
type ReaderLine = Readonly<{ text: string; was: number; now: number; height: number; contentMoved: number; expectedContentMove: number | null;
  whole: boolean }>;
type ReaderView = Readonly<{ lines: readonly ReaderLine[]; gone: number; answerWasWhole: boolean;
  scrollY: number; messageBoxTop: number; messageBoxInWindow: boolean; noticesHeight: number;
  savedLineWhole: boolean | null; savedLineBelowBy: number | null }>;
type Place = { top: number; bottom: number };
type Snapshot = { places: Map<Element, Place>; children: Map<Element, Element[]>;
  lines: { node: Element; text: string; was: number; height: number; whole: boolean }[]; answerWasWhole: boolean };
const LEAVES = "p, time, h3, h4, dt, dd, span, li, button, a";
const rememberLines = (page: Page, key: string) => historyBox(page).evaluate((element, [leaves, name]) => {
  const view = Element.prototype.getBoundingClientRect.call(element);
  const top = element.scrollTop;
  const whole = (place: DOMRect) => place.height > 0 && place.top >= view.top - 0.5 && place.bottom <= view.bottom + 0.5 && place.top >= 0 && place.bottom <= window.innerHeight;
  const snapshot: Snapshot = { places: new Map(), children: new Map(), lines: [], answerWasWhole: false };
  for (const node of [element, ...element.querySelectorAll("*")]) {
    const place = node === element ? view : node.getBoundingClientRect();
    snapshot.places.set(node, { top: place.top - view.top + top, bottom: place.bottom - view.top + top });
    snapshot.children.set(node, [...node.children]);
  }
  for (const node of element.querySelectorAll(leaves)) {
    const text = (node.textContent ?? "").trim();
    if (node.children.length > 0 || text === "") continue;
    const place = node.getBoundingClientRect();
    if (place.height === 0) continue;
    snapshot.lines.push({ node, text: text.slice(0, 60), was: place.top - view.top, height: place.height, whole: whole(place) });
  }
  const buttons = [...element.querySelectorAll("[data-waypoint-offer] button")];
  snapshot.answerWasWhole = buttons.length > 0 && buttons.every(control => whole(control.getBoundingClientRect()));
  const holder = window as unknown as { snapshots?: Record<string, Snapshot> };
  holder.snapshots = { ...(holder.snapshots ?? {}), [name]: snapshot };
  return snapshot.lines.filter(each => each.whole).length;
}, [LEAVES, key] as const);
const readerView = (page: Page, key: string, savedLine: string): Promise<ReaderView> => historyBox(page).evaluate((element, [saved, name]) => {
  const view = Element.prototype.getBoundingClientRect.call(element);
  const top = element.scrollTop;
  const whole = (place: DOMRect) => place.height > 0 && place.top >= view.top - 0.5 && place.bottom <= view.bottom + 0.5 && place.top >= 0 && place.bottom <= window.innerHeight;
  const snapshot = (window as unknown as { snapshots: Record<string, Snapshot> }).snapshots[name];
  const nowPlace = (node: Element): Place => {
    const place = node.getBoundingClientRect();
    return { top: place.top - view.top + top, bottom: place.bottom - view.top + top };
  };
  const stayed = (node: Element, parent: Element) => node.isConnected && node.parentElement === parent && snapshot.places.has(node);
  // How far the line had to move inside the content, from the blocks above it and never from the line itself.
  const expectedMove = (line: Element): number | null => {
    let move = 0;
    for (let node = line; node !== element; node = node.parentElement as Element) {
      const parent = node.parentElement;
      if (parent === null || !snapshot.places.has(parent) || !snapshot.places.has(node)) return null;
      const before = snapshot.children.get(parent) ?? [];
      const at = before.indexOf(node);
      if (at === -1) return null;
      const nodeWas = snapshot.places.get(node)!;
      // Blocks that stood before it in the same parent: one that stayed counts with its change of height when it
      // stood above (not beside) the node; a run of blocks that went gives up the room from its top to the top of
      // what followed it.
      for (let index = 0; index < at;) {
        const sibling = before[index];
        const was = snapshot.places.get(sibling)!;
        if (stayed(sibling, parent)) {
          if (was.bottom <= nodeWas.top + 0.5) {
            const now = nowPlace(sibling);
            move += (now.bottom - now.top) - (was.bottom - was.top);
          }
          index += 1;
          continue;
        }
        let end = index;
        while (end < at && !stayed(before[end], parent)) end += 1;
        const lastGone = snapshot.places.get(before[end - 1])!;
        const followed = snapshot.places.get(before[end])!;
        if (lastGone.bottom <= followed.top + 0.5) move -= followed.top - was.top;
        index = end;
      }
      // New blocks before it in the same parent: a run takes the room of its own height and the gap the parent
      // keeps between its blocks, measured on the run and its parent.
      const after = [...parent.children];
      const nowAt = after.indexOf(node);
      const gap = Number.parseFloat(getComputedStyle(parent).rowGap) || 0;
      for (let index = 0; index < nowAt;) {
        if (snapshot.places.has(after[index])) { index += 1; continue; }
        let end = index;
        while (end < nowAt && !snapshot.places.has(after[end])) end += 1;
        const first = nowPlace(after[index]);
        const last = nowPlace(after[end - 1]);
        const next = nowPlace(after[end]);
        if (last.bottom <= next.top + 0.5) {
          const styleFirst = getComputedStyle(after[index]);
          const styleLast = getComputedStyle(after[end - 1]);
          move += (last.bottom - first.top) + gap + (Number.parseFloat(styleFirst.marginTop) || 0) + (Number.parseFloat(styleLast.marginBottom) || 0);
        }
        index = end;
      }
    }
    return move;
  };
  const lines: ReaderLine[] = [];
  let gone = 0;
  for (const each of snapshot.lines) {
    if (!each.whole) continue;
    if (!each.node.isConnected) { gone += 1; continue; }
    const place = each.node.getBoundingClientRect();
    const was = snapshot.places.get(each.node)!;
    const now = place.top - view.top;
    lines.push({ text: each.text, was: each.was, now, height: each.height, contentMoved: now + top - was.top,
      expectedContentMove: expectedMove(each.node), whole: whole(place) });
  }
  const bar = document.querySelector("[data-composer-bar]")!.getBoundingClientRect();
  const notices = document.querySelector("[data-conversation-strip]")!.parentElement!.getBoundingClientRect();
  const savedNode = [...element.querySelectorAll("p, span")].find(node => node.children.length === 0 && (node.textContent ?? "").includes(saved)) ?? null;
  const savedPlace = savedNode === null ? null : savedNode.getBoundingClientRect();
  return { lines, gone, answerWasWhole: snapshot.answerWasWhole,
    scrollY: Math.round(window.scrollY), messageBoxTop: Math.round(bar.top),
    messageBoxInWindow: bar.top >= 0 && bar.bottom <= window.innerHeight, noticesHeight: Math.round(notices.height),
    savedLineWhole: savedPlace === null ? null : whole(savedPlace),
    savedLineBelowBy: savedPlace === null ? null : Math.max(0, Math.round(savedPlace.bottom - view.bottom)) };
}, [savedLine, key] as const);

type Transition = Readonly<{ moment: string; phase: "unconfirmed" | "settled"; anchoring: "off" | "on"; before: HistoryMeasure; after: HistoryMeasure;
  watch: HistoryWatch; viewBefore: ReaderView; view: ReaderView }>;
type TransitionRecord = Readonly<{ moment: string; anchoring: string; before: HistoryMeasure; after: HistoryMeasure; scrollWrites: number;
  heightWrites: number; smallestObservedRange: number; shortestSample: HistorySample | null; offsetFell: number; offsetReason: string;
  readerLines: number; gone: number; movedOnScreen: readonly number[]; expectedContentMoves: readonly number[]; clipped: readonly string[];
  savedLineWhole: boolean | null; answerWasWhole: boolean }>;
const SMALLEST_TRANSCRIPT = 224;
// One transition, checked.
// 1. The application wrote no scroll position on the transcript.
// 2. The offset's change has one of the justified reasons, and no other: none (it did not move); an observed
//    clamp (the offset is exactly at the smallest range the browser was observed in, and a sample shows the
//    browser there); or, with the browser's anchoring on, the browser holding a line of the reader's text (the
//    offset changed by exactly what the blocks above that line gave up or took). With anchoring off only the
//    first two exist. When everything that was in view went with the answer there is no line to hold: the offset
//    may then have fallen by no more than the height the content lost, and the Saved line must be wholly in view.
// 3. Each surviving line of the reader's text moved inside the content by what the blocks above it explain
//    (derived from those blocks, not from the line), within one pixel; so on screen it moved by that plus the
//    justified change of the offset, and by nothing else.
// 4. Whole visibility. Settled (after the Saved line, after the Retry): every surviving line that was wholly in
//    view is wholly in view, without exception. While a lost answer is unconfirmed, one exception: the alert took
//    room, the transcript became shorter by exactly the sizing rule's amount, the content's extent is unchanged,
//    the line's movement is explained, and the line is cut by the lower edge only.
// 5. The page did not move; the message box is lower by exactly what the area above the conversation and the
//    transcript grew by (nothing, when neither changed).
function checkTransition({ moment, phase, anchoring, before, after, watch, viewBefore, view }: Transition): TransitionRecord {
  const ranges = watch.samples.map(each => each.content - each.box);
  const smallestObservedRange = Math.min(before.range, after.range, ...ranges);
  const shortest = watch.samples.find(each => each.content - each.box === smallestObservedRange) ?? null;
  const offsetFell = before.top - after.top;
  const clampFall = before.top - Math.min(before.top, smallestObservedRange);
  const seenAtClamp = watch.samples.some(each => Math.abs((each.content - each.box) - smallestObservedRange) <= 1 && Math.abs(each.top - (each.content - each.box)) <= 1);
  const heldLine = view.lines.find(line => line.expectedContentMove !== null && Math.abs(offsetFell + line.expectedContentMove) <= 1) ?? null;
  const offsetReason = Math.abs(offsetFell) <= 1 ? "did not move"
    : clampFall > 1 && Math.abs(offsetFell - clampFall) <= 1 && seenAtClamp ? "observed clamp"
      : anchoring === "on" && heldLine !== null ? "the browser held the reader's text"
        : anchoring === "on" && view.lines.length === 0 ? "everything in view went"
          : "unexplained";
  const clipped = view.lines.filter(line => !line.whole);
  const movedOnScreen = [...new Set(view.lines.map(line => Math.round(line.now - line.was)))].sort((a, b) => a - b);
  const expectedContentMoves = [...new Set(view.lines.map(line => line.expectedContentMove === null ? Number.NaN : Math.round(line.expectedContentMove)))].sort((a, b) => a - b);
  const record: TransitionRecord = { moment, anchoring, before, after, scrollWrites: watch.scrollWrites, heightWrites: watch.heightWrites,
    smallestObservedRange, shortestSample: shortest, offsetFell, offsetReason, readerLines: view.lines.length, gone: view.gone,
    movedOnScreen, expectedContentMoves, clipped: clipped.map(line => `${line.text} (was ${Math.round(line.was)}, now ${Math.round(line.now)}, height ${Math.round(line.height)})`),
    savedLineWhole: view.savedLineWhole, answerWasWhole: viewBefore.answerWasWhole };
  const evidence = `${moment}: ${JSON.stringify(record)} lines ${JSON.stringify(view.lines)} samples ${JSON.stringify(watch.samples.slice(0, 40))}`;
  // 1.
  expect(watch.scrollWrites, `the application wrote a scroll position on the transcript. ${evidence}`).toBe(0);
  // 2.
  expect(offsetReason, `the offset moved without a justified reason. ${evidence}`).not.toBe("unexplained");
  // REV494e finding 1: whenever anchoring is on and no reader line survived, whatever the offset's reason.
  if (anchoring === "on" && view.lines.length === 0) {
    expect(view.gone, `nothing was in view to begin with. ${evidence}`).toBeGreaterThan(0);
    expect(view.savedLineWhole, `the text in view went and the Saved line is not wholly in view. ${evidence}`).toBe(true);
    const lost = Math.max(before.height, ...watch.samples.map(each => each.content)) - after.height;
    expect(offsetFell, evidence).toBeGreaterThanOrEqual(-1);
    expect(offsetFell, evidence).toBeLessThanOrEqual(lost + 1);
  }
  // 3.
  for (const line of view.lines) {
    expect(line.expectedContentMove, `"${line.text}" changed its place in the page's structure. ${evidence}`).not.toBeNull();
    expect(Math.abs(line.contentMoved - line.expectedContentMove!), `"${line.text}" moved inside the content by ${line.contentMoved}, and the blocks above it explain ${line.expectedContentMove}. ${evidence}`).toBeLessThanOrEqual(1);
    expect(Math.abs((line.now - line.was) - (line.expectedContentMove! + offsetFell)), `"${line.text}" is not where the blocks above it and the offset put it. ${evidence}`).toBeLessThanOrEqual(1.5);
  }
  // 4.
  if (phase === "settled") {
    expect(clipped, `a line that was wholly in view is not wholly in view. ${evidence}`).toEqual([]);
  } else {
    const noticesGrew = view.noticesHeight - viewBefore.noticesHeight;
    for (const line of clipped) {
      const approvedShrink = noticesGrew > 0 && after.box < before.box && Math.abs(after.box - Math.max(SMALLEST_TRANSCRIPT, before.box - noticesGrew)) <= 1;
      const sameExtent = Math.abs(after.height - before.height) <= 1;
      const lowerEdgeOnly = line.now >= -0.5 && line.now + line.height > after.box && line.now + line.height <= before.box + 0.5;
      expect({ approvedShrink, sameExtent, lowerEdgeOnly }, `"${line.text}" was wholly in view and is not any more. ${evidence}`)
        .toEqual({ approvedShrink: true, sameExtent: true, lowerEdgeOnly: true });
    }
  }
  // 5.
  expect(view.scrollY, evidence).toBe(viewBefore.scrollY);
  expect(view.messageBoxTop - viewBefore.messageBoxTop, `the message box moved otherwise. ${evidence}`)
    .toBe((view.noticesHeight - viewBefore.noticesHeight) + (after.box - before.box));
  return record;
}

test("O19b step B: answering a change offer keeps ordinary Send scrolling for its follow-up message, when it starts and when its reply arrives; the page does not move", async ({ page }) => {
  let current = longOfferState("change");
  const requests: ExplorerConversationCommand[] = [];
  // The automatic Send's answer is held, to see the moment the Send starts.
  let releaseSend: () => void = () => {};
  const sendGate = new Promise<void>(resolve => { releaseSend = resolve; });
  let sendArrived: () => void = () => {};
  const sendStarted = new Promise<void>(resolve => { sendArrived = resolve; });
  await page.route("**/explorer/conversation/commands", async route => {
    const command = commandOf(route);
    requests.push(command);
    if (command.kind === "respond_waypoint_offer") {
      current = answered(current, "change", "right");
      return fulfill(route, success(current, stored("change", "right")));
    }
    if (command.kind !== "send") throw new Error("unexpected_command");
    sendArrived();
    await sendGate;
    current = afterSend(current, command.body, 3);
    return fulfill(route, success(current));
  });
  await open(page, () => current);
  await withoutScrollAnchoring(page);
  await expect(box(page, "change")).toBeVisible();
  const item = transcript(page).getByRole("listitem").nth(17);
  await readAboveTheEnd(page);
  const pageBefore = await measurePage(item);
  await button(box(page, "change"), "change", "right").evaluate(control => (control as HTMLButtonElement).click());
  await sendStarted;
  // The Send has started and its reply is awaited: the answer was accepted (its Saved line shows), the waiting
  // row is drawn, and the transcript went to its newest end, as for any Send. The page did not move.
  await expect(box(page, "change")).toContainText(SAVED_LINE.change);
  await expect(page.locator("[data-waiting-indicator]")).toBeVisible();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(18);
  await expect.poll(async () => { const now = await measureHistory(page); return now.range - now.top; }).toBeLessThanOrEqual(2);
  expect((await readWatch(page)).scrollWrites).toBeGreaterThan(0);
  expectPageDidNotMove(pageBefore, await measurePage(item), "while the follow-up Send waits");
  releaseSend();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(20);
  await expect(page.locator("[data-waiting-indicator]")).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({ kind: "send" });
  // The reply arrived: the transcript is at its newest end with it.
  const after = await measureHistory(page);
  expect(after.range - after.top, `not at the newest end: ${JSON.stringify(after)}`).toBeLessThanOrEqual(2);
  expectPageDidNotMove(pageBefore, await measurePage(item), "when settled");
});

// The answers that are not followed by a message, each from the reading position 160 px above the newest end with
// the browser's scroll anchoring off (the offset alone) and on (what the reader sees), and from the newest end
// with anchoring on (where the Explorer is when the offer has just arrived). Both projects.
const RESPONSE_ONLY = [
  { name: "a reached answer", kind: "reached", lost: false, heldBack: false },
  { name: "a change answer whose follow-up is held back (the conversation advanced after the press)", kind: "change", lost: false, heldBack: true },
  { name: "a reached answer that is lost and then retried", kind: "reached", lost: true, heldBack: false },
] as const;
const READING = [
  { anchoring: "off", above: 160 },
  { anchoring: "on", above: 160 },
  { anchoring: "on", above: 0 },
] as const;
for (const scenario of RESPONSE_ONLY) for (const reading of READING) {
  const where = reading.above === 0 ? "at the newest end" : `${reading.above} px above the newest end`;
  test(`O19b step B: ${scenario.name}, read ${where}, browser scroll anchoring ${reading.anchoring}: no scroll write, the reading position survives, the page does not move`, async ({ page }) => {
    const kind = scenario.kind;
    let current = longOfferState(kind);
    const requests: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      requests.push(command);
      if (command.kind !== "respond_waypoint_offer") throw new Error("unexpected_command");
      if (scenario.lost && requests.length === 1) {
        // The answer is saved and its response is lost.
        current = answered(current, kind, "right");
        return route.abort("failed");
      }
      if (!scenario.lost) {
        const saved = answered(current, kind, "right");
        // Held back: another change in another tab is saved before this answer's result is read, so the returned
        // state is two revisions on, with no new message, and the follow-up is skipped without a notice.
        current = scenario.heldBack ? { ...saved, revision: saved.revision + 1 } : saved;
      }
      return fulfill(route, success(current, stored(kind, "right")));
    });
    await open(page, () => current);
    if (reading.anchoring === "off") await withoutScrollAnchoring(page);
    await expect(box(page, kind)).toBeVisible();
    // Where the page opened, before the test moves the transcript: the message box wholly in the window and the
    // transcript at its newest end.
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    const opened = await measureHistory(page);
    expect(opened.range - opened.top, `not opened at the newest end: ${JSON.stringify(opened)}`).toBeLessThanOrEqual(2);
    const item = transcript(page).getByRole("listitem").nth(17);
    const records: TransitionRecord[] = [];
    const startHistory = await readAboveTheEnd(page, reading.above);
    expect(await rememberLines(page, "start")).toBeGreaterThan(0);
    const started = await readerView(page, "start", SAVED_LINE[kind]);
    // Moving the transcript did not move the page: the message box is still wholly in the window.
    expect(started.messageBoxInWindow, JSON.stringify(started)).toBe(true);
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    const pageStart = await measurePage(item);
    let before = startHistory;
    let viewBefore = started;
    let pageBefore = pageStart;
    let key = "start";
    await button(box(page, kind), kind, "right").evaluate(control => (control as HTMLButtonElement).click());
    if (scenario.lost) {
      await expect(retry(page)).toHaveCount(1);
      await expect(retry(page)).toBeVisible();
      await expect(statusLine(page)).toHaveText("");
      // The "could not confirm" alert stands above the conversation with its Retry button in view. On a window
      // with room the transcript becomes shorter by what the alert takes; on the phone the message box is lower
      // by it. Neither the transcript's scroll position nor the page's was written.
      const uncertain = await measureHistory(page);
      const uncertainView = await readerView(page, "start", SAVED_LINE[kind]);
      records.push(checkTransition({ moment: "while the answer is unconfirmed", phase: "unconfirmed", anchoring: reading.anchoring, before,
        after: uncertain, watch: await readWatch(page), viewBefore, view: uncertainView }));
      expectPageDidNotMove(pageBefore, await measurePage(item), "while the answer is unconfirmed");
      expect(uncertainView.noticesHeight).toBeGreaterThan(viewBefore.noticesHeight);
      expect(uncertainView.lines.length, JSON.stringify(uncertainView)).toBeGreaterThan(0);
      await expect(retry(page)).toBeInViewport({ ratio: 0.99 });
      // The second transition starts from here, with its own snapshot; the first snapshot is kept.
      before = uncertain;
      key = "unconfirmed";
      await watchHistory(page);
      expect(await rememberLines(page, key)).toBeGreaterThan(0);
      viewBefore = await readerView(page, key, SAVED_LINE[kind]);
      pageBefore = await measurePage(item);
      await retry(page).evaluate(control => (control as HTMLButtonElement).click());
    }
    // Accepted: the Saved line shows; settled, with no message requested or in flight.
    await expect(box(page, kind)).toContainText(SAVED_LINE[kind]);
    await expectSettledWithoutSend(page, requests.filter(command => command.kind === "send"));
    expect(requests).toHaveLength(scenario.lost ? 2 : 1);
    await expect(page.locator("[data-waiting-indicator]")).toHaveCount(0);
    await expect(transcript(page).getByRole("listitem")).toHaveCount(18);
    if (kind === "change") await expect(transcript(page)).not.toContainText(`That's right: "${TITLE}"`);
    const after = await measureHistory(page);
    const view = await readerView(page, key, SAVED_LINE[kind]);
    records.push(checkTransition({ moment: scenario.lost ? "after the Retry" : "after the Saved line", phase: "settled", anchoring: reading.anchoring,
      before, after, watch: await readWatch(page), viewBefore, view }));
    expectPageDidNotMove(pageBefore, await measurePage(item), "when settled");
    expectPageDidNotMove(pageStart, await measurePage(item), "from the start to settled");
    // Against the first snapshot (the Retry path keeps it): every line that was wholly in view at the start and
    // still exists is wholly in view, without exception.
    const fromStart = await readerView(page, "start", SAVED_LINE[kind]);
    const report = JSON.stringify({ project: test.info().project.name, scenario: scenario.name, read: where, records,
      fromStart: { lines: fromStart.lines.length, gone: fromStart.gone, notWhole: fromStart.lines.filter(line => !line.whole).map(line => line.text) } });
    test.info().annotations.push({ type: "O19b transition records", description: report });
    console.log(`[O19b record] ${report}`);
    expect(fromStart.lines.filter(line => !line.whole), report).toEqual([]);
    // REV494e finding 2: against the first snapshot, each surviving line also moved inside the content only by
    // what the blocks above it explain, so a line clipped while the answer was unconfirmed is checked too.
    for (const line of fromStart.lines) {
      expect(line.expectedContentMove, `"${line.text}" changed its place in the page's structure since the start. ${report}`).not.toBeNull();
      expect(Math.abs(line.contentMoved - line.expectedContentMove!), `"${line.text}" moved inside the content by ${line.contentMoved} since the start, and the blocks above it explain ${line.expectedContentMove}. ${report}`).toBeLessThanOrEqual(1);
    }
    // A Reached answer leaves lines of the offer standing, so there is text to judge by; only the held-back change
    // read at the newest end can have had nothing in view but what went with the answer.
    if (kind === "reached") expect(fromStart.lines.length, report).toBeGreaterThan(0);
    // Settled: the page and the message box are exactly where they were at the start, and the message box is
    // wholly in the window, in every case.
    expect(view.scrollY, report).toBe(started.scrollY);
    expect(view.messageBoxTop, report).toBe(started.messageBoxTop);
    expect(view.messageBoxInWindow, report).toBe(true);
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    // The confirmation: when the Explorer had the answer buttons wholly in view, the Saved line is wholly in view.
    expect(view.savedLineWhole, report).not.toBeNull();
    if (started.answerWasWhole) expect(view.savedLineWhole, report).toBe(true);
    // At the newest end, where the Explorer is when an offer has just arrived, the buttons were in view, so the
    // Saved line must be.
    if (reading.above === 0) {
      expect(started.answerWasWhole, report).toBe(true);
      expect(view.savedLineWhole, report).toBe(true);
    }
  });
}

// REV488b finding 3 (2026-11-16 night): the invitation of decision 1 follows the composer as the owner derives it.
test.describe("O20 a changed Waypoint's invitation follows the composer", () => {
  const changedOffer = () => offer("change", { targetCurrent: false, typedAnswerEligible: false });
  const expectInvitation = async (page: Page, shown: boolean) => {
    const offerBox = box(page, "change");
    await expect(offerBox.getByText(TARGET_CHANGED_REASON("change"), { exact: true })).toHaveCount(1);
    await expect(offerBox.getByText(TARGET_CHANGED_DISCUSS, { exact: true })).toHaveCount(shown ? 1 : 0);
    if (shown) await expect(composer(page)).toBeEnabled();
    else await expect(composer(page)).toBeDisabled();
  };
  test("shown while a message can be sent", async ({ page }) => {
    await page.route("**/explorer/conversation/commands", route => route.abort());
    await open(page, () => savedState("change", { waypointOffer: changedOffer() }));
    await expectInvitation(page, true);
  });
  test("hidden while the last message has no confirmed result (a pending turn)", async ({ page }) => {
    await page.route("**/explorer/conversation/commands", route => route.abort());
    await open(page, () => savedState("change", { pendingTurn: true, waypointOffer: changedOffer() }));
    await expectInvitation(page, false);
  });
  test("hidden while the Virtual Guide is unavailable", async ({ page }) => {
    await page.route("**/explorer/conversation/commands", route => route.abort());
    await open(page, () => savedState("change", { providerState: "unavailable", waypointOffer: changedOffer() }));
    await expectInvitation(page, false);
  });
  test("hidden while a Send is uncertain, shown again once its Retry is confirmed", async ({ page }) => {
    let current = savedState("change", { waypointOffer: changedOffer() });
    let sends = 0;
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      if (command.kind !== "send") throw new Error("unexpected_command");
      sends += 1;
      if (sends === 1) return route.abort("failed");
      current = afterSend(current, command.body, 3);
      return fulfill(route, success(current));
    });
    await open(page, () => current);
    await expectInvitation(page, true);
    await composer(page).fill("A synthetic message for this test.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(retry(page)).toBeVisible();
    await expect(box(page, "change").getByText(TARGET_CHANGED_DISCUSS, { exact: true })).toHaveCount(0);
    await retry(page).click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
    await expectInvitation(page, true);
  });
});

// REV488b finding 3: the settled status line after a Retry, in the page's live region, with distinct titles.
const NEWER_TITLE = "A newer synthetic title";
const EARLIER_SAVED = {
  change: 'Your earlier answer to change "Walk each morning" was saved.',
  revisit: 'Your earlier answer to take up "Walk each morning" again was saved.',
  reached: 'Your earlier answer to mark "Walk each morning" Reached was saved.',
} as const;
for (const kind of ["revisit", "reached"] as const) {
  test(`O21 a lost yes to a ${kind} offer, then a newer offer with another title, then Retry: the status line names the earlier answer`, async ({ page }) => {
    let current = savedState(kind);
    let answers = 0;
    const sends: ExplorerConversationCommand[] = [];
    await page.route("**/explorer/conversation/commands", route => {
      const command = commandOf(route);
      if (command.kind !== "respond_waypoint_offer") { sends.push(command); return route.abort("failed"); }
      answers += 1;
      if (answers === 1) {
        const saved = answered(current, kind, "right");
        const later = afterSend(saved, "A synthetic message from another tab.", 3, "A synthetic reply that carries a newer offer.");
        current = { ...later, revision: later.revision + 1, waypointOffer: offer(kind, { id: OTHER_OFFER, waypointId: NEXT_WAYPOINT,
          ...(kind === "reached" ? {} : { title: NEWER_TITLE }), suggestionMessageId: later.messages.at(-1)!.id,
          targetBefore: { title: NEWER_TITLE, destination: SAVED.destination, whyItMatters: SAVED.meaning,
            arrivalSignal: SAVED.arrivalSignal, stage: kind === "revisit" ? "reached" : "formed" } }) };
        return route.abort("failed");
      }
      return fulfill(route, success(current, stored(kind, "right")));
    });
    await open(page, () => current);
    await button(box(page, kind), kind, "right").click();
    await retry(page).click();
    await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
    await expect(statusLine(page)).toHaveText(`${UP_TO_DATE} ${EARLIER_SAVED[kind]}`);
    await expect(box(page, kind)).toContainText(NEWER_TITLE);
    await expect(box(page, kind)).not.toContainText("Saved.");
    expect(sends).toHaveLength(0);
  });
}
test("O21 a lost yes to a change offer, a Retry that shows the confirmed box, and a follow-up whose reply brings a newer offer: the status line names the earlier answer", async ({ page }) => {
  let current = savedState("change");
  let answers = 0;
  const sends: ExplorerConversationCommand[] = [];
  await page.route("**/explorer/conversation/commands", route => {
    const command = commandOf(route);
    if (command.kind === "send") {
      sends.push(command);
      const later = afterSend(current, command.body, 3, "A synthetic reply that carries a newer offer.");
      current = { ...later, waypointOffer: offer("change", { id: OTHER_OFFER, waypointId: NEXT_WAYPOINT, title: NEWER_TITLE,
        suggestionMessageId: later.messages.at(-1)!.id,
        targetBefore: { title: NEWER_TITLE, destination: NEW_DESTINATION, whyItMatters: SAVED.meaning,
          arrivalSignal: SAVED.arrivalSignal, stage: "formed" } }) };
      return fulfill(route, success(current));
    }
    answers += 1;
    if (answers === 1) {
      current = answered(current, "change", "right");
      return route.abort("failed");
    }
    return fulfill(route, success(current, stored("change", "right")));
  });
  await open(page, () => current);
  await button(box(page, "change"), "change", "right").click();
  await retry(page).click();
  await expect(transcript(page).getByRole("listitem")).toHaveCount(4);
  expect(sends).toHaveLength(1);
  expect(sends[0]).toMatchObject({ kind: "send", body: `That's right: "${TITLE}"` });
  await expect(statusLine(page)).toHaveText(`${UP_TO_DATE} ${EARLIER_SAVED.change}`);
  await expect(box(page, "change")).toContainText(NEWER_TITLE);
  await expect(box(page, "change")).not.toContainText("Saved.");
});
