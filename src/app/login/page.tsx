import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { LoginOptionList } from "@/components/solmind/LoginOptionList";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { SOLMIND_PAGES } from "@/lib/solmind/pages";

export default function LoginPage() {
  const page = SOLMIND_PAGES.login;

  return (
    <PageShell maxWidth="3xl">
      <BackLink />

      <Panel className="mt-12">
        <SectionLabel>{page.title}</SectionLabel>

        <h1 className="mt-4 text-4xl font-semibold">
          Sign in with email or SMS
        </h1>

        <p className="mt-4 text-slate-300">{page.description}</p>

        <LoginOptionList />

        <div className="mt-8 space-y-4">
          <input
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-50"
            placeholder="Email, phone number, or Admin username"
          />

  <button className="rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950">
    Continue to verification
  </button>
</div>
      </Panel>
    </PageShell>
  );
}