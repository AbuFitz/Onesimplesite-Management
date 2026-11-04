import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/settings-nav";

/** Every settings page shares one frame: a grouped menu on the left, the section on the right. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
      <aside><p className="mb-3 hidden px-3 text-2xl font-bold tracking-tight lg:block" style={{ fontFamily: "var(--font-display)" }}>Settings</p><SettingsSidebar /></aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
