"use client";
import { useEffect, useRef } from "react";

export type Stage = { key: string; label: string; state: "done" | "cur" | "todo" };

/** A project's stages as a row you can swipe on a phone (the current one is brought into view) and that spreads across the page on a computer. */
export function StageBar({ stages }: { stages: Stage[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { const c = ref.current?.querySelector<HTMLElement>("[aria-current=step]"); if (c && ref.current) ref.current.scrollTo({ left: c.offsetLeft - 16, behavior: "instant" as ScrollBehavior }); }, []);
  return (
    <ol ref={ref} className="stagebar" aria-label="Progress">
      {stages.map((s) => (
        <li key={s.key} className={s.state} aria-current={s.state === "cur" ? "step" : undefined}><i aria-hidden /><span>{s.label}</span></li>
      ))}
    </ol>
  );
}
