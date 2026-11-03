import { Suspense } from "react";

import { GuideSuggestedWaypointRelationshipEntry } from "@/components/solmind/GuideSuggestedWaypointRelationshipEntry";
import { GuideWaypointSuggestionsPage } from "@/components/solmind/GuideWaypointSuggestionsPage";
import { GUIDE_HOME_ROUTE } from "@/lib/solmind/routeAccess";

// In the Guide workspace frame (Paul's 2026-11-02 decisions). The back link
// now goes to the signed-in Guide Dashboard instead of the /guide prototype,
// as a full-document link, so the server checks access again.
export default function GuideSuggestedWaypointEntryPage() {
  return (
    <GuideWaypointSuggestionsPage
      backFullDocument
      backHref={GUIDE_HOME_ROUTE}
      backLabel="Back to Guide dashboard"
      heading="Suggested Waypoints"
      intro="Choose an Explorer with an active Guide relationship. This page only opens the relationship workspace; it does not create, send, schedule, withdraw, or deliver a suggestion."
    >
      <Suspense fallback={<p className="mt-8 text-stone-300">Loading Suggested Waypoints...</p>}>
        <GuideSuggestedWaypointRelationshipEntry />
      </Suspense>
    </GuideWaypointSuggestionsPage>
  );
}
