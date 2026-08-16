import { notFound } from "next/navigation";

import { BackLink } from "@/components/solmind/BackLink";
import { GuideSuggestedWaypointDetail } from "@/components/solmind/GuideSuggestedWaypointDetail";
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
        <p className="mt-3 max-w-3xl text-slate-300">
          Review the exact current Guide-visible content and lifecycle state.
          This page does not expose Explorer-private activity and does not yet
          provide save, schedule, Pull Back, correction, or withdrawal controls.
        </p>
        <GuideSuggestedWaypointDetail
          relationshipId={relationshipId}
          suggestedWaypointId={suggestedWaypointId}
        />
      </Panel>
    </PageShell>
  );
}
