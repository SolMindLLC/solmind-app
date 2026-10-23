import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";

export const metadata: Metadata = { title: "Admin sign-in - SolMind MVP0" };

export default function AdminLoginPage() {
  return <LoginExperience initialAdmin />;
}
