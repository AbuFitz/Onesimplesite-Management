import Image from "next/image";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { origins } from "@/lib/env";
import { LegalLinks } from "./legal-links";
import { CookieNotice } from "./cookie-notice";

/**
 * One layout for every page reached from sign-in or an emailed link.
 * Customers (portal host) get the bold brand panel. The team (manage host) gets a plain, quick sign-in with no marketing.
 */
export async function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  const foot = footer ?? (portal ? <>Need a hand? <a className="font-semibold text-ink underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a></> : null);

  if (!portal) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bone px-5 py-10">
        <main id="main" className="w-full max-w-sm">
          <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={220} height={45} priority className="mx-auto mb-8" />
          <div className="card p-7">
            <h1 className="text-2xl">{title}</h1>
            {intro && <p className="mt-1.5 text-muted">{intro}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {foot && <div className="mt-5 text-center text-sm text-muted">{foot}</div>}
          <LegalLinks className="mt-4" />
        </main>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh bg-bone lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <CookieNotice />
      <aside className="relative isolate overflow-hidden bg-ink px-6 pb-12 pt-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-14" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="absolute inset-0 -z-10 bg-[url(/brand/doc/mast-bg.webp)] bg-cover bg-center opacity-90" aria-hidden />
        <div className="absolute -bottom-24 -right-24 -z-10 size-80 rounded-full bg-spring/25 blur-3xl" aria-hidden />
        <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={230} height={47} priority className="h-auto w-48 lg:w-64" />
        <div className="mt-12 lg:mt-0">
          <p className="max-w-lg font-[family-name:var(--font-display)] text-[2.4rem] font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-[4.25rem]">Your website, all in <span className="text-spring">one place.</span></p>
          <p className="mt-5 hidden max-w-md text-xl leading-snug text-white/80 lg:block lg:text-2xl">Follow your project, find your documents, pay online and get help from a real person.</p>
        </div>
        <p className="hidden text-base text-white/60 lg:block">onesimplesite.co.uk</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16">
        <div className="card mx-auto w-full max-w-md p-7 sm:p-9 lg:max-w-lg lg:p-11">
          <h1 className="text-[1.9rem] lg:text-4xl">{title}</h1>
          {intro && <p className="mt-2 text-muted lg:text-lg">{intro}</p>}
          <div className="mt-7 lg:text-lg">{children}</div>
        </div>
        {foot && <div className="mx-auto mt-6 max-w-md text-center text-sm text-muted lg:text-base">{foot}</div>}
        <LegalLinks className="mt-4" />
      </main>
    </div>
  );
}
