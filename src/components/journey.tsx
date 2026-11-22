"use client";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export type JourneyStep = { key: string; label: string; state: "done" | "cur" | "todo"; date?: string };

/**
 * The project's route from start to live. Finished steps are ticked, the current one glows, and each shows the day it was reached.
 * On a phone it scrolls sideways with the current step already in the middle; on a computer it spreads across the card.
 */
export function Journey({ steps }: { steps: JourneyStep[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current, c = el?.querySelector<HTMLElement>("[aria-current=step]");
    if (el && c) el.scrollTo({ left: c.offsetLeft - el.clientWidth / 2 + c.clientWidth / 2, behavior: "instant" as ScrollBehavior });
  }, []);
  const cur = Math.max(0, steps.findIndex((s) => s.state === "cur"));
  return (
    <ol ref={ref} className="jny" aria-label="Project journey" style={{ "--n": steps.length, "--c": cur } as React.CSSProperties}>
      {steps.map((s, i) => (
        <li key={s.key} className={s.state} aria-current={s.state === "cur" ? "step" : undefined}>
          <span className="jny-dot" aria-hidden>{s.state === "done" ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
          <span className="jny-l">{s.label}</span>
          <span className="jny-d">{s.date ?? (s.state === "cur" ? "Now" : "")}</span>
        </li>
      ))}
    </ol>
  );
}
