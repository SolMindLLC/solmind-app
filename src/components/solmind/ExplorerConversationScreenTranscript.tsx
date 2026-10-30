import type {
  ScreenChoice,
  ScreenTranscriptData,
  ScreenTurn,
} from "@/lib/solmind/explorerConversationScreenDisplay";
import { speakerLabelClass, type SpeakerLabelStyle } from "@/lib/solmind/explorerSpeakerStyle";

import { IconChat, IconCheck, IconCompass } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  NotYetImplementedNote,
  PRIMARY_BUTTON,
  PlaceholderSlot,
  QUIET_BUTTON,
  SampleTag,
  SECONDARY_BUTTON,
  UnwiredButton,
  UnwiredControl,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";
import { SpeakerBadge } from "./ExplorerConversationScreenSpeaker";

const SCOPE = "chat";

const CHOICE_CLASS =
  "flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm";
// The label grows from zero, so a badge stays beside it while the longest
// word still fits and wraps below it otherwise; nothing can overlap.
const CHOICE_WRAP = "flex-wrap gap-y-1.5";
const CHOICE_PLAIN = "border-stone-700 bg-black/30 text-stone-100 hover:border-amber-300/40 hover:bg-amber-300/5";
const CHOICE_OTHER = "border-amber-300/40 text-amber-100 hover:bg-amber-300/10";
const LANE_LABEL = "text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200";

function ChoiceButton({ choice, describedBy }: Readonly<{ choice: ScreenChoice; describedBy: string }>) {
  return (
    <UnwiredButton className={joinClasses(CHOICE_CLASS, CHOICE_WRAP, CHOICE_PLAIN, FOCUS_RING)} noteId={describedBy}>
      <span className="grow basis-0" data-choice-label="">
        {choice.label}
      </span>
      {choice.tag ? (
        <span
          className="shrink-0 rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
          data-choice-badge=""
        >
          {choice.tag}
        </span>
      ) : null}
    </UnwiredButton>
  );
}

type ChoicesProps = Readonly<{ choices: ScreenTranscriptData["openingChoices"] }>;

// The two lanes follow the width of the conversation itself (a container
// query), not the window, so they stack whenever the column is narrow.
function OpeningChoices({ choices }: ChoicesProps) {
  const groupNote = noteId(SCOPE, "choiceGroup");
  const choiceNote = noteId(SCOPE, "choice");
  const otherNote = noteId(SCOPE, "somethingElse");

  return (
    <div aria-describedby={groupNote} aria-label="Suggested starting topics" className="@container mt-4 grid gap-3" role="group">
      <NotYetImplementedNote id={groupNote} noteKey="choiceGroup" />
      <div className="grid gap-3 @sm:grid-cols-2" data-choice-lanes="">
        <div className="grid min-w-0 content-start gap-2" data-choice-lane="">
          <p className={LANE_LABEL}>Continue or revisit</p>
          {choices.continueOrRevisit.map((choice) => (
            <ChoiceButton choice={choice} describedBy={choiceNote} key={choice.id} />
          ))}
        </div>
        <div className="grid min-w-0 content-start gap-2" data-choice-lane="">
          <p className={LANE_LABEL}>Start somewhere new</p>
          {choices.startNew.map((choice) => (
            <ChoiceButton choice={choice} describedBy={choiceNote} key={choice.id} />
          ))}
        </div>
      </div>
      <NotYetImplementedNote id={choiceNote} noteKey="choice" />
      <div aria-hidden="true" className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-stone-400">
        <span className="h-px flex-1 bg-stone-700" />
        or
        <span className="h-px flex-1 bg-stone-700" />
      </div>
      <UnwiredButton className={joinClasses(CHOICE_CLASS, CHOICE_OTHER, "justify-start", FOCUS_RING)} noteId={otherNote}>
        <IconChat className="text-amber-300" />
        {choices.somethingElse}
      </UnwiredButton>
      <NotYetImplementedNote id={otherNote} noteKey="somethingElse" />
      <UnwiredControl className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} noteKey="earlierCompass" scope={SCOPE}>
        <IconCompass />
        Start from an earlier Compass
      </UnwiredControl>
    </div>
  );
}

type CheckProps = Readonly<{ followUpChoices: readonly ScreenChoice[]; somethingElse: string }>;

