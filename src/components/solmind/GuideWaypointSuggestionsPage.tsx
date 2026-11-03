import Link from "next/link";
import type { ReactNode } from "react";

import { SOLMIND_TERMS } from "@/lib/solmind/terms";

import { GuideWorkspaceFrame } from "./GuideWorkspaceFrame";

// The page around each of the three signed-in Guide Waypoint Suggestions
// pages (Paul's 2026-11-02 decisions): the Guide workspace frame with no menu
// entry current (the breadcrumb names the page), the page's back link and its
// "Guide workspace" panel, in the dark and amber look. Presentation only: each
// page keeps its own route checks, and its read and commands stay in its
// Guide Suggested Waypoint component. The texts are passed in unchanged.
//
// The pages are Server Components, so this file stays one too: it imports no
// client-only module, and the back link's classes are the conversation
// screen's secondary button written out (as on the Explorer Waypoint detail
// page).
//
// backFullDocument (set only by the entry page, whose back link goes to the
// signed-in Guide Dashboard) draws the back link as a plain full-document
// link: a client-side move into /guide/home could restore the Dashboard from
// the router cache with no server check (after a sign-out, browser Back then
// Forward), and GuideHome's pagehide/pageshow safeguard never runs on an
// in-app history move. Every other way into a signed-in home is a
// full-document link. The two inner back links stay client-side.

const BACK_LINK =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors border border-amber-200/25 bg-white/[0.03] px-4 py-2 text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const PANEL = "mt-6 rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5 sm:p-8";

type PageProps = Readonly<{
  backHref: string;
  backLabel: string;
  backFullDocument?: boolean;
  heading: string;
  intro: ReactNode;
  children: ReactNode;
}>;

export function GuideWaypointSuggestionsPage({ backHref, backLabel, backFullDocument = false, heading, intro, children }: PageProps) {
  return (
    <GuideWorkspaceFrame page="waypointSuggestions">
      <section className="mx-auto w-full max-w-5xl px-3 pb-12 pt-5 sm:px-6 lg:px-8">
        {backFullDocument ? (
          // Full document navigation retires this authenticated view and requests fresh server access.
          <a className={BACK_LINK} href={backHref}>
            {backLabel}
          </a>
        ) : (
          <Link className={BACK_LINK} href={backHref}>
            {backLabel}
          </Link>
        )}
        <div className={PANEL}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
            {`${SOLMIND_TERMS.guideRole} workspace`}
          </p>
          <h1 className="mt-3 font-serif text-3xl leading-tight text-stone-50 sm:text-4xl">{heading}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300">{intro}</p>
          {children}
        </div>
      </section>
    </GuideWorkspaceFrame>
  );
}
