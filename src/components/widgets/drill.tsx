"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { Sheet } from "../sheet";

function Panel({ title, href, linkLabel, detail, onClose }: { title: string; href: string; linkLabel: string; detail: ReactNode; onClose: () => void }) {
  return createPortal(
    <Sheet open onClose={onClose} title={title}>
      <div className="dr-body">{detail}</div>
      <Link href={href} className="btn btn-dark dr-go" onClick={onClose}>{linkLabel} <ArrowUpRight size={16} aria-hidden /></Link>
    </Sheet>, document.body);
}

/** A KPI tile that opens a short summary first, with the way through to the full page one tap further. */
export function DrillTile({ title, href, linkLabel = "Open", detail, tone, children, label }: { title: string; href: string; linkLabel?: string; detail: ReactNode; tone?: string; children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="wdg kpi kpi-btn" data-tone={tone} aria-haspopup="dialog" aria-label={label} onClick={() => setOpen(true)}>{children}</button>
      {open && <Panel title={title} href={href} linkLabel={linkLabel} detail={detail} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Wraps a widget so a click on empty space (or the small button) opens its summary. Links and buttons inside the widget keep working normally. */
export function Drill({ title, href, linkLabel = "Open", detail, children }: { title: string; href: string; linkLabel?: string; detail: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="contents" onClick={(e) => { const t = e.target as HTMLElement; if (t.closest("a,button,input,select,textarea,label,[role=tab]") || t.closest(".wcell.editing")) return; setOpen(true); }}>
      {children}
      <button type="button" className="wdg-more" aria-label={`${title}: more detail`} aria-haspopup="dialog" onClick={() => setOpen(true)}><ArrowUpRight size={15} aria-hidden /></button>
      {open && <Panel title={title} href={href} linkLabel={linkLabel} detail={detail} onClose={() => setOpen(false)} />}
    </div>
  );
}
