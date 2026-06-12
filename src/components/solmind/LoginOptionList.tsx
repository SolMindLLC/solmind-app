import { RoleBadge } from "@/components/solmind/RoleBadge";
import { SOLMIND_LOGIN_OPTIONS } from "@/lib/solmind/loginOptions";

export function LoginOptionList() {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {SOLMIND_LOGIN_OPTIONS.map((option) => (
        <section
          key={option.role}
          className="rounded-2xl border border-slate-700 p-5"
        >

          <RoleBadge role={option.role} />

          <h2 className="mt-3 text-xl font-semibold">{option.title}</h2>

          <p className="mt-3 text-sm text-slate-300">
            {option.description}
          </p>

          <p className="mt-4 rounded-2xl bg-slate-800 p-3 text-sm text-slate-300">
            {option.authenticationSummary}
          </p>

          <button className="mt-5 rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-50">
            {option.ctaLabel}
          </button>
        </section>
      ))}
    </div>
  );
}