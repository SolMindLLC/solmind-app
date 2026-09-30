import type { Metadata } from "next";

import { SignInPreview } from "@/components/solmind/SignInPreview";

export const metadata: Metadata = {
  title: "Sign-in preview - SolMind MVP0",
  description:
    "The approved sign-in screens as an unconnected preview. No code is sent or checked, and entries stay only in the page's memory until refresh.",
};

export default function LoginPage() {
  return <SignInPreview />;
}
