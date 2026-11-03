import { notFound } from "next/navigation";

import { GuideSuggestedWaypointRelationshipList } from "@/components/solmind/GuideSuggestedWaypointRelationshipList";
import { GuideWaypointSuggestionsPage } from "@/components/solmind/GuideWaypointSuggestionsPage";
import { isSuggestedWaypointRelationshipId } from "@/lib/solmind/suggestedWaypointRelationshipBrowserContract";

type GuideRelationshipPageProps = Readonly<{
  params: Promise<Readonly<{ relationshipId: string }>>;
}>;

// In the Guide workspace frame (Paul's 2026-11-02 decisions); the back link
// and the list read are unchanged.
export default async function GuideRelationshipSuggestedWaypointPage({
  params,
}: GuideRelationshipPageProps) {
  const { relationshipId } = await params;
  if (!isSuggestedWaypointRelationshipId(relationshipId)) {
    notFound();
  }

  return (
    <GuideWaypointSuggestionsPage
      backHref={`/guide/waypoint-suggestions?focus=${encodeURIComponent(relationshipId)}`}
      backLabel="Back to Explorer relationships"
      heading="Suggested Waypoints"
      intro="Review Guide-only drafts, pending sends, and suggestions already sent through this active Explorer relationship. Explorer-private activity and Waypoints never appear here."
    >
      <GuideSuggestedWaypointRelationshipList relationshipId={relationshipId} />
    </GuideWaypointSuggestionsPage>
  );
}
