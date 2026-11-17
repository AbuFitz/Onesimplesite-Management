"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A bottom sheet: it rises from the bottom over a blurred backdrop, follows your finger when you drag the grabber down, and closes when you
 * drag it far enough, tap outside, or press Escape. On desktop it is a centred card. Focus moves into it and returns afterwards.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="sheet" style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: drag.current ? "none" : undefined }}>
        <div className="sheet-grab" aria-hidden
          onPointerDown={(e) => { drag.current = { y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)); }}
          onPointerUp={() => { const far = dy > 90; drag.current = null; setDy(0); if (far) onClose(); }}
          onPointerCancel={() => { drag.current = null; setDy(0); }}><i /></div>
        <h2 className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
