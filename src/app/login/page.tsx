import type { Metadata } from "next";
import { LoginExperience } from "@/components/solmind/LoginExperience";

export const metadata: Metadata = {
  title: "Sign in - SolMind MVP0",
  description: "Explorer sign-in with emailed codes and Guide sign-in with a password plus emailed code. Admin sign-in remains a preview.",
};

export default function LoginPage() {
  return <LoginExperience />;
}
