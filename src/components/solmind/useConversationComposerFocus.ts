import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { isAppFocusMove } from "./conversationAppFocus";

const DIALOGS = "dialog[open], [role=dialog], [role=alertdialog]";
const CONTROLS = [
  "a[href], area[href], button, input, select, textarea, summary, label, iframe, audio[controls], video[controls]",
  "[contenteditable]:not([contenteditable=false]), [tabindex]:not([tabindex='-1'])",
  "[role=button], [role=link], [role=textbox], [role=searchbox], [role=combobox], [role=listbox], [role=option]",
  "[role=checkbox], [role=radio], [role=switch], [role=slider], [role=spinbutton], [role=tab], [role=treeitem]",
  "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=gridcell]",
].join(", ");

function hasOpenDialog() {
  return Array.from(document.querySelectorAll(DIALOGS)).some(dialog =>
    !dialog.closest("[hidden], [inert], [aria-hidden=true]") &&
    dialog.getClientRects().length > 0 && getComputedStyle(dialog).visibility === "visible");
}

// A computer with a keyboard: a fine pointer with hover and no touch screen.
// Focusing the box on a phone or tablet would open the on-screen keyboard.
function isKeyboardComputer() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true &&
    !window.matchMedia("(any-pointer: coarse)").matches;
}

function isPageItself(element: Element | null) {
  return element === null || element === document.body || element === document.documentElement;
}

// Where a first typed letter may be taken from: the page background (nothing
// holds focus) or the transcript, which takes Tab focus for reading and
// scrolling. Not the heading, not a control inside the transcript, no dialog.
function isComposeOrigin(target: EventTarget | null, transcript: HTMLElement | null) {
  if (!(target instanceof Element) || target.closest(DIALOGS)) return false;
  if (isPageItself(target)) return true;
  if (transcript === null || !transcript.contains(target)) return false;
  const control = target.closest(CONTROLS);
  return control === null || control === transcript;
}

type ComposerFocusProps = Readonly<{
  composerRef: RefObject<HTMLTextAreaElement | null>;
  transcriptRef: RefObject<HTMLDivElement | null>;
  sendSequence: number;
  busy: boolean;
  replyId: string | null;
  dialogOpen: boolean;
  onDraftChange: (draft: string) => void;
}>;

// One per busy period, from the accepted Send to the frame that moves focus.
// A Waypoint confirmation and its automatic Send share one busy period, so
// they share one watch and the person's focus choice holds across both.
type SendWatch = { personMoved: boolean };

export function useConversationComposerFocus({
  composerRef, transcriptRef, sendSequence, busy, replyId, dialogOpen, onDraftChange,
}: ComposerFocusProps) {
  const watchRef = useRef<SendWatch | null>(null);
  const previousSendSequence = useRef(sendSequence);
  const previousReplyId = useRef(replyId);

  // The listeners stay for the life of the screen, so nothing between the
  // accepted Send and the final frame is missed. They only write to the watch
  // of the Send that is open at that moment.
  useEffect(() => {
    const personMoved = () => {
      if (watchRef.current !== null) watchRef.current.personMoved = true;
    };
    const isElsewhere = (element: Element | null): element is Element =>
      !isPageItself(element) && element !== composerRef.current;
    // When the window or tab is left and returned to, the browser sends
    // focusin again for the element that already held focus. That is not a move.
    let heldWhenWindowLeft: Element | null | undefined;
    const rememberWindowLeft = (event: Event) => {
      if (event.target === window) heldWhenWindowLeft = document.activeElement;
    };
    // Every focus move the app did not mark is taken as the person's: a
    // press, a key, or a screen reader that moves focus with no key event.
    const rememberFocus = (event: FocusEvent) => {
      const target = event.target;
      const returnedTo = heldWhenWindowLeft;
      heldWhenWindowLeft = undefined;
      if (!(target instanceof Element) || !isElsewhere(target)) return;
      if (target === returnedTo || isAppFocusMove()) return;
      personMoved();
    };
    // A press on the element that already holds focus moves nothing, and is
    // still the person choosing that element.
    const rememberPress = (event: Event) => {
      const target = event.target;
      const active = document.activeElement;
      if (target instanceof Element && isElsewhere(active) && active.contains(target)) personMoved();
    };
    window.addEventListener("blur", rememberWindowLeft);
    document.addEventListener("focusin", rememberFocus, true);
    document.addEventListener("pointerdown", rememberPress, true);
    return () => {
      window.removeEventListener("blur", rememberWindowLeft);
      document.removeEventListener("focusin", rememberFocus, true);
      document.removeEventListener("pointerdown", rememberPress, true);
    };
  }, [composerRef]);

  // The accepted Send opens a new watch in the commit that shows it as busy.
  useLayoutEffect(() => {
    if (busy) watchRef.current = { personMoved: false };
  }, [busy]);

  useEffect(() => {
    if (busy) return;
    const newSend = previousSendSequence.current !== sendSequence;
    const newReply = replyId !== null && previousReplyId.current !== replyId;
    previousSendSequence.current = sendSequence;
    previousReplyId.current = replyId;
    const watch = watchRef.current;
    if (watch === null) return;
    if (!newSend || !newReply || dialogOpen || watch.personMoved) {
      watchRef.current = null;
      return;
    }
    // Only this Send's own watch is read and closed here: a later Send has
    // opened another one, which this frame must neither use nor clear.
    const focusAfterReply = () => {
      if (watchRef.current !== watch) return;
      watchRef.current = null;
      const field = composerRef.current;
      // Focus the app placed (the row of a tapped choice, the strip's title)
      // or the page itself gives way; the person's own move does not.
      if (!watch.personMoved && field && !field.disabled && field !== document.activeElement &&
          isKeyboardComputer() && !hasOpenDialog()) {
        field.focus({ preventScroll: true });
      }
    };
    // Give the committed live log a paint before moving focus. Honor any
    // change of focus or newly opened dialog up to the frame that moves it.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(focusAfterReply);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, replyId, dialogOpen, composerRef, sendSequence]);

  useEffect(() => {
    if (dialogOpen) return;
    const typeInComposer = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing ||
          event.keyCode === 229 || !/^\p{L}$/u.test(event.key)) return;
      const field = composerRef.current;
      if (!field || field.disabled || !isComposeOrigin(event.target, transcriptRef.current) ||
          !isKeyboardComputer() || hasOpenDialog()) return;
      const { selectionStart, selectionEnd } = field;
      if (field.value.length - (selectionEnd - selectionStart) + event.key.length > field.maxLength) return;
      event.preventDefault();
      field.focus();
      field.setRangeText(event.key, selectionStart, selectionEnd, "end");
      onDraftChange(field.value);
    };
    document.addEventListener("keydown", typeInComposer);
    return () => document.removeEventListener("keydown", typeInComposer);
  }, [composerRef, transcriptRef, dialogOpen, onDraftChange]);
}
