import { SOLMIND_ROUTE_ACCESS_RULES } from "@/lib/solmind/routeAccess";

export function RouteAccessPreview() {
  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold">Route access preview</h2>

      <p className="mt-3 text-sm text-slate-300">
        Static MVP0 preview of which roles should access each protected route.
      </p>

      <div className="mt-5 space-y-3">
        {SOLMIND_ROUTE_ACCESS_RULES.map((rule) => (
          <div
            key={rule.route}
            className="rounded-2xl border border-slate-700 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-50">{rule.label}</p>
                <p className="mt-1 text-sm text-slate-300">{rule.route}</p>
              </div>

              <p className="rounded-full bg-slate-800 px-3 py-1 text-sm text-cyan-300">
                {rule.allowedRoles.join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}