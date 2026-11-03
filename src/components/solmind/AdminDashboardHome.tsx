import type { AdminOverviewView } from "@/lib/solmind/adminWorkspaceContract";
import { ADMIN_WORKSPACE_WORDING, formatAdminCount } from "@/lib/solmind/adminWorkspaceWording";

import { HomeCard } from "./WorkspaceHomeParts";

// The Admin Dashboard's content (minimal Admin screens, decision queue
// 2026-11-03 11:56:14 and 12:19:09): four counts in the home cards' dark and
// amber look. Presentation only; AdminWorkspacePages.tsx places it in the Admin
// workspace frame and AdminHome.tsx keeps every session rule. Activity is
// counted by sign-ins only.

const WORDING = ADMIN_WORKSPACE_WORDING.dashboard;

export function AdminDashboardCounts({ overview }: Readonly<{ overview: AdminOverviewView }>) {
  const cards = [
    ["guides", WORDING.guides, overview.guides, null],
    ["explorers", WORDING.explorers, overview.explorers, null],
    ["active", WORDING.active, overview.explorersSignedInLast7Days, WORDING.activeNote],
    ["paused", WORDING.paused, overview.accountsPausedNow, WORDING.pausedNote],
  ] as const;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {cards.map(([id, title, value, note]) => (
        <HomeCard id={`admin-dashboard-${id}`} key={id} title={title}>
          <p className="font-serif text-4xl text-amber-200">{formatAdminCount(value)}</p>
          {note === null ? null : <p className="text-sm leading-6 text-stone-300">{note}</p>}
        </HomeCard>
      ))}
    </div>
  );
}
