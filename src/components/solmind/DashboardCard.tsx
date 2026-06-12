type DashboardCardProps = {
    title: string;
    description?: string;
  };
  
  export function DashboardCard({
    title,
    description = "Placeholder panel",
  }: DashboardCardProps) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
    );
  }