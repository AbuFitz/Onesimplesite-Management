"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "./ui";

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  return { open, setOpen, ref };
}

const panel = "absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-[0_8px_30px_rgba(14,19,17,.08)]";
const item = "flex min-h-10 items-center rounded-lg px-3 text-sm text-ink hover:bg-soft";

export function NewMenu({ links }: { links: { href: string; label: string }[] }) {
  const { open, setOpen, ref } = usePopover();
  if (!links.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}><Plus size={16} aria-hidden /> New</button>
      {open && <div role="menu" className={panel}>{links.map((l) => <Link key={l.href} role="menuitem" href={l.href} className={item}>{l.label}</Link>)}</div>}
    </div>
  );
}

export function UserMenu({ name, role, children }: { name: string; role: string; children: ReactNode }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label={`Account menu for ${name}`} onClick={() => setOpen(!open)} className="rounded-full focus-visible:outline-offset-2"><Avatar name={name} size={36} /></button>
      {open && (
        <div role="menu" className={panel}>
          <div className="px-3 py-2"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted">{role}</p></div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href="/account" className={item}>My account</Link>
          {children}
        </div>
      )}
    </div>
  );
}
