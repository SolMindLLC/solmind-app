import { createContext, useContext, type ReactNode } from "react";

import {
  LAYOUT_ONLY_LABEL,
  NOT_YET_IMPLEMENTED_PREFIX,
  PREVIEW_BAND_TEXT,
  SAMPLE_TAG_LABEL,
  notYetImplementedText,
  type FixedNoteKey,
  type NotYetImplementedKey,
} from "@/lib/solmind/explorerConversationScreen";
import { WORKSPACE_NOT_CONNECTED_LABEL, withoutReviewPrefix } from "@/lib/solmind/workspaceNavigation";

// Shared building blocks for the interim conversation screen. The class
// strings are copied from ExplorerCompassComparisonParts.tsx and adapted;
// this file imports nothing from the S01R2 files.
//
// Preview additions (notes, tags and the band) use a dashed sky style so they
// read apart from the amber design itself.

export function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors";

export const PRIMARY_BUTTON = joinClasses(
  BUTTON_BASE,
  "bg-amber-400 px-5 py-2.5 text-stone-950 shadow-[0_0_22px_rgba(251,146,60,0.28)] hover:bg-amber-300",
  FOCUS_RING,
);

export const SECONDARY_BUTTON = joinClasses(
  BUTTON_BASE,
  "border border-amber-200/25 bg-white/[0.03] px-4 py-2 text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10",
  FOCUS_RING,
);

export const QUIET_BUTTON = joinClasses(
  BUTTON_BASE,
  "px-3 py-1.5 font-medium text-amber-200 hover:bg-amber-300/10",
  FOCUS_RING,
);

// Unwired controls keep the designed look, gain a dashed edge and a
// not-allowed cursor, and are never dimmed (their visible note explains them).
const UNWIRED_MARK = "cursor-not-allowed border-dashed";

const NOTE_CLASS =
  "rounded-lg border border-dashed border-sky-300/50 bg-sky-950/60 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-4 tracking-normal text-sky-100 [overflow-wrap:anywhere]";

const TAG_BASE =
  "inline-flex shrink-0 items-center rounded-full border border-sky-300/50 px-2 py-0.5 text-[10px] leading-4 text-sky-100";

export function noteId(scope: string, key: NotYetImplementedKey): string {
  return `nyi-${scope}-${key}`;
}

// Signed-in screens (Paul's 2026-11-02 decision): a control that is not built
// yet keeps its designed look, shows the September 23 grey "Not connected yet"
// line and, when activated, one sentence right under it saying what it will
// do. The connected screen places NotConnectedProvider and owns which sentence
// is open (one at a time). Without the provider (the review version) every
// part in this file renders exactly as before.
type NotConnectedState = Readonly<{ openId: string | null; onToggle: (id: string) => void }>;

const NotConnectedContext = createContext<NotConnectedState | null>(null);

export function NotConnectedProvider({ openId, onToggle, children }: NotConnectedState & Readonly<{ children: ReactNode }>) {
  return <NotConnectedContext value={{ openId, onToggle }}>{children}</NotConnectedContext>;
}

const EXPLANATION_CLASS = "text-xs leading-5 text-stone-300";

// The grey line; it renders only on the signed-in screen.
export function NotConnectedLine() {
  const notConnected = useContext(NotConnectedContext);
  return notConnected ? <span className="text-[11px] font-normal text-stone-400">{WORKSPACE_NOT_CONNECTED_LABEL}</span> : null;
}

type NotConnectedButtonProps = Readonly<{ explanationId: string; className: string; label?: string; children: ReactNode }>;

// Activating it shows or hides its sentence and changes nothing else.
export function NotConnectedButton({ explanationId, className, label, children }: NotConnectedButtonProps) {
  const notConnected = useContext(NotConnectedContext);

  return (
    <button
      aria-controls={explanationId}
      aria-expanded={notConnected?.openId === explanationId}
      aria-label={label}
      className={className}
      onClick={() => notConnected?.onToggle(explanationId)}
      type="button"
    >
      {children}
    </button>
  );
}

type ExplanationProps = Readonly<{ id: string; text: string; className?: string; shown?: boolean }>;

// The sentence under a control that is not connected yet: hidden until the
// control is activated, unless no control opens it (shown).
export function NotConnectedExplanation({ id, text, className, shown = false }: ExplanationProps) {
  const notConnected = useContext(NotConnectedContext);

  return (
    <p className={joinClasses(EXPLANATION_CLASS, className)} hidden={!shown && notConnected?.openId !== id} id={id}>
      {text}
    </p>
  );
}

// A note that names the Guide needs the Guide name from the display props.
type NoteWording = Readonly<
  { noteKey: FixedNoteKey; guideName?: string } | { noteKey: NotYetImplementedKey; guideName: string }
>;

