import { Suspense } from "react";

import { BackLink } from "@/components/solmind/BackLink";
import { GuideSuggestedWaypointRelationshipEntry } from "@/components/solmind/GuideSuggestedWaypointRelationshipEntry";
import { PageShell } from "@/components/solmind/PageShell";
import { Panel } from "@/components/solmind/Panel";
import { SectionLabel } from "@/components/solmind/SectionLabel";

export default function GuideSuggestedWaypointEntryPage() {
  return (
    <PageShell maxWidth="5xl">
      <BackLink href="/guide">Back to Guide dashboard</BackLink>

      <Panel className="mt-10">
        <SectionLabel>Guide workspace</SectionLabel>
        <h1 className="mt-4 text-4xl font-semibold">Suggested Waypoints</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Choose an Explorer with an active Guide relationship. This page only
          opens the relationship workspace; it does not create, send, schedule,
          withdraw, or deliver a suggestion.
        </p>

        <Suspense fallback={<p className="mt-8 text-slate-300">Loading Suggested Waypoints...</p>}>
          <GuideSuggestedWaypointRelationshipEntry />
        </Suspense>
      </Panel>
    </PageShell>
  );
}
