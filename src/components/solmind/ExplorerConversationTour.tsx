import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  EXPLORER_TOUR_BACK, EXPLORER_TOUR_CLOSE_REASON, EXPLORER_TOUR_INTRO, EXPLORER_TOUR_NEXT,
  EXPLORER_TOUR_STEPS, EXPLORER_TOUR_STEPS_LABEL, EXPLORER_TOUR_TITLE,
} from "@/lib/solmind/explorerConversationTour";
import { FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// Keep Tab and Shift+Tab inside the tour: the native modal makes the page inert,
// but Chromium does not wrap focus from the last control back to the first.
function keepFocusInTour(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !controls.includes(active as HTMLButtonElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// Local presentation only.
export function ExplorerConversationTour({ opener, onClose }: Readonly<{
  opener: HTMLElement | null;
  onClose: () => void;
}>) {
  const [step, setStep] = useState({ index: 0, announce: false });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const focusBackAfterNext = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    headingRef.current?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);
  useEffect(() => {
    if (step.index === EXPLORER_TOUR_STEPS.length - 1 && focusBackAfterNext.current) {
      backButtonRef.current?.focus();
      focusBackAfterNext.current = false;
    }
  }, [step.index]);
  const current = EXPLORER_TOUR_STEPS[step.index];
  const showStep = (index: number) => {
    if (index !== step.index) setStep({ index, announce: true });
  };
  const nextStep = () => {
    const nextIndex = step.index + 1;
    if (nextIndex === EXPLORER_TOUR_STEPS.length - 1) focusBackAfterNext.current = true;
    showStep(nextIndex);
  };
  return (
    <dialog
      aria-labelledby="conversation-tour-title"
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-amber-200/25 bg-[#15110d] p-5 text-stone-100 shadow-2xl backdrop:bg-black/70 sm:p-7"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={keepFocusInTour}
      ref={dialogRef}
    >
      <h2 aria-describedby="conversation-tour-step" className={joinClasses("rounded-md font-serif text-2xl", FOCUS_RING)}
        id="conversation-tour-title" ref={headingRef} tabIndex={-1}>{EXPLORER_TOUR_TITLE}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-300">{EXPLORER_TOUR_INTRO}</p>
      <div className="mt-5 grid gap-3" id="conversation-tour-step">
        <h3 className="font-serif text-xl">{current.title}</h3>
        <ul className="list-disc space-y-3 pl-5">
          {current.paragraphs.map(text => <li className="text-sm leading-6 [overflow-wrap:anywhere]" key={text}>{text}</li>)}
        </ul>
      </div>
      {/* Initial focus describes the first step; only navigation updates this region. */}
      <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {step.announce ? [current.title, ...current.paragraphs].join(" ") : ""}
      </p>
      <nav aria-label={EXPLORER_TOUR_STEPS_LABEL} className="mt-5 flex flex-wrap gap-2">
        {EXPLORER_TOUR_STEPS.map((topic, index) => (
          <button aria-current={index === step.index ? "step" : undefined} className={SECONDARY_BUTTON}
            key={topic.title} onClick={() => showStep(index)} type="button">{topic.title}</button>
        ))}
      </nav>
      <p className="mt-5 text-sm leading-6 text-stone-300">{EXPLORER_TOUR_CLOSE_REASON}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step.index < EXPLORER_TOUR_STEPS.length - 1
          ? <button className={PRIMARY_BUTTON} onClick={nextStep} type="button">{EXPLORER_TOUR_NEXT}</button>
          : null}
        <button className={SECONDARY_BUTTON} onClick={onClose} ref={backButtonRef} type="button">{EXPLORER_TOUR_BACK}</button>
      </div>
    </dialog>
  );
}
