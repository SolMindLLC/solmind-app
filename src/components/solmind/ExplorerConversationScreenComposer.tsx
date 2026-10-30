import type { FormEvent } from "react";

import { CONVERSATION_FOOTER } from "@/lib/solmind/explorerConversationScreen";

import { IconArrowUp, IconClipboard, IconPause, IconSpark } from "./ExplorerConversationScreenIcons";
import {
  NotYetImplementedNote,
  PRIMARY_BUTTON,
  PlaceholderSlot,
  QUIET_BUTTON,
  SampleTag,
  SECONDARY_BUTTON,
  UnwiredButton,
  UnwiredControl,
  FOCUS_RING,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

const SCOPE = "composer";
export const COMPOSER_ID = "conversation-preview-composer";

// Nothing is sent: the form never submits, the message field is read-only and
// Send is an unwired button.
function preventSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

// The bar (text box and buttons) followed by the notes, the end controls and
// the footer. In this preview the bar sits in the normal page flow at every
// width. The accepted September screen pins it to the bottom of the screen;
// pinning comes back, sized from the bar's real height so focus is never
// hidden behind it, when the composer is connected.
export function ConversationComposer({ latestChange }: Readonly<{ latestChange: string }>) {
  const messageNote = noteId(SCOPE, "message");
  const latestNote = noteId(SCOPE, "latestChange");
  const sendNote = noteId(SCOPE, "send");
  const pauseNote = noteId(SCOPE, "pause");
  const finishNote = noteId(SCOPE, "finishReview");
  const slowNote = noteId(SCOPE, "slowDown");

  return (
    <>
      <div className="grid gap-3 border-t border-amber-200/15 bg-[#0c0a08]/95 px-3 py-3 sm:px-5" data-composer-bar="">
        <p aria-describedby={latestNote} className="flex flex-wrap items-start gap-2 text-xs leading-5 text-stone-300">
          <IconSpark className="mt-0.5 h-3.5 w-3.5 text-amber-300" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-amber-200">Latest change: </span>
            {latestChange}
          </span>
          <SampleTag />
        </p>
        <form className="grid gap-2" noValidate onSubmit={preventSubmit}>
          <label className="text-sm font-semibold text-stone-100" htmlFor={COMPOSER_ID}>
            Continue the conversation
          </label>
          <textarea
            aria-describedby={messageNote}
            aria-disabled="true"
            className={joinClasses(
              "min-h-[3.5rem] w-full cursor-not-allowed resize-none rounded-2xl border border-dashed border-stone-600 bg-black/50 px-4 py-3 text-sm leading-6 text-stone-50 placeholder:text-stone-400 focus:border-amber-300",
              FOCUS_RING,
            )}
            data-preview-control="unwired"
            id={COMPOSER_ID}
            maxLength={600}
            name="message"
            placeholder="Share what comes to mind..."
            readOnly
            rows={2}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <UnwiredButton className={SECONDARY_BUTTON} noteId={pauseNote}>
                <IconPause />
                Pause
              </UnwiredButton>
              <UnwiredButton className={SECONDARY_BUTTON} noteId={finishNote}>
                <IconClipboard />
                Finish &amp; Review
              </UnwiredButton>
              <UnwiredButton className={joinClasses(QUIET_BUTTON, "border border-stone-700")} noteId={slowNote}>
                Slow down
              </UnwiredButton>
            </div>
            <UnwiredButton className={PRIMARY_BUTTON} noteId={sendNote}>
              Send
              <IconArrowUp />
            </UnwiredButton>
          </div>
        </form>
      </div>
      <div className="grid gap-2 rounded-b-3xl border-t border-amber-200/10 px-3 py-3 sm:px-5">
        <div className="grid gap-1.5 sm:grid-cols-2">
          <NotYetImplementedNote id={messageNote} noteKey="message" />
          <NotYetImplementedNote id={sendNote} noteKey="send" />
          <NotYetImplementedNote id={latestNote} noteKey="latestChange" />
          <NotYetImplementedNote id={pauseNote} noteKey="pause" />
          <NotYetImplementedNote id={finishNote} noteKey="finishReview" />
          <NotYetImplementedNote id={slowNote} noteKey="slowDown" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <UnwiredControl className={SECONDARY_BUTTON} noteKey="end" scope={SCOPE}>
            End this conversation
          </UnwiredControl>
          <PlaceholderSlot title="After the conversation ends">
            <UnwiredControl className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteKey="continueFromThis" scope={SCOPE}>
              Continue from this conversation
            </UnwiredControl>
          </PlaceholderSlot>
        </div>
        <p className="text-[11px] leading-4 text-stone-400">{CONVERSATION_FOOTER}</p>
      </div>
    </>
  );
}
