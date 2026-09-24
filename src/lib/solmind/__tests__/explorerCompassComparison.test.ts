import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ACTIVE_PRIMARY_DESTINATION,
  ASSIGNED_GUIDE_NAME,
  COMPACT_RECENT_ORIENTATION_LIMIT,
  COMPOSER_MESSAGE_MAX_LENGTH,
  CONVERSATION_SHARING_EXPLANATION,
  CONVERSATION_SPACES,
  FOLLOW_UP_CHOICES,
  EXPLORE_NEXT_DIRECTION_DRAFT,
  GUIDE_CONVERSATIONS_DESTINATION,
  JOURNEY_HEADING_ID,
  JOURNEY_TITLE,
  NOT_CONNECTED_DESTINATIONS,
  NOT_CONNECTED_LABEL,
  OPENING_SOMETHING_ELSE_CHOICE,
  OPENING_TOPIC_CHOICES,
  PRIMARY_NAVIGATION,
  PROTOTYPE_DISCLOSURE,
  PROTOTYPE_FOOTNOTE,
  RESET_CONFIRMATION_COPY,
  RESET_FOCUS_TARGET_ID,
  SCRIPTED_REPLIES,
  SOLMIND_LOGO_SRC,
  SUPPORTING_QUOTATIONS,
  VIRTUAL_GUIDE_NAME_MAX_LENGTH,
  WAYPOINT_DETAILS,
  WAYPOINT_SHARING_EXPLANATION,
  activateConversationSpace,
  activatePrimaryNavigation,
  answerDetailVerification,
  closeNavigationMenu,
  closePrototypeDialog,
  closeSupportDrawer,
  confirmPriorityChange,
  confirmPrototypeReset,
  confirmStartNewConversation,
  confirmWaypointReached,
  createInitialExplorerConversationState,
  declinePriorityChange,
  exploreNextDirection,
  finishKeepingWaypointForming,
  getActivityPlacement,
  getCompactOrientations,
  getCompassLayout,
  getJourneyStatusLabel,
  getJourneySummary,
  getOpenVerificationTurn,
  getPriorityDisplay,
  getQuotationSharingExplanation,
  getQuotationReturnFocusTargetId,
  getQuotationSourceFocusTargetId,
  getSupportPanelToggle,
  getVirtualGuidePrimaryLabel,
  getVirtualGuideTurnLabel,
  getWaypointCounts,
  goToOpenVerification,
  openAboutPrototype,
  openConversationSharingInfo,
  openFinishReview,
  openJourneyFromConversations,
  openNotConnectedDestination,
  openQuotationSharingInfo,
  openVirtualGuideRename,
  openWaypointSharingInfo,
  pauseJourney,
  quotationElementId,
  requestPriorityChange,
  requestPrototypeReset,
  resumeJourney,
  returnToConversationFromReview,
  returnToConversationsFromSummary,
  returnToSupportingQuotation,
  saveVirtualGuideRename,
  selectCompassPath,
  selectConversationChoice,
  selectSupportingQuotation,
  setQuotationListOpen,
  requestNewConversation,
  startDetailVerification,
  submitComposerMessage,
  toggleCompassView,
  toggleNavigationMenu,
  toggleSupportPanel,
  turnElementId,
  updateComposerDraft,
  updateVirtualGuideRenameDraft,
  validateComposerMessage,
  type ExplorerConversationState,
  type PrototypeExplanation,
} from "../explorerCompassComparison";

function initial(): ExplorerConversationState {
  return createInitialExplorerConversationState();
}

function sendMessage(
  state: ExplorerConversationState,
  text: string,
): ExplorerConversationState {
  return submitComposerMessage(updateComposerDraft(state, text));
}

function reachedJourney(): ExplorerConversationState {
  return confirmWaypointReached(openFinishReview(initial()));
}

function openEndedConversation(
  state: ExplorerConversationState = initial(),
): ExplorerConversationState {
  return confirmStartNewConversation(requestNewConversation(state));
}

function explanationText(explanation: PrototypeExplanation): string {
  return explanation.statements.map((statement) => statement.text).join(" ");
}

function openQuestionTurnId(state: ExplorerConversationState): string {
  const turn = getOpenVerificationTurn(state);

  if (!turn) {
    throw new Error("Expected an open conversation question.");
  }

  return turn.id;
}

const sources = [
  "../explorerCompassComparison.ts",
  "../../../components/solmind/ExplorerCompassComparison.tsx",
  "../../../components/solmind/ExplorerCompassComparisonParts.tsx",
  "../../../app/explorer/compass-comparison/page.tsx",
].map((relativePath) => ({
  relativePath,
  source: readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
}));

const [domainSource, componentSource, partsSource] = sources.map(
  (entry) => entry.source,
);

