"use client";
import { useEffect } from "react";

/**
 * Makes the on-screen keyboard behave on phones.
 * - Publishes the visible area as CSS variables (--vvh height, --vvt offset from the top) and sets data-kb on <html> while a keyboard is up,
 *   so floating bars (menu, suggestions, cookie notice) step aside and popups resize to what is actually visible.
 * - Brings the field you tapped into view inside popups and sheets, after the keyboard has finished sliding up.
 * Nothing here runs on a computer: with no visual viewport change there is no keyboard.
 */
export function KeyboardAware() {
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vvt", `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty("--kb", `${Math.round(covered)}px`);
      // A keyboard is a big, sudden loss of height; ignore small changes like the browser bar collapsing.
      const open = window.innerHeight - vv.height > 140 && !!document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (open) root.setAttribute("data-kb", ""); else root.removeAttribute("data-kb");
    };
    const focus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if ((t as HTMLInputElement).type === "checkbox" || (t as HTMLInputElement).type === "radio") return;
      update();
      // Wait for the keyboard to finish sliding up, then keep the field clear of it.
      window.setTimeout(() => { update(); t.scrollIntoView({ block: "center", behavior: "smooth" }); }, 320);
    };
    const blur = () => window.setTimeout(update, 60);
    update();
    vv.addEventListener("resize", update); vv.addEventListener("scroll", update);
    document.addEventListener("focusin", focus); document.addEventListener("focusout", blur);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); document.removeEventListener("focusin", focus); document.removeEventListener("focusout", blur); root.removeAttribute("data-kb"); };
  }, []);
  return null;
}
