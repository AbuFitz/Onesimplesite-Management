"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="evt-b" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* the link is shown to select */ } }}>{done ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {done ? "Copied" : label}</button>;
}
