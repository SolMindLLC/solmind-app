import { BackLink } from "@/components/solmind/BackLink";
import { ExplorerExperiencePrototype } from "@/components/solmind/ExplorerExperiencePrototype";
import { PageShell } from "@/components/solmind/PageShell";

export default function ExplorerPage() {
  return (
    <PageShell>
      <BackLink />

      <div className="mt-10">
        <ExplorerExperiencePrototype />
      </div>
    </PageShell>
  );
}
