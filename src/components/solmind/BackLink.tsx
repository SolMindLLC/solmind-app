import Link from "next/link";

type BackLinkProps = {
  href?: string;
  children?: React.ReactNode;
};

export function BackLink({
  href = "/",
  children = "← Back to SolMind",
}: BackLinkProps) {
  return (
    <Link href={href} className="text-sm text-cyan-300">
      {children}
    </Link>
  );
}