// Draft screen copy for Paul's wording read, 2026-11-06 (REV306b).
export const EXPLORER_TOUR_CHOICE = "Show me around";
export const EXPLORER_TOUR_TITLE = "A look around your conversation";
export const EXPLORER_TOUR_INTRO = "Choose a topic to see how this space can help you reflect; this tour sends no message and uses no AI reply.";
export const EXPLORER_TOUR_CONVERSATION_TITLE = "How the conversation works";
export const EXPLORER_TOUR_CONVERSATION_TEXT = "The conversation area holds your saved messages and the SolMind Virtual Guide's replies, so you can return to what you have said.";
export const EXPLORER_TOUR_CONVERSATION_ACTION = "Type in the message box and choose Send to explore what is on your mind, or choose a suggested answer to send those words. \"Show me around\" opens this tour without sending a message.";
export const EXPLORER_TOUR_COMPASS_TITLE = "How the Compass works";
export const EXPLORER_TOUR_COMPASS_TEXT = "A Compass point names something that matters to you, so you can keep it in view while the conversation moves.";
export const EXPLORER_TOUR_COMPASS_FORMING = "As you talk, the Virtual Guide may suggest wording marked Forming so you can decide whether it fits.";
export const EXPLORER_TOUR_COMPASS_ACTION = "Choose \"That's right\" to confirm that wording, \"Close, not quite\" to explore a change, or \"That's not it\" to turn it down, so the point reflects your own meaning.";
export const EXPLORER_TOUR_WAYPOINT_TITLE = "How Waypoints work";
export const EXPLORER_TOUR_WAYPOINT_TEXT = "A Waypoint describes a place you want to reach, why it matters and what reaching it would look like, so you have a direction that means something to you.";
export const EXPLORER_TOUR_WAYPOINT_FORMING = "When that direction becomes clear in the conversation, the Virtual Guide may suggest a Forming Waypoint for you to consider.";
export const EXPLORER_TOUR_WAYPOINT_ACTION = "Choose \"That's right\" to confirm the Waypoint, \"Close, not quite\" to explore a change, or \"That's not it\" to turn it down, so you choose the direction yourself.";
export const EXPLORER_TOUR_CLOSE_REASON = "Close the tour or choose \"Back to the conversation\" to return to your conversation whenever you are ready.";
export const EXPLORER_TOUR_CLOSE = "Close tour";
export const EXPLORER_TOUR_BACK = "Back to the conversation";
export const EXPLORER_TOUR_NEXT = "Next step";
export const EXPLORER_TOUR_FINISH = "Finish tour";
export const EXPLORER_TOUR_STEPS_LABEL = "Tour topics";
export const EXPLORER_TOUR_STEPS = Object.freeze([
  Object.freeze({ title: EXPLORER_TOUR_CONVERSATION_TITLE,
    paragraphs: [EXPLORER_TOUR_CONVERSATION_TEXT, EXPLORER_TOUR_CONVERSATION_ACTION] }),
  Object.freeze({ title: EXPLORER_TOUR_COMPASS_TITLE,
    paragraphs: [EXPLORER_TOUR_COMPASS_TEXT, EXPLORER_TOUR_COMPASS_FORMING, EXPLORER_TOUR_COMPASS_ACTION] }),
  Object.freeze({ title: EXPLORER_TOUR_WAYPOINT_TITLE,
    paragraphs: [EXPLORER_TOUR_WAYPOINT_TEXT, EXPLORER_TOUR_WAYPOINT_FORMING, EXPLORER_TOUR_WAYPOINT_ACTION] }),
]);
