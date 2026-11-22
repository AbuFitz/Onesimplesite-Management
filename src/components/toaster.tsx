"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

export type ToastDetail = { text: string; href?: string; label?: string };
/** Show a short confirmation from anywhere: `toast({ text: "Ticket created", href: "/support/…", label: "Open" })`. */
export const toast = (d: ToastDetail) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ToastDetail>("oss-toast", { detail: d })); };

/** One toast at a time, bottom centre, above the phone tab bar. It leaves by itself after a few seconds, and can be closed. */
export function Toaster() {
  const [t, setT] = useState<(ToastDetail & { n: number }) | null>(null);
  const timer = useRef(0);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<ToastDetail>).detail; setT({ ...d, n: Date.now() }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setT(null), 7000); };
    window.addEventListener("oss-toast", on);
    return () => { window.removeEventListener("oss-toast", on); window.clearTimeout(timer.current); };
  }, []);
  if (!t) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={t.n}>
      <span className="toast-ico" aria-hidden><Check size={16} /></span>
      <span className="toast-tx">{t.text}</span>
      {t.href && <Link href={t.href} className="toast-go" onClick={() => setT(null)}>{t.label ?? "Open"}</Link>}
      <button type="button" aria-label="Dismiss" onClick={() => setT(null)}>×</button>
    </div>
  );
}
