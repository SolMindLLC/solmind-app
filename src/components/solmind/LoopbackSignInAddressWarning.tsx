"use client";

import { useSyncExternalStore } from "react";
import { loopbackSignInAddress, type LoopbackSignInRole } from "@/lib/solmind/loopbackSignInAddress";

const subscribe = () => () => undefined;
const serverOrigin = () => null;
const browserOrigin = () => typeof window === "undefined" ? null : window.location.origin;

/** A deliberate public link after hydration; no redirect, auth action or cookie access. */
export function LoopbackSignInAddressWarning({ configuredOrigin, role }: Readonly<{
  configuredOrigin: string | null; role: LoopbackSignInRole;
}>) {
  const currentOrigin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const destination = loopbackSignInAddress(currentOrigin, configuredOrigin, role);
  if (destination === null) return null;
  return <aside role="note" className="mx-auto mt-4 max-w-3xl rounded-xl border border-amber-500 bg-amber-50 p-4 text-slate-950">
    <p>localhost and 127.0.0.1 keep separate sign-ins. Use the configured SolMind address.</p>
    <a className="mt-2 inline-block font-semibold text-teal-900 underline" href={destination}>Use the configured sign-in address</a>
  </aside>;
}
