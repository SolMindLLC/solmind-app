import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { SOLMIND_PAGES } from "@/lib/solmind/pages";
import { SOLMIND_EXPLORER_TOPICS } from "@/lib/solmind/topics";

export default function ExplorerPage() {
  const page = SOLMIND_PAGES.explorer;

  return (
    <PageShell>
      <BackLink />

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel>
          <SectionLabel>{page.title}</SectionLabel>

          <h1 className="mt-4 text-4xl font-semibold">
            Conversation with SolMind Virtual Guide
          </h1>

          <p className="mt-4 text-slate-300">{page.description}</p>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl bg-slate-800 p-4">
              Welcome. What would feel most helpful to explore today?
            </div>

            <div className="rounded-2xl border border-slate-700 p-4 text-slate-300">
              Explorer response area placeholder
            </div>
          </div>
        </Panel>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold">
            What we can talk about today
          </h2>

          <div className="mt-5 space-y-3">
            {SOLMIND_EXPLORER_TOPICS.map((topic) => (
              <button
                key={topic}
                className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-left"
              >
                {topic}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}