"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Days = 7 | 30 | 90;
const Ctx = createContext<{ days: Days; set: (d: Days) => void }>({ days: 30, set: () => {} });

/** Each widget owns its own time range. Choosing 7 days on one never moves another. The choice is remembered per widget on this device. */
export function RangeProvider({ id, children }: { id: string; children: ReactNode }) {
  const [days, setDays] = useState<Days>(30);
  useEffect(() => { try { const v = Number(localStorage.getItem(`oss-range:${id}`)); if (v === 7 || v === 30 || v === 90) setDays(v); } catch { /* private window */ } }, [id]);
  const set = (d: Days) => { setDays(d); try { localStorage.setItem(`oss-range:${id}`, String(d)); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ days, set }}>{children}</Ctx.Provider>;
}

/** The 7d / 30d / 90d switch for the widget it sits in. Instant, no page load. */
export function RangeSwitch() {
  const { days, set } = useContext(Ctx);
  return (
    <div className="wdg-range" role="group" aria-label="Time range">
      {([7, 30, 90] as const).map((d) => <button key={d} type="button" aria-pressed={days === d} aria-current={days === d ? "true" : undefined} onClick={() => set(d)}>{d}d</button>)}
    </div>
  );
}

/** Shows the version of the widget's content that matches its own range. */
export function ByRange({ views }: { views: Record<Days, ReactNode> }) {
  const { days } = useContext(Ctx);
  return <div key={days} className="wdg-swap">{views[days]}</div>;
}
