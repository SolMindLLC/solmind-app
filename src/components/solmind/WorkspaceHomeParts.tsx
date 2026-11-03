import type { ReactNode } from "react";

import { SESSION_WARNING } from "@/lib/solmind/explorerLoginJourney";

import {
  FOCUS_RING, NotConnectedButton, NotConnectedExplanation, NotConnectedLine, SECONDARY_BUTTON, joinClasses,
} from "./ExplorerConversationScreenNotYetImplemented";

// Shared presentation for the signed-in home pages in the workspace frame,
// the Explorer's Overview (ExplorerOverviewHome.tsx) and the Guide's
// Dashboard (GuideDashboardHome.tsx), Paul's 2026-11-02 decisions ("Mockup
// cards, no names"). The class strings are copied from the home mockups
// without their bands, notes, names or counts. Presentation only: each home's
// binding owns its session, warning and sign-out rules and passes only flags
// and the sign-out action.

const EYEBROW_CLASS = "text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300";
const CARD_CLASS =
  "grid content-start gap-3 rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]";
const BADGE_CLASS = "rounded-full border border-amber-300/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100";
const DISABLED_LINK = "opacity-60";

type HeaderProps = Readonly<{ eyebrow: string; title: string; subtitle: string; headingId: string }>;

// The page header; its heading is the skip target and takes focus.
export function HomeHeader({ eyebrow, title, subtitle, headingId }: HeaderProps) {
  return (
    <header className="grid max-w-3xl gap-1.5">
      <p className={EYEBROW_CLASS}>{eyebrow}</p>
      <h1
        className={joinClasses("rounded-md font-serif text-3xl leading-tight text-stone-50 sm:text-4xl", FOCUS_RING)}
        id={headingId}
        tabIndex={-1}
      >
        {title}
      </h1>
      <p className="text-sm leading-6 text-stone-300">{subtitle}</p>
    </header>
  );
}

type CardProps = Readonly<{ id: string; title: string; badge?: string; children: ReactNode }>;

export function HomeCard({ id, title, badge, children }: CardProps) {
  return (
    <article aria-labelledby={`${id}-title`} className={CARD_CLASS}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-xl text-stone-50" id={`${id}-title`}>
          {title}
        </h2>
        {badge ? <span className={BADGE_CLASS}>{badge}</span> : null}
      </div>
      {children}
    </article>
  );
}

type CardLinkProps = Readonly<{ href: string; className: string; disabled: boolean; children: ReactNode }>;

// A full-document link (fresh server access, as the menu); its non-link form
// while a sign-out is pending.
export function HomeCardLink({ href, className, disabled, children }: CardLinkProps) {
  if (disabled) {
    return <span aria-disabled="true" className={joinClasses(className, DISABLED_LINK)}>{children}</span>;
  }
  return <a className={className} href={href}>{children}</a>;
}

type ActionProps = Readonly<{ id: string; className: string; label: string; explanation: string }>;

// A card button with no working screen yet: the grey "Not connected yet" line
// under its label and, when activated, its sentence directly beneath it, as
// the menu entries do. It stays a button while a sign-out is pending.
export function HomeNotConnectedAction({ id, className, label, explanation }: ActionProps) {
  return (
    <div className="grid min-w-0 justify-items-start gap-1.5">
      <NotConnectedButton className={className} explanationId={id}>
        <span className="flex flex-col items-center leading-tight">
          <span className="inline-flex items-center gap-2">{label}</span>
          <NotConnectedLine />
        </span>
      </NotConnectedButton>
      <NotConnectedExplanation id={id} text={explanation} />
    </div>
  );
}

// The existing session warning, shown only while the binding says so.
export function HomeSessionWarning({ shown }: Readonly<{ shown: boolean }>) {
  return shown ? (
    <p className="max-w-3xl rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50" role="status">
      {SESSION_WARNING}
    </p>
  ) : null;
}

type SignOutProps = Readonly<{ pending: boolean; onSignOut: () => void; label: string; pendingLabel: string }>;

export function HomeSignOut({ pending, onSignOut, label, pendingLabel }: SignOutProps) {
  return (
    <div>
      <button
        className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-60")}
        disabled={pending}
        onClick={onSignOut}
        type="button"
      >
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}