// standalone: no control opens this note (it describes an area, not a
// button), so on the signed-in screen its sentence stays shown; the caller
// places it in an area marked with NotConnectedLine.
type NoteProps = Readonly<{ id: string; className?: string; standalone?: boolean }> & NoteWording;

export function NotYetImplementedNote({ id, noteKey, guideName, className, standalone }: NoteProps) {
  const text = notYetImplementedText(noteKey, guideName);
  const notConnected = useContext(NotConnectedContext);

  if (notConnected) {
    return <NotConnectedExplanation className={className} id={id} shown={standalone} text={withoutReviewPrefix(text)} />;
  }

  return (
    <p className={joinClasses(NOTE_CLASS, className)} data-preview-note={noteKey} id={id}>
      <span className="font-semibold text-sky-50">{NOT_YET_IMPLEMENTED_PREFIX}</span>
      {text.slice(NOT_YET_IMPLEMENTED_PREFIX.length)}
    </p>
  );
}

type UnwiredButtonProps = Readonly<{
  noteId: string;
  className: string;
  children: ReactNode;
  label?: string;
  pressed?: boolean;
  current?: "page" | "true";
}>;

// Stays focusable (aria-disabled, never disabled) and does nothing when used.
// On the signed-in screens it shows the grey "Not connected yet" line and its
// sentence instead. A control given a label would carry "(not connected yet)"
// in its accessible name without the visible line; no signed-in control uses
// that form (the bell draws its own line), and the frame tests refuse it.
export function UnwiredButton({
  noteId: describedBy,
  className,
  children,
  label,
  pressed,
  current,
}: UnwiredButtonProps) {
  const notConnected = useContext(NotConnectedContext);

  if (notConnected) {
    return (
      <NotConnectedButton
        className={className}
        explanationId={describedBy}
        label={label === undefined ? undefined : `${label} (${WORKSPACE_NOT_CONNECTED_LABEL.toLowerCase()})`}
      >
        {label === undefined ? (
          <span className="flex flex-col items-center leading-tight">
            <span className="inline-flex items-center gap-2">{children}</span>
            <NotConnectedLine />
          </span>
        ) : (
          children
        )}
      </NotConnectedButton>
    );
  }

  return (
    <button
      aria-current={current}
      aria-describedby={describedBy}
      aria-disabled="true"
      aria-label={label}
      aria-pressed={pressed}
      className={joinClasses(className, UNWIRED_MARK)}
      data-preview-control="unwired"
      type="button"
    >
      {children}
    </button>
  );
}

type UnwiredControlProps = Readonly<{
  scope: string;
  className: string;
  children: ReactNode;
  label?: string;
  wrapperClassName?: string;
  noteClassName?: string;
}> &
  NoteWording;

// One unwired button with its note directly beneath it.
export function UnwiredControl({
  scope,
  className,
  children,
  label,
  wrapperClassName,
  noteClassName,
  ...wording
}: UnwiredControlProps) {
  const id = noteId(scope, wording.noteKey);

  return (
    <div className={joinClasses("grid min-w-0 justify-items-start gap-1.5", wrapperClassName)}>
      <UnwiredButton className={className} label={label} noteId={id}>
        {children}
      </UnwiredButton>
      <NotYetImplementedNote className={noteClassName} id={id} {...wording} />
    </div>
  );
}

export function LayoutOnlyTag({ className }: Readonly<{ className?: string }>) {
  return (
    <span className={joinClasses(TAG_BASE, "border-dashed font-medium", className)} data-preview-tag="layout">
      {LAYOUT_ONLY_LABEL}
    </span>
  );
}

export function SampleTag({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={joinClasses(TAG_BASE, "bg-sky-950/70 font-semibold uppercase tracking-[0.14em]", className)}
      data-preview-tag="sample"
    >
      {SAMPLE_TAG_LABEL}
    </span>
  );
}

// A designed v6 behaviour that exists here only as a placeholder. Its edge is
// dashed only in the review version.
export function PlaceholderSlot({
  title,
  children,
  className,
}: Readonly<{ title: string; children: ReactNode; className?: string }>) {
  const notConnected = useContext(NotConnectedContext);
  const edge = notConnected ? "border" : "border border-dashed";

  return (
    <div className={joinClasses(`grid gap-2 rounded-2xl ${edge} border-stone-600 bg-black/20 p-3`, className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-300">{title}</p>
      {children}
    </div>
  );
}

export function PreviewBand() {
  return (
    <section
      aria-label="Interim design review notice"
      className="relative z-10 border-b-2 border-dashed border-sky-300/60 bg-sky-950 px-4 py-2.5 sm:px-6 lg:px-8"
      data-preview-band=""
    >
      <p className="mx-auto max-w-5xl text-sm leading-6 text-sky-50 [overflow-wrap:anywhere]">{PREVIEW_BAND_TEXT}</p>
    </section>
  );
}
