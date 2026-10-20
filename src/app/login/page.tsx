import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";

export const metadata: Metadata = {
  title: "Sign in - SolMind MVP0",
  description: "Explorer sign-in with emailed codes. Guide and Admin sign-in screens remain previews.",
};

export default function LoginPage() {
  return <LoginExperience />;
}
