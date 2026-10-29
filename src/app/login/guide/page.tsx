import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";
import { LoopbackSignInAddressWarning } from "@/components/solmind/LoopbackSignInAddressWarning";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";

export const metadata: Metadata = { title: "Guide sign-in - SolMind MVP0" };

export const dynamic = "force-dynamic";

export default function GuideLoginPage() {
  let configuredOrigin: string | null = null;
  try {
    const trustedOrigin = loadTrustedApplicationOrigin();
    const hostname = new URL(trustedOrigin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") configuredOrigin = trustedOrigin;
  } catch { /* Invalid or unavailable public configuration supplies no link. */ }
  return <>
    <LoopbackSignInAddressWarning configuredOrigin={configuredOrigin} role="guide" />
    <LoginExperience initialGuide />
  </>;
}
