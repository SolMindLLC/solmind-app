import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";

const adminPanels = ["Guide Invites", "Methodology", "System QA"];

export default function AdminPage() {
  return (
    <PageShell>
      <BackLink />

      <Panel className="mt-10">
        <SectionLabel>Admin</SectionLabel>

        <h1 className="mt-4 text-4xl font-semibold">
          MVP0 administration console
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          Admin users can invite Guides, manage methodology versions, review
          system configuration, and perform MVP0 quality assurance.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {adminPanels.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
            >
              <h2 className="font-semibold">{item}</h2>
              <p className="mt-2 text-sm text-slate-400">Placeholder panel</p>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}