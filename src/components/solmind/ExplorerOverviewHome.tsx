import { EXPLORER_OVERVIEW, OVERVIEW_HEADING_ID } from "@/lib/solmind/explorerOverviewHome";

import { PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON, UnwiredControl, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { ExplorerWorkspaceFrame } from "./ExplorerWorkspaceFrame";
import { HomeCard, HomeCardLink, HomeHeader, HomeSessionWarning, HomeSignOut } from "./WorkspaceHomeParts";

// The signed-in Explorer home, Overview, in the Explorer workspace frame
// (Paul's 2026-11-02 decisions: "Mockup cards, no names"). Presentation only:
// ExplorerHome.tsx keeps every binding, timer, page-event and sign-out rule
// and passes only whether a sign-out is pending, whether the session warning
// shows, and the sign-out action. The header, card, warning and sign-out parts
// are shared with the Guide Dashboard (WorkspaceHomeParts.tsx). While a
// sign-out is pending every link on the page shows in its non-link form, as
// before. The collapsed "Design previews" list below the cards was removed
// (Paul, decision queue 2026-11-04 21:44:03 CST).

type OverviewProps = Readonly<{ pending: boolean; warning: boolean; onSignOut: () => void }>;

export function ExplorerOverviewHome({ pending, warning, onSignOut }: OverviewProps) {
  const { begin, suggestions } = EXPLORER_OVERVIEW;

  return (
    <ExplorerWorkspaceFrame linksDisabled={pending} page="overview" skipTargetId={OVERVIEW_HEADING_ID}>
      <div className="grid gap-6 px-3 pb-10 pt-5 sm:px-6 lg:px-8">
        <HomeHeader
          eyebrow={EXPLORER_OVERVIEW.eyebrow}
          headingId={OVERVIEW_HEADING_ID}
          subtitle={EXPLORER_OVERVIEW.subtitle}
          title={EXPLORER_OVERVIEW.title}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <HomeCard badge={begin.badge} id="overview-begin" title={begin.title}>
            <p className="text-sm leading-6 text-stone-300">{begin.body}</p>
            <div className="flex flex-wrap items-start gap-3">
              <HomeCardLink className={PRIMARY_BUTTON} disabled={pending} href={begin.talkHref}>
                {begin.talk}
              </HomeCardLink>
              <UnwiredControl
                className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
                noteKey="virtualGuideCanSee"
                scope="overview"
              >
                {begin.canSee}
              </UnwiredControl>
            </div>
          </HomeCard>
          <HomeCard id="overview-suggestions" title={suggestions.title}>
            <p className="text-sm leading-6 text-stone-300">{suggestions.body}</p>
            <div className="flex flex-wrap items-start gap-3">
              <HomeCardLink className={SECONDARY_BUTTON} disabled={pending} href={suggestions.openHref}>
                {suggestions.open}
              </HomeCardLink>
            </div>
          </HomeCard>
        </div>
        <HomeSessionWarning shown={warning} />
        <HomeSignOut
          label={EXPLORER_OVERVIEW.signOut}
          onSignOut={onSignOut}
          pending={pending}
          pendingLabel={EXPLORER_OVERVIEW.signingOut}
        />
      </div>
    </ExplorerWorkspaceFrame>
  );
}
