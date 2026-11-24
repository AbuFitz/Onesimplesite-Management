"use client";
import { useOptimistic, useState, useTransition } from "react";
import { SmilePlus } from "lucide-react";
import { reactAction } from "@/app/actions/board";

const SET = ["👍", "❤️", "🎉", "👀", "✅"];
export type Reaction = { emoji: string; count: number; mine: boolean };

/** Emoji under a topic or a reply. Tap one to add yours, tap it again to take it back. */
export function ReactionBar({ noteId, targetType, targetId, initial, canReact }: { noteId: string; targetType: "note" | "comment"; targetId: string; initial: Reaction[]; canReact: boolean }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const [list, flip] = useOptimistic(initial, (cur, emoji: string) => {
    const have = cur.find((r) => r.emoji === emoji);
    if (!have) return [...cur, { emoji, count: 1, mine: true }];
    const next = cur.map((r) => (r.emoji === emoji ? { ...r, count: r.count + (r.mine ? -1 : 1), mine: !r.mine } : r));
    return next.filter((r) => r.count > 0);
  });
  const tap = (emoji: string) => { setOpen(false); start(async () => { flip(emoji); await reactAction(noteId, targetType, targetId, emoji); }); };
  if (!canReact && list.length === 0) return null;
  return (
    <div className="rx" role="group" aria-label="Reactions">
      {list.map((r) => <button key={r.emoji} type="button" className={`rx-pill ${r.mine ? "on" : ""}`} disabled={!canReact} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}`} onClick={() => tap(r.emoji)}><span aria-hidden>{r.emoji}</span>{r.count}</button>)}
      {canReact && (
        <span className="rx-add">
          <button type="button" className="rx-pill rx-plus" aria-label="Add a reaction" aria-expanded={open} onClick={() => setOpen((o) => !o)}><SmilePlus size={16} aria-hidden /></button>
          {open && <span className="rx-menu" role="menu">{SET.map((e) => <button key={e} type="button" role="menuitem" onClick={() => tap(e)}>{e}</button>)}</span>}
        </span>
      )}
    </div>
  );
}
