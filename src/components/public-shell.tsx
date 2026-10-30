import Image from "next/image";
import type { ReactNode } from "react";

/** Frame for pages customers reach from an email link: calm, white, one clear task. */
export function PublicShell({ label, children, narrow = false }: { label?: string; children: ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`mx-auto flex h-14 items-center justify-between px-5 ${narrow ? "max-w-xl" : "max-w-3xl"}`}>
          <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={126} height={26} priority />
          {label && <span className="flex items-center gap-1.5 text-sm text-muted"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>{label}</span>}
        </div>
      </header>
      <main id="main" className={`mx-auto px-5 pb-24 pt-8 ${narrow ? "max-w-xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}
