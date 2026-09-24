import type { Metadata } from "next";

import { ExplorerCompassComparison } from "@/components/solmind/ExplorerCompassComparison";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";

export const metadata: Metadata = {
  title: "Explorer conversation prototype - SolMind MVP0",
  description: `A fixed, local, in-memory ${SOLMIND_TERMS.explorerRole} conversation with the ${SOLMIND_TERMS.virtualGuide}, supported by a Compass and a Forming Waypoint.`,
};

export default function ExplorerCompassComparisonPage() {
  return <ExplorerCompassComparison />;
}
