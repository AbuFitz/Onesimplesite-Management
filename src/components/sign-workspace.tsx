"use client";
import { useRef, useState, type ReactNode } from "react";
import { FileDown, PenLine, X } from "lucide-react";

/**
 * The signing screen. The document sits in its own scrolling frame so the page never loses its place.
 * Desktop: document left, signing panel right, both always in view.
 * Phone: the document fills the screen and a bar at the bottom opens the signing panel as a sheet.
 */
export function SignWorkspace({ doc, panel, title, reference, pdfHref }: { doc: ReactNode; panel: ReactNode; title: string; reference: string; pdfHref?: string }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const onScroll = () => { const el = box.current; if (!el) return; const max = el.scrollHeight - el.clientHeight; setRead(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))); };
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
      <section aria-label="The document" className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_2px_28px_rgba(14,19,17,.08)]" style={{ height: "calc(100dvh - 9.5rem)", minHeight: 380 }}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5 text-sm">
          <p className="min-w-0 truncate"><span className="font-semibold">{title}</span><span className="text-muted"> · {reference}</span></p>
          {pdfHref && <a href={pdfHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold hover:bg-[#e6e2d8]"><FileDown size={15} aria-hidden /> PDF</a>}
        </div>
        <div className="read-bar" role="progressbar" aria-label="How much of the document you have scrolled through" aria-valuenow={read} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${read}%` }} /></div>
        <div ref={box} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain bg-[#e8e6df] p-2 sm:p-5" tabIndex={0} aria-label="Scroll to read the whole document">{doc}</div>
      </section>

      {open && <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-ink/40 lg:hidden" />}
      <aside id="sign" aria-label="Sign" className={`sign-aside fixed inset-x-3 bottom-3 z-30 max-h-[88dvh] overflow-y-auto rounded-[32px] p-5 transition-transform duration-200 motion-reduce:transition-none lg:static lg:z-auto lg:max-h-[calc(100dvh-9.5rem)] lg:translate-y-0 lg:rounded-3xl lg:border lg:border-line lg:shadow-[0_2px_28px_rgba(14,19,17,.08)] ${open ? "translate-y-0" : "max-lg:invisible max-lg:translate-y-full"}`} style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="-mb-9 flex justify-end lg:hidden"><button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-lg bg-bone" aria-label="Close signing panel"><X size={18} aria-hidden /></button></div>
        {panel}
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={() => setOpen(true)} className="btn w-full"><PenLine size={18} aria-hidden /> Sign this order</button>
      </div>
    </div>
  );
}
