import Link from "next/link";

/** The three pages every sign-in page and footer points to. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted ${className}`}>
      <Link className="underline-offset-2 hover:underline" href="/legal/terms">Terms of use</Link>
      <Link className="underline-offset-2 hover:underline" href="/legal/privacy">Privacy</Link>
      <Link className="underline-offset-2 hover:underline" href="/legal/cookies">Cookies</Link>
    </nav>
  );
}
