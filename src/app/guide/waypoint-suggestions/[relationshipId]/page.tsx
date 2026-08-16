import { notFound } from "next/navigation";

import { BackLink } from "@/components/solmind/BackLink";
import { GuideSuggestedWaypointRelationshipList } from "@/components/solmind/GuideSuggestedWaypointRelationshipList";
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
        <h1 className="mt-4 text-4xl font-semibold">Suggested Waypoints</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review Guide-only drafts, pending sends, and suggestions already sent
          through this active Explorer relationship. Explorer-private activity
          and Waypoints never appear here.
        </p>
        <GuideSuggestedWaypointRelationshipList relationshipId={relationshipId} />
      </Panel>
    </PageShell>
  );
}
