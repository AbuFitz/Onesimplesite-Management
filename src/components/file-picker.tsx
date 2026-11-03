"use client";
import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

const MAX_FILES = 4, MAX_TOTAL = 4_000_000, MAX_EDGE = 1600;

/** Shrinks big photos and screenshots in the browser so they upload quickly and fit the size limit. */
async function shrink(f: File): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size < 300_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch { return f; }
}
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** Add pictures or a PDF. Works with a normal form: the files are sent as `files`. */
export function FilePicker({ label = "Add pictures or a PDF", hint }: { label?: string; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState("");
  const sync = (next: File[]) => { const dt = new DataTransfer(); next.forEach((f) => dt.items.add(f)); input.current!.files = dt.files; setFiles(next); };

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = await Promise.all(Array.from(e.target.files ?? []).map(shrink));
    const next = [...files, ...picked].slice(0, MAX_FILES);
    setMsg(files.length + picked.length > MAX_FILES ? `Only ${MAX_FILES} files at a time.` : "");
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) { setMsg("Those are too big together. Try fewer or smaller files."); sync(files); return; }
    sync(next);
  }
  return (
    <div>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-bone px-4 font-semibold hover:bg-[#e6e2d8] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
        <Paperclip size={17} aria-hidden /> {label}
        <input ref={input} onChange={onPick} type="file" name="files" multiple accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className="sr-only" />
      </label>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {msg && <p role="alert" className="mt-1 text-sm font-semibold text-[#7a2e12]">{msg}</p>}
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Files to send">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              <span className="max-w-40 truncate">{f.name}</span><span className="text-muted">{kb(f.size)}</span>
              <button type="button" onClick={() => sync(files.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full hover:bg-bone" aria-label={`Remove ${f.name}`}><X size={14} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Thumbnails and file chips for a list of attachments. */
export function Files({ items, base }: { items: { id: string; filename: string; contentType: string; internal?: boolean }[]; base: string }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => a.contentType.startsWith("image/") ? (
        <li key={a.id}><a href={`${base}/${a.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-bone" title={a.filename}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/${a.id}`} alt={a.filename} loading="lazy" className="h-28 w-auto max-w-56 object-cover" />
          {a.internal && <span className="block bg-ink px-2 py-0.5 text-xs font-semibold text-white">Only we see this</span>}
        </a></li>
      ) : (
        <li key={a.id}><a href={`${base}/${a.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-bone px-4 text-sm font-semibold hover:bg-[#e6e2d8]"><Paperclip size={15} aria-hidden />{a.filename}{a.internal && <span className="text-muted">(only we see this)</span>}</a></li>
      ))}
    </ul>
  );
}
