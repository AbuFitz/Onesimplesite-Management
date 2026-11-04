"use client";
import { useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page current without anyone pressing refresh. It is deliberately gentle so the app never feels laggy:
 * - refreshes at most every `seconds` (never faster than 20), one at a time, and never while the tab is hidden or offline;
 * - skips a refresh while someone is typing or a picture/dialog is open, so nothing is interrupted;
 * - after coming back to a tab that was away for a while, refreshes once a moment later (after the page has painted), not in the middle of the switch.
 * Client state (open panels, typed text) is preserved by router.refresh().
 */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const busy = useRef(false);
  useEffect(() => {
    const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) || a.isContentEditable); };
    const run = () => {
      if (busy.current || document.visibilityState !== "visible" || !navigator.onLine || typing() || document.querySelector("dialog[open]")) return;
      busy.current = true;
      startTransition(() => router.refresh());
      window.setTimeout(() => { busy.current = false; }, 2000);
    };
    let hiddenAt = 0, pending = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); window.clearTimeout(pending); return; }
      if (hiddenAt && Date.now() - hiddenAt > 30_000) pending = window.setTimeout(run, 600);
    };
    const id = window.setInterval(run, Math.max(seconds, 20) * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", run);
    return () => { window.clearInterval(id); window.clearTimeout(pending); document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("online", run); };
  }, [router, seconds]);
  return null;
}
