import { db } from "@/lib/db";
import { payables } from "@/modules/referrals/service";
import type { AccountItem } from "@/components/account-nav";

/** The sections of Referrals, with a short status on each so the hub says what needs attention without opening anything. */
export async function referralItems(workspaceId: string, owner: boolean): Promise<AccountItem[]> {
  const [review, partners, owing] = await Promise.all([db.referral.count({ where: { workspaceId, status: "review" } }), db.partner.count({ where: { workspaceId, active: true } }), payables(workspaceId)]);
  const owed = owing.filter((o) => o.owedMinor > 0).length;
  return [
    { href: "/referrals/activity", label: "Activity", note: "Everyone who has been sent to us", icon: "activity", tint: "#4a6024", status: review ? `${review} to review` : undefined },
    { href: "/referrals/customers", label: "Customers", note: "Their links and their own deals", icon: "customers", tint: "#3b6ea5" },
    { href: "/referrals/partners", label: "Partners", note: "Agencies, individuals and the team", icon: "partners", tint: "#7a5bb5", status: partners ? String(partners) : undefined },
    { href: "/referrals/payouts", label: "Payouts", note: "Who is owed, and what has been paid", icon: "payouts", tint: "#b7791f", status: owed ? `${owed} owed` : undefined },
    { href: "/referrals/mine", label: "My referrals", note: "Your own link", icon: "referrals", tint: "#2f7a4e" },
    ...(owner ? [{ href: "/referrals/rules", label: "Rules", note: "What is earned, and when", icon: "rules" as const, tint: "#5b6068" }] : []),
  ];
}
