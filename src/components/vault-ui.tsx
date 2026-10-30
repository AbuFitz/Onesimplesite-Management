"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Copy, Check, Pencil, Trash2, Dices, ExternalLink } from "lucide-react";
import { saveVaultAction, deleteVaultAction, revealVaultAction } from "@/app/actions/vault";
import { ErrorSummary, Avatar, timeAgo } from "./ui";

export type VaultRow = { id: string; title: string; category: string; username: string | null; url: string | null; notes: string | null; updatedBy: string; updatedAt: string };

const CATS = ["general", "website", "email", "hosting", "social", "finance", "software"];

function generate(len = 20) {
  const set = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_!?";
  const a = new Uint32Array(len); crypto.getRandomValues(a);
  return Array.from(a, (n) => set[n % set.length]).join("");
}

export function VaultForm({ row, onDone }: { row?: VaultRow; onDone?: () => void }) {
  const [s, act, pending] = useActionState(saveVaultAction, undefined as { error?: string; done?: boolean } | undefined);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.done) { form.current?.reset(); setPw(""); onDone?.(); } }, [s, onDone]);
  return (
    <form ref={form} action={act} className="space-y-3">
      <ErrorSummary message={s?.error} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`t-${row?.id ?? "new"}`}>Name</label><input id={`t-${row?.id ?? "new"}`} name="title" className="field" defaultValue={row?.title} placeholder="e.g. Namecheap" required /></div>
        <div><label className="label" htmlFor={`c-${row?.id ?? "new"}`}>Type</label>
          <select id={`c-${row?.id ?? "new"}`} name="category" className="field" defaultValue={row?.category ?? "general"}>{CATS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></div>
        <div><label className="label" htmlFor={`u-${row?.id ?? "new"}`}>Username or email</label><input id={`u-${row?.id ?? "new"}`} name="username" className="field" defaultValue={row?.username ?? ""} autoComplete="off" autoCapitalize="none" /></div>
        <div><label className="label" htmlFor={`l-${row?.id ?? "new"}`}>Website</label><input id={`l-${row?.id ?? "new"}`} name="url" className="field" defaultValue={row?.url ?? ""} placeholder="https://" autoComplete="off" /></div>
      </div>
      <div>
        <label className="label" htmlFor={`p-${row?.id ?? "new"}`}>Password</label>
        <div className="flex gap-2">
          <input id={`p-${row?.id ?? "new"}`} name="secret" type={show ? "text" : "password"} className="field font-mono" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder={row ? "Leave blank to keep the current password" : ""} required={!row} />
          <button type="button" className="btn btn-quiet px-3" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button type="button" className="btn btn-quiet px-3" aria-label="Generate a strong password" title="Generate" onClick={() => { setPw(generate()); setShow(true); }}><Dices size={16} /></button>
        </div>
      </div>
      <div><label className="label" htmlFor={`n-${row?.id ?? "new"}`}>Notes</label><textarea id={`n-${row?.id ?? "new"}`} name="notes" rows={2} className="field" defaultValue={row?.notes ?? ""} placeholder="Security questions, which plan, who to contact" /></div>
      <button className="btn" disabled={pending}>{pending ? "Saving…" : row ? "Save changes" : "Add to vault"}</button>
    </form>
  );
}

export function VaultItem({ row }: { row: VaultRow }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hideLater = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setSecret(null), 30_000); };
  async function fetchSecret() {
    const r = await revealVaultAction(row.id);
    if (r.error) { setErr(r.error); return null; }
    setErr(null);
    return r.secret ?? null;
  }
  async function toggle() {
    if (secret) { setSecret(null); return; }
    const s = await fetchSecret(); if (s) { setSecret(s); hideLater(); }
  }
  async function copy(what: "password" | "username") {
    const v = what === "username" ? row.username : (secret ?? (await fetchSecret()));
    if (!v) return;
    await navigator.clipboard.writeText(v);
    setCopied(what); window.setTimeout(() => setCopied(null), 1800);
  }
  const safeUrl = row.url && /^https?:\/\//i.test(row.url) ? row.url : null;

  return (
    <li className="row py-4">
      <div className="flex items-start gap-3">
        <Avatar name={row.title} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="font-semibold break-words">{row.title}</p>
            <span className="pill pill-neutral">{row.category}</span>
          </div>
          {row.username && (
            <p className="text-sm text-muted break-all">
              {row.username}{" "}
              <button type="button" className="underline" onClick={() => copy("username")}>{copied === "username" ? "Copied" : "Copy"}</button>
            </p>
          )}
          {safeUrl && <a className="inline-flex items-center gap-1 text-sm text-moss underline break-all" href={safeUrl} target="_blank" rel="noopener noreferrer">{row.url}<ExternalLink size={12} aria-hidden /></a>}
          {row.notes && <p className="mt-1 text-sm text-muted whitespace-pre-wrap break-words">{row.notes}</p>}
          {secret && <p className="mt-2 select-all rounded-lg bg-soft px-3 py-2 font-mono text-sm break-all" role="status">{secret}</p>}
          {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
          <p className="mt-1 text-xs text-muted">Updated {timeAgo(new Date(row.updatedAt))} by {row.updatedBy}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <button type="button" className="btn btn-quiet px-3" onClick={toggle} aria-label={secret ? `Hide password for ${row.title}` : `Show password for ${row.title}`}>{secret ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button type="button" className="btn btn-quiet px-3" onClick={() => copy("password")} aria-label={`Copy password for ${row.title}`}>{copied === "password" ? <Check size={16} /> : <Copy size={16} />}</button>
          <button type="button" className="btn btn-quiet px-3" onClick={() => setEdit(!edit)} aria-label={`Edit ${row.title}`}><Pencil size={16} /></button>
        </div>
      </div>
      {edit && (
        <div className="mt-4 rounded-xl border border-line p-4">
          <VaultForm row={row} onDone={() => setEdit(false)} />
          <form action={deleteVaultAction} className="mt-3" onSubmit={(e) => { if (!confirm(`Delete ${row.title}? This can't be undone.`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={row.id} />
            <button className="inline-flex items-center gap-1.5 text-sm text-danger underline"><Trash2 size={14} aria-hidden />Delete this login</button>
          </form>
        </div>
      )}
    </li>
  );
}
