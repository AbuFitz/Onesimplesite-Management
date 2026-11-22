"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** A scrolling area that opens at the newest message, and follows new ones. */
export function ScrollEnd({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; });
  return <div ref={ref} className={className}>{children}</div>;
}
