import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";

export const metadata: Metadata = { title: "Explorer sign-in - SolMind MVP0" };

export default function ExplorerLoginPage() {
  return <LoginExperience initialExplorer />;
}
