"use client";
import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";

/** Copy, share sheet on phones, WhatsApp and email: the ways people actually pass a link on. */
export function ShareLink({ url, from }: { url: string; from: string }) {
  const [done, setDone] = useState(false);
  const text = `${from} recommends OneSimpleSite for your website. This link gets you a thank-you credit:`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* the link is also shown to select by hand */ } };
  return (
    <div>
      <p className="break-all rounded-xl bg-white/70 px-4 py-3 font-mono text-[14px] select-all" aria-label="Your referral link">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-dark" onClick={copy}>{done ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}{done ? "Copied" : "Copy link"}</button>
        {typeof navigator !== "undefined" && "share" in navigator && <button type="button" className="btn btn-quiet" onClick={() => navigator.share({ title: "OneSimpleSite", text, url }).catch(() => {})}><Share2 size={17} aria-hidden />Share</button>}
        <a className="btn btn-quiet" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden />WhatsApp</a>
        <a className="btn btn-quiet" href={`mailto:?subject=${encodeURIComponent("A website person I recommend")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}><Mail size={17} aria-hidden />Email</a>
      </div>
    </div>
  );
}
