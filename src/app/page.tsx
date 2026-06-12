import Link from "next/link";
import { SOLMIND_PRIMARY_NAV } from "@/lib/solmind/navigation";
import { SOLMIND_PAGES } from "@/lib/solmind/pages";

export default function Home() {
  const page = SOLMIND_PAGES.home;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-cyan-300">
          {page.title}
        </p>

        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">
          AI-assisted coaching support for Guides and Explorers
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          SolMind helps human coaches support clients with structured intake,
          reflection, check-ins, summaries, and safety-aware escalation.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {SOLMIND_PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.href === "/login"
                  ? "rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950"
                  : "rounded-full border border-slate-600 px-5 py-3"
              }
              title={item.description}
            >
              {item.label === "Login" ? "Start" : item.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}