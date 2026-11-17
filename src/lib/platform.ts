"use client";
import { useEffect, useState } from "react";

/**
 * What kind of device this is, so keyboard hints match it: ⌘ on Apple computers, Ctrl on Windows and Linux, and no hints at all on touch devices.
 * Detected in the browser after load (the server cannot know), so nothing is shown until it is certain: no flash of the wrong key.
 */
export function usePlatform() {
  const [p, setP] = useState({ ready: false, apple: false, touch: false });
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const name = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
    const touch = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setP({ ready: true, apple: /mac|iphone|ipad|ipod/i.test(name) && !/windows|linux|android/i.test(name), touch });
  }, []);
  return p;
}

/** The key that opens search: ⌘K on Apple devices, Ctrl K elsewhere. */
export const searchKeyLabel = (apple: boolean) => (apple ? "⌘K" : "Ctrl K");
