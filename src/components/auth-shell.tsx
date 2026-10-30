import Image from "next/image";
import type { ReactNode } from "react";

/** One layout for every page reached from sign-in or an emailed link. */
export function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-10 sm:pt-20">
      <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={180} height={36} priority />
      <h1 className="mt-10 text-[26px] leading-tight">{title}</h1>
      {intro && <p className="mt-2 text-muted">{intro}</p>}
      <div className="mt-8">{children}</div>
      <div className="mt-auto pt-12 text-sm text-muted">
        {footer ?? <>Need a hand? <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a></>}
      </div>
    </main>
  );
}
