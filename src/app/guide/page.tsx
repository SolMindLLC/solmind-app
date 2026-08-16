import Link from "next/link";

import { BackLink } from "@/components/solmind/BackLink";
import { DashboardCard } from "@/components/solmind/DashboardCard";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { SOLMIND_GUIDE_DASHBOARD_PANELS } from "@/lib/solmind/dashboardPanels";
import { SOLMIND_PAGES } from "@/lib/solmind/pages";

export default function GuidePage() {
  const page = SOLMIND_PAGES.guide;

  return (
    <PageShell>
      <BackLink />

      <Panel className="mt-10">
        <SectionLabel>{page.title}</SectionLabel>

        <h1 className="mt-4 text-4xl font-semibold">
          Guide dashboard
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          {page.description}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SOLMIND_GUIDE_DASHBOARD_PANELS.map((dashboardPanel) => (
            <DashboardCard key={dashboardPanel.title} title={dashboardPanel.title} />
          ))}
        </div>

        <Link
          href="/guide/waypoint-suggestions"
          className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-cyan-700 bg-cyan-950/30 p-5 transition hover:border-cyan-400 hover:bg-cyan-950/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <span>
            <span className="block font-semibold">Suggested Waypoints</span>
            <span className="mt-1 block text-sm text-slate-300">
              Choose an Explorer with an active Guide relationship.
            </span>
          </span>
          <span className="font-semibold text-cyan-300">Open</span>
        </Link>
      </Panel>
    </PageShell>
  );
}
