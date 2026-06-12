import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-50">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-cyan-300">
          ← Back to SolMind
        </Link>

        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            MVP0 Login
          </p>

          <h1 className="mt-4 text-4xl font-semibold">
            Sign in with email or SMS
          </h1>

          <p className="mt-4 text-slate-300">
            MVP0 will support passwordless login for Guides and Explorers.
            Admin users will use a password plus a verification code.
          </p>

          <div className="mt-8 space-y-4">
            <input
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-50"
              placeholder="Email or phone number"
            />

            <button className="rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950">
              Send verification code
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}