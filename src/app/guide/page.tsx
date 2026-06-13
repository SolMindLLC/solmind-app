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
          {SOLMIND_GUIDE_DASHBOARD_PANELS.map((panel) => (
            <DashboardCard key={panel.title} title={panel.title} />
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}