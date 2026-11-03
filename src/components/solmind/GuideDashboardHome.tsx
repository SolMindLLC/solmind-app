import { GUIDE_DASHBOARD, GUIDE_DASHBOARD_HEADING_ID } from "@/lib/solmind/guideDashboardHome";

import { SECONDARY_BUTTON } from "./ExplorerConversationScreenNotYetImplemented";
import { GuideWorkspaceFrame } from "./GuideWorkspaceFrame";
import {
  HomeCard, HomeCardLink, HomeHeader, HomeNotConnectedAction, HomeSessionWarning, HomeSignOut,
} from "./WorkspaceHomeParts";

// The signed-in Guide home, the Dashboard, in the Guide workspace frame
// (Paul's 2026-11-02 decisions: "Mockup cards, no names"). Presentation only:
// GuideHome.tsx keeps every binding, timer, page-event and sign-out rule and
// passes only whether a sign-out is pending, whether the session warning
// shows, and the sign-out action. The four cards follow the Guide dashboard
// mockup without names, counts or sample times; the Guide Assistant card
// carries the "AI" badge. Three card buttons have no working screen yet and
// explain themselves; "View Waypoint Suggestions" links the existing page.
// While a sign-out is pending every link on the page shows in its non-link
// form, as on the Explorer Overview.

// Each not-connected card button's sentence id (distinct from the menu's).
const actionId = (card: string) => `not-connected-dashboard-${card}`;

type DashboardProps = Readonly<{ pending: boolean; warning: boolean; onSignOut: () => void }>;

export function GuideDashboardHome({ pending, warning, onSignOut }: DashboardProps) {
  const { explorers, assistant, appointment, suggestions } = GUIDE_DASHBOARD;

  return (
    <GuideWorkspaceFrame linksDisabled={pending} page="dashboard" skipTargetId={GUIDE_DASHBOARD_HEADING_ID}>
      <div className="grid gap-6 px-3 pb-10 pt-5 sm:px-6 lg:px-8">
        <HomeHeader
          eyebrow={GUIDE_DASHBOARD.eyebrow}
          headingId={GUIDE_DASHBOARD_HEADING_ID}
          subtitle={GUIDE_DASHBOARD.subtitle}
          title={GUIDE_DASHBOARD.title}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <HomeCard id="dashboard-explorers" title={explorers.title}>
            <p className="text-sm leading-6 text-stone-300">{explorers.body}</p>
            <HomeNotConnectedAction
              className={SECONDARY_BUTTON}
              explanation={explorers.explanation}
              id={actionId("explorers")}
              label={explorers.action}
            />
          </HomeCard>
          <HomeCard badge={assistant.badge} id="dashboard-assistant" title={assistant.title}>
            <p className="text-sm leading-6 text-stone-300">{assistant.body}</p>
            <HomeNotConnectedAction
              className={SECONDARY_BUTTON}
              explanation={assistant.explanation}
              id={actionId("assistant")}
              label={assistant.action}
            />
          </HomeCard>
          <HomeCard id="dashboard-appointment" title={appointment.title}>
            <p className="text-sm leading-6 text-stone-300">{appointment.body}</p>
            <HomeNotConnectedAction
              className={SECONDARY_BUTTON}
              explanation={appointment.explanation}
              id={actionId("appointments")}
              label={appointment.action}
            />
          </HomeCard>
          <HomeCard id="dashboard-suggestions" title={suggestions.title}>
            <p className="text-sm leading-6 text-stone-300">{suggestions.body}</p>
            <div className="flex flex-wrap items-start gap-3">
              <HomeCardLink className={SECONDARY_BUTTON} disabled={pending} href={suggestions.href}>
                {suggestions.action}
              </HomeCardLink>
            </div>
          </HomeCard>
        </div>
        <HomeSessionWarning shown={warning} />
        <HomeSignOut label={GUIDE_DASHBOARD.signOut} onSignOut={onSignOut} pending={pending} pendingLabel={GUIDE_DASHBOARD.signingOut} />
      </div>
    </GuideWorkspaceFrame>
  );
}
