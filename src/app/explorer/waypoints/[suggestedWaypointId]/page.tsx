import Link from "next/link";
import { notFound } from "next/navigation";

import { ExplorerSuggestedWaypointDetail } from "@/components/solmind/ExplorerSuggestedWaypointDetail";
import { ExplorerWorkspaceFrame } from "@/components/solmind/ExplorerWorkspaceFrame";
import { isSuggestedWaypointExplorerId } from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";

type ExplorerSuggestionPageProps = Readonly<{
  params: Promise<Readonly<{ suggestedWaypointId: string }>>;
}>;

// The Explorer workspace frame with Waypoints as the current section (Paul's
// 2026-11-02 decisions); the back link and the detail read are unchanged.
export default async function ExplorerSuggestedWaypointPage({
  params,
}: ExplorerSuggestionPageProps) {
  const { suggestedWaypointId } = await params;
  if (!isSuggestedWaypointExplorerId(suggestedWaypointId)) {
    notFound();
  }

  return (
    <ExplorerWorkspaceFrame page="waypointDetail">
      <section className="mx-auto w-full max-w-4xl px-3 pb-12 pt-5 sm:px-6 lg:px-8">
        <Link
          className="inline-flex items-center justify-center rounded-full border border-amber-200/25 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          href={`/explorer/waypoints?focus=${encodeURIComponent(suggestedWaypointId)}`}
        >
          Back to Waypoint Suggestions
        </Link>
        <ExplorerSuggestedWaypointDetail suggestedWaypointId={suggestedWaypointId} />
      </section>
    </ExplorerWorkspaceFrame>
  );
}
