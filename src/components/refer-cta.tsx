"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, X } from "lucide-react";

const KEY = "oss-refer-hide";
/**
 * Refer is the most useful thing a customer can do for us, so it is the one thing that moves.
 * Computers: a calm button floating at the bottom right. Hover it (or tab to it) and a small card says what you get and how it works.
 * Phones: a small floating card above the tab bar that slides in, bobs now and then, and can be closed (it stays away for a week).
 */
export function ReferCta({ amount, gift }: { amount: string; gift?: string }) {
  const [pill, setPill] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let t = 0;
    try { const hid = Number(localStorage.getItem(KEY)) || 0; if (Date.now() - hid > 7 * 864e5) t = window.setInterval(() => { if (localStorage.getItem("oss-cookie-notice")) { window.clearInterval(t); setPill(true); } }, 1500); } catch { /* private window: no card */ }
    return () => window.clearInterval(t);
  }, []);
  const hide = () => { setPill(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  return (
    <>
      {mounted && createPortal(
        <div className="rf-wrap">
          <div className="rf-pop" role="tooltip" id="rf-pop">
            <b>Earn {amount}</b><span>for every business you send us{gift ? `. They get ${gift}.` : "."}</span>
            <ol><li>Share your link</li><li>They sign up and pay</li><li>You get paid</li></ol>
          </div>
          <Link href="/referrals" className="rf-btn" aria-describedby="rf-pop"><Gift size={20} aria-hidden /><span>Refer &amp; earn {amount}</span></Link>
        </div>, document.body)}
      {pill && createPortal(
        <div className="rf-pill" role="complementary" aria-label="Refer a friend">
          <Link href="/referrals"><span className="rf-gift" aria-hidden><Gift size={20} /></span><span><b>Earn {amount}</b><small>Refer a friend</small></span></Link>
          <button type="button" aria-label="Hide for a week" onClick={hide}><X size={16} aria-hidden /></button>
        </div>, document.body)}
    </>
  );
}
