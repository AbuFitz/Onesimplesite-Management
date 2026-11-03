"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight, ChevronDown } from "lucide-react";

type S = { id: string; level: "urgent" | "high" | "normal" | "tip"; title: string; reason: string; action: { label: string; href: string } };
const KEY = "oss-smart-later";
const today = () => new Date().toISOString().slice(0, 10);
const DOT = { urgent: "#dc4c3e", high: "#d99a06", normal: "#0c6a49", tip: "#8b8b95" } as const;
const read = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };

/**
 * A quiet helper at the bottom right. It watches what's happening (waiting customers, unsigned agreements, payments, deadlines) and
 * points out what to do next, with the reason, and a button that goes straight there. "Later" hides one until tomorrow.
 */
export function SmartBubble() {
  const [items, setItems] = useState<S[]>([]);
  const [mode, setMode] = useState<"peek" | "list" | "closed">("closed");
  const [later, setLater] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { const r = await fetch("/api/suggestions", { cache: "no-store" }); if (r.ok) setItems((await r.json()).suggestions); } catch { /* offline: keep what we have */ }
  }, []);
  useEffect(() => { setLater(read()); load(); const t = setInterval(load, 3 * 60_000); const f = () => document.visibilityState === "visible" && load(); document.addEventListener("visibilitychange", f); return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); }; }, [load]);

  const visible = items.filter((i) => later[i.id] !== today());
  const top = visible[0];
  // Pop up once per browser session when something needs attention. Tips stay quiet behind the button.
  useEffect(() => { if (top && top.level !== "tip") { try { if (!sessionStorage.getItem("oss-smart-peeked")) { sessionStorage.setItem("oss-smart-peeked", "1"); setMode("peek"); } } catch { setMode("peek"); } } }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const snooze = (id: string) => { const next = { ...later, [id]: today() }; setLater(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ } if (visible.length <= 1) setMode("closed"); };
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-[4.75rem] right-3 z-40 flex w-[min(23rem,calc(100vw-1.5rem))] flex-col items-end gap-2 lg:bottom-14 lg:right-4" role="region" aria-label="Suggestions">
      {mode !== "closed" && (
        <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-line bg-white shadow-[0_16px_50px_rgba(14,19,17,.22)]" aria-live="polite">
          <div className="flex items-center justify-between border-b border-[var(--card-rule)] bg-[var(--card-head)] px-4 py-2.5">
            <p className="flex items-center gap-2 text-[13.5px] font-bold"><Sparkles size={15} aria-hidden /> {mode === "peek" ? "Worth a look" : `${visible.length} ${visible.length === 1 ? "suggestion" : "suggestions"}`}</p>
            <div className="flex items-center gap-1">
              {mode === "peek" && visible.length > 1 && <button type="button" onClick={() => setMode("list")} className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-muted hover:bg-soft">+{visible.length - 1} more</button>}
              <button type="button" onClick={() => setMode("closed")} aria-label="Hide suggestions" className="grid size-7 place-items-center rounded-md text-muted hover:bg-soft">{mode === "list" ? <ChevronDown size={16} aria-hidden /> : <X size={15} aria-hidden />}</button>
            </div>
          </div>
          <ul className={`divide-y divide-[var(--card-rule)] ${mode === "list" ? "max-h-[min(26rem,60dvh)] overflow-y-auto" : ""}`}>
            {(mode === "peek" ? visible.slice(0, 1) : visible).map((i) => (
              <li key={i.id} className="p-4">
                <p className="flex items-start gap-2 text-[14.5px] font-bold leading-snug"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: DOT[i.level] }} aria-hidden />{i.title}</p>
                <p className="mt-1 pl-4 text-[13px] leading-relaxed text-ink/70">{i.reason}</p>
                <div className="mt-3 flex items-center gap-2 pl-4">
                  <Link href={i.action.href} onClick={() => setMode("closed")} className="btn !min-h-10 sm:!min-h-8 text-[13px]">{i.action.label} <ArrowRight size={13} aria-hidden /></Link>
                  <button type="button" onClick={() => snooze(i.id)} className="btn btn-quiet !min-h-10 sm:!min-h-8 text-[13px]">Later</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={() => setMode((m) => (m === "closed" ? (visible.length > 1 ? "list" : "peek") : "closed"))} aria-label={`Suggestions: ${visible.length}`} aria-expanded={mode !== "closed"}
        className="pointer-events-auto relative grid size-12 place-items-center rounded-full bg-ink text-white shadow-[0_8px_24px_rgba(14,19,17,.3)] transition-transform hover:scale-105">
        <Sparkles size={20} aria-hidden />
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-white px-1 text-[11px] font-bold text-white" style={{ background: DOT[top?.level ?? "tip"] }}>{visible.length}</span>
      </button>
    </div>
  );
}