describe("Explorer conversation, Compass, and Waypoint prototype", () => {
  describe("Explorer shell and terminology", () => {
    it("keeps Overview, Conversations, Waypoints, and Settings with Conversations active", () => {
      expect(PRIMARY_NAVIGATION.map((item) => item.label)).toEqual([
        "Overview",
        "Conversations",
        "Waypoints",
        "Settings",
      ]);
      expect(ACTIVE_PRIMARY_DESTINATION).toBe("conversations");
      expect(
        PRIMARY_NAVIGATION.filter((item) => item.connection === "local").map(
          (item) => item.id,
        ),
      ).toEqual(["conversations"]);
    });

    it("distinguishes Virtual Guide conversations from direct human Guide conversations", () => {
      const [virtualGuide, guide] = CONVERSATION_SPACES;

      expect(CONVERSATION_SPACES).toHaveLength(2);
      expect(virtualGuide).toMatchObject({ id: "virtualGuide", connection: "local" });
      expect(virtualGuide.label).toContain("Virtual Guide");
      expect(guide).toMatchObject({ id: "guide", connection: "notConnected" });
      expect(guide.label).toContain(`${ASSIGNED_GUIDE_NAME}, your Guide`);
    });

    it("labels the Virtual Guide by name in the identity area and in turns", () => {
      expect(getVirtualGuidePrimaryLabel("Mary")).toBe("Mary (SolMind Virtual Guide)");
      expect(getVirtualGuideTurnLabel("Mary")).toBe("Mary (Virtual Guide)");
      expect(getVirtualGuidePrimaryLabel("")).toBe("SolMind Virtual Guide");
      expect(getVirtualGuideTurnLabel("   ")).toBe("SolMind Virtual Guide");
      expect(JOURNEY_TITLE).toBe("Today's Reflection Journey");
    });

    it("uses Explorer and Guide terminology, never Client or coach", () => {
      for (const { relativePath, source } of sources) {
        const text = source.replace(/["']use client["'];?/g, "");

        expect(/\bclients?\b/i.test(text), relativePath).toBe(false);
        expect(/\bcoach(es|ing)?\b/i.test(text), relativePath).toBe(false);
      }
    });
  });

  describe("initial conversation-first state", () => {
    it("gives the scrollable conversation substantially more space than the summary", () => {
      expect(componentSource).toContain(
        "h-[60vh] min-h-[32rem] max-h-[52rem] overflow-y-auto",
      );
      expect(componentSource).toContain("lg:h-[clamp(36rem,65vh,52rem)]");
      expect(componentSource).not.toContain("lg:max-h-[58%]");
      expect(componentSource).not.toContain("lg:h-dvh lg:overflow-hidden");
      expect(partsSource).toContain(
        'font-serif text-2xl leading-tight text-stone-50 sm:text-3xl',
      );
    });

    it("opens the journey conversation with the full Compass and Waypoint panel", () => {
      const state = initial();

      expect(state).toMatchObject({
        view: "journey",
        phase: "active",
        outcome: null,
        conversationVisibility: "private",
        waypointVisibility: "private",
        compassView: "full",
        navigationMenuOpen: false,
        dialog: null,
        composerDraft: "",
        composerError: null,
        selectedChoiceId: null,
        sourceHighlight: null,
        supportPanel: { wideVisible: true, narrowOpen: false },
      });
      expect(getActivityPlacement(state, "wide")).toBe("journey");
      expect(getActivityPlacement(state, "narrow")).toBe("journey");
    });

    it("starts with a journey-aware opening turn followed by fixed scenario turns", () => {
      const state = initial();
      const [opening] = state.turns;

      expect(state.turns).toHaveLength(8);
      expect(opening).toMatchObject({
        id: "turn-1",
        speaker: "virtualGuide",
        offersOpeningChoices: true,
      });
      expect(opening.body).toContain("today's reflection journey");
      expect(getOpenVerificationTurn(state)).toMatchObject({
        id: "turn-8",
        verification: { detailId: "evidence-name-need", mode: "capture", answer: null },
      });
    });

    it("keeps attention, Priority, history, and Waypoint distinct", () => {
      const state = initial();

      expect(state.attentionPathId).toBe("timing");
      expect(state.priorityPathId).toBe("understand-need");
      expect(state.pendingPriorityPathId).toBeNull();
      expect(state.orientationHistory.length).toBeGreaterThan(
        COMPACT_RECENT_ORIENTATION_LIMIT,
      );
      expect(state.waypointStatus).toBe("forming");
      expect(getWaypointCounts(state)).toEqual({
        keyInsights: 1,
        capturedDetails: 1,
        formingDetails: 1,
      });
      expect(WAYPOINT_DETAILS.some((detail) => detail.kind === "keyInsight")).toBe(true);
    });

    it("creates equal, deeply frozen initial states on every call", () => {
      const first = initial();
      const second = initial();

      expect(first).toEqual(second);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.turns)).toBe(true);
      expect(Object.isFrozen(first.turns[0])).toBe(true);
      expect(Object.isFrozen(first.detailStates)).toBe(true);
      expect(Object.isFrozen(first.supportPanel)).toBe(true);
    });
  });

  describe("starting topics", () => {
    it("offers five useful topics and a distinct final something-else choice", () => {
      expect(OPENING_TOPIC_CHOICES).toHaveLength(5);
      expect(OPENING_TOPIC_CHOICES.filter((choice) => choice.tag === "Recommended")).toHaveLength(1);
      expect(OPENING_TOPIC_CHOICES.filter((choice) => choice.tag === "From earlier")).toHaveLength(1);
      expect(OPENING_TOPIC_CHOICES.filter((choice) => choice.group === "new")).toHaveLength(3);
      expect(OPENING_SOMETHING_ELSE_CHOICE).toMatchObject({
        group: "somethingElse",
        topic: null,
      });
      expect(OPENING_TOPIC_CHOICES.map((choice) => choice.id)).not.toContain(
        OPENING_SOMETHING_ELSE_CHOICE.id,
      );
    });

    it("prepares an editable message without sending anything", () => {
      const state = initial();
      const next = selectConversationChoice(state, "difficult-conversation");

      expect(next.composerDraft).toBe(
        "I'd like to talk about preparing for the difficult conversation.",
      );
      expect(next.selectedChoiceId).toBe("difficult-conversation");
      expect(next.turns).toEqual(state.turns);
    });

    it("clears the composer and changes the prompt for something else", () => {
      const prepared = selectConversationChoice(initial(), "decision");
      const next = selectConversationChoice(prepared, "opening-something-else");

      expect(next.composerDraft).toBe("");
      expect(next.composerPrompt).toBe("somethingElse");
      expect(next.selectedChoiceId).toBe("opening-something-else");
    });

    it("offers follow-up choices only after a detail is captured in the conversation", () => {
      const state = initial();

      expect(selectConversationChoice(state, FOLLOW_UP_CHOICES[0].id)).toBe(state);

      const captured = answerDetailVerification(state, openQuestionTurnId(state), "yes");
      const next = selectConversationChoice(captured, "follow-up-timing");

      expect(next.composerDraft).toBe(
        "I'd like to talk about when to have the conversation.",
      );
    });

    it("ignores topic choices while the journey is paused", () => {
      const paused = pauseJourney(initial());

      expect(selectConversationChoice(paused, "relationship")).toBe(paused);
    });
  });

  describe("fixed local conversation", () => {
    it("validates blank, whitespace-only, and overlong messages", () => {
      const atLimit = "a".repeat(COMPOSER_MESSAGE_MAX_LENGTH);

      expect(validateComposerMessage("")).toEqual({ ok: false, reason: "blank" });
      expect(validateComposerMessage("  \n\t ")).toEqual({ ok: false, reason: "blank" });
      expect(validateComposerMessage(atLimit)).toEqual({ ok: true, text: atLimit });
      expect(validateComposerMessage(`${atLimit}a`)).toEqual({
        ok: false,
        reason: "tooLong",
      });
    });

    it("shows a composer error without adding turns, and clears it when typing", () => {
      const state = initial();
      const blank = submitComposerMessage(state);

      expect(blank.composerError).toBe("blank");
      expect(blank.turns).toEqual(state.turns);
      expect(submitComposerMessage(blank)).toBe(blank);
      expect(updateComposerDraft(blank, "Hello").composerError).toBeNull();
    });

    it("adds the trimmed Explorer message and one fixed reply that ignores the wording", () => {
      const state = initial();
      const first = sendMessage(state, "  I feel unsure.  ");
      const second = sendMessage(state, "Completely different words");
      const explorerTurn = first.turns[state.turns.length];
      const replyTurn = first.turns[state.turns.length + 1];

      expect(first.turns).toHaveLength(state.turns.length + 2);
      expect(explorerTurn).toMatchObject({
        id: "turn-9",
        speaker: "explorer",
        origin: "explorerMessage",
        body: "I feel unsure.",
      });
      expect(replyTurn).toMatchObject({
        id: "turn-10",
        speaker: "virtualGuide",
        origin: "scriptedReply",
        body: SCRIPTED_REPLIES[0],
      });
      expect(second.turns[state.turns.length + 1].body).toBe(replyTurn.body);
      expect(replyTurn.body).not.toContain("unsure");
      expect(first.composerDraft).toBe("");
      expect(sendMessage(state, "  I feel unsure.  ")).toEqual(first);
    });

    it("rotates the fixed replies and never changes the Compass or Waypoint", () => {
      let state = initial();

      for (let index = 0; index < SCRIPTED_REPLIES.length + 1; index += 1) {
        state = sendMessage(state, `Message ${index}`);
        expect(state.turns[state.turns.length - 1].body).toBe(
          SCRIPTED_REPLIES[index % SCRIPTED_REPLIES.length],
        );
      }

      expect(state.attentionPathId).toBe(initial().attentionPathId);
      expect(state.priorityPathId).toBe(initial().priorityPathId);
      expect(state.detailStates).toEqual(initial().detailStates);
      expect(state.waypointStatus).toBe("forming");
    });
  });

  describe("conversation-mediated Waypoint details", () => {
    it("captures a detail only after the Explorer confirms it in the conversation", () => {
      const state = initial();
      const turnId = openQuestionTurnId(state);
      const captured = answerDetailVerification(state, turnId, "yes");
      const answered = captured.turns.find((turn) => turn.id === turnId);
      const reply = captured.turns[captured.turns.length - 1];

      expect(captured.detailStates["evidence-name-need"]).toBe("captured");
      expect(answered?.verification?.answer).toBe("yes");
      expect(reply).toMatchObject({
        speaker: "virtualGuide",
        origin: "verificationReply",
        offersFollowUpChoices: true,
      });
      expect(getWaypointCounts(captured)).toEqual({
        keyInsights: 1,
        capturedDetails: 2,
        formingDetails: 0,
      });
      expect(getOpenVerificationTurn(captured)).toBeNull();
      expect(answerDetailVerification(captured, turnId, "no")).toBe(captured);
    });

    it("keeps a detail Forming when the Explorer says it is still forming", () => {
      const state = initial();
      const next = answerDetailVerification(state, openQuestionTurnId(state), "no");

      expect(next.detailStates["evidence-name-need"]).toBe("forming");
      expect(next.turns[next.turns.length - 1].offersFollowUpChoices).toBe(false);
      expect(answerDetailVerification(state, "turn-404", "yes")).toBe(state);
    });

    it("raises verification and reopening as questions inside the conversation", () => {
      const state = initial();

      expect(startDetailVerification(state, "insight-clarity", "wide")).toBe(state);

      const answered = answerDetailVerification(state, openQuestionTurnId(state), "yes");
      const revisit = startDetailVerification(answered, "insight-clarity", "wide");
      const question = getOpenVerificationTurn(revisit);

      expect(question).toMatchObject({
        speaker: "virtualGuide",
        origin: "verificationPrompt",
        verification: { detailId: "insight-clarity", mode: "reopen", answer: null },
      });
      expect(revisit.detailStates["insight-clarity"]).toBe("captured");

      const reopened = answerDetailVerification(revisit, openQuestionTurnId(revisit), "yes");

      expect(reopened.detailStates["insight-clarity"]).toBe("forming");
    });

    it("closes the narrow drawer when a question moves into the conversation", () => {
      const answered = answerDetailVerification(
        initial(),
        openQuestionTurnId(initial()),
        "no",
      );
      const drawerOpen = toggleSupportPanel(answered, "narrow");
      const next = startDetailVerification(drawerOpen, "evidence-name-need", "narrow");

      expect(next.supportPanel.narrowOpen).toBe(false);
      expect(getOpenVerificationTurn(next)?.verification?.mode).toBe("capture");
    });

    it("navigates to an open question without changing wide state", () => {
      const state = initial();
      const drawerOpen = toggleSupportPanel(state, "narrow");

      expect(goToOpenVerification(state, "wide")).toBe(state);
      expect(goToOpenVerification(drawerOpen, "narrow").supportPanel.narrowOpen).toBe(false);
    });

    it("exposes no direct freeform Waypoint editing transition", () => {
      const exportedFunctions = [
        ...domainSource.matchAll(/export function (\w+)/g),
      ].map((match) => match[1]);

      expect(exportedFunctions.length).toBeGreaterThan(20);
      expect(
        exportedFunctions.filter((name) =>
          /updateWaypoint|editWaypoint|WaypointField|setDetailState|WaypointDraft/i.test(name),
        ),
      ).toEqual([]);
    });
  });

  describe("Compass: current attention versus confirmed Priority", () => {
    it("moves only current attention and records the prior orientation", () => {
      const state = initial();
      const moved = selectCompassPath(state, "afterward");

      expect(moved.attentionPathId).toBe("afterward");
      expect(moved.priorityPathId).toBe(state.priorityPathId);
      expect(moved.orientationHistory[0]).toBe(state.attentionPathId);
      expect(selectCompassPath(moved, "afterward")).toBe(moved);
    });

    it("changes Priority only after explicit confirmation", () => {
      const state = initial();
      const pending = requestPriorityChange(state);

      expect(pending.pendingPriorityPathId).toBe("timing");
      expect(pending.priorityPathId).toBe("understand-need");
      expect(declinePriorityChange(pending).priorityPathId).toBe("understand-need");
      expect(confirmPriorityChange(pending).priorityPathId).toBe("timing");
      expect(confirmPriorityChange(state)).toBe(state);
    });

    it("closes an open Priority question without a change when attention moves", () => {
      const moved = selectCompassPath(requestPriorityChange(initial()), "avoiding-conflict");

      expect(moved.pendingPriorityPathId).toBeNull();
      expect(moved.priorityPathId).toBe("understand-need");
    });

    it("does not ask to confirm a path that is already the Priority", () => {
      const onPriority = selectCompassPath(initial(), "understand-need");

      expect(requestPriorityChange(onPriority)).toBe(onPriority);
    });

    it("keeps the Priority in the upper zone of a fixed frame", () => {
      const confirmed = confirmPriorityChange(requestPriorityChange(initial()));
      const zones = Object.fromEntries(
        getCompassLayout(confirmed).map((item) => [item.path.id, item.zone]),
      );

      expect(getCompassLayout(initial()).find((item) => item.isPriority)?.zone).toBe(
        "priority",
      );
      expect(zones).toEqual({
        timing: "priority",
        "understand-need": "detourRight",
        "avoiding-conflict": "detourLeft",
        afterward: "excursion",
      });
    });

    it("shows the current orientation, up to three recent orientations, and a more-history count", () => {
      const compact = getCompactOrientations(initial());

      expect(compact.current.id).toBe("timing");
      expect(compact.recent.map((path) => path.id)).toEqual([
        "understand-need",
        "afterward",
        "avoiding-conflict",
      ]);
      expect(compact.moreCount).toBe(1);

      const moved = getCompactOrientations(selectCompassPath(initial(), "afterward"));

      expect(moved.recent).toHaveLength(COMPACT_RECENT_ORIENTATION_LIMIT);
      expect(moved.moreCount).toBe(2);
    });

    it("switches between full and compact Compass views", () => {
      const compact = toggleCompassView(initial());

      expect(compact.compassView).toBe("compact");
      expect(toggleCompassView(compact).compassView).toBe("full");
    });

    it("ignores Compass changes while the journey is not active", () => {
      const paused = pauseJourney(initial());

      expect(selectCompassPath(paused, "afterward")).toBe(paused);
      expect(requestPriorityChange(paused)).toBe(paused);
    });
  });

  describe("panel, drawer, menu, and single activity message", () => {
    it("hides and restores the whole panel with one wide-layout control", () => {
      const state = initial();
      const hidden = toggleSupportPanel(state, "wide");

      expect(getSupportPanelToggle(state, "wide")).toEqual({
        expanded: true,
        label: "Hide Compass & Waypoint",
      });
      expect(hidden.supportPanel).toEqual({ wideVisible: false, narrowOpen: false });
      expect(getSupportPanelToggle(hidden, "wide").label).toBe("Show Compass & Waypoint");
      expect(toggleSupportPanel(hidden, "wide").supportPanel.wideVisible).toBe(true);
    });

    it("uses one drawer on narrow screens without changing the wide panel", () => {
      const state = initial();
      const open = toggleSupportPanel(state, "narrow");

      expect(getSupportPanelToggle(state, "narrow")).toEqual({
        expanded: false,
        label: "Show Compass & Waypoint",
      });
      expect(open.supportPanel).toEqual({ wideVisible: true, narrowOpen: true });
      expect(getSupportPanelToggle(open, "narrow").label).toBe("Close Compass & Waypoint");
      expect(closeSupportDrawer(open).supportPanel.narrowOpen).toBe(false);
      expect(closeSupportDrawer(state)).toBe(state);
    });

    it("places the current activity message in exactly one location", () => {
      const state = initial();
      const drawerOpen = toggleSupportPanel(state, "narrow");
      const conversations = activatePrimaryNavigation(state, "conversations");

      expect(getActivityPlacement(drawerOpen, "narrow")).toBe("drawer");
      expect(getActivityPlacement(drawerOpen, "wide")).toBe("journey");
      expect(getActivityPlacement(conversations, "narrow")).toBe("conversations");
      expect(componentSource).toContain('activityPlacement === "journey"');
      expect(componentSource).toContain('activityPlacement === "drawer"');
      expect(componentSource).toContain('activityPlacement === "conversations"');
      expect(componentSource).toContain("showActivity={false}");
    });

    it("opens and closes the labeled narrow navigation menu", () => {
      const open = toggleNavigationMenu(initial());

      expect(open.navigationMenuOpen).toBe(true);
      expect(closeNavigationMenu(open).navigationMenuOpen).toBe(false);
      expect(activatePrimaryNavigation(open, "conversations").navigationMenuOpen).toBe(false);

      // A disclosure opened from the menu keeps the menu so focus can return.
      const disclosure = activatePrimaryNavigation(open, "settings");

      expect(disclosure.navigationMenuOpen).toBe(true);
      expect(disclosure.dialog).toEqual({ kind: "notConnected", destination: "settings" });
    });
  });

  describe("supporting quotation source navigation", () => {
    it("keeps every quotation an exact excerpt of an existing source turn", () => {
      const state = initial();

      for (const quotation of SUPPORTING_QUOTATIONS) {
        const turn = state.turns.find((candidate) => candidate.id === quotation.turnId);

        expect(turn, quotation.id).toBeDefined();
        expect(turn?.body, quotation.id).toContain(quotation.text);
      }

      for (const detail of WAYPOINT_DETAILS) {
        expect(
          SUPPORTING_QUOTATIONS.some(
            (quotation) => quotation.detailId === detail.id && quotation.status === "current",
          ),
          detail.id,
        ).toBe(true);
      }

      expect(SUPPORTING_QUOTATIONS.some((quotation) => quotation.status === "superseded")).toBe(true);
    });

    it("highlights the source turn and targets it for focus", () => {
      const state = initial();
      const next = selectSupportingQuotation(state, "quote-name-need", "wide");

      expect(next.sourceHighlight).toEqual({
        turnId: "turn-6",
        quotationId: "quote-name-need",
      });
      expect(next.openQuotationDetailIds).toContain("evidence-name-need");
      expect(getQuotationSourceFocusTargetId(next)).toBe(turnElementId("turn-6"));
      expect(next.supportPanel).toEqual(state.supportPanel);
      expect(getQuotationSourceFocusTargetId(state)).toBeNull();
    });

    it("closes the narrow drawer and provides a path back to the quotation", () => {
      const drawerOpen = toggleSupportPanel(initial(), "narrow");
      const selected = selectSupportingQuotation(drawerOpen, "quote-describe-current", "narrow");
      const collapsed = setQuotationListOpen(selected, "evidence-describe-need", false);
      const returned = returnToSupportingQuotation(collapsed, "narrow");

      expect(selected.supportPanel.narrowOpen).toBe(false);
      expect(returned.supportPanel.narrowOpen).toBe(true);
      expect(returned.openQuotationDetailIds).toContain("evidence-describe-need");
      expect(getQuotationReturnFocusTargetId(returned)).toBe(
        quotationElementId("quote-describe-current"),
      );
    });

    it("restores a hidden wide panel when returning to a quotation", () => {
      const hidden = toggleSupportPanel(initial(), "wide");
      const selected = selectSupportingQuotation(hidden, "quote-clarity-explorer", "wide");

      expect(returnToSupportingQuotation(selected, "wide").supportPanel.wideVisible).toBe(true);
      expect(returnToSupportingQuotation(initial(), "wide")).toEqual(initial());
    });

    it("identifies a superseded quotation as history, not the current basis", () => {
      const next = selectSupportingQuotation(initial(), "quote-describe-earlier", "wide");

      expect(next.activity).toContain("no longer the current basis");
      expect(next.sourceHighlight?.turnId).toBe("turn-2");
    });
  });

  describe("Pause, Finish & review, and the journey summary", () => {
    it("pauses in place, blocks changes, and resumes with the same content", () => {
      const state = requestPriorityChange(initial());
      const paused = pauseJourney(state);

      expect(paused.phase).toBe("paused");
      expect(paused.pendingPriorityPathId).toBeNull();
      expect(paused.activity).toContain("clears this prototype");
      expect(updateComposerDraft(paused, "Hello")).toBe(paused);
      expect(submitComposerMessage(paused)).toBe(paused);

      const resumed = resumeJourney(paused);

      expect(resumed.phase).toBe("active");
      expect(resumed.turns).toEqual(state.turns);
      expect(resumed.detailStates).toEqual(state.detailStates);
      expect(resumeJourney(resumed)).toBe(resumed);
    });

    it("opens review from active or paused and can return to the conversation", () => {
      const fromActive = openFinishReview(initial());
      const fromPaused = openFinishReview(pauseJourney(initial()));

      expect(fromActive.phase).toBe("reviewing");
      expect(fromPaused.phase).toBe("reviewing");
      expect(returnToConversationFromReview(fromActive).phase).toBe("active");
      expect(finishKeepingWaypointForming(initial())).toEqual(initial());
      expect(confirmWaypointReached(initial())).toEqual(initial());
    });

    it("finishes while the Waypoint keeps forming", () => {
      const finished = finishKeepingWaypointForming(openFinishReview(initial()));

      expect(finished).toMatchObject({
        phase: "finished",
        outcome: "keptForming",
        waypointStatus: "forming",
      });
      expect(getJourneySummary(finished)?.heading).toBe(
        "Journey finished - Waypoint still Forming",
      );
      expect(getJourneyStatusLabel(finished)).toBe("Finished - Waypoint still Forming");
    });

    it("confirms the Waypoint as Reached and uses Reached, not completed", () => {
      const reached = reachedJourney();
      const summary = getJourneySummary(reached);

      expect(reached).toMatchObject({
        phase: "finished",
        outcome: "reached",
        waypointStatus: "reached",
      });
      expect(summary?.heading).toBe("Waypoint Reached");
      expect(getJourneyStatusLabel(reached)).toBe("Finished - Waypoint Reached");
      expect(getJourneySummary(initial())).toBeNull();

      for (const { relativePath, source } of sources) {
        expect(/\bcompleted\b/i.test(source), relativePath).toBe(false);
      }
    });

    it("offers stable post-finish paths instead of a dead end", () => {
      const reached = reachedJourney();
      const conversations = returnToConversationsFromSummary(reached);
      const requested = requestNewConversation(reached);
      const another = confirmStartNewConversation(requested);

      expect(returnToConversationsFromSummary(initial())).toEqual(initial());
      expect(conversations.view).toBe("conversations");
      expect(openJourneyFromConversations(conversations).view).toBe("journey");
      expect(requested.dialog).toEqual({ kind: "newConversationConfirmation" });
      expect(another).toMatchObject({
        view: "journey",
        phase: "active",
        outcome: null,
        waypointStatus: "none",
        dialog: null,
      });
      expect(another.turns).toHaveLength(1);
      expect(another.turns[0]).toMatchObject({
        speaker: "virtualGuide",
        offersOpeningChoices: true,
      });
      expect(another.turns[0].body).toContain("without choosing a Waypoint");
      expect(getJourneyStatusLabel(another)).toBe("Active - no Waypoint chosen yet");
    });

    it("keeps a new conversation open-ended until the Explorer explicitly starts a Waypoint", () => {
      const open = openEndedConversation();
      const afterMessage = sendMessage(open, "I only want a quick check-in today.");

      expect(afterMessage.waypointStatus).toBe("none");
      expect(afterMessage.turns.at(-1)?.body).toContain(
        "without choosing a Waypoint",
      );
      expect(confirmWaypointReached(openFinishReview(afterMessage))).toEqual(
        openFinishReview(afterMessage),
      );
    });

    it("can finish an open conversation without manufacturing a Waypoint", () => {
      const open = openEndedConversation();
      const finished = finishKeepingWaypointForming(openFinishReview(open));

      expect(finished).toMatchObject({
        phase: "finished",
        outcome: "noWaypoint",
        waypointStatus: "none",
      });
      expect(getJourneyStatusLabel(finished)).toBe(
        "Finished - no Waypoint chosen",
      );
      expect(getJourneySummary(finished)).toMatchObject({
        heading: "Conversation finished without a Waypoint",
        countsLabel: "No Waypoint chosen",
      });
    });

    it("resets an open-ended conversation to the exact initial prototype state", () => {
      const open = openEndedConversation();
      const changed = sendMessage(open, "I want to reflect without setting a goal.");
      const reset = confirmPrototypeReset(requestPrototypeReset(changed));

      expect(reset).toEqual(initial());
    });

    it("does not replace a current conversation without explicit confirmation", () => {
      const state = initial();
      const requested = requestNewConversation(state);

      expect(requested.turns).toEqual(state.turns);
      expect(requested.dialog).toEqual({ kind: "newConversationConfirmation" });
      expect(confirmStartNewConversation(state)).toEqual(state);
      expect(closePrototypeDialog(requested)).toEqual(state);
    });

    it("starts with no confirmed Priority and no hidden Waypoint details", () => {
      const open = openEndedConversation();

      expect(open.priorityConfirmed).toBe(false);
      expect(getPriorityDisplay(open)).toEqual({
        confirmed: false,
        label: "No Priority confirmed",
      });
      expect(getCompassLayout(open).some((item) => item.isPriority)).toBe(false);
      expect(getWaypointCounts(open)).toEqual({
        keyInsights: 0,
        capturedDetails: 0,
        formingDetails: 0,
      });
      expect(openWaypointSharingInfo(open)).toEqual(open);
      expect(selectSupportingQuotation(open, "quote-clarity-guide", "wide")).toEqual(open);

      const requested = requestPriorityChange(open);
      expect(requested.pendingPriorityPathId).toBe(open.attentionPathId);
      const confirmed = confirmPriorityChange(requested);
      expect(confirmed.priorityConfirmed).toBe(true);
      expect(confirmed.activity).toContain("No Waypoint has been chosen");
      expect(confirmed.activity).not.toContain("Forming Waypoint");
    });
  });

  describe("honest navigation and destination disclosures", () => {
    it("opens a Not connected yet explanation for unbuilt primary destinations", () => {
      const state = initial();

      for (const item of PRIMARY_NAVIGATION.filter(
        (candidate) => candidate.connection === "notConnected",
      )) {
        const next = activatePrimaryNavigation(state, item.id);

        expect(next.dialog, item.id).toEqual({ kind: "notConnected", destination: item.id });
        expect(next.view, item.id).toBe("journey");
        expect(closePrototypeDialog(next), item.id).toEqual(state);
      }
    });

    it("moves locally to the Conversations list and back", () => {
      const conversations = activatePrimaryNavigation(initial(), "conversations");

      expect(conversations.view).toBe("conversations");
      expect(activateConversationSpace(conversations, "virtualGuide").view).toBe("journey");
    });

    it("sends the Guide space and the continuity banner to the same destination", () => {
      const state = initial();
      const fromSpace = activateConversationSpace(state, "guide");
      const fromBanner = openNotConnectedDestination(state, GUIDE_CONVERSATIONS_DESTINATION);

      expect(fromSpace.dialog).toEqual({
        kind: "notConnected",
        destination: "guideConversations",
      });
      expect(fromBanner).toEqual(fromSpace);
      expect(NOT_CONNECTED_DESTINATIONS.guideConversations.statements.join(" ")).toContain(
        "not reading it",
      );
    });

    it("labels every incomplete destination as Not connected yet", () => {
      for (const [destination, copy] of Object.entries(NOT_CONNECTED_DESTINATIONS)) {
        expect(copy.title, destination).toContain(NOT_CONNECTED_LABEL);
        expect(copy.statements.join(" ").toLowerCase(), destination).toContain(
          "not connected",
        );
      }
    });

    it("discloses the fixed-script prototype truthfully", () => {
      const disclosure = PROTOTYPE_DISCLOSURE.statements.join(" ");

      expect(openAboutPrototype(initial()).dialog).toEqual({ kind: "aboutPrototype" });
      expect(disclosure).toContain("fixed-script prototype");
      expect(disclosure).toContain("No AI model and no human Guide is responding");
      expect(disclosure).toContain("not a therapist or a crisis service");
      expect(disclosure).toMatch(/Refreshing the page .* clears everything/);
      expect(PROTOTYPE_FOOTNOTE).toContain("Refresh clears this screen");
    });
  });

  describe("reset", () => {
    it("requires confirmation and can be cancelled without change", () => {
      const state = sendMessage(initial(), "Hello");
      const confirming = requestPrototypeReset(state);

      expect(confirming.dialog).toEqual({ kind: "resetConfirmation" });
      expect(closePrototypeDialog(confirming)).toEqual(state);
      expect(confirmPrototypeReset(state)).toBe(state);
      expect(RESET_CONFIRMATION_COPY.statements.join(" ")).toContain("exact starting point");
    });

    it("restores the exact initial state and returns focus to the journey heading", () => {
      let state = initial();
      state = sendMessage(state, "Hello");
      state = answerDetailVerification(state, openQuestionTurnId(state), "yes");
      state = selectCompassPath(state, "afterward");
      state = confirmPriorityChange(requestPriorityChange(state));
      state = toggleCompassView(state);
      state = toggleSupportPanel(state, "wide");
      state = selectSupportingQuotation(state, "quote-clarity-guide", "wide");
      state = saveVirtualGuideRename(updateVirtualGuideRenameDraft(openVirtualGuideRename(state), "Nia"));
      state = confirmWaypointReached(openFinishReview(state));
      state = returnToConversationsFromSummary(state);

      expect(state).not.toEqual(initial());

      const reset = confirmPrototypeReset(requestPrototypeReset(state));

      expect(reset).toEqual(initial());
      expect(RESET_FOCUS_TARGET_ID).toBe(JOURNEY_HEADING_ID);
    });
  });

  describe("whole-conversation sharing explanation", () => {
    it("explains sharing without creating any shared state", () => {
      const state = initial();
      const open = openConversationSharingInfo(state);

      expect(open.dialog).toEqual({ kind: "conversationSharing" });
      expect(open.conversationVisibility).toBe("private");
      expect(open.waypointVisibility).toBe("private");
      expect(closePrototypeDialog(open)).toEqual(state);
    });

    it("covers the complete continuing-access rule", () => {
      const ids = CONVERSATION_SHARING_EXPLANATION.statements.map((statement) => statement.id);
      const text = explanationText(CONVERSATION_SHARING_EXPLANATION);

      expect(ids).toEqual([
        "notConnected",
        "wholeConversation",
        "existingAndFutureEntries",
        "immutableHistory",
        "continuesUntilEnded",
        "noAutomaticReturn",
        "revocationLimits",
        "separateFromWaypoints",
        "quotationsInsideConversation",
      ]);
      expect(text).toContain("nothing was saved or shared");
      expect(text).toContain("all or none");
      expect(text).toContain("every new entry added later");
      expect(text).toContain("cannot be edited or selectively removed");
      expect(text).toContain("until you revoke it or your relationship");
      expect(text).toContain("does not return on its own");
      expect(text).toMatch(/cannot erase what \w+ already saw/);
      expect(text).toContain("never shares a Waypoint as a separate item");
      expect(text).toContain("Waypoint sharing and quotation sharing each require their own explicit choice");
      expect(text).toContain("does not separately share, label, or link any quotation as Waypoint evidence");
    });

    it("excludes superseded snapshot, re-sharing, and irreversible language", () => {
      const text = explanationText(CONVERSATION_SHARING_EXPLANATION);

      expect(text).not.toMatch(/cannot be unshared/i);
      expect(text).not.toMatch(/snapshot/i);
      expect(text).not.toMatch(/share newer messages/i);
      expect(text).not.toMatch(/history returns/i);
      expect(text).not.toMatch(/per-message/i);

      for (const { relativePath, source } of sources) {
        expect(/cannot be unshared/i.test(source), relativePath).toBe(false);
        expect(/shared snapshot/i.test(source), relativePath).toBe(false);
        expect(/share newer messages/i.test(source), relativePath).toBe(false);
      }
    });

    it("keeps old per-detail share controls out of the Waypoint panel", () => {
      for (const { relativePath, source } of sources) {
        expect(/data-share-state/.test(source), relativePath).toBe(false);
        expect(/Share with Guide\b/.test(source), relativePath).toBe(false);
        expect(/selected for Guide review/i.test(source), relativePath).toBe(false);
        expect(/at final review/i.test(source), relativePath).toBe(false);
      }
    });
  });

  describe("separate Waypoint sharing explanation", () => {
    it("is unavailable until the Waypoint is Reached", () => {
      const state = initial();

      expect(openWaypointSharingInfo(state)).toBe(state);
    });

    it("explains that nothing was saved or shared and that sharing needs its own action", () => {
      const reached = reachedJourney();
      const open = openWaypointSharingInfo(reached);
      const text = explanationText(WAYPOINT_SHARING_EXPLANATION);

      expect(open.dialog).toEqual({ kind: "waypointSharing" });
      expect(open.waypointVisibility).toBe("private");
      expect(open.conversationVisibility).toBe("private");
      expect(closePrototypeDialog(open)).toEqual(reached);
      expect(text).toContain("No Waypoint was saved or shared");
      expect(text).toContain("separate, explicit action");
      expect(text).toContain(
        "Waypoint sharing, supporting-quotation sharing, and whole-conversation sharing are independent choices",
      );
      expect(text).toContain("Supporting quotations stay private");
      expect(text).toContain("does not grant access to the surrounding private conversation");
    });

    it("keeps the Reached-only sharing rule visible while the Waypoint is Forming", () => {
      expect(partsSource).toContain("Sharing unlocks when Reached");
      expect(partsSource).toContain(
        "Sharing becomes available after you confirm it as Reached.",
      );
      expect(partsSource).toContain("aria-disabled={!reached}");
      expect(partsSource).not.toMatch(/\sdisabled=\{!reached\}/);
    });
  });

  describe("separate exact-quotation sharing explanation", () => {
    it("previews the exact selected words without creating any shared state", () => {
      const state = initial();
      const quotationId = "quote-clarity-explorer";
      const quotation = SUPPORTING_QUOTATIONS.find(
        (candidate) => candidate.id === quotationId,
      );
      const open = openQuotationSharingInfo(state, quotationId);
      const explanation = getQuotationSharingExplanation(quotationId);
      const text = explanationText(explanation);

      expect(quotation).toBeDefined();
      expect(open.dialog).toEqual({ kind: "quotationSharing", quotationId });
      expect(open.waypointVisibility).toBe("private");
      expect(open.conversationVisibility).toBe("private");
      expect(closePrototypeDialog(open)).toEqual(state);
      expect(text).toContain(`\u201c${quotation?.text}\u201d`);
      expect(text).toContain("No quotation was saved or shared");
      expect(text).toContain("separate, explicit confirmation");
      expect(text).toContain(
        "Quotation sharing, Waypoint sharing, and whole-conversation sharing are independent choices",
      );
      expect(text).toContain("would not share its surrounding conversation");
      expect(text).toContain("or the Waypoint it supports");
    });

    it("renders a distinct quotation-sharing affordance", () => {
      expect(partsSource).toContain("Review sharing this quotation");
      expect(partsSource).toContain("Review sharing this exact quotation");
      expect(partsSource).toContain("onShareQuotation");
    });
  });

  describe("possible next direction", () => {
    it("prefills only a blank draft, closes the narrow drawer, and changes no journey facts", () => {
      const withDrawer = toggleSupportPanel(initial(), "narrow");
      const next = exploreNextDirection(withDrawer, "narrow");

      expect(next.composerDraft).toBe(EXPLORE_NEXT_DIRECTION_DRAFT);
      expect(next.selectedChoiceId).toBeNull();
      expect(next.supportPanel.narrowOpen).toBe(false);
      expect(next.activity).toContain("Nothing was sent");
      expect(next).toMatchObject({
        turns: withDrawer.turns,
        waypointStatus: withDrawer.waypointStatus,
        detailStates: withDrawer.detailStates,
        attentionPathId: withDrawer.attentionPathId,
        priorityPathId: withDrawer.priorityPathId,
        priorityConfirmed: withDrawer.priorityConfirmed,
        orientationHistory: withDrawer.orientationHistory,
        outcome: withDrawer.outcome,
      });
    });

    it("preserves an existing unsent draft and does nothing outside an active journey", () => {
      const draft = updateComposerDraft(initial(), "Please keep this exact draft.");
      const withDrawer = toggleSupportPanel(draft, "narrow");
      const next = exploreNextDirection(withDrawer, "narrow");

      expect(next.composerDraft).toBe("Please keep this exact draft.");
      expect(next.activity).toContain("unsent draft was kept");
      expect(exploreNextDirection(pauseJourney(draft), "wide")).toEqual(
        pauseJourney(draft),
      );
      expect(exploreNextDirection(openFinishReview(draft), "wide")).toEqual(
        openFinishReview(draft),
      );
      expect(
        exploreNextDirection(finishKeepingWaypointForming(openFinishReview(draft)), "wide"),
      ).toEqual(finishKeepingWaypointForming(openFinishReview(draft)));
      expect(
        exploreNextDirection(activatePrimaryNavigation(draft, "conversations"), "wide"),
      ).toEqual(activatePrimaryNavigation(draft, "conversations"));
    });

    it("returns control to the conversation without creating another Waypoint", () => {
      expect(partsSource).toContain("Possible next direction");
      expect(partsSource).toContain("Explore this next");
      expect(partsSource).toMatch(
        /without creating, capturing, or\s+completing another Waypoint\./,
      );
      expect(domainSource).toContain(EXPLORE_NEXT_DIRECTION_DRAFT);
      expect(componentSource).toContain("exploreNextDirection(state, layout)");
      expect(componentSource).toContain('focusOn(COMPOSER_ID, "center")');
    });
  });

  describe("Virtual Guide name", () => {
    it("renames locally, trims, and falls back to SolMind Virtual Guide when blank", () => {
      const opened = openVirtualGuideRename(initial());

      expect(opened.renameDraft).toBe("Mary");
      expect(updateVirtualGuideRenameDraft(initial(), "Nia")).toEqual(initial());

      const named = saveVirtualGuideRename(updateVirtualGuideRenameDraft(opened, "  Nia  "));

      expect(named.virtualGuideName).toBe("Nia");
      expect(named.renameDraft).toBeNull();
      expect(getVirtualGuidePrimaryLabel(named.virtualGuideName)).toBe(
        "Nia (SolMind Virtual Guide)",
      );

      const blank = saveVirtualGuideRename(
        updateVirtualGuideRenameDraft(openVirtualGuideRename(named), "   "),
      );

      expect(blank.virtualGuideName).toBe("");
      expect(getVirtualGuidePrimaryLabel(blank.virtualGuideName)).toBe("SolMind Virtual Guide");

      const long = updateVirtualGuideRenameDraft(opened, "x".repeat(60));

      expect(long.renameDraft).toHaveLength(VIRTUAL_GUIDE_NAME_MAX_LENGTH);
    });

    it("does not hard-code Mary in either React component", () => {
      expect(componentSource).not.toMatch(/\bMary\b/);
      expect(partsSource).not.toMatch(/\bMary\b/);
    });
  });

  describe("exact supplied logo asset", () => {
    it("references the supplied dark logo file without a redrawn mark", () => {
      const logoPath = fileURLToPath(
        new URL("../../../../public/solmind-dark-logo.png", import.meta.url),
      );

      expect(SOLMIND_LOGO_SRC).toBe("/solmind-dark-logo.png");
      expect(partsSource).toContain('from "next/image"');
      expect(partsSource).toContain("src={SOLMIND_LOGO_SRC}");
      expect(partsSource).toMatch(/\bunoptimized\b/);
      expect(existsSync(logoPath)).toBe(true);
      expect([...readFileSync(logoPath).subarray(0, 8)]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(
        createHash("sha256").update(readFileSync(logoPath)).digest("hex").toUpperCase(),
      ).toBe("F4BC27F21C078FFC9047F81D781B9C7B179D4B3EDA68460A2AD4D1EE35C44988");

      for (const { relativePath, source } of sources) {
        expect(/Sol<span/.test(source), relativePath).toBe(false);
      }
    });
  });

  describe("local-only boundary", () => {
    it("uses no provider, network, persistence, server, URL-state, notification, or timer integration", () => {
      const forbidden = [
        /\bfetch\s*\(/,
        /localStorage|sessionStorage|indexedDB/,
        /cookie/i,
        /supabase/i,
        /["']use server["']/,
        /next\/headers/,
        /process\.env/,
        /sendBeacon/,
        /\bNotification\b/,
        /setTimeout|setInterval|requestAnimationFrame|requestIdleCallback/,
        /XMLHttpRequest|WebSocket|EventSource/,
        /\bpostMessage\s*\(|\bBroadcastChannel\b|\bimport\s*\(/,
        /useSearchParams|useRouter|usePathname|next\/navigation/,
        /history\.(pushState|replaceState)|location\.(hash|search|href|assign)/,
        /window\.open\s*\(/,
        /\bopenai\b|\banthropic\b|@ai-sdk|generateText|streamText/i,
      ];

      for (const { relativePath, source } of sources) {
        for (const pattern of forbidden) {
          expect(pattern.test(source), `${relativePath} matches ${pattern}`).toBe(false);
        }
      }
    });

    it("adds no literal direction letters to the Compass", () => {
      for (const { relativePath, source } of sources) {
        expect(/>\s*[NESW]\s*</.test(source), relativePath).toBe(false);
        expect(/\b(north|south|east|west)\b/i.test(source), relativePath).toBe(false);
      }
    });

    it("keeps the state module free of React and the route file thin", () => {
      const pageSource = sources[3].source;

      expect(domainSource).not.toMatch(/from\s+["']react/);
      expect(componentSource.startsWith('"use client";')).toBe(true);
      expect(pageSource).not.toMatch(/["']use client["']/);
      expect(pageSource.split("\n").length).toBeLessThan(30);
    });
  });
});
