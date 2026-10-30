import Image from "next/image";
import type { ReactNode } from "react";

export type SheetMeta = { title: string; ref: string; version: string; status: string; date: string; audience: string };

/** The document as it is issued: dark masthead with title and reference, then the text on white, footer at the end. */
/** The document itself: reference, date and version only. Status ("draft") is a staff matter and is shown outside the sheet. */
export function LegalSheet({ meta, intro, children }: { meta: SheetMeta; intro?: string; children: ReactNode }) {
  const marked = meta.audience === "Private & confidential"; // the only marking that belongs on the paper
  return (
    <article className="mx-auto max-w-[794px] overflow-hidden rounded-sm bg-white shadow-[0_2px_24px_rgba(14,19,17,.14)]" aria-label={meta.title}>
      <header className="bg-[#0e1311] px-6 pb-7 pt-6 text-white sm:px-14 sm:pb-9 sm:pt-9">
        <div className="flex items-start justify-between gap-4">
          <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={132} height={27} />
          {marked && <span className="rounded-full border border-white/30 px-3 py-1 text-xs">{meta.audience}</span>}
        </div>
        <h1 className="mt-8 text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-[2.1rem]">{meta.title}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
          {([["Ref", meta.ref], ["Date", meta.date], ["Version", meta.version]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-xs uppercase tracking-wide text-white/60">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
      </header>
      <div className="px-6 py-8 sm:px-14 sm:py-12">
        {intro && <p className="mb-6 text-[15px] leading-relaxed text-ink">{intro}</p>}
        {children}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-4 text-xs text-muted sm:px-14">
        <span>onesimplesite.co.uk</span>{marked && <span>{meta.audience}</span>}<span>{meta.title} · {meta.ref}</span>
      </footer>
    </article>
  );
}
