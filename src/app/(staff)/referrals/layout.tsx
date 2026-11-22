import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { ReferralNav } from "@/components/referral-nav";

export default async function ReferralsLayout({ children }: { children: ReactNode }) {
  await requireStaff("customer.read");
  return <><h1 className="sr-only">Referrals</h1><ReferralNav />{children}</>;
}
