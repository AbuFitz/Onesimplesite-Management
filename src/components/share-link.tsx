"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Mail, MessageCircle, QrCode, Share2, X as XIcon } from "lucide-react";
import { StyledQr } from "./styled-qr";
import { Sheet } from "./sheet";

const enc = encodeURIComponent;
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
        <a href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={20} aria-hidden /></a>
        <a href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="X"><XIcon size={20} aria-hidden /></a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><span className="shr-in" aria-hidden>in</span></a>
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
