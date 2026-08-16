import { notFound } from "next/navigation";

import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";

type GuideRelationshipPageProps = Readonly<{
  params: Promise<Readonly<{ relationshipId: string }>>;
}>;

export default async function GuideRelationshipSuggestedWaypointPage({
  params,
}: GuideRelationshipPageProps) {
  const { relationshipId } = await params;
  if (!isSuggestedWaypointRelationshipId(relationshipId)) {
    notFound();
  }

  return (
    <PageShell maxWidth="5xl">
      <BackLink
        href={`/guide/waypoint-suggestions?focus=${encodeURIComponent(relationshipId)}`}
      >
        Back to Explorer relationships
      </BackLink>

      <Panel className="mt-10">
        <SectionLabel>Guide workspace</SectionLabel>
        <h1 className="mt-4 text-4xl font-semibold">
          Suggested Waypoint relationship workspace
        </h1>
        <div className="mt-6 rounded-2xl border border-cyan-800 bg-cyan-950/30 p-6">
          <h2 className="text-xl font-semibold">Next bounded connection</h2>
          <p className="mt-2 text-slate-300">
            No Explorer or suggestion information is loaded on this page. The
            next bounded implementation step will recheck the selected Guide
            relationship and load only that Explorer&apos;s Guide-visible
            suggestion list.
          </p>
        </div>
      </Panel>
    </PageShell>
  );
}
