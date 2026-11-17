"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "oss-cookie-notice";

/**
 * A short cookie notice for customers. We only use cookies the portal needs to work (staying signed in, keeping you safe),
 * which the law doesn't need consent for, so this informs rather than asks. It remembers "Got it" on this device.
 */
export function CookieNotice({ aboveTabs = false }: { aboveTabs?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setShow(true); } catch { setShow(true); } }, []);
  if (!show) return null;
  const ok = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private window: it just shows again next time */ } setShow(false); };
  return (
    <div role="dialog" aria-label="Cookies" aria-live="polite" className={`cookie ${aboveTabs ? "cookie-up" : ""}`}>
      <p><b>Only the cookies we need.</b> They keep you signed in and safe. Nothing for tracking or adverts. <Link href="/legal/cookies">Read more</Link></p>
      <button type="button" onClick={ok}>Got it</button>
    </div>
  );
}
