"use client";
import { useEffect, useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { announcementCountsAction, sendAnnouncementAction } from "@/app/actions/announce";
import { useConfirm } from "./confirm";

const CHOICES = [["team", "Team"], ["customers", "Customers"], ["everyone", "Everyone"]] as const;

/** The real send. Pick who, see how many people that is, confirm. Each person can only ever get this notice once. */
export function AnnounceSend({ kind = "rollout" }: { kind?: "rollout" | "update" }) {
  const [to, setTo] = useState<(typeof CHOICES)[number][0]>("everyone");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { ask, node } = useConfirm();
  useEffect(() => { announcementCountsAction().then(setCounts).catch(() => {}); }, []);
  const n = counts?.[to];
  return (
    <div className="mb-4 rounded-2xl border border-line bg-white p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold"><Megaphone size={17} aria-hidden />Send to people</p>
      <div className="rchips" role="radiogroup" aria-label="Who gets it">{CHOICES.map(([v, l]) => <label key={v} className="rchip"><input type="radio" name="aud" checked={to === v} onChange={() => setTo(v)} /><span>{l}{counts ? ` · ${counts[v]}` : ""}</span></label>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" disabled={pending || !n} onClick={async () => {
          if (!await ask(`This emails ${n} ${n === 1 ? "person" : "people"} now. Each person only ever gets it once. Send a test to hello@ first if you have not.`, { title: kind === "update" ? "Send what's changed?" : "Send the rollout notice?", confirmLabel: `Send to ${n}` })) return;
          start(async () => { const r = await sendAnnouncementAction(to, kind); setOut(r.ok ? `Queued for ${r.count}. They go out in the next minute or so.` : r.error); });
        }}>{pending ? "Sending…" : n ? `Send to ${n}` : "Send"}</button>
        {out && <p role="status" className="text-sm font-semibold">{out}</p>}
      </div>
      {node}
    </div>
  );
}
