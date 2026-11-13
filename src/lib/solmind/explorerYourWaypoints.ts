// The fixed wording of the private "Your Waypoints" section of the Waypoints page (execution/07 item 43).
// Every sentence here is the Executor's draft for Paul's wording read (decision queue 2026-11-06 09:03:09 CST,
// decision 4: the screen wording is decided on a wording sheet when the build is ready). The Reached and Release
// review sentences reuse the conversation tools' existing wording where it still fits a conversation that has ended.

// The conversation tools' pointer to earlier versions, replacing "Earlier versions cannot currently be opened." (Paul's approved interim
// sentence of 2026-11-06 15:13:41 CST, item 2, true only until this section existed). Draft for his wording read.
export const YOUR_WAYPOINTS_EARLIER_VERSIONS_POINTER = "You can open earlier versions in Your Waypoints on the Waypoints page.";

export const YOUR_WAYPOINTS_WORDING = Object.freeze({
  pageHeading: "Waypoints",
  heading: "Your Waypoints",
  intro: "Your Waypoints from all your conversations, kept private to you. Nothing here is shared with your Guide.",
  loading: "Loading your Waypoints...",
  unavailableHeading: "Your Waypoints are unavailable",
  unavailable: "This Explorer workspace cannot open your Waypoints right now.",
  failedHeading: "Could not load your Waypoints",
  failed: "Nothing was changed. Load your Waypoints again to see what is saved.",
  // Distinct names, so each retry says what it loads when both sections of the page offer one.
  retryList: "Load your Waypoints again",
  retryEarlier: "Load earlier versions again",
  empty: "You have no Waypoints yet. A Waypoint appears here once you choose one in a conversation.",
  activeGroup: (count: number) => `In progress (${count})`,
  // Without a count while more Waypoints wait to load, so a partial count is never shown as the total.
  activeGroupPartial: "In progress",
  activeListLabel: "Waypoints in progress",
  activeEmpty: "No Waypoint is in progress.",
  closedGroup: (count: number) => `Reached and released (${count})`,
  closedGroupPartial: "Reached and released",
  closedListLabel: "Reached and released Waypoints",
  loadMore: "Show more Waypoints",
  loadMoreFailed: "More Waypoints could not be loaded. The Waypoints shown remain available.",
  fromEnded: "From an ended conversation",
  // Neutral: a conversation that has not ended is normally the current one, but one left open in an earlier Guide
  // relationship is not (review round 2, note 3).
  fromOpen: "From a conversation that has not ended",
  savedOn: (date: string) => `Saved ${date}`,
  reachedOn: (date: string) => `Reached ${date}`,
  releasedOn: (date: string) => `Released ${date}`,
  evidenceTerm: "What showed you reached it",
  // Paul's approved sentence (decision record 2026-11-13 15:36:41 CST, choice A): the conversation's older tools
  // section is removed, and Reached and Release come to the Compass & Waypoint card in the next demo.
  openHint:
    "Marking this Waypoint Reached or releasing it is coming to its conversation's Compass & Waypoint card, so its changes stay with that conversation.",
  openLink: "Go to your conversation",
  reachButton: "Mark Reached",
  releaseButton: "Release",
  earlierShow: "Show earlier versions",
  earlierHide: "Hide earlier versions",
  earlierLoading: "Loading earlier versions...",
  earlierFailed: "Earlier versions could not be loaded.",
  earlierIncomplete: "Some earlier versions could not be found in this conversation's saved history.",
  // Reached review (adapted from the conversation tools' review).
  reachedLegend: "Review before confirming Reached",
  // Why the review asks for this (Paul's rule: every instruction on a screen says why; REV312).
  reachedReason: "To make sure Reached reflects your progress, review your arrival signal, enter supporting evidence and tick the confirmation box.",
  reachedEvidenceLabel: "What supporting evidence shows arrival?",
  reachedConfirm: "I have reviewed my arrival signal and supporting evidence, and I confirm meaningful progress to this Waypoint.",
  reachedSubmit: "Confirm Reached",
  // Release review (the conversation tools' sentence, without "end the conversation", which has already ended).
  releaseLegend: "Review before releasing this Waypoint",
  releaseExplanation:
    "Releasing stops treating this Waypoint as in progress. Its definition and history stay saved and private. This does not mark it Reached, reopen its conversation or share anything.",
  releaseReason: "Review this Waypoint and tick the confirmation box so you can check that you want to stop pursuing it while keeping its private history.",
  releaseConfirm: "I reviewed this Waypoint, and I choose to release it while keeping its private history.",
  releaseSubmit: "Release this Waypoint",
  keep: "Keep in progress",
  saving: "Saving...",
  savedReached: "Saved. This Waypoint is marked Reached.",
  savedReleased: "Saved. This Waypoint is released.",
  uncertain:
    "We could not confirm whether this was saved. To avoid saving it twice, choose the same button again; it repeats the same request.",
  conflict: "This Waypoint changed since you opened it, so nothing was saved. Its current details are shown again.",
  denied: "This change could not be saved, so your Waypoint stays as it was. It may no longer be available to close here.",
  uncertainResolved:
    "We could not confirm whether your earlier request was saved. Your Waypoints are shown as they are saved now.",
  uncertainClosed: "Showing your Waypoints as they are saved now, so you can see whether the change was saved.",
  closeUncertain: "Close and show what is saved",
  reloadFailed: "Your Waypoints could not be loaded again, so this list may be out of date. Load the page again to see them.",
  // Shown under Mark Reached and Release while every shown page is read again (correction D-2, 2026-11-09).
  reloadingActions:
    "Your Waypoints are being refreshed so they show what is saved now. Mark Reached and Release will be available again when that finishes.",
});
