"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, X } from "lucide-react";

const KEY = "oss-refer-hide";
/**
 * Refer is the most useful thing a customer can do for us, so it is the one thing that moves.
 * Computers: a button floating at the bottom right that pulses softly, with a speech bubble the first time in each visit.
 * Phones: a small floating card above the tab bar that slides in, bobs now and then, and can be closed (it stays away for a week).
 */
export function ReferCta({ amount }: { amount: string }) {
  const [tip, setTip] = useState(false);
  const [pill, setPill] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let t1 = 0, t2 = 0, t2b = 0;
    try {
      if (!sessionStorage.getItem("oss-refer-tip")) { sessionStorage.setItem("oss-refer-tip", "1"); t1 = window.setTimeout(() => setTip(true), 1800); t2 = window.setTimeout(() => setTip(false), 9000); }
      const hid = Number(localStorage.getItem(KEY)) || 0;
      // Wait until the cookie notice has been answered, so two cards never fight for the same spot.
      if (Date.now() - hid > 7 * 864e5) t2b = window.setInterval(() => { if (localStorage.getItem("oss-cookie-notice")) { window.clearInterval(t2b); setPill(true); } }, 1500);
    } catch { /* private window: just show the button */ }
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearInterval(t2b); };
  }, []);
  const hide = () => { setPill(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  return (
    <>
      {mounted && createPortal(
        <div className="rf-wrap">
          {tip && <div className="rf-tip" role="status"><button type="button" aria-label="Close" onClick={() => setTip(false)}><X size={14} aria-hidden /></button><b>Earn {amount}</b><span>for every business you send us.</span><Link href="/referrals" onClick={() => setTip(false)}>Get your link</Link></div>}
          <Link href="/referrals" className="rf-btn" aria-label={`Refer a friend, earn ${amount}`} onClick={() => setTip(false)}><i aria-hidden /><Gift size={20} aria-hidden /><span>Refer &amp; earn {amount}</span></Link>
        </div>, document.body)}
      {pill && createPortal(
        <div className="rf-pill" role="complementary" aria-label="Refer a friend">
          <Link href="/referrals"><span className="rf-gift" aria-hidden><Gift size={20} /></span><span><b>Earn {amount}</b><small>Refer a friend</small></span></Link>
          <button type="button" aria-label="Hide for a week" onClick={hide}><X size={16} aria-hidden /></button>
        </div>, document.body)}
    </>
  );
}
