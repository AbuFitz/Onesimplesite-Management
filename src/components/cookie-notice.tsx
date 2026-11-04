"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const KEY = "oss-cookie-notice";

/**
 * A short, friendly cookie notice for customers. We only use cookies the portal needs to work (staying signed in, keeping you safe),
 * which the law doesn't need consent for, so this informs rather than asks. It remembers "Got it" on this device.
 */
export function CookieNotice({ aboveTabs = false }: { aboveTabs?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setShow(true); } catch { setShow(true); } }, []);
  if (!show) return null;
  const ok = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private window: it just shows again next time */ } setShow(false); };
  return (
    <div role="dialog" aria-label="Cookies" aria-live="polite" className={`fixed inset-x-3 z-50 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] ${aboveTabs ? "bottom-[5.5rem]" : "bottom-3"}`}>
      <div className={`rounded-2xl border border-line bg-white shadow-[0_12px_40px_rgba(14,19,17,.18)] p-4`}>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-butter"><Cookie size={20} aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-bold">Just the cookies we need</p>
            <p className="mt-1 text-sm text-muted">We use cookies to keep you signed in and to recognise your devices so we can warn you about unfamiliar sign-ins. Nothing for tracking or adverts.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Link href="/legal/cookies" className="btn btn-quiet !min-h-11 sm:!min-h-9">Cookie notice</Link>
          <button type="button" onClick={ok} className="btn btn-dark !min-h-11 sm:!min-h-9">Got it</button>
        </div>
      </div>
    </div>
  );
}
