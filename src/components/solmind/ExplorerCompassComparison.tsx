"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  GUIDE_CONVERSATIONS_DESTINATION,
  JOURNEY_HEADING_ID,
  PROTOTYPE_FOOTNOTE,
  RESET_FOCUS_TARGET_ID,
  activateConversationSpace,
  activatePrimaryNavigation,
  answerDetailVerification,
  cancelVirtualGuideRename,
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
  getLatestTurnId,
  getOpenVerificationTurn,
  getQuotationReturnFocusTargetId,
  getQuotationSourceFocusTargetId,
  getSupportPanelToggle,
  getSupportingQuotation,
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
  type CompassPathId,
  type ConversationChoiceId,
  type ConversationSpaceId,
  type ExplorerConversationState,
  type PrimaryDestinationId,
  type QuotationId,
  type SupportLayout,
  type VerificationAnswer,
  type WaypointDetailId,
} from "@/lib/solmind/explorerCompassComparison";
import {
  AmbientGlow,
  COMPOSER_ID,
  CONVERSATIONS_HEADING_ID,
  ComposerForm,
  ConversationHeader,
  ConversationTurnView,
  ConversationsHub,
  ActivityStatus,
  DIALOG_BODY_ID,
  DIALOG_INITIAL_FOCUS_ID,
  DIALOG_TITLE_ID,
  DRAWER_DIALOG_CLASS,
  FOCUS_RING,
  GuideContinuityBanner,
  INFO_DIALOG_CLASS,
  IconPanelRight,
  MENU_BUTTON_ID,
  MOBILE_NAVIGATION_ID,
  ModalDialog,
  PANEL_TOGGLE_ID,
  PAUSE_HEADING_ID,
  PRIORITY_QUESTION_ID,
  PRIORITY_STATUS_ID,
  PauseCard,
  PrimaryNavigation,
  PrototypeDialogContent,
  RENAME_INPUT_ID,
  RENAME_TOGGLE_ID,
  REVIEW_HEADING_ID,
  ReviewCard,
  SECONDARY_BUTTON,
  SUMMARY_HEADING_ID,
  SUPPORT_DRAWER_HEADING_ID,
  SUPPORT_DRAWER_ID,
  SUPPORT_PANEL_HEADING_ID,
  SUPPORT_PANEL_ID,
  SolMindLogo,
  SummaryCard,
  SupportPanelContent,
  UtilityBar,
  VirtualGuideIdentity,
  YourSpaceCard,
  getInactiveHint,
  joinClasses,
} from "./ExplorerCompassComparisonParts";

// Viewport detection only chooses between the inline panel and the drawer.
// It reads nothing else from the browser and stores nothing.
const WIDE_LAYOUT_QUERY = "(min-width: 64rem)";

