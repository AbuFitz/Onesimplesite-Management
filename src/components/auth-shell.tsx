import Image from "next/image";
import type { ReactNode } from "react";

/**
 * One layout for every page reached from sign-in or an emailed link. A bold brand panel on the left
 * (on top on a phone), the form on a clean card beside it.
 */
export function AuthShell({ title, intro, children, footer, kicker = "Welcome back" }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode; kicker?: string }) {
  return (
    <div className="grid min-h-dvh bg-bone lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative isolate overflow-hidden bg-ink px-6 pb-10 pt-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="absolute inset-0 -z-10 bg-[url(/brand/doc/mast-bg.webp)] bg-cover bg-center opacity-90" aria-hidden />
        <div className="absolute -bottom-24 -right-24 -z-10 size-72 rounded-full bg-spring/25 blur-3xl" aria-hidden />
        <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={170} height={34} priority />
        <div className="mt-10 lg:mt-0">
          <p className="mb-3 inline-block rounded-full bg-spring px-3 py-1 text-sm font-bold text-ink">{kicker}</p>
          <p className="max-w-md font-[family-name:var(--font-display)] text-[2.1rem] font-bold leading-[1.05] tracking-tight sm:text-5xl">Your website, <span className="text-spring">sorted.</span></p>
          <p className="mt-4 hidden max-w-sm text-lg text-white/75 lg:block">Everything about your site in one friendly place: updates, documents and help when you need it.</p>
        </div>
        <p className="hidden text-sm text-white/55 lg:block">onesimplesite.co.uk</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16">
        <div className="card mx-auto w-full max-w-md p-7 sm:p-9">
          <h1 className="text-[1.75rem]">{title}</h1>
          {intro && <p className="mt-2 text-muted">{intro}</p>}
          <div className="mt-7">{children}</div>
        </div>
        <div className="mx-auto mt-6 max-w-md text-center text-sm text-muted">
          {footer ?? <>Need a hand? <a className="font-semibold text-ink underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a></>}
        </div>
      </main>
    </div>
  );
}
