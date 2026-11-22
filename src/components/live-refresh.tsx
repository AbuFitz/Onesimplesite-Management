"use client";
import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page current without anyone pressing refresh, and costs as little as possible while doing it. Every refresh is a full
 * server render, so a tab left open all day used to add up to hundreds of thousands of requests. Now:
 * - ONE timer per tab, however many pages ask for one (the fastest request wins, never faster than 45 seconds);
 * - it stops after 3 minutes with no touch, key or scroll, and picks up again with a single refresh the moment someone is back;
 * - never while the tab is hidden or offline, while someone is typing, or while a dialog is open.
 * Client state (open panels, typed text) is preserved by router.refresh().
 */
const asks = new Set<number>();
let last = typeof window === "undefined" ? 0 : Date.now();
const IDLE_MS = 3 * 60_000;

export function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    asks.add(seconds);
    const mine = seconds;
    const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) || a.isContentEditable); };
    let busy = false, wasIdle = false, hiddenAt = 0, pending = 0;
    const fastest = () => Math.max(45, Math.min(...asks));
    const owner = () => fastest() === Math.max(45, mine) && Math.min(...asks) === mine; // only the fastest asker runs the timer
    const run = () => {
      if (busy || !owner() || document.visibilityState !== "visible" || !navigator.onLine || typing() || document.querySelector("dialog[open]")) return;
      if (Date.now() - last > IDLE_MS) { wasIdle = true; return; }
      busy = true; startTransition(() => router.refresh()); window.setTimeout(() => { busy = false; }, 2000);
    };
    const touch = () => { last = Date.now(); if (wasIdle) { wasIdle = false; window.clearTimeout(pending); pending = window.setTimeout(run, 400); } };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); window.clearTimeout(pending); return; }
      last = Date.now();
      if (hiddenAt && Date.now() - hiddenAt > 30_000) pending = window.setTimeout(run, 600);
    };
    const id = window.setInterval(run, fastest() * 1000);
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", run);
    return () => { asks.delete(seconds); window.clearInterval(id); window.clearTimeout(pending); evs.forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("online", run); };
  }, [router, seconds]);
  return null;
}