function UnderstandingCheck({ followUpChoices, somethingElse }: CheckProps) {
  const checkNote = noteId(SCOPE, "checkUnderstanding");
  const followNote = noteId(SCOPE, "followUpChoices");

  return (
    <div className="mt-3 grid gap-3">
      <div aria-label="Answer this question" className="flex flex-wrap items-center gap-2" role="group">
        <UnwiredButton className={PRIMARY_BUTTON} noteId={checkNote}>
          <IconCheck />
          Yes, capture that
        </UnwiredButton>
        <UnwiredButton className={SECONDARY_BUTTON} noteId={checkNote}>
          It&apos;s still forming
        </UnwiredButton>
      </div>
      <NotYetImplementedNote id={checkNote} noteKey="checkUnderstanding" />
      <UnwiredControl className={joinClasses(QUIET_BUTTON, "border border-stone-700")} noteKey="notQuiteRight" scope={SCOPE}>
        That&apos;s not quite right
      </UnwiredControl>
      {/* Like the opening choices, these columns follow the conversation's
          width (a container query on the slot), not the window. */}
      <PlaceholderSlot className="@container" title="After something is captured">
        <div aria-label="Where to go next" className="grid gap-2 @sm:grid-cols-2" role="group">
          {followUpChoices.map((choice) => (
            <ChoiceButton choice={choice} describedBy={followNote} key={choice.id} />
          ))}
          <UnwiredButton className={joinClasses(CHOICE_CLASS, CHOICE_OTHER, "justify-start", FOCUS_RING)} noteId={followNote}>
            <IconChat className="text-amber-300" />
            {somethingElse}
          </UnwiredButton>
        </div>
        <NotYetImplementedNote id={followNote} noteKey="followUpChoices" />
      </PlaceholderSlot>
    </div>
  );
}

type TurnProps = Readonly<{ turn: ScreenTurn; transcript: ScreenTranscriptData; speakerStyle: SpeakerLabelStyle }>;

function TurnBubble({ turn, transcript, speakerStyle }: TurnProps) {
  const isGuide = turn.speaker === "virtualGuide";
  const speakerId = `conversation-preview-${turn.id}-speaker`;

  return (
    <article
      aria-labelledby={speakerId}
      className={joinClasses(
        "rounded-2xl border px-4 py-3",
        isGuide
          ? "mr-auto w-full max-w-[94%] border-amber-200/10 bg-[#15110d] text-stone-100"
          : "ml-auto max-w-[90%] border-amber-300/20 bg-[#22190f] text-stone-50",
      )}
    >
      <p
        className={joinClasses("flex items-center gap-2 text-xs font-semibold", speakerLabelClass(speakerStyle, turn.speaker))}
        id={speakerId}
      >
        <SpeakerBadge speaker={turn.speaker} speakerStyle={speakerStyle} />
        {transcript.speakerLabels[turn.speaker]}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{turn.body}</p>
      {turn.extra === "openingChoices" ? <OpeningChoices choices={transcript.openingChoices} /> : null}
      {turn.extra === "check" ? (
        <UnderstandingCheck followUpChoices={transcript.followUpChoices} somethingElse={transcript.followUpSomethingElse} />
      ) : null}
    </article>
  );
}

function ReopenPlaceholder() {
  const reopenNote = noteId(SCOPE, "reopen");

  return (
    <PlaceholderSlot title="Reopening a captured part">
      <div aria-label="Reopen a captured part" className="flex flex-wrap gap-2" role="group">
        <UnwiredButton className={SECONDARY_BUTTON} noteId={reopenNote}>
          Yes, reopen it
        </UnwiredButton>
        <UnwiredButton className={SECONDARY_BUTTON} noteId={reopenNote}>
          Keep it
        </UnwiredButton>
      </div>
      <NotYetImplementedNote id={reopenNote} noteKey="reopen" />
    </PlaceholderSlot>
  );
}

type TranscriptProps = Readonly<{ transcript: ScreenTranscriptData; speakerStyle: SpeakerLabelStyle }>;

// The transcript keeps the September heights at every width.
export function ConversationTranscript({ transcript, speakerStyle }: TranscriptProps) {
  return (
    <div
      aria-label="Conversation transcript"
      className={joinClasses(
        "h-[60vh] min-h-[32rem] max-h-[52rem] overflow-y-auto px-3 py-4 max-lg:scroll-py-2 sm:px-5 lg:h-[clamp(36rem,65vh,52rem)]",
        FOCUS_RING,
      )}
      role="log"
      tabIndex={0}
    >
      <div className="mx-auto mb-3 flex max-w-3xl justify-end">
        <SampleTag />
      </div>
      <ol className="mx-auto grid max-w-3xl gap-3">
        {transcript.turns.map((turn) => (
          <li className="grid" key={turn.id}>
            <TurnBubble speakerStyle={speakerStyle} transcript={transcript} turn={turn} />
          </li>
        ))}
        <li className="grid">
          <ReopenPlaceholder />
        </li>
      </ol>
    </div>
  );
}
