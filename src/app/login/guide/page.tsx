import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";

export const metadata: Metadata = { title: "Guide sign-in - SolMind MVP0" };

export default function GuideLoginPage() {
  return <LoginExperience initialGuide />;
}
