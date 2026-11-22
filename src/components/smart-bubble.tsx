"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight, ChevronRight } from "lucide-react";

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
  const [mode, setMode] = useState<"peek" | "card" | "closed">("closed");
  const [n, setN] = useState(0);
  const [later, setLater] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { const r = await fetch("/api/suggestions", { cache: "no-store" }); if (r.ok) setItems((await r.json()).suggestions); } catch { /* offline: keep what we have */ }
  }, []);
  useEffect(() => { setLater(read()); load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60_000); const f = () => document.visibilityState === "visible" && load(); document.addEventListener("visibilitychange", f); return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); }; }, [load]);

  const visible = items.filter((i) => later[i.id] !== today());
  const top = visible[0];
  const cur = visible[Math.min(n, visible.length - 1)];
  // Once per browser session, when something needs attention, a one-line pill slides in, then tucks itself away after a few seconds. Tips stay quiet.
  useEffect(() => {
    if (!top || top.level === "tip") return;
    let seen = false; try { seen = !!sessionStorage.getItem("oss-smart-peeked"); sessionStorage.setItem("oss-smart-peeked", "1"); } catch { /* ignore */ }
    if (seen) return;
    setMode("peek"); const t = setTimeout(() => setMode((m) => (m === "peek" ? "closed" : m)), 7000); return () => clearTimeout(t);
  }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const snooze = (id: string) => { const next = { ...later, [id]: today() }; setLater(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ } setN(0); if (visible.length <= 1) setMode("closed"); };
  if (!visible.length || !cur) return null;

  return (
    <div className="sb" role="region" aria-label="Suggestions">
      {mode === "peek" && (
        <button type="button" className="sb-peek" onClick={() => setMode("card")} aria-label={`Suggestion: ${cur.title}. Open`}>
          <i style={{ background: DOT[cur.level] }} aria-hidden /><span>{cur.title}</span><ArrowRight size={14} aria-hidden />
        </button>
      )}
      {mode === "card" && (
        <div className="pop sb-card" aria-live="polite">
          <div className="sb-top">
            <span className="sb-dot" style={{ background: DOT[cur.level] }} aria-hidden />
            <span className="sb-count">{visible.length > 1 ? `${Math.min(n, visible.length - 1) + 1} of ${visible.length}` : "Worth a look"}</span>
            {visible.length > 1 && <button type="button" className="sb-nav" aria-label="Next suggestion" onClick={() => setN((x) => (x + 1) % visible.length)}><ChevronRight size={16} aria-hidden /></button>}
            <button type="button" className="sb-nav" aria-label="Hide suggestions" onClick={() => setMode("closed")}><X size={15} aria-hidden /></button>
          </div>
          <div key={cur.id} className="sb-body">
            <p className="sb-title">{cur.title}</p>
            <p className="sb-reason">{cur.reason}</p>
          </div>
          <div className="sb-act">
            <Link href={cur.action.href} onClick={() => setMode("closed")} className="sb-go">{cur.action.label} <ArrowRight size={14} aria-hidden /></Link>
            <button type="button" onClick={() => snooze(cur.id)} className="sb-later">Later</button>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setMode((m) => (m === "card" ? "closed" : "card"))} aria-label={`Suggestions: ${visible.length}`} aria-expanded={mode === "card"} className="sb-fab">
        <Sparkles size={19} aria-hidden />
        <b style={{ background: DOT[top?.level ?? "tip"] }}>{visible.length}</b>
      </button>
    </div>
  );
}
