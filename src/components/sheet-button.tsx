"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Sheet } from "./sheet";

/**
 * A button that opens a form in a sheet (a bottom sheet on a phone, a centred card on a computer), so forms never sit open on the page.
 * It closes by itself once the page moves on (the form was sent and the page reloaded).
 */
export function SheetButton({ label, title, className = "lt-add", icon = true, children }: { label: string; title?: string; className?: string; icon?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname(), qs = useSearchParams().toString();
  useEffect(() => { setOpen(false); }, [path, qs]);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>{icon && <Plus size={18} aria-hidden />}<span>{label}</span></button>
      {open && createPortal(<Sheet open onClose={() => setOpen(false)} title={title ?? label}>{children}</Sheet>, document.body)}
    </>
  );
}
