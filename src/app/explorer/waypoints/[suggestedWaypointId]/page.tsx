import Link from "next/link";
import { notFound } from "next/navigation";

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
      <section className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#1d6768]">Explorer workspace</p>
        <h1 className="mt-3 text-3xl font-semibold">Suggestion detail</h1>
        <p className="mt-4 text-slate-600">
          The authenticated inbox is connected. The delivered suggestion detail
          remains the next separately reviewed read increment, so no suggestion
          content is displayed on this page yet.
        </p>
        <Link
          className="mt-6 inline-flex rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50"
          href={`/explorer/waypoints?focus=${encodeURIComponent(suggestedWaypointId)}`}
        >
          Back to Waypoint Suggestions
        </Link>
      </section>
    </main>
  );
}
