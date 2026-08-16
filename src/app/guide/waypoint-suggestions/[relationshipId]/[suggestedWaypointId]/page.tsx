import { notFound } from "next/navigation";

import { BackLink } from "@/components/solmind/BackLink";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";
import { isSuggestedWaypointId } from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";

type GuideSuggestionDetailPageProps = Readonly<{
  params: Promise<
    Readonly<{ relationshipId: string; suggestedWaypointId: string }>
  >;
}>;

export default async function GuideSuggestionDetailPage({
  params,
}: GuideSuggestionDetailPageProps) {
  const { relationshipId, suggestedWaypointId } = await params;
  if (
    !isSuggestedWaypointRelationshipId(relationshipId) ||
    !isSuggestedWaypointId(suggestedWaypointId)
  ) {
    notFound();
  }

  return (
    <PageShell maxWidth="5xl">
      <BackLink
        href={`/guide/waypoint-suggestions/${relationshipId}?focus=${encodeURIComponent(suggestedWaypointId)}`}
      >
        Back to Waypoint Suggestions
      </BackLink>

      <Panel className="mt-10">
        <SectionLabel>Guide workspace</SectionLabel>
        <h1 className="mt-4 text-4xl font-semibold">Suggestion detail</h1>
        <div className="mt-6 rounded-2xl border border-cyan-800 bg-cyan-950/30 p-6">
          <h2 className="text-xl font-semibold">Next bounded connection</h2>
          <p className="mt-2 text-slate-300">
            No suggestion detail is loaded on this page. A later bounded step
            will recheck the active Guide relationship and load only the exact
            Guide-visible detail for this suggestion before exposing review or
            command controls.
          </p>
        </div>
      </Panel>
    </PageShell>
  );
}
