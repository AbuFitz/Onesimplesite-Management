"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Maximize2, X } from "lucide-react";

/** Shows a record (ticket, agreement, project) over the page you were on, instead of taking you away from it. */
export function RecordModal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (!d.open) d.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  const close = () => router.back();
  return (
    <dialog ref={ref} aria-label="Details" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}
      className="m-0 h-dvh w-dvw max-h-none max-w-none overflow-hidden bg-white p-0 backdrop:bg-[rgba(14,19,17,.45)] sm:m-auto sm:h-[min(52rem,92dvh)] sm:w-[min(68rem,95vw)] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(14,19,17,.25)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-end gap-1 border-b border-line px-3 py-2" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
          <a href={path} className="btn btn-quiet !min-h-10 sm:!min-h-8 !px-2.5 text-[13px]"><Maximize2 size={14} aria-hidden /> Open as a page</a>
          <button type="button" onClick={close} aria-label="Close" className="btn btn-quiet !min-h-10 sm:!min-h-8 !w-8 !px-0"><X size={16} aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--canvas-2)] px-4 pb-8 pt-5 sm:px-8">{children}</div>
      </div>
    </dialog>
  );
}
