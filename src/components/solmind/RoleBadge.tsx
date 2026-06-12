import { SOLMIND_ROLE_LABELS, type SolMindRole } from "@/lib/solmind/roles";

type RoleBadgeProps = {
  role: SolMindRole;
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-cyan-300">
      {SOLMIND_ROLE_LABELS[role]}
    </span>
  );
}