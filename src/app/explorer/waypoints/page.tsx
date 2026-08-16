import { Suspense } from "react";

import { ExplorerSuggestedWaypointInbox } from "@/components/solmind/ExplorerSuggestedWaypointInbox";

export default function ExplorerWaypointsPage() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-[#f7f5ef] px-5 py-12 text-slate-900">
          Loading Waypoint Suggestions...
        </main>
      )}
    >
      <ExplorerSuggestedWaypointInbox />
    </Suspense>
  );
}
