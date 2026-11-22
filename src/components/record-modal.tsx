"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { ModalCloseContext } from "./modal-context";

/** Shows a record (ticket, agreement, project) over the page you were on, instead of taking you away from it. */
export function RecordModal({ children, variant = "record", title }: { children: React.ReactNode; variant?: "record" | "create"; title?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const path = usePathname();
  const qs = useSearchParams().toString();
  // Every save or step inside the popup adds a history entry. Count them, so the X can leave the popup in one go instead of walking back through each one.
  const moves = useRef(0), seen = useRef(`${path}?${qs}`);
  useEffect(() => { const now = `${path}?${qs}`; if (now !== seen.current) { seen.current = now; moves.current += 1; } }, [path, qs]);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (!d.open) d.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  const close = () => { if (moves.current > 0) window.history.go(-(moves.current + 1)); else router.back(); };
  return (
    <dialog ref={ref} aria-label="Details" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}
      className={`rec-dlg ${variant === "create" ? "cm-dlg" : ""}`}>
      <div className="flex h-full flex-col">
        {variant === "create" ? (
          <div className="cm-head"><h2>{title}</h2><button type="button" onClick={close} aria-label="Close" className="iconbtn"><X size={18} aria-hidden /></button></div>
        ) : (
        <div className="rec-head" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
          <a href={path} className="btn btn-quiet !min-h-10 sm:!min-h-8 !px-2.5 text-[13px]"><Maximize2 size={14} aria-hidden /> Open as a page</a>
          <button type="button" onClick={close} aria-label="Close" className="btn btn-quiet !min-h-10 sm:!min-h-8 !w-8 !px-0"><X size={16} aria-hidden /></button>
        </div>
        )}
        <div className={variant === "create" ? "cm-body" : "min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-8"}><ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider></div>
      </div>
    </dialog>
  );
}
