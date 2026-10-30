"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bold, CheckSquare, Heading2, List, Minus, Quote, Lock, Users } from "lucide-react";
import { autosaveNoteAction } from "@/app/actions/notes";
import { NoteView } from "./note-view";

type Status = "saved" | "saving" | "unsaved" | "error" | "conflict";
type Vis = "team" | "private";

/** A page that saves itself. Write in plain text with shortcuts (# heading, - list, - [ ] to-do), read it formatted. */
export function NoteEditor({ id, initial, mine, canWrite }: { id: string; initial: { title: string; body: string; version: number; visibility: Vis }; mine: boolean; canWrite: boolean }) {
  const [title, setTitle] = useState(initial.title === "Untitled" ? "" : initial.title);
  const [body, setBody] = useState(initial.body);
  const [vis, setVis] = useState<Vis>(initial.visibility);
  const [mode, setMode] = useState<"write" | "read">(initial.body.trim() || !canWrite ? "read" : "write");
  const [status, setStatus] = useState<Status>("saved");
  const [msg, setMsg] = useState("");
  const version = useRef(initial.version);
  const latest = useRef({ title, body, vis });
  const saving = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const area = useRef<HTMLTextAreaElement>(null);
  latest.current = { title, body, vis };

  const flush = useCallback(async () => {
    if (saving.current) return; // the running save re-checks `dirty` when it finishes
    saving.current = true;
    while (dirty.current) {
      dirty.current = false;
      setStatus("saving");
      const { title: t, body: b, vis: v } = latest.current;
      const r = await autosaveNoteAction(id, version.current, { title: t, body: b, visibility: v }).catch(() => ({ error: "No connection. Your text is still here." }));
      if ("version" in r) { version.current = r.version; if (!dirty.current) setStatus("saved"); }
      else if ("conflict" in r) { setStatus("conflict"); dirty.current = false; break; }
      else { setStatus("error"); setMsg(r.error); dirty.current = false; break; }
    }
    saving.current = false;
  }, [id]);

  const touch = useCallback(() => {
    if (!canWrite) return;
    dirty.current = true; setStatus("unsaved");
    window.clearTimeout(timer.current); timer.current = window.setTimeout(flush, 700);
  }, [canWrite, flush]);

  useEffect(() => { const a = area.current; if (a) { a.style.height = "auto"; a.style.height = `${a.scrollHeight}px`; } }, [body, mode]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || saving.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); window.clearTimeout(timer.current); if (dirty.current) void flush(); };
  }, [flush]);

  function lineEdit(fn: (line: string) => string) {
    const a = area.current; if (!a) return;
    const pos = a.selectionStart, start = body.lastIndexOf("\n", pos - 1) + 1, endRaw = body.indexOf("\n", pos), end = endRaw === -1 ? body.length : endRaw;
    const next = body.slice(0, start) + fn(body.slice(start, end)) + body.slice(end);
    setBody(next); touch();
    requestAnimationFrame(() => { a.focus(); });
  }
  const prefix = (p: string) => () => lineEdit((l) => (l.startsWith(p) ? l.slice(p.length) : p + l.replace(/^(#{1,3}\s|[-*]\s(\[[ xX]\]\s)?|>\s?)/, "")));
  function wrapBold() {
    const a = area.current; if (!a) return;
    const s = a.selectionStart, e = a.selectionEnd, sel = body.slice(s, e) || "bold";
    setBody(body.slice(0, s) + `**${sel}**` + body.slice(e)); touch(); requestAnimationFrame(() => a.focus());
  }
  function toggleLine(i: number) {
    const lines = body.split("\n");
    lines[i] = lines[i].replace(/\[( |x|X)\]/, (_, c) => (c === " " ? "[x]" : "[ ]"));
    setBody(lines.join("\n")); touch();
  }

  const label = { saved: "Saved", saving: "Saving…", unsaved: "Editing…", error: msg || "Not saved", conflict: "" }[status];
  const tool = "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink";

  return (
    <div className="mx-auto max-w-3xl">
      {status === "conflict" && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff6e5] px-4 py-3 text-sm text-warn">
          <span>Someone else changed this page. Reload to see their version. Your latest text is still on screen: copy it first if you need it.</span>
          <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-3 text-sm text-muted">
        <div className="flex items-center gap-2">
          {mine && canWrite ? (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-soft" onClick={() => { setVis(vis === "team" ? "private" : "team"); touch(); }} aria-label={`Visible to ${vis === "team" ? "the team" : "only you"}. Change`}>
              {vis === "team" ? <Users size={14} aria-hidden /> : <Lock size={14} aria-hidden />}{vis === "team" ? "Team" : "Only me"}
            </button>
          ) : <span className="inline-flex items-center gap-1.5 px-2">{vis === "team" ? <Users size={14} aria-hidden /> : <Lock size={14} aria-hidden />}{vis === "team" ? "Team" : "Private"}</span>}
          <span role="status" aria-live="polite" className={status === "error" ? "text-danger" : ""}>{label}</span>
        </div>
        {canWrite && (
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="View">
            <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={`rounded-md px-3 py-1 ${mode === "write" ? "bg-soft font-medium text-ink" : ""}`}>Write</button>
            <button type="button" aria-pressed={mode === "read"} onClick={() => setMode("read")} className={`rounded-md px-3 py-1 ${mode === "read" ? "bg-soft font-medium text-ink" : ""}`}>Read</button>
          </div>
        )}
      </div>

      <label className="sr-only" htmlFor="np-title">Page title</label>
      <input id="np-title" value={title} readOnly={!canWrite} placeholder="Untitled" onChange={(e) => { setTitle(e.target.value); touch(); }}
        className="w-full border-0 bg-transparent px-0 py-2 text-[2rem] font-bold leading-tight tracking-tight outline-none placeholder:text-[#8f9993] focus-visible:outline-none" />

      {mode === "write" && canWrite && (
        <div className="sticky top-14 z-10 -mx-1 mb-2 flex flex-wrap gap-0.5 border-b border-line bg-white/95 px-1 py-1 backdrop-blur" role="toolbar" aria-label="Formatting">
          <button type="button" className={tool} aria-label="Heading" onClick={prefix("## ")}><Heading2 size={17} /></button>
          <button type="button" className={tool} aria-label="Bold" onClick={wrapBold}><Bold size={17} /></button>
          <button type="button" className={tool} aria-label="Bulleted list" onClick={prefix("- ")}><List size={17} /></button>
          <button type="button" className={tool} aria-label="To-do" onClick={prefix("- [ ] ")}><CheckSquare size={17} /></button>
          <button type="button" className={tool} aria-label="Quote" onClick={prefix("> ")}><Quote size={17} /></button>
          <button type="button" className={tool} aria-label="Divider" onClick={() => { setBody(body + (body.endsWith("\n") || !body ? "" : "\n") + "---\n"); touch(); }}><Minus size={17} /></button>
        </div>
      )}

      {mode === "write" && canWrite ? (
        <>
          <label className="sr-only" htmlFor="np-body">Page text</label>
          <textarea id="np-body" ref={area} value={body} placeholder={"Start writing…\n\n# Heading   - list   - [ ] to-do   > quote"} spellCheck
            onChange={(e) => { setBody(e.target.value); touch(); }}
            className="min-h-[55dvh] w-full resize-none border-0 bg-transparent px-0 py-2 text-[16px] leading-relaxed outline-none placeholder:text-[#8f9993] focus-visible:outline-none" />
        </>
      ) : body.trim() ? <NoteView body={body} onToggle={canWrite ? toggleLine : undefined} /> : <p className="py-2 text-muted">Empty page.</p>}
    </div>
  );
}