function subscribeToLayout(onChange: () => void) {
  const query = window.matchMedia(WIDE_LAYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getLayoutSnapshot(): SupportLayout {
  return window.matchMedia(WIDE_LAYOUT_QUERY).matches ? "wide" : "narrow";
}

function getServerLayoutSnapshot(): SupportLayout {
  return "wide";
}

type FocusRequest = Readonly<{
  id: string;
  focus: boolean;
  scroll: ScrollLogicalPosition | null;
}>;

function focusOn(
  id: string,
  scroll: ScrollLogicalPosition | null = null,
): FocusRequest {
  return { id, focus: true, scroll };
}

function performFocusRequest(request: FocusRequest) {
  const element = document.getElementById(request.id);

  if (!element) {
    return;
  }

  if (request.focus) {
    element.focus({ preventScroll: request.scroll !== null });
  }

  if (request.scroll !== null) {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollIntoView({
      block: request.scroll,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }
}

export function ExplorerCompassComparison() {
  const [state, setState] = useState<ExplorerConversationState>(
    createInitialExplorerConversationState,
  );
  const layout = useSyncExternalStore(
    subscribeToLayout,
    getLayoutSnapshot,
    getServerLayoutSnapshot,
  );
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  // Each request is a new object, so this runs once per request. Dialog
  // layout effects in children run first, so a requested focus target wins
  // over a dialog's own focus return.
  useEffect(() => {
    if (focusRequest !== null) {
      performFocusRequest(focusRequest);
    }
  }, [focusRequest]);

  useEffect(() => {
    const query = window.matchMedia(WIDE_LAYOUT_QUERY);

    function closeDrawerWhenLayoutWidens(event: MediaQueryListEvent) {
      if (!event.matches) {
        return;
      }

      setState((current) => closeSupportDrawer(current));
      setFocusRequest(focusOn(PANEL_TOGGLE_ID));
    }

    query.addEventListener("change", closeDrawerWhenLayoutWidens);
    return () =>
      query.removeEventListener("change", closeDrawerWhenLayoutWidens);
  }, []);

  const isActive = state.view === "journey" && state.phase === "active";
  const inactiveHint = getInactiveHint(state.phase);
  const panelToggle = getSupportPanelToggle(state, layout);
  const activityPlacement = getActivityPlacement(state, layout);
  const highlightedQuotation = state.sourceHighlight
    ? getSupportingQuotation(state.sourceHighlight.quotationId)
    : null;

  function apply(
    next: ExplorerConversationState,
    request: FocusRequest | null = null,
  ) {
    if (next !== state) {
      setState(next);
    }

    if (request !== null) {
      setFocusRequest(request);
    }
  }

  // Shell, navigation, and dialogs ----------------------------------------

  function handleSkipToContent() {
    performFocusRequest(
      focusOn(
        state.view === "journey" ? JOURNEY_HEADING_ID : CONVERSATIONS_HEADING_ID,
      ),
    );
  }

  function handleToggleMenu() {
    apply(toggleNavigationMenu(state));
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      apply(closeNavigationMenu(state), focusOn(MENU_BUTTON_ID));
    }
  }

  function handlePrimaryNavigation(destinationId: PrimaryDestinationId) {
    apply(
      activatePrimaryNavigation(state, destinationId),
      destinationId === "conversations" ? focusOn(CONVERSATIONS_HEADING_ID) : null,
    );
  }

  function handleConversationSpace(spaceId: ConversationSpaceId) {
    apply(
      activateConversationSpace(state, spaceId),
      spaceId === "virtualGuide" ? focusOn(JOURNEY_HEADING_ID) : null,
    );
  }

  function handleOpenGuideConversations() {
    apply(openNotConnectedDestination(state, GUIDE_CONVERSATIONS_DESTINATION));
  }

  function handleDialogDismiss() {
    apply(closePrototypeDialog(state));
  }

  function handleConfirmReset() {
    apply(confirmPrototypeReset(state), focusOn(RESET_FOCUS_TARGET_ID));
  }

  function handleConfirmNewConversation() {
    apply(confirmStartNewConversation(state), focusOn(JOURNEY_HEADING_ID));
  }

  // Virtual Guide name --------------------------------------------------------

  function handleToggleRename() {
    if (state.renameDraft === null) {
      apply(openVirtualGuideRename(state), focusOn(RENAME_INPUT_ID));
    } else {
      apply(cancelVirtualGuideRename(state), focusOn(RENAME_TOGGLE_ID));
    }
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(saveVirtualGuideRename(state), focusOn(RENAME_TOGGLE_ID));
  }

  function handleRenameCancel() {
    apply(cancelVirtualGuideRename(state), focusOn(RENAME_TOGGLE_ID));
  }

  // Conversation --------------------------------------------------------------

  function handleSelectChoice(choiceId: ConversationChoiceId) {
    apply(selectConversationChoice(state, choiceId), focusOn(COMPOSER_ID));
  }

  function sendComposerMessage() {
    const next = submitComposerMessage(state);

    if (next.turns.length > state.turns.length) {
      apply(next, {
        id: turnElementId(getLatestTurnId(next)),
        focus: false,
        scroll: "end",
      });
      return;
    }

    apply(next, focusOn(COMPOSER_ID));
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendComposerMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    sendComposerMessage();
  }

  function handleAnswerVerification(turnId: string, answer: VerificationAnswer) {
    const next = answerDetailVerification(state, turnId, answer);

    apply(
      next,
      next === state
        ? null
        : focusOn(turnElementId(getLatestTurnId(next)), "center"),
    );
  }

  function handleDetailAction(detailId: WaypointDetailId) {
    const openTurn = getOpenVerificationTurn(state);

    if (openTurn && openTurn.verification?.detailId === detailId) {
      apply(
        goToOpenVerification(state, layout),
        focusOn(turnElementId(openTurn.id), "center"),
      );
      return;
    }

    const next = startDetailVerification(state, detailId, layout);

    apply(
      next,
      next === state
        ? null
        : focusOn(turnElementId(getLatestTurnId(next)), "center"),
    );
  }

  // Compass -------------------------------------------------------------------

  function handleSelectPath(pathId: CompassPathId) {
    apply(selectCompassPath(state, pathId));
  }

  function handleRequestPriority() {
    apply(requestPriorityChange(state), focusOn(PRIORITY_QUESTION_ID));
  }

  function handleConfirmPriority() {
    apply(confirmPriorityChange(state), focusOn(PRIORITY_STATUS_ID));
  }

  function handleDeclinePriority() {
    apply(declinePriorityChange(state), focusOn(PRIORITY_STATUS_ID));
  }

  // Supporting quotations -----------------------------------------------------

  function handleSelectQuotation(quotationId: QuotationId) {
    const next = selectSupportingQuotation(state, quotationId, layout);
    const target = getQuotationSourceFocusTargetId(next);

    apply(next, target ? focusOn(target, "center") : null);
  }

  function handleReturnToQuotation() {
    const next = returnToSupportingQuotation(state, layout);
    const target = getQuotationReturnFocusTargetId(next);

    apply(next, target ? focusOn(target, "nearest") : null);
  }

  // Rendering -----------------------------------------------------------------

  const supportPanelHandlers = {
    isActive,
    inactiveHint,
    onSelectPath: handleSelectPath,
    onRequestPriority: handleRequestPriority,
    onConfirmPriority: handleConfirmPriority,
    onDeclinePriority: handleDeclinePriority,
    onToggleCompassView: () => apply(toggleCompassView(state)),
    onDetailAction: handleDetailAction,
    onExploreNext: () =>
      apply(
        exploreNextDirection(state, layout),
        focusOn(COMPOSER_ID, "center"),
      ),
    onQuotationListToggle: (detailId: WaypointDetailId, open: boolean) =>
      apply(setQuotationListOpen(state, detailId, open)),
    onSelectQuotation: handleSelectQuotation,
    onShareQuotation: (quotationId: QuotationId) =>
      apply(openQuotationSharingInfo(state, quotationId)),
    onShareWaypoint: () => apply(openWaypointSharingInfo(state)),
  };

  const journeyFooter = (() => {
    switch (state.phase) {
      case "active":
        return (
          <ComposerForm
            draft={state.composerDraft}
            error={state.composerError}
            onChange={(value) => apply(updateComposerDraft(state, value))}
            onFinish={() => apply(openFinishReview(state), focusOn(REVIEW_HEADING_ID))}
            onKeyDown={handleComposerKeyDown}
            onPause={() => apply(pauseJourney(state), focusOn(PAUSE_HEADING_ID))}
            onSubmit={handleComposerSubmit}
            prompt={state.composerPrompt}
          />
        );
      case "paused":
        return (
          <PauseCard
            onFinish={() => apply(openFinishReview(state), focusOn(REVIEW_HEADING_ID))}
            onResume={() => apply(resumeJourney(state), focusOn(COMPOSER_ID))}
          />
        );
      case "reviewing":
        return (
          <ReviewCard
            onKeepForming={() =>
              apply(finishKeepingWaypointForming(state), focusOn(SUMMARY_HEADING_ID))
            }
            onReached={() =>
              apply(confirmWaypointReached(state), focusOn(SUMMARY_HEADING_ID))
            }
            onReturn={() =>
              apply(returnToConversationFromReview(state), focusOn(COMPOSER_ID))
            }
            state={state}
          />
        );
      case "finished":
        return (
          <SummaryCard
            onReturnToConversations={() =>
              apply(
                returnToConversationsFromSummary(state),
                focusOn(CONVERSATIONS_HEADING_ID),
              )
            }
            onStartAnother={() =>
              apply(requestNewConversation(state))
            }
            state={state}
          />
        );
    }
  })();

  const journeyView = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 pt-4 sm:px-6 lg:px-8 lg:pt-5">
        <VirtualGuideIdentity
          name={state.virtualGuideName}
          onCancel={handleRenameCancel}
          onDraftChange={(value) =>
            apply(updateVirtualGuideRenameDraft(state, value))
          }
          onSave={handleRenameSubmit}
          onToggleRename={handleToggleRename}
          renameDraft={state.renameDraft}
        />
        <button
          aria-controls={layout === "wide" ? SUPPORT_PANEL_ID : SUPPORT_DRAWER_ID}
          aria-expanded={panelToggle.expanded}
          aria-haspopup={layout === "narrow" ? "dialog" : undefined}
          className={SECONDARY_BUTTON}
          id={PANEL_TOGGLE_ID}
          onClick={() => apply(toggleSupportPanel(state, layout))}
          type="button"
        >
          <IconPanelRight />
          {panelToggle.label}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-5 px-3 pb-6 pt-4 sm:px-6 lg:px-8">
        <section
          aria-labelledby={JOURNEY_HEADING_ID}
          className="flex min-w-0 flex-1 flex-col rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
        >
          <ConversationHeader
            onShareConversation={() => apply(openConversationSharingInfo(state))}
            state={state}
          />
          <div
            aria-label="Conversation transcript"
            className={joinClasses(
              "h-[60vh] min-h-[32rem] max-h-[52rem] overflow-y-auto px-3 py-4 sm:px-5 lg:h-[clamp(36rem,65vh,52rem)]",
              FOCUS_RING,
            )}
            role="log"
            tabIndex={0}
          >
            <ol className="mx-auto grid max-w-3xl gap-3">
              {state.turns.map((turn) => (
                <li className="grid" key={turn.id}>
                  <ConversationTurnView
                    highlight={
                      highlightedQuotation &&
                      state.sourceHighlight?.turnId === turn.id
                        ? highlightedQuotation
                        : null
                    }
                    inactiveHint={inactiveHint}
                    isActive={isActive}
                    onAnswer={handleAnswerVerification}
                    onReturnToQuotation={handleReturnToQuotation}
                    onSelectChoice={handleSelectChoice}
                    selectedChoiceId={state.selectedChoiceId}
                    turn={turn}
                    virtualGuideName={state.virtualGuideName}
                  />
                </li>
              ))}
            </ol>
          </div>
          <div
            className={joinClasses(
              "grid gap-3 rounded-b-3xl border-t border-amber-200/15 bg-[#0c0a08]/95 px-3 py-3 sm:px-5 lg:static",
              state.phase === "active" ? "sticky bottom-0 z-10 backdrop-blur" : "",
            )}
          >
            {activityPlacement === "journey" ? (
              <ActivityStatus message={state.activity} />
            ) : null}
            {journeyFooter}
            <p className="text-[11px] leading-4 text-stone-400">
              {PROTOTYPE_FOOTNOTE}
            </p>
          </div>
        </section>

        {layout === "wide" ? (
          <aside
            aria-labelledby={SUPPORT_PANEL_HEADING_ID}
            className={joinClasses(
              "hidden min-h-0 w-[23rem] shrink-0 flex-col overflow-y-auto rounded-3xl border border-stone-800 bg-[#090807]/85 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)] xl:w-[25rem]",
              state.supportPanel.wideVisible ? "lg:flex" : "",
            )}
            id={SUPPORT_PANEL_ID}
          >
            <SupportPanelContent
              {...supportPanelHandlers}
              headingId={SUPPORT_PANEL_HEADING_ID}
              showActivity={false}
              state={state}
              variant="panel"
            />
          </aside>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex min-h-dvh w-full bg-[#050404] text-stone-100">
      <AmbientGlow />
      <button
        className={joinClasses(
          "sr-only rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          FOCUS_RING,
        )}
        onClick={handleSkipToContent}
        type="button"
      >
        Skip to {state.view === "journey" ? "the conversation" : "conversations"}
      </button>

      <aside
        aria-label="SolMind workspace"
        className="relative hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-amber-200/10 bg-black pb-4 lg:flex"
      >
        <div className="px-6 pt-7">
          <SolMindLogo className="w-44" />
        </div>
        <PrimaryNavigation
          className="px-3"
          label="Explorer workspace"
          onPrimary={handlePrimaryNavigation}
          onSpace={handleConversationSpace}
          view={state.view}
        />
        <YourSpaceCard className="mx-4 mt-auto" />
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <UtilityBar
          menuOpen={state.navigationMenuOpen}
          onAbout={() => apply(openAboutPrototype(state))}
          onNotifications={() =>
            apply(openNotConnectedDestination(state, "notifications"))
          }
          onProfile={() => apply(openNotConnectedDestination(state, "profile"))}
          onReset={() => apply(requestPrototypeReset(state))}
          onToggleMenu={handleToggleMenu}
          view={state.view}
        />
        {state.navigationMenuOpen ? (
          <div className="border-b border-amber-200/10 bg-black/90 px-3 py-3 lg:hidden">
            <PrimaryNavigation
              id={MOBILE_NAVIGATION_ID}
              label="Explorer workspace menu"
              onKeyDown={handleMenuKeyDown}
              onPrimary={handlePrimaryNavigation}
              onSpace={handleConversationSpace}
              view={state.view}
            />
          </div>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col">
          {state.view === "journey" ? (
            journeyView
          ) : (
            <ConversationsHub
              onOpenEarlier={() =>
                apply(openNotConnectedDestination(state, "earlierConversation"))
              }
              onOpenGuide={handleOpenGuideConversations}
              onOpenJourney={() =>
                apply(openJourneyFromConversations(state), focusOn(JOURNEY_HEADING_ID))
              }
              onStartAnother={() =>
                apply(requestNewConversation(state))
              }
              showActivity={activityPlacement === "conversations"}
              state={state}
            />
          )}
          <GuideContinuityBanner onOpen={handleOpenGuideConversations} />
        </main>
      </div>

      {layout === "narrow" && state.view === "journey" ? (
        <ModalDialog
          className={DRAWER_DIALOG_CLASS}
          id={SUPPORT_DRAWER_ID}
          initialFocusId={SUPPORT_DRAWER_HEADING_ID}
          labelledBy={SUPPORT_DRAWER_HEADING_ID}
          onDismiss={() => apply(closeSupportDrawer(state))}
          open={state.supportPanel.narrowOpen}
        >
          <SupportPanelContent
            {...supportPanelHandlers}
            headingId={SUPPORT_DRAWER_HEADING_ID}
            onClose={() => apply(closeSupportDrawer(state))}
            showActivity={activityPlacement === "drawer"}
            state={state}
            variant="drawer"
          />
        </ModalDialog>
      ) : null}

      <ModalDialog
        className={INFO_DIALOG_CLASS}
        describedBy={DIALOG_BODY_ID}
        initialFocusId={DIALOG_INITIAL_FOCUS_ID}
        labelledBy={DIALOG_TITLE_ID}
        onDismiss={handleDialogDismiss}
        open={state.dialog !== null}
      >
        {state.dialog ? (
          <PrototypeDialogContent
            dialog={state.dialog}
            onClose={handleDialogDismiss}
            onConfirmNewConversation={handleConfirmNewConversation}
            onConfirmReset={handleConfirmReset}
          />
        ) : null}
      </ModalDialog>
    </div>
  );
}
