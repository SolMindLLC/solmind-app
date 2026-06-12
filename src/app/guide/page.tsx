import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";

const guidePanels = ["Active Explorers", "Needs Review", "Safety Flags"];

export default function GuidePage() {
  return (
    <PageShell>
      <BackLink />

      <Panel className="mt-10">
        <SectionLabel>Guide</SectionLabel>

        <h1 className="mt-4 text-4xl font-semibold">
          Guide Assistant dashboard
        </h1>

        <p className="mt-4 max-w-3xl text-slate-300">
          Guides will see Explorer summaries, onboarding progress, flags,
          suggested follow-ups, and approved responses. Full transcripts are
          stored but not shown by default in MVP0.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {guidePanels.map((item) => (
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