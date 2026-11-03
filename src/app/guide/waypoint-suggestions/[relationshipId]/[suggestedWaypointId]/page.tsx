import { notFound } from "next/navigation";

import { GuideSuggestedWaypointDetail } from "@/components/solmind/GuideSuggestedWaypointDetail";
import { GuideWaypointSuggestionsPage } from "@/components/solmind/GuideWaypointSuggestionsPage";
import { isSuggestedWaypointId } from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";

type GuideSuggestionDetailPageProps = Readonly<{
  params: Promise<
    Readonly<{ relationshipId: string; suggestedWaypointId: string }>
  >;
}>;

// In the Guide workspace frame (Paul's 2026-11-02 decisions); the back link,
// the detail read and its commands are unchanged.
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
    <GuideWaypointSuggestionsPage
      backHref={`/guide/waypoint-suggestions/${relationshipId}?focus=${encodeURIComponent(suggestedWaypointId)}`}
      backLabel="Back to Waypoint Suggestions"
      heading="Suggestion detail"
      intro="Review the exact current Guide-visible content and lifecycle state. This page does not expose Explorer-private activity. A complete Guide-only draft can be edited, saved, reviewed, and scheduled; a pending suggestion can be pulled back during its available window. Blank-draft compose, delete, correction, and withdrawal remain separately gated."
    >
      <GuideSuggestedWaypointDetail
        relationshipId={relationshipId}
        suggestedWaypointId={suggestedWaypointId}
      />
    </GuideWaypointSuggestionsPage>
  );
}
