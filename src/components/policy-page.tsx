import Image from "next/image";
import Link from "next/link";
import { parseDoc, type Block } from "@/documents/parse";
import { BackLink } from "./back-link";

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A plain, readable web page for privacy, cookies and terms. Not the contract layout. */
export function PolicyPage({ title, intro, version, updated, body, others }: { title: string; intro: string; version: string; updated: string; body: string; others: { href: string; label: string }[] }) {
  const blocks = parseDoc(body);
  const sections = blocks.filter((b): b is Extract<Block, { t: "h" }> => b.t === "h");
  let n = 0;
  return (
    <div className="min-h-dvh bg-bone">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3"><BackLink /><Link href="/" aria-label="OneSimpleSite home" className="hidden sm:block"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={120} height={25} priority /></Link></div>
          <nav aria-label="Other pages" className="flex gap-1 text-sm">{others.map((o) => <Link key={o.href} href={o.href} className="rounded-lg px-3 py-1.5 text-muted hover:bg-bone hover:text-ink">{o.label}</Link>)}</nav>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden lg:block"><nav aria-label="On this page" className="sticky top-24 text-sm"><p className="mb-2 font-semibold">On this page</p><ul className="space-y-1">{sections.map((s) => <li key={s.text}><a className="block rounded-md px-2 py-1 text-muted hover:bg-white hover:text-ink" href={`#${slug(s.text)}`}>{s.text}</a></li>)}</ul></nav></aside>
        <article className="min-w-0 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(14,19,17,.05)] sm:p-10">
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-prose text-lg text-muted">{intro}</p>
          <p className="mt-4 text-sm text-muted">Version {version} · Updated {updated}</p>
          <div className="mt-8 max-w-prose space-y-4 text-[17px] leading-relaxed">
            {blocks.map((b, i) => {
              switch (b.t) {
                case "h": n++; return <h2 key={i} id={slug(b.text)} className="!mt-10 scroll-mt-24 border-t border-line pt-6 text-2xl">{n}. {b.text}</h2>;
                case "tsec": case "sub": return <h3 key={i} className="!mt-6 text-lg font-bold">{b.text}</h3>;
                case "clause": case "p": return <p key={i}>{b.t === "clause" ? b.text : b.text}</p>;
                case "bullet": return <ul key={i} className="list-disc pl-6"><li>{b.text}</li></ul>;
                case "note": return <p key={i} className="rounded-xl bg-[#fbf3d5] px-4 py-3 text-base">{b.text}</p>;
                case "kv": return <dl key={i} className="grid gap-1 rounded-xl bg-bone px-4 py-3 text-base sm:grid-cols-[13rem_1fr] sm:gap-4"><dt className="font-semibold">{b.label}</dt><dd>{b.value}</dd></dl>;
                default: return null;
              }
            })}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted"><BackLink label="Go back" /><span>Questions? Email <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a></span></div>
        </article>
      </main>
    </div>
  );
}
