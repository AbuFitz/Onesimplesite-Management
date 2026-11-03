import Link from "next/link";

/** The three pages every sign-in page and footer points to. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted lg:hidden ${className}`}>
      <Link className="underline-offset-2 hover:underline" href="/legal/terms">Terms of use</Link>
      <Link className="underline-offset-2 hover:underline" href="/legal/privacy">Privacy</Link>
      <Link className="underline-offset-2 hover:underline" href="/legal/cookies">Cookies</Link>
    </nav>
  );
}

/** Pinned to the bottom right of every desktop screen. On a phone the same links sit at the end of the page instead, so they never cover a button. */
export function LegalDock() {
  return (
    <div className="pointer-events-none fixed bottom-3 right-4 z-20 hidden lg:block">
      <nav aria-label="Legal" className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-white/90 px-1.5 py-1 text-[12.5px] text-muted shadow-[0_1px_6px_rgba(14,19,17,.08)] backdrop-blur">
        <Link className="rounded-md px-2 py-1 hover:bg-bone hover:text-ink" href="/legal/terms">Terms of use</Link>
        <span aria-hidden className="h-3 w-px bg-line" />
        <Link className="rounded-md px-2 py-1 hover:bg-bone hover:text-ink" href="/legal/privacy">Privacy</Link>
        <span aria-hidden className="h-3 w-px bg-line" />
        <Link className="rounded-md px-2 py-1 hover:bg-bone hover:text-ink" href="/legal/cookies">Cookies</Link>
      </nav>
    </div>
  );
}
