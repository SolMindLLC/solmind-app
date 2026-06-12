import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";

export default function LoginPage() {
  return (
    <PageShell maxWidth="3xl">
      <BackLink />

      <Panel className="mt-12">
        <SectionLabel>MVP0 Login</SectionLabel>

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
      </Panel>
    </PageShell>
  );
}