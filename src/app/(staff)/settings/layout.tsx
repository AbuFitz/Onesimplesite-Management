import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { SettingsFrame, type SettingsKey } from "@/components/settings-nav";

/** Every settings page shares one frame (see SettingsFrame). Only the sections this person is allowed to use are listed. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff();
  const show: SettingsKey[] = ["account", ...(can(ctx.role, "settings.write") ? (["company", "plans", "legal", "emails", "notifications", "security"] as SettingsKey[]) : []), ...(can(ctx.role, "staff.manage") ? (["team"] as SettingsKey[]) : []), ...(can(ctx.role, "data.export") ? (["backup"] as SettingsKey[]) : [])];
  return <SettingsFrame show={show}>{children}</SettingsFrame>;
}
