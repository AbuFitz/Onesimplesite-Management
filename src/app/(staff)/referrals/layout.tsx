import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { AccountFrame } from "@/components/account-nav";
import { referralItems } from "./items";

export default async function ReferralsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff("customer.read");
  return <AccountFrame base="/referrals" title="Referrals" items={await referralItems(ctx.workspaceId, can(ctx.role, "settings.write"))}>{children}</AccountFrame>;
}
