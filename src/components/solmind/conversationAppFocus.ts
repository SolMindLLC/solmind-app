// Focus the conversation screen places itself, as opposed to focus the person
// moves. The message box focus hook (useConversationComposerFocus) lets a new
// reply take focus to the message box only while the person has not moved
// focus since the Send; a move made through focusByApp is not the person's.

// Above zero only while an app focus() call runs. The browser sends focusin
// inside that call, so the mark needs no timer and cannot outlive the call.
let appFocusCalls = 0;

// Moves focus for the app. Returns whether the element holds focus afterwards.
export function focusByApp(element: HTMLElement | null | undefined, options?: FocusOptions): boolean {
  if (element === null || element === undefined) return false;
  appFocusCalls += 1;
  try {
    element.focus(options);
  } finally {
    appFocusCalls -= 1;
  }
  return typeof document !== "undefined" && document.activeElement === element;
}

// True for a focusin handled while the app itself is placing focus.
export function isAppFocusMove(): boolean {
  return appFocusCalls > 0;
}
