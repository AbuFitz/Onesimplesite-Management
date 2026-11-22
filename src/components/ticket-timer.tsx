"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const fmt = (ms: number) => { const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24); return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };
/** How long the customer has been waiting for us, counting up. It turns amber at half the time we promise and red once it is over. */
export function WaitTimer({ since, limitHours }: { since: string; limitHours: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") setNow(Date.now()); }, 30_000); return () => window.clearInterval(id); }, []);
  const ms = Math.max(0, now - +new Date(since)), limit = limitHours * 3600e3;
  const tone = ms >= limit ? "bad" : ms >= limit / 2 ? "warn" : "ok";
  return <span className={`tk-timer ${tone}`} role="timer" aria-label={`Waiting ${fmt(ms)}`}><Clock size={13} aria-hidden /> Waiting {fmt(ms)}{tone === "bad" && " · overdue"}</span>;
}
