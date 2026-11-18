import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getCompany, companyMissing } from "@/modules/settings/service";
import { SettingsHub, type SettingsKey } from "@/components/settings-nav";

export const metadata = { title: "Settings" };
export default async function Settings() {
  const ctx = await requireStaff("settings.write");
  const c = await getCompany(ctx);
  const show: SettingsKey[] = ["account", "company", "plans", "legal", "emails", "notifications", "security", ...(can(ctx.role, "staff.manage") ? (["team"] as SettingsKey[]) : []), ...(can(ctx.role, "data.export") ? (["backup"] as SettingsKey[]) : [])];
  return <SettingsHub show={show} company={{ name: c.legalName || "Your company", missing: companyMissing(c) }} />;
}
