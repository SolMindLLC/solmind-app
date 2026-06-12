import { SOLMIND_EXPLORER_PROFILE_PREVIEW_FIELDS } from "@/lib/solmind/profile";

export function MiniProfileCard() {
  return (
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold">Mini profile</h2>

      <p className="mt-3 text-sm text-slate-300">
        Preview of the Explorer context that will help personalize reflection.
      </p>

      <dl className="mt-5 space-y-4">
        {SOLMIND_EXPLORER_PROFILE_PREVIEW_FIELDS.map((field) => (
          <div key={field.key} className="rounded-2xl border border-slate-700 p-4">
            <dt className="text-sm uppercase tracking-[0.2em] text-cyan-300">
              {field.label}
            </dt>
            <dd className="mt-2 font-medium text-slate-50">
              {field.previewValue}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}