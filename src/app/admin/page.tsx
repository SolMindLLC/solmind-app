import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-50">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-cyan-300">
          ← Back to SolMind
        </Link>

        <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Admin
          </p>

          <h1 className="mt-4 text-4xl font-semibold">
            MVP0 administration console
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            Admin users can invite Guides, manage methodology versions, review
            system configuration, and perform MVP0 quality assurance.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {["Guide Invites", "Methodology", "System QA"].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
              >
                <h2 className="font-semibold">{item}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Placeholder panel
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}