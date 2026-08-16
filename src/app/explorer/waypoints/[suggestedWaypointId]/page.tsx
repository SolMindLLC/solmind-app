import Link from "next/link";
import { notFound } from "next/navigation";

import { ExplorerSuggestedWaypointDetail } from "@/components/solmind/ExplorerSuggestedWaypointDetail";
import { isSuggestedWaypointExplorerId } from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";

type ExplorerSuggestionPageProps = Readonly<{
  params: Promise<Readonly<{ suggestedWaypointId: string }>>;
}>;

export default async function ExplorerSuggestedWaypointPage({
  params,
}: ExplorerSuggestionPageProps) {
  const { suggestedWaypointId } = await params;
  if (!isSuggestedWaypointExplorerId(suggestedWaypointId)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 py-12 text-slate-900 sm:px-8">
      <section className="mx-auto max-w-4xl">
        <Link
          className="inline-flex rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50"
          href={`/explorer/waypoints?focus=${encodeURIComponent(suggestedWaypointId)}`}
        >
          Back to Waypoint Suggestions
        </Link>
        <ExplorerSuggestedWaypointDetail suggestedWaypointId={suggestedWaypointId} />
      </section>
    </main>
  );
}
