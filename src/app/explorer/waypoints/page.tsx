import { Suspense } from "react";

import { ExplorerSuggestedWaypointInbox } from "@/components/solmind/ExplorerSuggestedWaypointInbox";

export default function ExplorerWaypointsPage() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-[#050404] px-5 py-12 text-stone-100">
          Loading Waypoint Suggestions...
        </main>
      )}
    >
      <ExplorerSuggestedWaypointInbox />
    </Suspense>
  );
}
