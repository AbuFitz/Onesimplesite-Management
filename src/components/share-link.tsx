"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Mail, QrCode, Share2 } from "lucide-react";
import { StyledQr } from "./styled-qr";
import { Sheet } from "./sheet";

const enc = encodeURIComponent;
/** Real brand marks (Simple Icons paths), not stand-ins. */
const Brand = ({ d, color }: { d: string; color?: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill={color ?? "currentColor"} aria-hidden><path d={d} /></svg>;
const X_D = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const WA_D = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const IN_D = "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
/** Every way people actually pass a link on: copy, the phone's share sheet, WhatsApp, X, LinkedIn, email, or a QR code to show in person. */
function Channels({ url, text }: { url: string; text: string }) {
  const [done, setDone] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* the link is also shown to select by hand */ } };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="shr">
      <div className="shr-url"><span>{url}</span><button type="button" onClick={copy} aria-label={done ? "Copied" : "Copy link"}>{done ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}</button></div>
      <div className="shr-ch" role="group" aria-label="Share with">
        <a href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Brand d={WA_D} color="#25D366" /></a>
        <a href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="X"><Brand d={X_D} /></a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><Brand d={IN_D} color="#0A66C2" /></a>
        <a href={`mailto:?subject=${enc("A website person I recommend")}&body=${enc(`${text}\n\n${url}`)}`} aria-label="Email"><Mail size={20} aria-hidden /></a>
        {canShare && <button type="button" aria-label="More ways to share" onClick={() => navigator.share({ title: "OneSimpleSite", text, url }).catch(() => {})}><Share2 size={20} aria-hidden /></button>}
        <button type="button" aria-label="Show QR code" aria-pressed={showQr} className={showQr ? "on" : ""} onClick={() => setShowQr((v) => !v)}><QrCode size={20} aria-hidden /></button>
      </div>
      {showQr && <div className="shr-qr"><StyledQr url={url} size={216} /></div>}
    </div>
  );
}

/** The share card, opened from a button: a bottom sheet on a phone, a centred card on a computer. */
export function ShareLink({ url, from, reward }: { url: string; from: string; reward?: string }) {
  const [open, setOpen] = useState(false);
  const text = `${from} recommends OneSimpleSite for your website.`;
  return (
    <>
      <div className="shr-inline"><Channels url={url} text={text} /></div>
      <button type="button" className="btn btn-dark shr-open" onClick={() => setOpen(true)}><Share2 size={17} aria-hidden /> Invite someone</button>
      {open && createPortal(
        <Sheet open onClose={() => setOpen(false)} title="Invite someone">
          <div className="shr-modal"><p className="shr-lead">{reward ?? "Send your link. We look after them."}</p><Channels url={url} text={text} /></div>
        </Sheet>, document.body)}
    </>
  );
}
