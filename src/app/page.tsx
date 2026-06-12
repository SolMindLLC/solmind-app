import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-cyan-300">
          SolMind MVP0
        </p>

        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">
          AI-assisted coaching support for Guides and Explorers
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          SolMind helps human coaches support clients with structured intake,
          reflection, check-ins, summaries, and safety-aware escalation.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950"
          >
            Start
          </Link>

          <Link
            href="/explorer"
            className="rounded-full border border-slate-600 px-5 py-3"
          >
            Explorer Preview
          </Link>

          <Link
            href="/guide"
            className="rounded-full border border-slate-600 px-5 py-3"
          >
            Guide Preview
          </Link>

          <Link
            href="/admin"
            className="rounded-full border border-slate-600 px-5 py-3"
          >
            Admin Preview
          </Link>
        </div>
      </section>
    </main>
  );
}