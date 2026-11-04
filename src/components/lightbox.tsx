"use client";
import { useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";

/** Opens a picture in a frame on top of the page (not a new tab). Esc, the backdrop or the X closes it. */
export function ImageLink({ src, name, className, children, download }: { src: string; name: string; className?: string; children: React.ReactNode; download?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog" title={`Open ${name}`}>{children}</button>
      <dialog ref={ref} aria-label={name} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
        className="m-auto max-h-[94dvh] w-[min(94vw,64rem)] max-w-none overflow-hidden rounded-2xl bg-white p-0 backdrop:bg-[rgba(9,9,11,.7)]">
        {open && (
          <div className="flex max-h-[94dvh] flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <p className="min-w-0 truncate text-sm font-semibold">{name}</p>
              <span className="flex shrink-0 items-center gap-1">
                {download && <a href={download} download className="grid size-10 place-items-center rounded-lg hover:bg-soft" aria-label="Download"><Download size={17} aria-hidden /></a>}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-10 place-items-center rounded-lg hover:bg-soft"><X size={18} aria-hidden /></button>
              </span>
            </header>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[#f4f4f5] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={name} className="max-h-[80dvh] w-auto max-w-full object-contain" />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
