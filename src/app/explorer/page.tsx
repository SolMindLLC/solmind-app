import Link from "next/link";

export default function ExplorerPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-50">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-cyan-300">
          ← Back to SolMind
        </Link>

        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
              Explorer
            </p>

            <h1 className="mt-4 text-4xl font-semibold">
              Conversation with SolMind Virtual Guide
            </h1>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl bg-slate-800 p-4">
                Welcome. What would feel most helpful to explore today?
              </div>

              <div className="rounded-2xl border border-slate-700 p-4 text-slate-300">
                Explorer response area placeholder
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold">
              What we can talk about today
            </h2>

            <div className="mt-5 space-y-3">
              {[
                "Getting to know you",
                "Self-sabotage patterns",
                "Today’s check-in",
                "Goals and next steps",
                "Something difficult",
                "Just talk",
              ].map((topic) => (
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
      </section>
    </main>
  );
}