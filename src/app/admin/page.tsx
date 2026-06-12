import { BackLink } from "@/components/solmind/BackLink";
import { DashboardCard } from "@/components/solmind/DashboardCard";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { SOLMIND_PAGES } from "@/lib/solmind/pages";

const adminPanels = ["Guide Invites", "Methodology", "System QA"];

export default function AdminPage() {
  const page = SOLMIND_PAGES.admin;

  return (
    <PageShell>
      <BackLink />

      <Panel className="mt-10">
        <SectionLabel>{page.title}</SectionLabel>

        <h1 className="mt-4 text-4xl font-semibold">
          MVP0 administration console
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          {page.description}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {adminPanels.map((item) => (
            <DashboardCard key={item} title={item} />
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}